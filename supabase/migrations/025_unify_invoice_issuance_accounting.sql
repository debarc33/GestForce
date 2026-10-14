-- ============================================================================
-- Migración 025: unificar la generación del comprobante contable automático
-- y el descuento de inventario en TODOS los caminos que emiten una factura
-- o un tiquet (antes solo `issue_invoice` lo hacía bien, y esa función no la
-- llama ningún botón de la interfaz hoy en día).
--
-- Contexto / diagnóstico (13-14 oct 2026):
--   - `approve_quote` (el botón "Aprobar cotización → Factura/Ticket", que es
--     HOY la única forma real de crear una factura desde la interfaz) crea la
--     factura ya "emitida", descuenta stock y crea el recibo, pero NUNCA
--     generaba el comprobante contable (no llamaba la lógica agregada en la
--     migración 023).
--   - `create_ticket_with_items` (botón "Nuevo ticket") tampoco generaba el
--     comprobante contable, y además NO descontaba stock ni registraba
--     movimiento de inventario — un bug independiente que se corrige aquí de
--     una vez por tratarse de la misma familia de problema.
--   - `issue_invoice` (migración 023) sí tenía toda la lógica correcta
--     (stock, recibo, comprobante contable) pero ninguna pantalla de la app
--     la invoca actualmente — quedaba código "muerto" desde el punto de vista
--     de la interfaz.
--
-- Solución: se extrae la generación del comprobante contable a una única
-- función interna `_post_sale_journal_entry`, y las tres funciones que crean
-- una venta real (`approve_quote`, `create_ticket_with_items`,
-- `issue_invoice`) la llaman desde ahí. Así solo existe UN lugar que decide
-- cómo se contabiliza una venta, sin importar por cuál botón se creó.
--
-- Es seguro correr esta migración en Supabase: cada `CREATE OR REPLACE
-- FUNCTION` reemplaza la versión anterior sin perder datos ya existentes.
-- No hace falta tocar ninguna tabla.
-- ============================================================================

