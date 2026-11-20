-- 045_invoice_payment_form.sql
--
-- Agrega el concepto de "forma de pago" (contado/crédito) a las facturas,
-- que hoy no existe en absoluto: approve_quote() siempre insertaba
-- payment_status='unpaid' y balance_due=total sin importar si la venta
-- era de contado o a crédito, y due_date quedaba siempre en NULL.
--
-- Hallazgo del 20 nov 2026 comparando con Siigo (que sí pide "Forma de
-- pago: Contado/Crédito" y, si es crédito, cuotas/vencimiento) y revisando
-- que create_credit_debit_note() nunca ajustaba el saldo de la factura ni
-- del recibo -- una nota crédito no descontaba nada del saldo pendiente.
--
-- Cambios:
--   1) invoices gana payment_form (contado/credito) y credit_days.
--   2) approve_quote(): nuevos parámetros p_payment_form, p_credit_days,
--      p_payment_method_id. Si es contado, registra el pago completo de una
--      vez contra el recibo recién creado (reutilizando
--      register_receipt_payment, que ya mantiene receipts + invoices en
--      sincronía) -- deja huella de auditoría (quién, cuándo, con qué medio).
--      Si es crédito, calcula due_date = issue_date + credit_days y deja el
--      saldo pendiente como hasta ahora.
--   3) create_credit_debit_note(): ahora SÍ ajusta invoices.balance_due/
--      payment_status y receipts.total_amount/balance/status -- una nota
--      crédito reduce lo que el cliente debe, una nota débito lo aumenta.
--      El total legal de la factura (invoices.total) NUNCA se toca.
--
-- No se backfillea ninguna fila existente: las facturas ya creadas
-- mantienen payment_form='contado' por defecto (valor puramente
-- descriptivo) sin que esto altere su balance_due/payment_status actual.

-- ── 1) Columnas nuevas en invoices ──────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_form text NOT NULL DEFAULT 'contado'
    CHECK (payment_form IN ('contado', 'credito'));
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_days integer;

