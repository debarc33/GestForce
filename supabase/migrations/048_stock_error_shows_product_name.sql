-- 048_stock_error_shows_product_name.sql
--
-- Hallazgo de Deisy (23 nov 2026): al intentar facturar con stock
-- insuficiente, el aviso mostraba el UUID interno del producto
-- (ej. "Stock insuficiente para el producto d1b9af68-649e-...") en vez de
-- su nombre y referencia. Esto pasaba en las dos funciones que validan
-- stock antes de descontarlo: approve_quote (al facturar una cotizacion) e
-- issue_invoice (al remitir una factura en borrador). Se corrige el
-- mensaje en ambas para que muestre el nombre del producto y su
-- referencia/SKU, consultandolos de la tabla products por product_id
-- (no se asume que quote_items/invoice_items ya los tengan guardados).
--
-- El resto de cada funcion queda identico a su version anterior (issue_invoice
-- de la migracion 025, approve_quote de la migracion 045).

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
  v_product_name  text;
  v_product_sku   text;
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
      SELECT stock, name, sku INTO v_stock, v_product_name, v_product_sku
        FROM products WHERE id = v_item.product_id;
      IF v_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto "%" (ref. %)',
          v_product_name, COALESCE(v_product_sku, 'sin referencia');
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
  v_product_name  text;
  v_product_sku   text;
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
      SELECT stock, name, sku INTO v_stock, v_product_name, v_product_sku
        FROM products WHERE id = v_item.product_id;
      IF v_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto "%" (ref. %)',
          v_product_name, COALESCE(v_product_sku, 'sin referencia');
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
