-- 🚀 SETUP RÁPIDO: Ejecutar en Supabase SQL Editor
-- Copia y pega todo este script de una vez

-- 1. Crear tablas si no existen
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- 2. Crear empresa de prueba
INSERT INTO companies (name) VALUES ('Mi Empresa S.A.')
ON CONFLICT DO NOTHING;

-- 3. Políticas RLS para companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view companies they belong to" ON companies;
CREATE POLICY "Users can view companies they belong to" ON companies
FOR SELECT USING (
  id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- 4. Políticas RLS para company_users
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their company memberships" ON company_users;
CREATE POLICY "Users can view their company memberships" ON company_users
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their company memberships" ON company_users;
CREATE POLICY "Users can insert their company memberships" ON company_users
FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. Políticas RLS para customers (corregidas)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company customers" ON customers;
CREATE POLICY "Users can view their company customers" ON customers
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert customers for their companies" ON customers;
CREATE POLICY "Users can insert customers for their companies" ON customers
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their company customers" ON customers;
CREATE POLICY "Users can update their company customers" ON customers
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their company customers" ON customers;
CREATE POLICY "Users can delete their company customers" ON customers
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- ✅ SETUP COMPLETADO
-- Ahora necesitas agregar manualmente al usuario:
-- INSERT INTO company_users (user_id, company_id, role)
-- SELECT 'TU_USER_ID_DEL_AUTH', (SELECT id FROM companies WHERE name = 'Mi Empresa S.A.'), 'admin';