-- Script de inicialización para arquitectura multiempresa
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear tabla company_users si no existe
CREATE TABLE IF NOT EXISTS company_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- 2. Crear tabla companies si no existe
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Agregar foreign key constraint si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_users_company_id_fkey'
  ) THEN
    ALTER TABLE company_users
    ADD CONSTRAINT company_users_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Crear empresa de prueba
INSERT INTO companies (name) VALUES ('Mi Empresa S.A.')
ON CONFLICT DO NOTHING;

-- 5. Políticas RLS para companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view companies they belong to" ON companies
FOR SELECT USING (
  id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- 6. Políticas RLS para company_users
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company memberships" ON company_users
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their company memberships" ON company_users
FOR INSERT WITH CHECK (user_id = auth.uid());

-- NOTA: Después de ejecutar este script, necesitas:
-- 1. Obtener el ID del usuario autenticado desde auth.users
-- 2. Insertar manualmente una fila en company_users con ese user_id y el company_id de la empresa creada