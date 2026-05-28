-- ============================================================
-- MIGRACIÓN 002: Tabla superadmins + marcar usuario superadmin
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla de superadmins
-- Sólo el service_role puede leer/modificar esta tabla
CREATE TABLE IF NOT EXISTS superadmins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS habilitado SIN políticas = ningún cliente anon/authenticated puede leer
-- Solo el service_role (Panel Superadmin) puede acceder a esta tabla
ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COLUMNA is_active en companies
-- Permite al superadmin activar/desactivar empresas
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- MARCAR TU USUARIO COMO SUPERADMIN
--
-- 1. Reemplaza 'TU_EMAIL@aqui.com' con tu email real
-- 2. Esto establece app_metadata.is_superadmin = true en el JWT
--    (solo editable con service_role, los usuarios no pueden modificarlo)
-- 3. También inserta en la tabla superadmins para auditoría
--
-- IMPORTANTE: app_metadata es diferente a user_metadata.
--   - user_metadata: el usuario puede editarlo (inseguro para permisos)
--   - app_metadata: solo service_role puede editarlo (seguro)
-- ============================================================

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_superadmin": true}'::jsonb
WHERE email = 'TU_EMAIL@aqui.com';  -- ← CAMBIAR por tu email

INSERT INTO superadmins (user_id)
SELECT id FROM auth.users WHERE email = 'TU_EMAIL@aqui.com'  -- ← CAMBIAR
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- VERIFICACIÓN: Comprobar que quedó correcto
-- SELECT id, email, raw_app_meta_data FROM auth.users
-- WHERE email = 'TU_EMAIL@aqui.com';
--
-- Deberías ver: raw_app_meta_data contiene {"is_superadmin": true}
-- ============================================================
