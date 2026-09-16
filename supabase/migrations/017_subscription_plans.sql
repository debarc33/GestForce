-- ============================================================
-- MIGRACIÓN 017: Planes de suscripción por paquete de módulos
--                + compra única de facturas electrónicas (DIAN)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Plan actualmente contratado por la empresa. Los planes (Núcleo, Comercial,
-- Contable, Integral) están definidos en código
-- (src/modules/subscription/plans.ts), no en una tabla aparte -- por ahora
-- son fijos y no hace falta una tabla de planes en la base de datos.
--
-- NULL = la empresa todavía no tiene un plan asignado (empresas creadas
-- antes de esta migración, o que nunca han completado un pago de plan).
-- Esto es retrocompatible con la lógica ya existente en
-- useEnabledModules(): sin filas en company_modules => todos los módulos
-- habilitados.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan_id TEXT;

-- Qué plan se pagó en cada orden, para poder aprovisionar los módulos
-- correctos cuando el webhook del proveedor confirma el pago.
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS plan_id TEXT;

-- ============================================================
-- Compras únicas (no recurrentes) -- por ahora solo el paquete de
-- facturas electrónicas DIAN. NO incluye todavía control de cupo/consumo
-- de facturas: solo registra que la compra se hizo y quedó pagada. El
-- descuento del cupo al emitir cada factura queda pendiente para más
-- adelante (junto con la prueba de Facturación Electrónica).
-- ============================================================
CREATE TABLE IF NOT EXISTS one_time_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  kind TEXT NOT NULL CHECK (kind IN ('dian_invoice_pack')),
  quantity INTEGER NOT NULL DEFAULT 1,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'COP',

  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

  provider TEXT NOT NULL,
  provider_id TEXT UNIQUE,
  provider_response JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE one_time_purchases ENABLE ROW LEVEL SECURITY;

-- Mismo patrón de RLS que payment_orders: solo superadmin por RLS directo;
-- el resto de accesos pasan por rutas de servidor con el admin client
-- (createAdminClient(), que ignora RLS) después de validar el permiso ahí.
CREATE POLICY "superadmin_one_time_purchases" ON one_time_purchases
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin') = 'true'
  );

CREATE INDEX IF NOT EXISTS idx_one_time_purchases_company_id ON one_time_purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_one_time_purchases_provider_id ON one_time_purchases(provider_id);
CREATE INDEX IF NOT EXISTS idx_one_time_purchases_status ON one_time_purchases(payment_status);
