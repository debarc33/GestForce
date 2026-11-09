-- ============================================================
-- MIGRACIÓN 037: Catálogo de servicios/paquetes de Facturación
--                Electrónica (oferta separada, 8 nov 2026)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Fase 1 de la nueva oferta de FE (claude/plan-accion-facturacion-dian.md,
-- Fase H): separa la habilitación inicial como facturador electrónico del
-- paquete de 20 facturas (antes mezclados en un solo precio de $300.000,
-- ver invoice_pack_settings de la migración 021) en 8 ítems vendibles
-- independientes, agrupados en 3 categorías:
--   - servicio_gestion: trámites/gestión (habilitación, renovación de
--     certificado, resolución de numeración)
--   - paquete_facturas: bloques fijos de facturas (20/200/500)
--   - plan_ilimitado: suscripción de facturas sin límite (mensual/anual)
--
-- A PROPÓSITO esta migración es puramente ADITIVA: no modifica ni
-- reemplaza invoice_pack_settings ni one_time_purchases, así que la compra
-- de $300.000 que ya está en producción (checkout, webhook, etc.) sigue
-- funcionando exactamente igual mientras no se decida lo contrario. Esta
-- tabla nueva es solo el catálogo de precios editable desde Superadmin; el
-- flujo de compra del cliente para estos 8 ítems es una fase aparte
-- (Fase 2), todavía no construida.
CREATE TABLE IF NOT EXISTS fe_services_catalog (
  item_id      TEXT PRIMARY KEY,
  category     TEXT NOT NULL CHECK (category IN ('servicio_gestion', 'paquete_facturas', 'plan_ilimitado')),
  label        TEXT NOT NULL,
  description  TEXT,
  -- 'unico' = pago único, 'anual' = recurrente cada año, 'mensual' = recurrente cada mes.
  billing_type TEXT NOT NULL CHECK (billing_type IN ('unico', 'anual', 'mensual')),
  price        BIGINT NOT NULL,
  -- Cantidad de facturas que incluye (solo aplica a paquete_facturas); NULL
  -- para servicios de gestión y planes ilimitados (no tienen cantidad fija).
  quantity     INTEGER,
  -- Permite ocultar/desactivar un ítem desde Superadmin sin borrar la fila
  -- (y sin perder su precio configurado) una vez exista la pantalla de
  -- compra del cliente (Fase 2).
  active       BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Valores sembrados con los precios recomendados que trajo Deisy (ver
-- "Oferta completa de servicios de facturación electrónica", 8 nov 2026).
-- Todos editables desde Superadmin después de esta migración.
INSERT INTO fe_services_catalog (item_id, category, label, description, billing_type, price, quantity, sort_order) VALUES
  ('fe_enablement',        'servicio_gestion', 'Habilitación inicial como facturador electrónico',
   'Actualización del RUT con responsabilidad 52, pruebas técnicas ante la DIAN, configuración inicial en la plataforma y acompañamiento hasta la aprobación.',
   'unico', 160000, NULL, 1),
  ('cert_renewal',         'servicio_gestion', 'Gestión de renovación anual del certificado digital',
   'Trámite ante entidad certificadora, validación del archivo en el software y aviso anticipado de vencimiento.',
   'anual', 150000, NULL, 2),
  ('dian_resolution_mgmt', 'servicio_gestion', 'Gestión de resolución de numeración de facturas',
   'Solicitud de nuevo rango de consecutivos, asociación en el sistema y seguimiento de vigencia (por trámite).',
   'unico', 90000, NULL, 3),
  ('invoice_pack_20',      'paquete_facturas', 'Paquete de 20 facturas',
   'Emprendedores nuevos o vendedores ocasionales que quieren probar el servicio.',
   'unico', 35000, 20, 10),
  ('invoice_pack_200',     'paquete_facturas', 'Paquete de 200 facturas',
   'Pequeños negocios con ventas regulares.',
   'unico', 240000, 200, 11),
  ('invoice_pack_500',     'paquete_facturas', 'Paquete de 500 facturas',
   'Negocios consolidados con volumen medio-alto de facturación.',
   'unico', 480000, 500, 12),
  ('unlimited_monthly',    'plan_ilimitado',   'Ilimitado mensual',
   'Facturas, notas crédito y débito sin límite, soporte básico.',
   'mensual', 42000, NULL, 20),
  ('unlimited_annual',     'plan_ilimitado',   'Ilimitado anual',
   'Equivale a $35.000 mensuales, descuento por pago anticipado.',
   'anual', 420000, NULL, 21)
ON CONFLICT (item_id) DO NOTHING;

ALTER TABLE fe_services_catalog ENABLE ROW LEVEL SECURITY;

-- Mismo patrón de RLS que subscription_plan_prices/invoice_pack_settings:
-- solo superadmin por RLS directo. La lectura para el cliente (Fase 2,
-- cuando exista la pantalla de compra) pasará por una ruta de servidor con
-- el admin client, igual que /api/company/subscription/pricing hoy.
CREATE POLICY "superadmin_fe_services_catalog" ON fe_services_catalog
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin') = 'true'
  );