-- ── Función interna compartida: comprobante contable de una venta ──────────
-- (idéntica a la lógica que ya traía `issue_invoice` desde la migración 023,
-- ahora reutilizable desde cualquier lugar que termine de "emitir" una venta)
CREATE OR REPLACE FUNCTION public._post_sale_journal_entry(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invoice   invoices%ROWTYPE;
  v_je_id     UUID;
  v_je_year   TEXT;
  v_je_seq    INTEGER;
  v_je_number TEXT;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_invoice.total IS NULL OR v_invoice.total <= 0 THEN RETURN; END IF;

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
END;
$function$;

-- ── issue_invoice: sin cambios de comportamiento, ahora reutiliza la función
--    compartida en vez de tener la lógica del comprobante duplicada ────────
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
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;

  IF v_invoice.company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  IF v_invoice.status <> 'draft' THEN
    RAISE EXCEPTION 'Solo se pueden remitir facturas en borrador';
  END IF;

  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock FROM products WHERE id = v_item.product_id;
      IF v_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %', v_item.product_id;
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      v_stock_after := v_stock_before - v_item.quantity;

      UPDATE products SET stock = v_stock_after WHERE id = v_item.product_id;

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

  UPDATE invoices
    SET status    = 'issued',
        issued_at = now()
    WHERE id = p_invoice_id;

  INSERT INTO receipts (
    company_id, customer_id, invoice_id, receipt_number,
    total_amount, amount_paid, balance, status
  ) VALUES (
    v_invoice.company_id, v_invoice.customer_id, p_invoice_id,
    next_doc_number(v_invoice.company_id, 'receipt', 'REC-'),
    v_invoice.total, 0, v_invoice.total, 'pending'
  );

  -- Comprobante contable automático (función compartida)
  PERFORM public._post_sale_journal_entry(p_invoice_id);
END;
$function$;

-- ── approve_quote: se agrega la generación del comprobante contable al
--    final (única adición real; el resto de la lógica no cambia) y se
--    completa el registro de movimiento de inventario con stock_before/
--    stock_after/reference_no, igual que ya hace issue_invoice, para que
--    el Kardex de inventario quede consistente sin importar el camino ──────
CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid, p_document_type text DEFAULT 'invoice'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_quote       quotes%ROWTYPE;
  v_invoice_id  uuid;
  v_item        quote_items%ROWTYPE;
  v_prefix      text;
  v_doc_seq     text;
  v_stock       numeric;
  v_stock_before NUMERIC;
  v_stock_after  NUMERIC;
  v_invoice_number TEXT;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  IF v_quote.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'La cotización no puede facturarse en estado %', v_quote.status;
  END IF;

  FOR v_item IN SELECT * FROM quote_items WHERE quote_id = p_quote_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock FROM products WHERE id = v_item.product_id;
      IF v_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %', v_item.product_id;
      END IF;
    END IF;
  END LOOP;

  v_prefix  := CASE p_document_type WHEN 'ticket' THEN 'TK-' ELSE 'FAC-' END;
  v_doc_seq := CASE p_document_type WHEN 'ticket' THEN 'ticket' ELSE 'invoice' END;
  v_invoice_number := next_doc_number(v_quote.company_id, v_doc_seq, v_prefix);

  UPDATE quotes SET status = 'approved' WHERE id = p_quote_id;

  INSERT INTO invoices (
    company_id, customer_id, quote_id, invoice_number,
    issue_date, subtotal, tax, total, balance_due,
    status, payment_status, notes, created_by,
    document_type, dian_status, issued_at
  ) VALUES (
    v_quote.company_id, v_quote.customer_id, p_quote_id,
    v_invoice_number,
    v_quote.issue_date,
    v_quote.subtotal, v_quote.tax, v_quote.total, v_quote.total,
    'issued', 'unpaid', v_quote.notes, auth.uid(),
    p_document_type, 'not_applicable', NOW()
  )
  RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM quote_items WHERE quote_id = p_quote_id
  LOOP
    INSERT INTO invoice_items (
      invoice_id, product_id, quantity, unit_price,
      discount, tax_rate, subtotal, tax, total
    ) VALUES (
      v_invoice_id, v_item.product_id, v_item.quantity, v_item.unit_price,
      v_item.discount, v_item.tax_rate, v_item.subtotal, v_item.tax, v_item.total
    );

    IF v_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      v_stock_after := v_stock_before - v_item.quantity;

      UPDATE products SET stock = v_stock_after WHERE id = v_item.product_id;

      INSERT INTO inventory_movements (
        company_id, product_id, movement_type,
        quantity, stock_before, stock_after,
        reference_type, reference_id, reference_no, created_by
      ) VALUES (
        v_quote.company_id, v_item.product_id, 'sale',
        -v_item.quantity, v_stock_before, v_stock_after,
        'invoice', v_invoice_id, v_invoice_number, auth.uid()
      );
    END IF;
  END LOOP;

  INSERT INTO receipts (
    company_id, customer_id, invoice_id, receipt_number,
    total_amount, amount_paid, balance, status
  ) VALUES (
    v_quote.company_id, v_quote.customer_id, v_invoice_id,
    next_doc_number(v_quote.company_id, 'receipt', 'REC-'),
    v_quote.total, 0, v_quote.total, 'pending'
  );

  -- Comprobante contable automático (función compartida) — esto es lo que
  -- faltaba y causaba que las facturas/tiquets aprobados desde una
  -- cotización nunca aparecieran en Contabilidad → Comprobantes.
  PERFORM public._post_sale_journal_entry(v_invoice_id);

  RETURN v_invoice_id;
END;
$function$;

-- ── create_ticket_with_items: se agrega el descuento de inventario +
--    movimiento (no existía del todo, bug independiente) y el comprobante
--    contable (función compartida) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_ticket_with_items(p_company_id uuid, p_customer_id uuid, p_issue_date date, p_notes text, p_subtotal numeric, p_tax numeric, p_total numeric, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_invoice_id   uuid;
  v_number       text;
  v_count        int;
  v_item_json    jsonb;
  v_product_id   uuid;
  v_quantity     numeric;
  v_stock_before numeric;
  v_stock_after  numeric;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM invoices
   WHERE company_id = p_company_id
     AND document_type = 'ticket';
  v_number := 'TKT-' || LPAD((v_count + 1)::text, 6, '0');

  INSERT INTO invoices (
    company_id, customer_id, document_type, invoice_number,
    issue_date, status, subtotal, tax, total, notes
  ) VALUES (
    p_company_id, p_customer_id, 'ticket', v_number,
    p_issue_date, 'issued', p_subtotal, p_tax, p_total, p_notes
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO invoice_items (
    invoice_id, product_id, product_name, sku,
    quantity, unit_price, discount, tax_rate, subtotal, tax, total
  )
  SELECT
    v_invoice_id,
    (item->>'product_id')::uuid,
    p.name,
    p.sku,
    (item->>'quantity')::numeric,
    (item->>'unit_price')::numeric,
    (item->>'discount')::numeric,
    (item->>'tax_rate')::numeric,
    (item->>'subtotal')::numeric,
    (item->>'tax')::numeric,
    (item->>'total')::numeric
  FROM jsonb_array_elements(p_items) AS item
  JOIN products p ON p.id = (item->>'product_id')::uuid;

  -- Descontar stock y registrar movimiento de inventario (antes no se hacía
  -- en absoluto para un tiquet creado por este camino directo).
  FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item_json->>'product_id')::uuid;
    IF v_product_id IS NOT NULL THEN
      v_quantity := (v_item_json->>'quantity')::numeric;
      SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;
      v_stock_after := v_stock_before - v_quantity;

      UPDATE products SET stock = v_stock_after WHERE id = v_product_id;

      INSERT INTO inventory_movements (
        company_id, product_id, movement_type,
        quantity, stock_before, stock_after,
        reference_type, reference_id, reference_no, created_by
      ) VALUES (
        p_company_id, v_product_id, 'sale',
        -v_quantity, v_stock_before, v_stock_after,
        'invoice', v_invoice_id, v_number, auth.uid()
      );
    END IF;
  END LOOP;

  -- Comprobante contable automático (función compartida)
  PERFORM public._post_sale_journal_entry(v_invoice_id);

  RETURN v_invoice_id;
END;
$function$;
