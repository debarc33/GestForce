-- =============================================================================
-- Migración de SOLO RESPALDO (no cambia ningún comportamiento).
--
-- Contexto: al revisar el módulo Contabilidad (13 oct 2026) se descubrió que
-- buena parte de la lógica real de Ventas/Compras corre como funciones de
-- Postgres (RPC, SECURITY DEFINER) que viven solo en la base de datos de
-- Supabase, sin ningún respaldo en este repositorio -- si el proyecto de
-- Supabase se perdiera, estas funciones no se podrían reconstruir desde el
-- código. Esta migración existe únicamente para dejar una copia exacta del
-- código real de esas funciones dentro del repo (obtenido el 13 oct 2026
-- vía `pg_get_functiondef` en el SQL Editor de Supabase, pegado por la
-- usuaria tal cual lo devolvió la base de datos, sin modificar nada).
--
-- Es seguro correrla en Supabase: cada `CREATE OR REPLACE FUNCTION` deja
-- la función exactamente igual a como ya está hoy en producción (no se
-- cambió ni una línea de ninguna de las 8). No es necesario correrla para
-- que la app siga funcionando -- es solo para quedar respaldada en git.
--
-- Nota: la consulta original pedía también `cancel_invoice`, pero esa
-- función NO existe en la base de datos (la consulta solo devolvió 8 de
-- las 9 funciones pedidas) -- cancelar una factura probablemente se hace
-- con un UPDATE directo desde el cliente, no vía una función RPC propia.
-- Pendiente de confirmar dónde vive esa lógica si se necesita tocarla.
-- =============================================================================

-- ── approve_quote ─────────────────────────────────────────────────────────
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
BEGIN
  -- Obtener cotización
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  IF v_quote.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'La cotización no puede facturarse en estado %', v_quote.status;
  END IF;

  -- Verificar stock antes de proceder
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

  -- Aprobar cotización
  UPDATE quotes SET status = 'approved' WHERE id = p_quote_id;

  -- Crear factura directamente como EMITIDA
  INSERT INTO invoices (
    company_id, customer_id, quote_id, invoice_number,
    issue_date, subtotal, tax, total, balance_due,
    status, payment_status, notes, created_by,
    document_type, dian_status, issued_at
  ) VALUES (
    v_quote.company_id, v_quote.customer_id, p_quote_id,
    next_doc_number(v_quote.company_id, v_doc_seq, v_prefix),
    v_quote.issue_date,
    v_quote.subtotal, v_quote.tax, v_quote.total, v_quote.total,
    'issued', 'unpaid', v_quote.notes, auth.uid(),
    p_document_type, 'not_applicable', NOW()
  )
  RETURNING id INTO v_invoice_id;

  -- Copiar ítems + descontar stock + registrar movimientos
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
      UPDATE products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id;

      INSERT INTO inventory_movements (
        company_id, product_id, movement_type,
        quantity, reference_type, reference_id, created_by
      ) VALUES (
        v_quote.company_id, v_item.product_id, 'sale',
        -v_item.quantity, 'invoice', v_invoice_id, auth.uid()
      );
    END IF;
  END LOOP;

  -- Crear recibo automáticamente
  INSERT INTO receipts (
    company_id, customer_id, invoice_id, receipt_number,
    total_amount, amount_paid, balance, status
  ) VALUES (
    v_quote.company_id, v_quote.customer_id, v_invoice_id,
    next_doc_number(v_quote.company_id, 'receipt', 'REC-'),
    v_quote.total, 0, v_quote.total, 'pending'
  );

  RETURN v_invoice_id;
END;
$function$

