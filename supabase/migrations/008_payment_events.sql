-- Create payment_events table
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  provider_event_data JSONB,

  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Superadmin only
CREATE POLICY "superadmin_payment_events" ON payment_events
  FOR ALL USING (
    auth.jwt() ->> 'app_metadata'::text ->> 'is_superadmin'::text = 'true'
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(processed_at DESC);
