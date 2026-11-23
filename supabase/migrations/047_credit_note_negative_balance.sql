-- 047_credit_note_negative_balance.sql
--
-- Hallazgo (20 nov 2026, confirmado por Deisy probando en vivo): al aplicar
-- una nota credito a una factura que ya estaba pagada por completo, el
-- recibo quedaba mostrando "Pagado" / saldo $0 -- pero en realidad el
-- cliente habia pagado MAS de lo que ahora vale la factura (el total bajo
-- por la nota credito). Esa diferencia a favor del cliente se perdia porque
-- create_credit_debit_note (migracion 045) usaba GREATEST(..., 0) para
-- nunca dejar el saldo en negativo.
--
-- Decision de Deisy: mostrar ese saldo como negativo / "a favor del
-- cliente" en vez de ocultarlo como si no pasara nada. Esta migracion
-- quita el GREATEST(...,0) solo en el CALCULO DEL SALDO (balance_due de la
-- factura y balance del recibo), para que pueda quedar negativo cuando el
-- cliente pago de mas. El "total" del recibo (total_amount) SI se sigue
-- dejando en 0 como minimo, porque un total nunca deberia ser negativo --
-- lo que puede ser negativo es la resta total-pagado (el saldo).
--
-- El resto de la funcion es identico a la version de la migracion 045.

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
  -- de la factura ante la DIAN) nunca se toca -- solo balance_due. Si el
  -- resultado queda negativo, es porque el cliente ya habia pagado mas de lo
  -- que ahora vale la factura: se deja negativo a proposito para mostrar el
  -- saldo a favor del cliente, en vez de ocultarlo con un piso en 0.
  v_delta := CASE WHEN p_type = 'credit' THEN -p_total ELSE p_total END;

  SELECT balance_due, total INTO v_invoice_balance, v_invoice_total
    FROM invoices WHERE id = p_invoice_id FOR UPDATE;

  v_new_invoice_balance := v_invoice_balance + v_delta;

  UPDATE invoices SET
    balance_due = v_new_invoice_balance,
    payment_status = CASE
      WHEN v_new_invoice_balance <= 0 THEN 'paid'
      WHEN v_new_invoice_balance < v_invoice_total THEN 'partial'
      ELSE 'unpaid'
    END
  WHERE id = p_invoice_id;

  -- Mismo ajuste en el recibo asociado (si existe), para que la tabla de
  -- recibos refleje el mismo saldo real. El total del recibo (total_amount)
  -- si se deja con piso en 0 -- un total no deberia ser negativo -- pero el
  -- saldo (total - pagado) puede quedar negativo a proposito (ver arriba).
  SELECT id, total_amount, amount_paid INTO v_receipt_id, v_receipt_total, v_receipt_paid
    FROM receipts WHERE invoice_id = p_invoice_id FOR UPDATE;

  IF FOUND THEN
    v_new_receipt_total   := GREATEST(v_receipt_total + v_delta, 0);
    v_new_receipt_balance := v_new_receipt_total - v_receipt_paid;

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
