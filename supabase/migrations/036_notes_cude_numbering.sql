-- ============================================================================
-- Migración 036: CUDE + numeración atómica para Notas Crédito/Débito (Fase G
-- del plan de acción de facturación electrónica, ver
-- claude/plan-accion-facturacion-dian.md).
--
-- Contexto (5 nov 2026): las Notas Crédito/Débito (tabla credit_debit_notes)
-- no tenían ninguna columna para guardar su CUDE/XML (a diferencia de
-- invoices, que ya las tiene desde la migración 034), y su numeración
-- (create_credit_debit_note, respaldada en la migración 024) usaba
-- `SELECT MAX(...)+1` SIN bloqueo de fila -- una condición de carrera real
-- (dos notas creadas al mismo tiempo para la misma empresa podrían terminar
-- con el mismo número), independiente de cualquier tema DIAN.
--
-- Esta migración:
--   1) Agrega a credit_debit_notes las columnas cude/xml_ubl/fe_generated_at
--      (nullable, igual patrón que la 034 para invoices -- no toca ningún
--      dato existente).
--   2) Siembra doc_sequences a partir de los números YA existentes en
--      credit_debit_notes, para que el cambio al contador atómico
--      (next_doc_number) no choque con la nota de prueba NC-0001 ni con
--      ninguna nota real que exista para cuando esto se corra.
--   3) Reescribe create_credit_debit_note():
--        a) Numeración atómica: usa next_dian_number() si la empresa tiene
--           una resolución DIAN activa para 'credit_note'/'debit_note' en su
--           ambiente (idéntico patrón a approve_quote, migración 033); si no
--           (el caso de TODAS las empresas reales hoy), usa next_doc_number()
--           -- mismo comportamiento de siempre, solo que ahora sin condición
--           de carrera.
--        b) Agrega el chequeo de acceso `p_company_id NOT IN user_company_ids()`
--           que faltaba (sí lo tienen approve_quote y create_quote_with_items;
--           aquí se había quedado afuera). Esto SOLO bloquea un uso indebido
--           (pasar el company_id de otra empresa); no cambia el comportamiento
--           para ningún uso legítimo existente.
--
-- El CUDE y el XML en sí (igual que el CUFE/XML de facturas, Fase C) se
-- calculan y persisten aparte, del lado del servidor, cuando alguien pide el
-- XML DIAN de la nota -- ver /api/sales/documents/xml (extendida en este
-- mismo cambio para aceptar notas, no solo facturas).
--
-- Es seguro correr esta migración en Supabase ahora mismo.
-- ============================================================================

-- ── 1) Columnas CUDE/XML en credit_debit_notes (aditivo) ────────────────────
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS cude text;
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS xml_ubl text;
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS fe_generated_at timestamptz;

-- ── 2) Siembra de doc_sequences desde los números ya existentes ────────────
-- Toma el número más alto ya usado por cada empresa/tipo (extrayendo los
-- dígitos finales de note_number, sea cual sea su formato -- "NC-0001" o
-- "NC-000001") y lo deja como punto de partida en doc_sequences, para que
-- next_doc_number() continúe desde ahí sin repetir ningún número.
INSERT INTO public.doc_sequences (company_id, doc_type, last_number)
SELECT
  company_id,
  CASE type WHEN 'credit' THEN 'credit_note' ELSE 'debit_note' END,
  MAX(COALESCE(NULLIF(regexp_replace(note_number, '\D', '', 'g'), '')::integer, 0))
FROM public.credit_debit_notes
GROUP BY company_id, CASE type WHEN 'credit' THEN 'credit_note' ELSE 'debit_note' END
ON CONFLICT (company_id, doc_type)
DO UPDATE SET last_number = GREATEST(public.doc_sequences.last_number, EXCLUDED.last_number);

-- ── 3) create_credit_debit_note(): numeración atómica + chequeo de acceso ──
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

  RETURN v_note_id;
END;
$function$;
