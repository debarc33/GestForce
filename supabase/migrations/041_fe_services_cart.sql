-- ============================================================
-- MIGRACIÓN 041: Selección de varios ítems del catálogo de
--                Facturación Electrónica para un solo pago
--                (Fase H, Fase 3 -- 9 nov 2026)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Antes (migraciones 037/038): cada ítem del catálogo se compraba por
-- separado (item_id + amount = precio de ESE ítem). Deisy pidió ahora poder
-- elegir varios ítems a la vez y pagarlos juntos en un solo link de Bold.
--
-- En vez de crear filas separadas por ítem (complicaría el webhook, que hoy
-- marca "completado" por un solo id de referencia), se guarda la compra
-- combinada en UNA sola fila: item_id se deja NULL, y el detalle de qué se
-- compró (cada ítem, su precio, y su "vigente hasta" si es recurrente) se
-- guarda en la columna nueva `items` (lista en JSON). `amount` es el total a
-- cobrar (suma de todos los ítems elegidos). El webhook de pagos
-- (handleBoldWebhook) NO necesita ningún cambio: sigue marcando completada
-- la fila de one_time_purchases que coincide con el id de referencia, sea
-- de un solo ítem o de varios.
ALTER TABLE one_time_purchases
  ADD COLUMN IF NOT EXISTS items JSONB;

-- 'kind' amplía de nuevo (aditivo, igual que la 038) para el nuevo tipo de
-- compra combinada: 'fe_service_cart'.
--
-- De paso se corrige un problema real encontrado al revisar esto: la
-- migración 038 angostó el CHECK de 'kind' a solo ('dian_invoice_pack',
-- 'fe_service'), sin darse cuenta de que el botón "Pago de prueba" de
-- Superadmin (createTestPaymentCheckout, kind='test_payment') sigue
-- existiendo en el código y todavía lo inserta -- desde la migración 038,
-- si alguien lo usa, fallaría con un error de restricción CHECK. Se
-- restaura 'test_payment' en la lista para que ese botón (pendiente de
-- quitarse más adelante, ver claude/estado-proyecto.md ítem 20) no quede
-- roto mientras tanto.
ALTER TABLE one_time_purchases
  DROP CONSTRAINT IF EXISTS one_time_purchases_kind_check;
ALTER TABLE one_time_purchases
  ADD CONSTRAINT one_time_purchases_kind_check
  CHECK (kind IN ('dian_invoice_pack', 'fe_service', 'fe_service_cart', 'test_payment'));
