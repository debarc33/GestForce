-- ============================================================
-- MIGRACIÓN 021: Precios de planes editables desde Superadmin
--                + paquete de facturas DIAN editable
--                + visibilidad de precios/autopago por empresa
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Precios editables de los 4 planes (Núcleo, Comercial, Contable, Integral).
-- La identidad de cada plan (nombre, descripción, módulos incluidos) sigue
-- definida en código (src/modules/subscription/plans.ts) -- solo el PRECIO
-- se vuelve editable desde aquí. Sembrado con los valores que ya estaban
-- fijos en el código al momento de esta migración (ver plan actual del
-- primer cliente real en claude/estado-proyecto.md).
CREATE TABLE IF NOT EXISTS subscription_plan_prices (
  plan_id        TEXT PRIMARY KEY CHECK (plan_id IN ('nucleo', 'comercial', 'contable', 'integral')),
  price_3_months BIGINT NOT NULL,
  price_6_months BIGINT NOT NULL,
  price_1_year   BIGINT NOT NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO subscription_plan_prices (plan_id, price_3_months, price_6_months, price_1_year) VALUES
  ('nucleo',    270000, 459000,  864000),
  ('comercial', 375000, 637500,  1200000),
  ('contable',  525000, 892500,  1680000),
  ('integral',  675000, 1147500, 2160000)
ON CONFLICT (plan_id) DO NOTHING;

ALTER TABLE subscription_plan_prices ENABLE ROW LEVEL SECURITY;

-- Mismo patrón de RLS que one_time_purchases/payment_orders: solo
-- superadmin por RLS directo; la lectura del cliente pasa por una ruta de
-- servidor (admin client) que valida membresía de empresa primero.
CREATE POLICY "superadmin_subscription_plan_prices" ON subscription_plan_prices
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin') = 'true'
  );

-- Paquete de facturas electrónicas DIAN -- fila única (id fijo = 1),
-- cantidad y precio editables desde Superadmin (antes era una constante
-- fija en código, DIAN_INVOICE_PACK).
CREATE TABLE IF NOT EXISTS invoice_pack_settings (
  id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quantity   INTEGER NOT NULL,
  price      BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO invoice_pack_settings (id, quantity, price) VALUES (1, 20, 300000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE invoice_pack_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_invoice_pack_settings" ON invoice_pack_settings
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin') = 'true'
  );

-- Visibilidad por empresa del bloque de precios/autopago (self-service) de
-- planes y del paquete de facturas DIAN, en la pantalla de Suscripción que
-- ve el cliente (Configuración > Suscripción). Por defecto APAGADO
-- (false) para TODAS las empresas, incluidas las existentes -- ya hay
-- clientes con precios negociados manualmente, así que no se debe mostrar
-- una lista de precios fija hasta que el superadmin decida lo contrario,
-- empresa por empresa o para todas a la vez (ver
-- /superadmin/settings/subscription-plans). company_modules y la fecha de
-- vencimiento se siguen asignando manualmente desde Superadmin
-- independientemente de estas dos columnas.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS show_plan_pricing         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_invoice_pack_pricing  BOOLEAN NOT NULL DEFAULT false;
