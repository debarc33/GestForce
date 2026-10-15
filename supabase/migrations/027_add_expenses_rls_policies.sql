-- ============================================================
-- MIGRACIÓN 027: agrega RLS (seguridad a nivel de fila) a las tablas
-- del módulo de Gastos — expense_categories, expenses, recurring_expenses
--
-- BUG ENCONTRADO (15 oct 2026, probando en vivo Finanzas → Gastos):
-- al intentar registrar un gasto nuevo desde la app, Postgres devolvía
-- el error "new row violates row-level security policy for table
-- \"expenses\"". Además, la lista de gastos del período siempre
-- aparecía vacía ("No hay gastos registrados en este período"),
-- incluso sin haber creado ninguno todavía para confirmarlo — es
-- decir, no era solo que no se pudiera crear un gasto nuevo: tampoco
-- se podía LEER ninguno (una lectura bloqueada por RLS no da error,
-- simplemente no devuelve filas, por eso pasaba desapercibido).
--
-- CAUSA RAÍZ: la migración 006, que crea estas tres tablas
-- (expense_categories, expenses, recurring_expenses), nunca agregó
-- ninguna política RLS para ellas. A diferencia de tablas como
-- companies/customers/invoices (creadas a mano en el SQL Editor de
-- Supabase en el origen del proyecto, ya con sus políticas incluidas),
-- estas tres tablas se crearon después, solo por migración de código,
-- y se quedaron sin ninguna política — con RLS activado por defecto en
-- el proyecto para tablas nuevas, eso equivale a bloquear todo acceso
-- (lectura y escritura) para cualquier usuario normal de la app.
--
-- Esto significa que el módulo Finanzas → Gastos nunca funcionó de
-- punta a punta en ninguna empresa, a pesar de que su lógica (incluidos
-- los 5 fixes del 13 oct 2026, commit c78a6c1) ya estaba correcta.
--
-- FIX: se agregan las 3 tablas con el mismo patrón ya usado en el resto
-- de la app (ver migración 013, función public.get_my_company_ids()):
-- un usuario puede ver/crear/editar/borrar filas de cualquier empresa a
-- la que pertenezca, nunca de otra.
-- ============================================================

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_expense_categories" ON expense_categories
  FOR ALL
  USING (company_id IN (SELECT public.get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "company_members_expenses" ON expenses
  FOR ALL
  USING (company_id IN (SELECT public.get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "company_members_recurring_expenses" ON recurring_expenses
  FOR ALL
  USING (company_id IN (SELECT public.get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

-- ============================================================
-- VERIFICACIÓN:
--   Desde la app, en Finanzas > Gastos, registrar un gasto nuevo —
--   ya no debe aparecer el error de row-level security, y debe quedar
--   visible en la lista del período.
-- ============================================================
