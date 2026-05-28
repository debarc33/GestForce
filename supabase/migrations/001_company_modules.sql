-- ============================================================
-- MIGRACIÓN 001: Tabla company_modules
-- Almacena qué módulos están habilitados por empresa
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS company_modules (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id   TEXT NOT NULL,
  -- Valores posibles: 'customers' | 'products' | 'sales' | 'purchases'
  --                   'inventory' | 'finances' | 'accounting' | 'payroll'
  --                   'reports'
  -- Nota: 'dashboard' y 'settings' son siempre activos, no se almacenan aquí
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(company_id, module_id)
);

-- Índice para búsquedas rápidas por empresa
CREATE INDEX IF NOT EXISTS idx_company_modules_company_id
  ON company_modules(company_id);

-- RLS: Habilitar seguridad a nivel fila
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

-- Los miembros de una empresa pueden VER los módulos de su empresa
-- Esto permite que el sidebar filtre los módulos correctamente en el cliente
CREATE POLICY "company_members_can_read_modules"
  ON company_modules
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- NOTA IMPORTANTE:
-- INSERT / UPDATE / DELETE solo se realizan desde el Panel Superadmin
-- usando el cliente service_role (createAdminClient) que bypasea RLS.
-- Los usuarios normales NO pueden modificar sus propios módulos.

-- ============================================================
-- SEMILLA OPCIONAL: Si quieres pre-cargar todos los módulos
-- como habilitados para una empresa existente, usa:
--
-- INSERT INTO company_modules (company_id, module_id, is_enabled)
-- SELECT
--   '<TU_COMPANY_ID>',
--   unnest(ARRAY['customers','products','sales','purchases',
--               'inventory','finances','accounting','payroll','reports']),
--   true
-- ON CONFLICT (company_id, module_id) DO NOTHING;
--
-- PERO NO ES NECESARIO: Si no hay filas para una empresa,
-- el código TypeScript asume que TODOS los módulos están activos
-- (retrocompatibilidad con empresas existentes).
-- ============================================================
