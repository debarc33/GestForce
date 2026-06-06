-- Tabla para gestionar múltiples proveedores de pago
CREATE TABLE payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE, -- 'bold', 'wompi', 'stripe', etc.
  display_name VARCHAR(100) NOT NULL, -- 'Bold', 'Wompi', 'Stripe', etc.
  is_active BOOLEAN DEFAULT FALSE,
  webhook_url TEXT, -- URL donde recibiremos los webhooks
  webhook_secret TEXT, -- Secret para validar webhooks
  -- Configuración JSON flexible para guardar credenciales
  config JSONB DEFAULT '{}', -- { "api_key": "...", "secret_key": "...", etc }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS: Solo superadmin puede ver y editar
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_select" ON payment_providers
  FOR SELECT USING (auth.jwt() ->> 'is_superadmin' = 'true');

CREATE POLICY "superadmin_insert" ON payment_providers
  FOR INSERT WITH CHECK (auth.jwt() ->> 'is_superadmin' = 'true');

CREATE POLICY "superadmin_update" ON payment_providers
  FOR UPDATE USING (auth.jwt() ->> 'is_superadmin' = 'true');

CREATE POLICY "superadmin_delete" ON payment_providers
  FOR DELETE USING (auth.jwt() ->> 'is_superadmin' = 'true');

-- Índices
CREATE INDEX payment_providers_name_idx ON payment_providers(name);
CREATE INDEX payment_providers_is_active_idx ON payment_providers(is_active);

-- Inicializar con Bold como proveedor por defecto
INSERT INTO payment_providers (name, display_name, is_active)
VALUES
  ('bold', 'Bold', TRUE),
  ('wompi', 'Wompi', FALSE),
  ('stripe', 'Stripe', FALSE)
ON CONFLICT (name) DO NOTHING;
