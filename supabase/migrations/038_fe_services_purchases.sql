-- ============================================================
-- MIGRACIÓN 038: Compra de los ítems del catálogo de Facturación
--                Electrónica (Fase H, Fase 2 -- 9 nov 2026)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extiende one_time_purchases (migración 017) para poder comprar cualquier
-- ítem del catálogo nuevo (fe_services_catalog, migración 037), no solo el
-- paquete fijo "dian_invoice_pack" de antes. Aditivo -- no borra ni
-- modifica ninguna fila existente, y el checkout viejo
-- (createInvoicePackCheckout, kind='dian_invoice_pack') sigue funcionando
-- exactamente igual.
ALTER TABLE one_time_purchases
  ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES fe_services_catalog(item_id),
  -- Para los ítems recurrentes (billing_type 'mensual'/'anual' en el
  -- catálogo, hoy solo los planes "Ilimitado"): fecha hasta la que cubre
  -- ESTA compra puntual. No hay renovación automática todavía (decisión de
  -- Deisy, 9 nov 2026: empezar simple, ella avisa y el cliente vuelve a
  -- comprar) -- esta columna es solo para poder mostrar "vigente hasta" en
  -- pantalla. NULL para servicios/paquetes de pago único (billing_type
  -- 'unico'), que no vencen.
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMP WITH TIME ZONE;

-- 'kind' tenía un CHECK que solo permitía 'dian_invoice_pack' (migración
-- 017). Se amplía a un segundo valor genérico 'fe_service' para todas las
-- compras del catálogo nuevo (el ítem específico queda en item_id, no hace
-- falta un valor de kind por ítem). El nombre de la restricción es el que
-- Postgres asigna por defecto a un CHECK de columna sin nombre explícito
-- (<tabla>_<columna>_check).
ALTER TABLE one_time_purchases
  DROP CONSTRAINT IF EXISTS one_time_purchases_kind_check;
ALTER TABLE one_time_purchases
  ADD CONSTRAINT one_time_purchases_kind_check CHECK (kind IN ('dian_invoice_pack', 'fe_service'));

CREATE INDEX IF NOT EXISTS idx_one_time_purchases_item_id ON one_time_purchases(item_id);
