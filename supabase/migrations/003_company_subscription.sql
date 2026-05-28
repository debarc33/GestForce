-- ============================================================
-- MIGRACIÓN 003: Campos de suscripción en companies
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Período contratado: '3_months' | '6_months' | '1_year'
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_period TEXT DEFAULT '1_year'
    CHECK (subscription_period IN ('3_months', '6_months', '1_year'));

-- Fecha de inicio de la suscripción (auto al crear)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_start DATE DEFAULT CURRENT_DATE;

-- Fecha de vencimiento (calculada automáticamente por trigger)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_end DATE;

-- Estado de pago:
--   'pending'  → registrada pero sin pago confirmado
--   'active'   → pago confirmado, dentro del período
--   'expired'  → venció el período
--   'suspended'→ suspendida manualmente por el superadmin
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending'
    CHECK (subscription_status IN ('pending', 'active', 'expired', 'suspended'));

-- ============================================================
-- FUNCIÓN: Calcular fecha de vencimiento según el período
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_subscription_end(
  start_date DATE,
  period TEXT
) RETURNS DATE AS $$
BEGIN
  RETURN CASE period
    WHEN '3_months' THEN start_date + INTERVAL '3 months'
    WHEN '6_months' THEN start_date + INTERVAL '6 months'
    WHEN '1_year'   THEN start_date + INTERVAL '1 year'
    ELSE start_date + INTERVAL '1 year'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- TRIGGER: Calcular subscription_end automáticamente al
-- insertar o actualizar period/start
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_subscription_end()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_start IS NOT NULL AND NEW.subscription_period IS NOT NULL THEN
    NEW.subscription_end := calculate_subscription_end(
      NEW.subscription_start,
      NEW.subscription_period
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_subscription_end ON companies;
CREATE TRIGGER set_subscription_end
  BEFORE INSERT OR UPDATE OF subscription_start, subscription_period
  ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_subscription_end();

-- ============================================================
-- Actualizar empresas existentes que no tengan subscription_end
-- ============================================================
UPDATE companies
SET subscription_end = calculate_subscription_end(
  COALESCE(subscription_start, CURRENT_DATE),
  COALESCE(subscription_period, '1_year')
)
WHERE subscription_end IS NULL;

-- ============================================================
-- VERIFICACIÓN:
-- SELECT name, subscription_start, subscription_period,
--        subscription_end, subscription_status
-- FROM companies;
-- ============================================================
