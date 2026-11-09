-- ============================================================
-- MIGRACIÓN 039: Interruptor de pago en línea por ítem del
--                catálogo de Facturación Electrónica (Fase H -- 9 nov 2026)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Separa "mostrar el ítem y su precio al cliente" (columna `active`, ya
-- existente) de "dejar que el cliente lo pague él mismo desde la
-- plataforma" (columna nueva `self_checkout`). Decisión de Deisy (9 nov
-- 2026): hoy la venta es 100% presencial -- ella da el precio, el cliente
-- paga por fuera de la app y hacen juntos el proceso de habilitación por
-- videollamada. Con self_checkout=false el ítem se ve en Suscripción como
-- informativo (sin botón de pago); cuando algún ítem sí se vaya a vender
-- de forma remota, se activa su self_checkout desde Superadmin, sin tocar
-- código.
--
-- DEFAULT false: los 8 ítems sembrados por la migración 037 quedan
-- informativos hasta que Deisy decida activar el pago en línea de alguno.
ALTER TABLE fe_services_catalog
  ADD COLUMN IF NOT EXISTS self_checkout BOOLEAN NOT NULL DEFAULT false;
