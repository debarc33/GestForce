-- ============================================================
-- MIGRACIÓN 004: Renombrar module_id en company_modules
-- para reflejar la nueva estructura de módulos agrupados.
--
-- EJECUTAR EN DOS PASOS:
--   PASO 1: Insertar nuevos IDs (antes de desplegar el código)
--   PASO 2: Borrar IDs viejos (después de verificar que todo funciona)
-- ============================================================

-- ============================================================
-- PASO 1: Insertar filas con los nuevos module_id
-- (Seguros de ejecutar — no borran nada)
-- ============================================================

-- customers + products + sales → ventas
INSERT INTO company_modules (company_id, module_id, is_enabled, updated_at)
SELECT company_id, 'ventas', BOOL_OR(is_enabled), NOW()
FROM company_modules
WHERE module_id IN ('customers', 'products', 'sales')
GROUP BY company_id
ON CONFLICT (company_id, module_id) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled, updated_at = EXCLUDED.updated_at;

-- purchases → compras
INSERT INTO company_modules (company_id, module_id, is_enabled, updated_at)
SELECT company_id, 'compras', is_enabled, NOW()
FROM company_modules WHERE module_id = 'purchases'
ON CONFLICT (company_id, module_id) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled, updated_at = EXCLUDED.updated_at;

-- products + inventory → inventario
INSERT INTO company_modules (company_id, module_id, is_enabled, updated_at)
SELECT company_id, 'inventario', BOOL_OR(is_enabled), NOW()
FROM company_modules
WHERE module_id IN ('products', 'inventory')
GROUP BY company_id
ON CONFLICT (company_id, module_id) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled, updated_at = EXCLUDED.updated_at;

-- payroll → nomina
INSERT INTO company_modules (company_id, module_id, is_enabled, updated_at)
SELECT company_id, 'nomina', is_enabled, NOW()
FROM company_modules WHERE module_id = 'payroll'
ON CONFLICT (company_id, module_id) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled, updated_at = EXCLUDED.updated_at;

-- accounting → contabilidad
INSERT INTO company_modules (company_id, module_id, is_enabled, updated_at)
SELECT company_id, 'contabilidad', is_enabled, NOW()
FROM company_modules WHERE module_id = 'accounting'
ON CONFLICT (company_id, module_id) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled, updated_at = EXCLUDED.updated_at;

-- finances → finanzas
INSERT INTO company_modules (company_id, module_id, is_enabled, updated_at)
SELECT company_id, 'finanzas', is_enabled, NOW()
FROM company_modules WHERE module_id = 'finances'
ON CONFLICT (company_id, module_id) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled, updated_at = EXCLUDED.updated_at;

-- VERIFICACIÓN PASO 1:
-- SELECT module_id, COUNT(*) FROM company_modules GROUP BY module_id ORDER BY module_id;

-- ============================================================
-- PASO 2: Borrar IDs viejos
-- (Ejecutar SOLO después de verificar que el nuevo código funciona)
-- ============================================================

-- DELETE FROM company_modules
-- WHERE module_id IN (
--   'customers', 'products', 'sales',
--   'purchases', 'inventory', 'finances',
--   'accounting', 'payroll', 'reports'
-- );

-- ============================================================
-- NOTA: Si company_modules tiene un CHECK constraint sobre
-- module_id, verificar con:
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'company_modules'::regclass AND contype = 'c';
-- Si existe, actualizarlo antes de ejecutar el Paso 1.
-- ============================================================
