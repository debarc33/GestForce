-- Create payment_orders table
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Detalles del pedido
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'COP',

  -- Período a activar
  subscription_period TEXT NOT NULL CHECK (subscription_period IN ('3_months', '6_months', '1_year')),
  billing_start_date DATE NOT NULL,
  billing_end_date DATE NOT NULL,

  -- Estado de pago
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Proveedor
  provider TEXT NOT NULL,
  provider_id TEXT UNIQUE,
  provider_response JSONB,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Superadmin only
CREATE POLICY "superadmin_payment_orders" ON payment_orders
  FOR ALL USING (
    auth.jwt() ->> 'app_metadata'::text ->> 'is_superadmin'::text = 'true'
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_orders_company_id ON payment_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_id ON payment_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders(created_at DESC);