-- ── create_credit_debit_note ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_credit_debit_note(p_company_id uuid, p_invoice_id uuid, p_type text, p_reason text, p_issue_date date, p_subtotal numeric, p_tax numeric, p_total numeric, p_notes text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_note_id UUID;
  v_prefix  TEXT;
  v_seq     INTEGER;
BEGIN
  v_prefix := CASE p_type WHEN 'credit' THEN 'NC' ELSE 'ND' END;

  SELECT COALESCE(MAX(CAST(SUBSTRING(note_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_seq
  FROM credit_debit_notes
  WHERE company_id = p_company_id AND type = p_type;

  INSERT INTO credit_debit_notes
    (company_id, invoice_id, note_number, type, reason, issue_date, subtotal, tax, total, notes, created_by)
  VALUES
    (p_company_id, p_invoice_id, v_prefix || '-' || LPAD(v_seq::TEXT, 4, '0'),
     p_type, p_reason, p_issue_date, p_subtotal, p_tax, p_total, p_notes, auth.uid())
  RETURNING id INTO v_note_id;

  INSERT INTO credit_debit_note_items
    (note_id, product_id, product_name, sku, quantity, unit_price, discount, tax_rate, subtotal, tax, total)
  SELECT
    v_note_id,
    NULLIF(item->>'product_id','')::UUID,
    item->>'product_name',
    NULLIF(item->>'sku',''),
    (item->>'quantity')::NUMERIC,
    (item->>'unit_price')::NUMERIC,
    (item->>'discount')::NUMERIC,
    (item->>'tax_rate')::NUMERIC,
    (item->>'subtotal')::NUMERIC,
    (item->>'tax')::NUMERIC,
    (item->>'total')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_note_id;
END;
$function$

-- ── create_purchase_order_with_items ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_purchase_order_with_items(p_company_id uuid, p_supplier_id uuid, p_issue_date date, p_expected_date date, p_subtotal numeric, p_tax numeric, p_total numeric, p_notes text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_order_id UUID;
  v_seq      INTEGER;
  v_number   TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_seq FROM purchase_orders WHERE company_id = p_company_id;
  v_number := 'OC-' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO purchase_orders
    (company_id, supplier_id, order_number, issue_date, expected_date,
     subtotal, tax, total, status, notes, created_by)
  VALUES
    (p_company_id, p_supplier_id, v_number, p_issue_date, p_expected_date,
     p_subtotal, p_tax, p_total, 'draft', p_notes, auth.uid())
  RETURNING id INTO v_order_id;

  INSERT INTO purchase_order_items
    (order_id, product_id, product_name, sku, quantity, unit_price,
     discount, tax_rate, subtotal, tax, total)
  SELECT
    v_order_id,
    NULLIF(item->>'product_id','')::UUID,
    item->>'product_name',
    NULLIF(item->>'sku',''),
    (item->>'quantity')::NUMERIC,
    (item->>'unit_price')::NUMERIC,
    (item->>'discount')::NUMERIC,
    (item->>'tax_rate')::NUMERIC,
    (item->>'subtotal')::NUMERIC,
    (item->>'tax')::NUMERIC,
    (item->>'total')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$function$

-- ── create_quote_with_items ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_quote_with_items(p_company_id uuid, p_customer_id uuid, p_issue_date date, p_expiry_date date, p_notes text, p_subtotal numeric, p_tax numeric, p_total numeric, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_quote_id uuid;
  v_item     jsonb;
BEGIN
  -- Verificar acceso
  IF p_company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Crear cotización con número automático
  INSERT INTO quotes (
    company_id, customer_id, quote_number,
    issue_date, expiry_date,
    subtotal, tax, total, status, notes, created_by
  ) VALUES (
    p_company_id, p_customer_id,
    next_doc_number(p_company_id, 'quote', 'COT-'),
    p_issue_date, p_expiry_date,
    p_subtotal, p_tax, p_total, 'draft', p_notes, auth.uid()
  )
  RETURNING id INTO v_quote_id;

  -- Insertar ítems
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO quote_items (
      quote_id, product_id, quantity, unit_price,
      discount, tax_rate, subtotal, tax, total
    ) VALUES (
      v_quote_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'discount')::numeric,
      (v_item->>'tax_rate')::numeric,
      (v_item->>'subtotal')::numeric,
      (v_item->>'tax')::numeric,
      (v_item->>'total')::numeric
    );
  END LOOP;

  RETURN v_quote_id;
END;
$function$

-- ── create_ticket_with_items ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_ticket_with_items(p_company_id uuid, p_customer_id uuid, p_issue_date date, p_notes text, p_subtotal numeric, p_tax numeric, p_total numeric, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_invoice_id  uuid;
  v_number      text;
  v_count       int;
BEGIN
  -- Generar número TKT-XXXXXX
  SELECT COUNT(*) INTO v_count
    FROM invoices
   WHERE company_id = p_company_id
     AND document_type = 'ticket';
  v_number := 'TKT-' || LPAD((v_count + 1)::text, 6, '0');

  -- Insertar factura
  INSERT INTO invoices (
    company_id, customer_id, document_type, invoice_number,
    issue_date, status, subtotal, tax, total, notes
  ) VALUES (
    p_company_id, p_customer_id, 'ticket', v_number,
    p_issue_date, 'issued', p_subtotal, p_tax, p_total, p_notes
  ) RETURNING id INTO v_invoice_id;

  -- Insertar ítems
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

  RETURN v_invoice_id;
END;
$function$

-- ── register_receipt_payment ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_receipt_payment(p_receipt_id uuid, p_payment_method_id uuid, p_amount numeric, p_payment_date date, p_reference text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_receipt     receipts%ROWTYPE;
  v_new_paid    numeric;
  v_new_balance numeric;
  v_new_status  text;
BEGIN
  -- Obtener recibo con lock para evitar race conditions
  SELECT * INTO v_receipt FROM receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recibo no encontrado'; END IF;

  -- Verificar acceso
  IF v_receipt.company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  IF v_receipt.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'El recibo ya está % y no acepta más abonos', v_receipt.status;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del abono debe ser mayor a 0';
  END IF;

  IF p_amount > v_receipt.balance THEN
    RAISE EXCEPTION 'El monto supera el saldo pendiente de %', v_receipt.balance;
  END IF;

  -- Calcular nuevos totales
  v_new_paid    := v_receipt.amount_paid + p_amount;
  v_new_balance := v_receipt.total_amount - v_new_paid;
  v_new_status  := CASE
    WHEN v_new_balance <= 0 THEN 'paid'
    WHEN v_new_paid    >  0 THEN 'partial'
    ELSE 'pending'
  END;

  -- Registrar abono
  INSERT INTO receipt_payments (
    receipt_id, payment_method_id, amount,
    payment_date, reference, created_by
  ) VALUES (
    p_receipt_id, p_payment_method_id, p_amount,
    p_payment_date, p_reference, auth.uid()
  );

  -- Actualizar recibo
  UPDATE receipts
    SET amount_paid = v_new_paid,
        balance     = v_new_balance,
        status      = v_new_status
    WHERE id = p_receipt_id;

  -- Actualizar payment_status de la factura
  UPDATE invoices
    SET payment_status = CASE
      WHEN v_new_status = 'paid'    THEN 'paid'
      WHEN v_new_status = 'partial' THEN 'partial'
      ELSE 'unpaid'
    END,
    balance_due = v_new_balance
    WHERE id = v_receipt.invoice_id;
END;
$function$

-- ── register_supplier_payment ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_supplier_payment(p_company_id uuid, p_invoice_id uuid, p_payment_date date, p_amount numeric, p_method text, p_reference text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_payment_id UUID;
  v_balance    NUMERIC;
BEGIN
  INSERT INTO supplier_payments
    (company_id, invoice_id, payment_date, amount, payment_method, reference, notes, created_by)
  VALUES
    (p_company_id, p_invoice_id, p_payment_date, p_amount, p_method, p_reference, p_notes, auth.uid())
  RETURNING id INTO v_payment_id;

  UPDATE supplier_invoices
  SET balance_due = GREATEST(balance_due - p_amount, 0),
      status = CASE
        WHEN balance_due - p_amount <= 0 THEN 'paid'
        ELSE 'partial'
      END
  WHERE id = p_invoice_id
  RETURNING balance_due INTO v_balance;

  RETURN v_payment_id;
END;
$function$

-- ── update_invoice_with_items ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_invoice_with_items(p_invoice_id uuid, p_customer_id uuid, p_issue_date date, p_due_date date, p_notes text, p_subtotal numeric, p_tax numeric, p_total numeric, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE invoices SET
    customer_id = p_customer_id,
    issue_date  = p_issue_date,
    due_date    = p_due_date,
    notes       = p_notes,
    subtotal    = p_subtotal,
    tax         = p_tax,
    total       = p_total
  WHERE id = p_invoice_id;

  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

  INSERT INTO invoice_items (
    invoice_id, product_id,
    quantity, unit_price, discount, tax_rate, subtotal, tax, total
  )
  SELECT
    p_invoice_id,
    (item->>'product_id')::uuid,
    (item->>'quantity')::numeric,
    (item->>'unit_price')::numeric,
    (item->>'discount')::numeric,
    (item->>'tax_rate')::numeric,
    (item->>'subtotal')::numeric,
    (item->>'tax')::numeric,
    (item->>'total')::numeric
  FROM jsonb_array_elements(p_items) AS item;
END;
$function$

