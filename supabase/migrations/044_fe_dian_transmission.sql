-- Fase E de claude/plan-accion-facturacion-dian.md: ahora que
-- src/lib/fe/dian-client.ts puede transmitir el XML firmado al servicio
-- web de la DIAN, estas columnas guardan el resultado del envío (o del
-- intento) sin tener que ir a revisar logs.
--
-- fe_track_id: el "ZipKey" que devuelve SendTestSetAsync (Habilitación,
--   asíncrono) para consultar el resultado después con GetStatus/
--   GetStatusZip. En SendBillSync (Producción, síncrono) no aplica --
--   el resultado llega de una vez, así que este campo queda vacío.
-- fe_dian_status: lectura rápida del estado -- 'enviado' (async, en
--   espera de status), 'aceptado', 'rechazado', 'error' (falló el envío
--   mismo, no una validación de la DIAN).
-- fe_dian_response: la respuesta cruda de la DIAN (o del error), en
--   JSON, para poder ver el detalle completo sin tener que reenviar nada.
-- fe_sent_at: cuándo se intentó el envío más reciente.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fe_track_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fe_dian_status text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fe_dian_response jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fe_sent_at timestamptz;

ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS fe_track_id text;
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS fe_dian_status text;
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS fe_dian_response jsonb;
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS fe_sent_at timestamptz;

COMMENT ON COLUMN public.invoices.fe_track_id IS
  'ZipKey que devuelve SendTestSetAsync (Habilitación) para consultar el resultado después con GetStatus/GetStatusZip. Vacío si se envió con SendBillSync (Producción, síncrono -- el resultado ya queda en fe_dian_response).';
COMMENT ON COLUMN public.invoices.fe_dian_status IS
  'enviado (async, esperando status) | aceptado | rechazado | error (falló el envío mismo, no es un rechazo de la DIAN).';
COMMENT ON COLUMN public.invoices.fe_dian_response IS
  'Respuesta cruda de la DIAN (o del error de envío), en JSON -- para ver el detalle sin reenviar.';
