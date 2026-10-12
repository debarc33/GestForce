-- Genera automáticamente un comprobante contable (journal_entries +
-- journal_entry_lines) al emitir una factura de venta y al recibir una
-- orden de compra (que es cómo se crea la factura de proveedor en este
-- sistema). Reutiliza cuentas PUC que ya existen en el plan de cuentas
-- de toda empresa (130505 Clientes, 413505 Ventas, 2408 IVA por pagar,
-- 143505 Productos para la venta/Inventario, 2205 Proveedores), así que
-- no requiere agregar cuentas nuevas. La cuenta 2408 se usa para ambos
-- lados del IVA (generado en ventas, descontable en compras); el saldo
-- neto de esa cuenta es lo que se debe o se puede descontar de IVA.
--
-- Fuera de alcance a propósito (decisión con la usuaria, 11-12 oct 2026):
-- el comprobante de pagos/recibos (register_receipt_payment,
-- register_supplier_payment) -- su código actual no está en ninguna
-- migración de este repo, así que reescribirlas a ciegas podría romper
-- algo que ya funciona en producción -- y el costeo de inventario/costo
-- de venta por producto en cada factura. Ambos quedan pendientes.
--
-- Esta migración re-crea ambas funciones completas (mismo comportamiento
-- que la migración 020), solo agregando la creación del comprobante al
-- final de cada una.

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
BEGIN
  SELECT * INTO v_order FROM purchase_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.company_id NOT IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
  IF v_order.status NOT IN ('draft','sent')
    THEN RAISE EXCEPTION 'La orden ya fue recibida o anulada'; END IF;

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

CREATE OR REPLACE FUNCTION public.issue_invoice(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_invoice       invoices%ROWTYPE;
  v_item          invoice_items%ROWTYPE;
  v_stock         numeric;
  v_stock_before  NUMERIC;
  v_stock_after   NUMERIC;
  v_je_id         UUID;
  v_je_year       TEXT;
  v_je_seq        INTEGER;
  v_je_number     TEXT;
BEGIN
  -- Obtener factura
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;

  -- Verificar acceso
  IF v_invoice.company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  IF v_invoice.status <> 'draft' THEN
    RAISE EXCEPTION 'Solo se pueden remitir facturas en borrador';
  END IF;

  -- Verificar stock por ítem
  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock FROM products WHERE id = v_item.product_id;
      IF v_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %', v_item.product_id;
      END IF;
    END IF;
  END LOOP;

  -- Descontar stock y registrar movimientos
  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      v_stock_after := v_stock_before - v_item.quantity;

      UPDATE products
        SET stock = v_stock_after
        WHERE id = v_item.product_id;

      INSERT INTO inventory_movements (
        company_id, product_id, movement_type,
        quantity, stock_before, stock_after,
        reference_type, reference_id, reference_no, created_by
      ) VALUES (
        v_invoice.company_id, v_item.product_id, 'sale',
        -v_item.quantity, v_stock_before, v_stock_after,
        'invoice', p_invoice_id, v_invoice.invoice_number, auth.uid()
      );
    END IF;
  END LOOP;

  -- Cambiar estado de la factura
  UPDATE invoices
    SET status    = 'issued',
        issued_at = now()
    WHERE id = p_invoice_id;

  -- Crear recibo
  INSERT INTO receipts (
    company_id, customer_id, invoice_id, receipt_number,
    total_amount, amount_paid, balance, status
  ) VALUES (
    v_invoice.company_id, v_invoice.customer_id, p_invoice_id,
    next_doc_number(v_invoice.company_id, 'receipt', 'REC-'),
    v_invoice.total, 0, v_invoice.total, 'pending'
  );

  -- Comprobante contable automático: Clientes a Ventas / IVA por pagar (2408)
  IF v_invoice.total > 0 THEN
    v_je_year := to_char(NOW(), 'YYYY');
    SELECT COALESCE(count(*), 0) + 1 INTO v_je_seq FROM journal_entries
      WHERE company_id = v_invoice.company_id
        AND entry_date >= (v_je_year || '-01-01')::DATE
        AND entry_date <= (v_je_year || '-12-31')::DATE;
    v_je_number := 'CE-' || v_je_year || '-' || LPAD(v_je_seq::TEXT, 4, '0');

    INSERT INTO journal_entries
      (company_id, entry_number, entry_date, entry_type, description, reference_id, status, created_by)
    VALUES
      (v_invoice.company_id, v_je_number, NOW()::DATE, 'sale',
       'Venta ' || v_invoice.invoice_number, p_invoice_id, 'posted', auth.uid())
    RETURNING id INTO v_je_id;

    INSERT INTO journal_entry_lines (entry_id, account_code, description, debit, credit) VALUES
      (v_je_id, '130505', 'Venta ' || v_invoice.invoice_number, v_invoice.total, 0),
      (v_je_id, '413505', 'Venta ' || v_invoice.invoice_number, 0, v_invoice.subtotal),
      (v_je_id, '2408',   'IVA generado ' || v_invoice.invoice_number, 0, v_invoice.tax);
  END IF;
END;
$function$;
