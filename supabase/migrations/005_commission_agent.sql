-- ============================================================
-- MIGRACIÓN 005: Agente de comisión en empleados y facturas
--
-- 1. Agrega `commission_rate` a la tabla `employees`
--    (solo aplica cuando contract_type = 'comision')
-- 2. Agrega `agent_id` a la tabla `invoices`
--    (FK nullable → employees, SET NULL al eliminar empleado)
-- ============================================================

-- Empleados: porcentaje de comisión (5 = 5 %, 12.5 = 12.5 %)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(6,2) DEFAULT NULL;

-- Facturas: agente que generó la venta
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS agent_id UUID
    REFERENCES employees(id) ON DELETE SET NULL DEFAULT NULL;

-- Índice para consultas de comisiones por agente
CREATE INDEX IF NOT EXISTS idx_invoices_agent_id
  ON invoices(agent_id)
  WHERE agent_id IS NOT NULL;

-- ============================================================
-- VERIFICACIÓN:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'employees' AND column_name = 'commission_rate';
--
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'invoices' AND column_name = 'agent_id';
-- ============================================================
