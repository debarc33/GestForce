-- 018_test_payment_kind.sql
-- Permite un nuevo "kind" en one_time_purchases: 'test_payment', usado para
-- validar de punta a punta la integracion de Bold (cobro real muy pequeno,
-- $3.000 COP) sin tocar planes, periodos ni la fecha de vencimiento de
-- ninguna empresa. Se busca el nombre real del CHECK constraint sobre
-- "kind" en vez de asumirlo, por si Postgres lo auto-nombro distinto.

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.one_time_purchases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%kind%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.one_time_purchases DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.one_time_purchases
  ADD CONSTRAINT one_time_purchases_kind_check
  CHECK (kind IN ('dian_invoice_pack', 'test_payment'));
