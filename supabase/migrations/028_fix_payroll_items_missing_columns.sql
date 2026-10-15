-- ============================================================
-- MIGRACIÓN 028: agrega columnas faltantes en payroll_items
--
-- BUG ENCONTRADO (15 oct 2026, probando en vivo Nómina → Liquidar):
-- al hacer clic en "Abrir nómina" o "Regenerar", la app mostraba
-- "No hay empleados activos para liquidar" para CUALQUIER período
-- (incluso uno nunca antes abierto), a pesar de existir empleados
-- activos confirmados en la pestaña Empleados.
--
-- El error NO era de permisos/RLS (hipótesis inicial descartada):
-- se confirmó interceptando las llamadas reales a Supabase que el
-- error real, silenciado por el bloque try/catch de
-- handleOpenPeriod() (solo hacía console.error, sin aviso visible
-- al usuario), era:
--
--   PGRST204 — "Could not find the 'cesantias_interest' column of
--   'payroll_items' in the schema cache"
--
-- CAUSA RAÍZ: a diferencia de la mayoría de tablas del módulo de
-- nómina, "payroll_items" y "payroll_periods" NUNCA se crearon por
-- migración de código (no hay ningún CREATE TABLE para ellas en
-- supabase/migrations/) — se crearon a mano en el SQL Editor de
-- Supabase en el origen del proyecto. Cuando más adelante se agregó
-- al código el cálculo de prestaciones sociales proporcionales
-- (cesantías, intereses sobre cesantías, prima, vacaciones
-- acumuladas — ver calcPrestaciones() en queries.ts), la tabla real
-- en la base de datos nunca se actualizó para incluir esas columnas
-- nuevas. Como generatePayrollItems() siempre intenta insertar con
-- TODAS las columnas (incluidas las de prestaciones), el INSERT
-- fallaba de punta a punta para cualquier período, dejando
-- "payroll_items" permanentemente vacía.
--
-- FIX: se agregan (de forma seguro/idempotente, con IF NOT EXISTS)
-- todas las columnas que el código ya espera poder escribir en
-- "payroll_items", por si falta más de una. Las que ya existan no
-- se tocan ni se redefinen.
-- ============================================================

ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS salary                NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS transport_allowance   NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS overtime_pay          NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS bonuses               NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS other_income          NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS gross_pay             NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS health_employee       NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS pension_employee      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS withholding_tax       NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS other_deductions      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS total_deductions      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS net_pay               NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS health_employer       NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS pension_employer      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS arl                   NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS ccf                   NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS icbf                  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS sena                  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS total_employer_cost   NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS worked_days           INTEGER       NOT NULL DEFAULT 30;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS unpaid_days           INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS vacation_days_taken   INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS sick_days             INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS cesantias_month       NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS cesantias_interest    NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS prima_month           NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS vacation_days_accrued NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS notes                 TEXT;

-- ============================================================
-- VERIFICACIÓN:
--   Desde la app, en Nómina > Liquidar, seleccionar un período
--   (nuevo o existente) y hacer clic en "Abrir nómina" / "Regenerar" —
--   ya no debe aparecer "No hay empleados activos para liquidar";
--   deben listarse los empleados activos con sus valores calculados.
-- ============================================================
