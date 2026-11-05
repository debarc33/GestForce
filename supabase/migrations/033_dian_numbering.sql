-- ============================================================================
-- Migración 033: numeración real conectada a la resolución DIAN (Fase B del
-- plan de acción de facturación electrónica, ver
-- claude/plan-accion-facturacion-dian.md).
--
-- Contexto (4-5 nov 2026): el informe de auditoría señaló que `next_doc_number`
-- no estaba respaldada en ninguna migración versionada (vivía solo en la base
-- de datos), y que la numeración de facturas no tenía ninguna conexión con el
-- consecutivo autorizado por la resolución DIAN de cada empresa.
--
-- Esta migración:
--   1) Deja respaldado en el repo el código real de `next_doc_number`
--      (obtenido el 4 nov 2026 vía `pg_get_functiondef` en el SQL Editor de
--      Supabase) — sin cambiarla.
--   2) Crea la infraestructura nueva `dian_numbering` / `next_dian_number()`
--      (esta parte ya fue aplicada en vivo por la usuaria el 5 nov 2026,
--      corriendo el SQL directamente en Supabase; aquí queda respaldada en
--      git. Escrita con `IF NOT EXISTS` / chequeo de policy existente para
--      que sea segura de volver a correr).
--   3) Conecta `approve_quote` a la numeración DIAN real: cuando el documento
--      es una factura (no tiquet) Y la empresa tiene una resolución DIAN
--      activa configurada en `dian_numbering` para su ambiente
--      (producción/pruebas, según `companies.fe_test_mode`), usa
--      `next_dian_number()` en vez del contador interno `FAC-`. Si la
--      empresa NO tiene resolución DIAN activa (el caso de TODAS las
--      empresas reales hoy, confirmado con la usuaria), el comportamiento
--      es exactamente el mismo de siempre — cero cambio de comportamiento
--      hasta que alguien configure una resolución real.
--
-- Es seguro correr esta migración en Supabase ahora mismo.
-- ============================================================================

-- ── 1) Captura de next_doc_number (sin cambios de comportamiento) ──────────
CREATE OR REPLACE FUNCTION public.next_doc_number(p_company_id uuid, p_doc_type text, p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO doc_sequences (company_id, doc_type, last_number)
  VALUES (p_company_id, p_doc_type, 1)
  ON CONFLICT (company_id, doc_type)
  DO UPDATE SET last_number = doc_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN p_prefix || LPAD(v_next::text, 6, '0');
END;
$function$;

-- ── 2) Infraestructura dian_numbering / next_dian_number (idempotente;
--       ya aplicada en vivo el 5 nov 2026, se deja aquí como respaldo) ─────
CREATE TABLE IF NOT EXISTS public.dian_numbering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  prefix text NOT NULL,
  resolution_number text NOT NULL,
  resolution_date date,
  range_from bigint NOT NULL,
  range_to bigint NOT NULL,
  current_number bigint NOT NULL DEFAULT 0,
  validity_from date,
  validity_to date,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dian_numbering_range_valid CHECK (range_to >= range_from),
  CONSTRAINT dian_numbering_status_valid CHECK (status IN ('active','exhausted','expired','inactive')),
  CONSTRAINT dian_numbering_environment_valid CHECK (environment IN ('production','test'))
);

CREATE UNIQUE INDEX IF NOT EXISTS dian_numbering_one_active_idx
  ON public.dian_numbering (company_id, document_type, environment)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS dian_numbering_company_idx
  ON public.dian_numbering (company_id);

ALTER TABLE public.dian_numbering ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dian_numbering'
      AND policyname = 'dian_numbering_select_own_company'
  ) THEN
    CREATE POLICY dian_numbering_select_own_company
      ON public.dian_numbering FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.next_dian_number(
  p_company_id uuid,
  p_document_type text,
  p_environment text DEFAULT 'production'
)
RETURNS TABLE(
  full_number text,
  numeric_number bigint,
  prefix text,
  resolution_number text,
  resolution_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_row public.dian_numbering%ROWTYPE;
  v_next bigint;
BEGIN
  SELECT * INTO v_row
  FROM public.dian_numbering
  WHERE company_id = p_company_id
    AND document_type = p_document_type
    AND environment = p_environment
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una resolución DIAN activa para esta empresa (tipo: %, ambiente: %)', p_document_type, p_environment;
  END IF;

  IF v_row.validity_to IS NOT NULL AND CURRENT_DATE > v_row.validity_to THEN
    UPDATE public.dian_numbering SET status = 'expired', updated_at = now() WHERE id = v_row.id;
    RAISE EXCEPTION 'La resolución DIAN % ya venció (vigente hasta %)', v_row.resolution_number, v_row.validity_to;
  END IF;

  v_next := GREATEST(v_row.current_number, v_row.range_from - 1) + 1;

  IF v_next > v_row.range_to THEN
    UPDATE public.dian_numbering SET status = 'exhausted', updated_at = now() WHERE id = v_row.id;
    RAISE EXCEPTION 'El rango autorizado por la resolución DIAN % ya se agotó (hasta %)', v_row.resolution_number, v_row.range_to;
  END IF;

  UPDATE public.dian_numbering
  SET current_number = v_next, updated_at = now()
  WHERE id = v_row.id;

  RETURN QUERY SELECT
    v_row.prefix || v_next::text,
    v_next,
    v_row.prefix,
    v_row.resolution_number,
    v_row.resolution_date;
END;
$function$;

-- ── 3) approve_quote: usa next_dian_number() para facturas de empresas con
--       resolución DIAN activa; para todo lo demás (tiquets, y facturas de
--       empresas sin resolución DIAN) sigue exactamente igual que antes ────
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
  v_dian_environment text;
  v_dian_active boolean;
  v_dian_result record;
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

  -- Comprobante contable automático (función compartida, migración 025)
  PERFORM public._post_sale_journal_entry(v_invoice_id);

  RETURN v_invoice_id;
END;
$function$;
