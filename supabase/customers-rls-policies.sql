-- Políticas RLS para la tabla customers - ARQUITECTURA MULTIEMPRESA
-- Ejecutar estas políticas en el SQL Editor de Supabase

-- Habilitar RLS en la tabla customers (si no está habilitado)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Los usuarios pueden ver clientes de compañías a las que pertenecen
CREATE POLICY "Users can view their company customers" ON customers
FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- Política para INSERT: Los usuarios pueden crear clientes para compañías a las que pertenecen
CREATE POLICY "Users can insert customers for their companies" ON customers
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- Política para UPDATE: Los usuarios pueden actualizar clientes de compañías a las que pertenecen
CREATE POLICY "Users can update their company customers" ON customers
FOR UPDATE USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);

-- Política para DELETE: Los usuarios pueden eliminar clientes de compañías a las que pertenecen
CREATE POLICY "Users can delete their company customers" ON customers
FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  )
);