-- ── 2) approve_quote(): forma de pago al facturar desde una cotización ──
CREATE OR REPLACE FUNCTION public.approve_quote(
  p_quote_id uuid,
  p_document_type text DEFAULT 'invoice'::text,
  p_payment_form text DEFAULT 'contado'::text,
  p_credit_days integer DEFAULT NULL,
  p_payment_method_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_quote       quotes%ROWTYPE;
  v_invoice_id  uuid;
  v_receipt_id  uuid;
  v_item        quote_items%ROWTYPE;
  v_prefix      text;
  v_doc_seq     text;
  v_stock       numeric;
  v_stock_before NUMERIC;
  v_stock_after  NUMERIC;
  v_invoice_number TEXT;
  v_dian_environment text;
  v_dian_active boolean;
  v_dian_result record;
  v_due_date    date;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  IF v_quote.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'La cotización no puede facturarse en estado %', v_quote.status;
  END IF;

  IF p_payment_form NOT IN ('contado', 'credito') THEN
    RAISE EXCEPTION 'Forma de pago inválida: %', p_payment_form;
  END IF;
  -- p_payment_method_id es opcional incluso en contado: si la empresa
  -- todavía no tiene medios de pago configurados (Ajustes), no queremos
  -- bloquear la emisión de la factura por eso -- se marca pagada igual,
  -- solo que sin un medio de pago asociado en el registro del abono.

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

  v_due_date := CASE
    WHEN p_payment_form = 'credito' THEN v_quote.issue_date + (COALESCE(p_credit_days, 30) || ' days')::interval
    ELSE NULL
  END;

  -- Numeración DIAN real: solo aplica a facturas (nunca a tiquets) y solo si
  -- la empresa tiene una resolución DIAN activa para su ambiente actual.
  v_invoice_number := NULL;
  IF p_document_type = 'invoice' THEN
    v_dian_environment := CASE
      WHEN (SELECT fe_test_mode FROM companies WHERE id = v_quote.company_id) THEN 'test'
      ELSE 'production'
    END;

    SELECT EXISTS (
      SELECT 1 FROM dian_numbering
      WHERE company_id = v_quote.company_id
        AND document_type = 'invoice'
        AND environment = v_dian_environment
        AND status = 'active'
    ) INTO v_dian_active;

    IF v_dian_active THEN
      SELECT * INTO v_dian_result
        FROM next_dian_number(v_quote.company_id, 'invoice', v_dian_environment);
      v_invoice_number := v_dian_result.full_number;
    END IF;
  END IF;

  IF v_invoice_number IS NULL THEN
    v_invoice_number := next_doc_number(v_quote.company_id, v_doc_seq, v_prefix);
  END IF;

  UPDATE quotes SET status = 'approved' WHERE id = p_quote_id;

  INSERT INTO invoices (
    company_id, customer_id, quote_id, invoice_number,
    issue_date, subtotal, tax, total, balance_due,
    status, payment_status, notes, created_by,
    document_type, dian_status, issued_at,
    payment_form, credit_days, due_date
  ) VALUES (
    v_quote.company_id, v_quote.customer_id, p_quote_id,
    v_invoice_number,
    v_quote.issue_date,
    v_quote.subtotal, v_quote.tax, v_quote.total, v_quote.total,
    'issued', 'unpaid', v_quote.notes, auth.uid(),
    p_document_type, 'not_applicable', NOW(),
    p_payment_form, (CASE WHEN p_payment_form = 'credito' THEN COALESCE(p_credit_days, 30) ELSE NULL END), v_due_date
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
    total_amount, amount_paid, balance, status, due_date
  ) VALUES (
    v_quote.company_id, v_quote.customer_id, v_invoice_id,
    next_doc_number(v_quote.company_id, 'receipt', 'REC-'),
    v_quote.total, 0, v_quote.total, 'pending', v_due_date
  )
  RETURNING id INTO v_receipt_id;

  -- Venta de contado: se registra el pago completo de una vez (deja huella
  -- de auditoría en receipt_payments) en vez de solo marcar banderas --
  -- reutiliza register_receipt_payment(), que ya mantiene receipts e
  -- invoices sincronizados.
  IF p_payment_form = 'contado' THEN
    IF v_quote.total > 0 AND p_payment_method_id IS NOT NULL THEN
      PERFORM public.register_receipt_payment(
        v_receipt_id, p_payment_method_id, v_quote.total, v_quote.issue_date,
        'Pago de contado al facturar'
      );
    ELSE
      -- Sin monto que cobrar, o sin medio de pago configurado todavía:
      -- se marca pagada directamente, sin dejar un abono en receipt_payments.
      UPDATE invoices SET payment_status = 'paid', balance_due = 0 WHERE id = v_invoice_id;
      UPDATE receipts SET status = 'paid', amount_paid = total_amount, balance = 0 WHERE id = v_receipt_id;
    END IF;
  END IF;

  -- Comprobante contable automático (función compartida, migración 025)
  PERFORM public._post_sale_journal_entry(v_invoice_id);

  RETURN v_invoice_id;
END;
$function$;

-- ── 3) create_credit_debit_note(): ajustar saldo real de factura/recibo ──
CREATE OR REPLACE FUNCTION public.create_credit_debit_note(p_company_id uuid, p_invoice_id uuid, p_type text, p_reason text, p_issue_date date, p_subtotal numeric, p_tax numeric, p_total numeric, p_notes text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_note_id UUID;
  v_prefix  TEXT;
  v_doc_seq TEXT;
  v_note_number TEXT;
  v_document_type TEXT;
  v_dian_environment TEXT;
  v_dian_active boolean;
  v_dian_result record;
  v_delta             numeric;
  v_invoice_balance    numeric;
  v_invoice_total      numeric;
  v_new_invoice_balance numeric;
  v_receipt_id          uuid;
  v_receipt_total       numeric;
  v_receipt_paid        numeric;
  v_new_receipt_total   numeric;
  v_new_receipt_balance numeric;
BEGIN
  IF p_company_id NOT IN (SELECT user_company_ids()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  v_prefix       := CASE p_type WHEN 'credit' THEN 'NC-' ELSE 'ND-' END;
  v_doc_seq      := CASE p_type WHEN 'credit' THEN 'credit_note' ELSE 'debit_note' END;
  v_document_type := v_doc_seq;

  -- Numeración DIAN real: igual patrón que approve_quote (migración 033) --
  -- solo aplica si la empresa tiene una resolución DIAN activa configurada
  -- para este tipo de documento y su ambiente actual. Si no, sigue exactamente
  -- igual que siempre (next_doc_number), solo que ahora con bloqueo de fila
  -- en vez de MAX(...)+1 sin bloqueo.
  v_dian_environment := CASE
    WHEN (SELECT fe_test_mode FROM companies WHERE id = p_company_id) THEN 'test'
    ELSE 'production'
  END;

  SELECT EXISTS (
    SELECT 1 FROM dian_numbering
    WHERE company_id = p_company_id
      AND document_type = v_document_type
      AND environment = v_dian_environment
      AND status = 'active'
  ) INTO v_dian_active;

  IF v_dian_active THEN
    SELECT * INTO v_dian_result
      FROM next_dian_number(p_company_id, v_document_type, v_dian_environment);
    v_note_number := v_dian_result.full_number;
  ELSE
    v_note_number := next_doc_number(p_company_id, v_doc_seq, v_prefix);
  END IF;

  INSERT INTO credit_debit_notes
    (company_id, invoice_id, note_number, type, reason, issue_date, subtotal, tax, total, notes, created_by)
  VALUES
    (p_company_id, p_invoice_id, v_note_number,
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

  -- Ajustar el saldo real de la factura: una nota crédito reduce lo que el
  -- cliente debe, una nota débito lo aumenta. invoices.total (el valor legal
  -- de la factura ante la DIAN) nunca se toca -- solo balance_due.
  v_delta := CASE WHEN p_type = 'credit' THEN -p_total ELSE p_total END;

  SELECT balance_due, total INTO v_invoice_balance, v_invoice_total
    FROM invoices WHERE id = p_invoice_id FOR UPDATE;

  v_new_invoice_balance := GREATEST(v_invoice_balance + v_delta, 0);

  UPDATE invoices SET
    balance_due = v_new_invoice_balance,
    payment_status = CASE
      WHEN v_new_invoice_balance <= 0 THEN 'paid'
      WHEN v_new_invoice_balance < v_invoice_total THEN 'partial'
      ELSE 'unpaid'
    END
  WHERE id = p_invoice_id;

  -- Mismo ajuste en el recibo asociado (si existe), para que la tabla de
  -- recibos refleje el mismo saldo real.
  SELECT id, total_amount, amount_paid INTO v_receipt_id, v_receipt_total, v_receipt_paid
    FROM receipts WHERE invoice_id = p_invoice_id FOR UPDATE;

  IF FOUND THEN
    v_new_receipt_total   := GREATEST(v_receipt_total + v_delta, 0);
    v_new_receipt_balance := GREATEST(v_new_receipt_total - v_receipt_paid, 0);

    UPDATE receipts SET
      total_amount = v_new_receipt_total,
      balance      = v_new_receipt_balance,
      status       = CASE
        WHEN v_new_receipt_balance <= 0 THEN 'paid'
        WHEN v_receipt_paid > 0          THEN 'partial'
        ELSE 'pending'
      END
    WHERE id = v_receipt_id;
  END IF;

  RETURN v_note_id;
END;
$function$;
