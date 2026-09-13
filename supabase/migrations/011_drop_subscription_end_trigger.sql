-- ============================================================
-- MIGRACIÓN 011: Eliminar el trigger que recalcula subscription_end
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================
--
-- CONTEXTO:
-- La migración 003 instaló un trigger (set_subscription_end) que forzaba
-- subscription_end = subscription_start + subscription_period en cada
-- INSERT/UPDATE. Eso sobreescribía:
--   1. El período de prueba (trial de N días) al crear una empresa, que
--      terminaba durando el período completo (bug silencioso).
--   2. Cualquier ajuste manual de fechas desde el panel de superadmin.
--
-- A partir de ahora la APLICACIÓN controla las fechas explícitamente:
--   - Creación de empresa: subscription_end = hoy + trial_days
--   - Pago (webhook): subscription_end = base + período (con stacking)
--   - Ajuste manual superadmin: subscription_end = inicio + días definidos
--
-- Es seguro ejecutar esta migración exista o no el trigger (IF EXISTS).
-- ============================================================

DROP TRIGGER IF EXISTS set_subscription_end ON companies;
DROP FUNCTION IF EXISTS trigger_set_subscription_end();

-- Se conserva la función calculate_subscription_end() por si se quiere
-- usar manualmente; no está atada a ningún trigger.

-- ============================================================
-- VERIFICACIÓN (opcional):
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'companies'::regclass;
-- -- 'set_subscription_end' NO debe aparecer en el resultado.
-- ============================================================
