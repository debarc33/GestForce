-- ============================================================
-- MIGRACIÓN 032: Roles y permisos editables por empresa
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Reemplaza la lista fija de 4 roles (admin/contador/vendedor/
-- readonly) por una tabla editable por empresa, más una tabla de
-- permisos por módulo (Sin acceso / Solo ver / Puede editar).
--
-- IMPORTANTE: el rol "admin" queda protegido a propósito (no se
-- puede renombrar ni borrar desde la pantalla nueva) porque el
-- resto del código (requireCompanyAdmin, en
-- src/lib/auth/require-company-admin.ts) sigue reconociendo ese
-- nombre literal para decidir quién administra usuarios y
-- suscripción -- cambiar esto NO se tocó en este lote, a propósito,
-- para no arriesgar el acceso de administrador de nadie.
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- true SOLO para el rol "admin" sembrado abajo -- bloquea
  -- renombrar/borrar desde la API (ver rutas /api/company/roles/*).
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles(company_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_can_read_roles"
  ON roles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- NOTA: INSERT/UPDATE/DELETE solo desde /api/company/roles/* con el
-- cliente admin (service_role) -- mismo patrón que company_modules y
-- company_users. Ningún usuario normal puede escribir aquí directo.

CREATE TABLE IF NOT EXISTS role_permissions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id     TEXT NOT NULL,
  -- 'none' (sin acceso) | 'view' (solo ver) | 'edit' (puede editar)
  access_level  TEXT NOT NULL DEFAULT 'edit' CHECK (access_level IN ('none', 'view', 'edit')),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_can_read_role_permissions"
  ON role_permissions
  FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- TRIGGER: sembrar los 4 roles de siempre automáticamente para
-- CUALQUIER empresa nueva que se cree de ahora en adelante (sea por
-- el panel superadmin o por cualquier otro flujo futuro). Sin esto,
-- una empresa creada después de correr esta migración empezaría sin
-- ningún rol -- e invitar un colaborador se rompería, porque no
-- habría ningún rol válido para asignarle.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_roles_for_new_company()
RETURNS TRIGGER AS $$
DECLARE
  rid UUID;
  role_name TEXT;
  mod_id TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['admin', 'contador', 'vendedor', 'readonly'] LOOP
    INSERT INTO roles (company_id, name, is_system)
    VALUES (NEW.id, role_name, role_name = 'admin')
    RETURNING id INTO rid;

    FOREACH mod_id IN ARRAY ARRAY['ventas', 'compras', 'inventario', 'nomina', 'contabilidad', 'finanzas'] LOOP
      INSERT INTO role_permissions (role_id, module_id, access_level)
      VALUES (rid, mod_id, 'edit');
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_default_roles ON companies;
CREATE TRIGGER trg_seed_default_roles
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_roles_for_new_company();

-- ============================================================
-- SIEMBRA: los 4 roles de siempre, para cada empresa que ya existe,
-- en 'edit' (acceso completo) en todos los módulos activables.
--
-- A propósito NO se restringe nada todavía (ni siquiera "readonly"
-- queda en solo-ver por defecto): el día que se corre esta
-- migración, el acceso real de cada usuario sigue exactamente
-- igual que hoy. Ajustar los permisos a mano después, desde
-- Configuración → Roles y permisos, es responsabilidad de cada
-- empresa -- nadie pierde acceso a nada por sorpresa.
--
-- Si en el futuro se agrega un módulo nuevo a TOGGLEABLE_MODULES
-- (src/config/modules.ts), agregar su id también en la lista VALUES
-- de abajo para que los roles de sistema lo sembren con 'edit'.
-- ============================================================

INSERT INTO roles (company_id, name, is_system)
SELECT DISTINCT c.id, r.name, (r.name = 'admin')
FROM companies c
CROSS JOIN (VALUES ('admin'), ('contador'), ('vendedor'), ('readonly')) AS r(name)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO role_permissions (role_id, module_id, access_level)
SELECT ro.id, m.module_id, 'edit'
FROM roles ro
CROSS JOIN (VALUES ('ventas'), ('compras'), ('inventario'), ('nomina'), ('contabilidad'), ('finanzas')) AS m(module_id)
WHERE ro.name IN ('admin', 'contador', 'vendedor', 'readonly')
ON CONFLICT (role_id, module_id) DO NOTHING;

-- VERIFICACIÓN SUGERIDA DESPUÉS DE CORRER ESTO:
-- SELECT c.name AS empresa, r.name AS rol, r.is_system, count(rp.id) AS modulos_con_permiso
-- FROM roles r JOIN companies c ON c.id = r.company_id
-- LEFT JOIN role_permissions rp ON rp.role_id = r.id
-- GROUP BY c.name, r.name, r.is_system ORDER BY c.name, r.name;
