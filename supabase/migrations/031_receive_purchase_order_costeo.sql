-- 031_receive_purchase_order_costeo.sql
-- Punto 2 del backlog (27 oct 2026): al recibir una orden de compra, se
-- actualiza el precio de Compra real del producto (y, por decisión de
-- Deisy, también el de Venta recalculado con el margen del producto), y
-- se guarda/actualiza el precio pagado a ESE proveedor en particular en
-- la tabla producto_proveedores (creada en la migración 030).
--
-- Esta migración re-crea receive_purchase_order() completa (misma técnica
-- que usó la migración 023: "se re-crea la función completa, solo
-- agregando..."), para no perder ningún comportamiento existente --
-- stock, factura de proveedor, movimiento de inventario y comprobante
-- contable automático quedan exactamente igual que antes. Lo único nuevo
-- está marcado con "-- NUEVO" más abajo.
--
-- Costo con IVA incluido: v_item.total (no v_item.unit_price) ya es el
-- valor total pagado por esa línea CON impuesto -- es justo el "costo
-- incluye IVA pagado" que ya estaba decidido en el plan de este backlog.
--
-- Método de costeo: se lee de companies.costing_method (migración 030).
-- Si el producto nunca tuvo precio_compra, o no tenía stock antes de esta
-- compra, el promedio ponderado no tiene nada que promediar -- en ese
-- caso se usa directo el costo de esta compra, en los dos métodos.

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_order         purchase_orders%ROWTYPE;
  v_item          purchase_order_items%ROWTYPE;
  v_inv_id        UUID;
  v_seq           INTEGER;
  v_number        TEXT;
  v_due           DATE;
  v_stock_before  NUMERIC;
  v_stock_after   NUMERIC;
  v_je_id         UUID;
  v_je_year       TEXT;
  v_je_seq        INTEGER;
  v_je_number     TEXT;
  -- NUEVO: costeo de inventario
  v_costing_method     TEXT;
  v_old_precio_compra  NUMERIC;
  v_margen             NUMERIC;
  v_unit_cost          NUMERIC;
  v_new_compra         NUMERIC;
  v_new_price          NUMERIC;
BEGIN
  SELECT * INTO v_order FROM purchase_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.company_id NOT IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
  IF v_order.status NOT IN ('draft','sent')
    THEN RAISE EXCEPTION 'La orden ya fue recibida o anulada'; END IF;

  -- NUEVO: método de costeo configurado por la empresa (default si por
  -- algún motivo viniera nulo, aunque la columna ya trae default propio).
  SELECT COALESCE(costing_method, 'weighted_avg') INTO v_costing_method
    FROM companies WHERE id = v_order.company_id;

  -- Número factura proveedor
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_seq FROM supplier_invoices WHERE company_id = v_order.company_id;
  v_number := 'FAC-P-' || LPAD(v_seq::TEXT, 4, '0');

  -- Fecha vencimiento según días de pago del proveedor
  SELECT COALESCE(NOW()::DATE + (payment_days || ' days')::INTERVAL, NOW()::DATE + INTERVAL '30 days')
  INTO v_due FROM suppliers WHERE id = v_order.supplier_id;

  -- Marcar OC como recibida
  UPDATE purchase_orders SET status = 'received' WHERE id = p_order_id;

  -- Crear factura proveedor
  INSERT INTO supplier_invoices
    (company_id, supplier_id, order_id, invoice_number, issue_date, due_date,
     subtotal, tax, total, balance_due, status, notes, created_by)
  VALUES
    (v_order.company_id, v_order.supplier_id, p_order_id, v_number,
     NOW()::DATE, v_due,
     v_order.subtotal, v_order.tax, v_order.total, v_order.total,
     'pending', v_order.notes, auth.uid())
  RETURNING id INTO v_inv_id;

  -- Copiar ítems + aumentar stock + registrar movimiento
  FOR v_item IN SELECT * FROM purchase_order_items WHERE order_id = p_order_id
  LOOP
    INSERT INTO supplier_invoice_items
      (invoice_id, product_id, product_name, sku, quantity, unit_price,
       discount, tax_rate, subtotal, tax, total)
    VALUES
      (v_inv_id, v_item.product_id, v_item.product_name, v_item.sku,
       v_item.quantity, v_item.unit_price, v_item.discount, v_item.tax_rate,
       v_item.subtotal, v_item.tax, v_item.total);

    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      v_stock_after := v_stock_before + v_item.quantity;

      UPDATE products SET stock = v_stock_after
        WHERE id = v_item.product_id;

      INSERT INTO inventory_movements
        (company_id, product_id, movement_type, quantity,
         stock_before, stock_after,
         reference_type, reference_id, reference_no, created_by)
      VALUES
        (v_order.company_id, v_item.product_id, 'purchase',
         v_item.quantity, v_stock_before, v_stock_after,
         'purchase_order', p_order_id, v_order.order_number, auth.uid());

      -- NUEVO: costo de compra real + precio de venta recalculado +
      -- precio por proveedor. Se salta si la cantidad es 0 (no debería
      -- pasar, pero evita una división por cero).
      IF v_item.quantity > 0 THEN
        v_unit_cost := v_item.total / v_item.quantity;

        SELECT precio_compra, margen_ganancia INTO v_old_precio_compra, v_margen
          FROM products WHERE id = v_item.product_id;
        v_margen := COALESCE(v_margen, 30);

        IF v_costing_method = 'last_price' OR COALESCE(v_old_precio_compra, 0) = 0 OR v_stock_before <= 0 THEN
          v_new_compra := v_unit_cost;
        ELSE
          v_new_compra := ((v_stock_before * v_old_precio_compra) + (v_item.quantity * v_unit_cost))
                          / (v_stock_before + v_item.quantity);
        END IF;
        v_new_price := ROUND(v_new_compra * (1 + v_margen / 100), 2);

        UPDATE products
          SET precio_compra = ROUND(v_new_compra, 2),
              price         = v_new_price
          WHERE id = v_item.product_id;

        INSERT INTO producto_proveedores (company_id, product_id, supplier_id, price, updated_at)
          VALUES (v_order.company_id, v_item.product_id, v_order.supplier_id, ROUND(v_unit_cost, 2), NOW())
          ON CONFLICT (product_id, supplier_id) DO UPDATE
            SET price = EXCLUDED.price, updated_at = NOW();
      END IF;
    END IF;
  END LOOP;

  -- Comprobante contable automático: Inventario / IVA descontable (2408) a Proveedores
  IF v_order.total > 0 THEN
    v_je_year := to_char(NOW(), 'YYYY');
    SELECT COALESCE(count(*), 0) + 1 INTO v_je_seq FROM journal_entries
      WHERE company_id = v_order.company_id
        AND entry_date >= (v_je_year || '-01-01')::DATE
        AND entry_date <= (v_je_year || '-12-31')::DATE;
    v_je_number := 'CE-' || v_je_year || '-' || LPAD(v_je_seq::TEXT, 4, '0');

    INSERT INTO journal_entries
      (company_id, entry_number, entry_date, entry_type, description, reference_id, status, created_by)
    VALUES
      (v_order.company_id, v_je_number, NOW()::DATE, 'purchase',
       'Compra ' || v_number, v_inv_id, 'posted', auth.uid())
    RETURNING id INTO v_je_id;

    INSERT INTO journal_entry_lines (entry_id, account_code, description, debit, credit) VALUES
      (v_je_id, '143505', 'Compra ' || v_number, v_order.subtotal, 0),
      (v_je_id, '2408',   'IVA descontable ' || v_number, v_order.tax, 0),
      (v_je_id, '2205',   'Compra ' || v_number, 0, v_order.total);
  END IF;

  RETURN v_inv_id;
END;
$function$;
