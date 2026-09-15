-- ============================================================
-- MIGRACIÓN 012: Corregir política RLS de SELECT en company_users
--
-- CONTEXTO / BUG ENCONTRADO:
-- La política de lectura vigente en la base de datos real es
-- "USING (user_id = auth.uid())" (viene de supabase/setup-rapido.sql o
-- supabase/init-multiempresa.sql, el script inicial con el que se creó
-- esta tabla). Esto significa que un usuario SOLO puede ver su propia
-- fila en company_users — nunca las de sus compañeros de equipo.
--
-- Efecto observado: la pantalla Configuración > Equipo siempre mostraba
-- únicamente al usuario que la estaba mirando, sin importar cuántos
-- colaboradores tuviera realmente la empresa (ni el refresco de caché en
-- el frontend arregla esto, porque el problema es que el propio query a
-- Supabase ya vuelve con una sola fila).
--
-- FIX: igual que ya se hace para `companies` y `customers` en
-- setup-rapido.sql, se cambia la condición para que un usuario pueda ver
-- TODAS las filas de company_users de cualquier empresa a la que
-- pertenezca (no solo la suya propia).
-- ============================================================

DROP POLICY IF EXISTS "Users can view their company memberships" ON company_users;

CREATE POLICY "Users can view company memberships in their companies" ON company_users
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- ============================================================
-- VERIFICACIÓN (opcional, ejecutar como usuario autenticado normal):
--   SELECT * FROM company_users WHERE company_id = '<tu company_id>';
--   -- Antes del fix: solo devolvía tu propia fila.
--   -- Después del fix: devuelve todas las filas de esa empresa.
-- ============================================================
