-- ============================================================
-- MIGRACIÓN 013: Corregir recursión infinita introducida por la 012
--
-- BUG: la política 012 sobre company_users usaba, dentro de su propia
-- condición USING, un subquery que vuelve a leer company_users:
--
--   CREATE POLICY "..." ON company_users
--   FOR SELECT USING (
--     company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
--   )
--
-- Postgres, al evaluar el SELECT sobre company_users, tiene que aplicar
-- esta misma política — que a su vez dispara otro SELECT sobre
-- company_users — y así indefinidamente: "infinite recursion detected in
-- policy for relation company_users". Esto rompió TODO acceso a esa
-- tabla (selección de empresa, equipo, etc.), no solo la visibilidad de
-- compañeros de equipo que se quería arreglar con la 012.
--
-- El mismo patrón "company_id IN (SELECT ... FROM company_users ...)" es
-- seguro en companies/customers (políticas ya existentes) porque ahí el
-- subquery lee una tabla DISTINTA a la que tiene la política. El
-- problema es específico de aplicar ese patrón sobre la propia
-- company_users.
--
-- FIX: una función SECURITY DEFINER que consulta company_users con los
-- privilegios de su dueño (bypaseando RLS internamente), rompiendo así
-- el ciclo. Es el patrón que la propia documentación de Supabase
-- recomienda para este caso exacto.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
$$;

DROP POLICY IF EXISTS "Users can view company memberships in their companies" ON company_users;

CREATE POLICY "Users can view company memberships in their companies" ON company_users
FOR SELECT USING (
  company_id IN (SELECT public.get_my_company_ids())
);

-- ============================================================
-- VERIFICACIÓN:
--   SELECT * FROM company_users WHERE company_id = '<tu company_id>';
--   -- No debe dar error de recursión, y debe devolver todas las filas
--   -- de esa empresa (no solo la tuya).
-- ============================================================
