-- ============================================================================
-- Migración 034: persistencia de CUFE/XML en facturas (Fase C del plan de
-- acción de facturación electrónica, ver claude/plan-accion-facturacion-dian.md).
--
-- Contexto: hasta ahora el CUFE y el XML se calculaban al vuelo en el
-- navegador cuando alguien hacía clic en "XML DIAN" y nunca se guardaban --
-- si no se descargaba en ese momento, se perdía (hallazgo Sección 3 del
-- informe de auditoría). Ahora que la generación es server-side
-- (/api/sales/documents/xml), el resultado se persiste aquí.
--
-- Columnas nuevas, todas nullable, no tocan ningún dato existente.
-- Es seguro correr esta migración en Supabase ahora mismo.
-- ============================================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cufe text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xml_ubl text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fe_generated_at timestamptz;
