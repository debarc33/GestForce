-- ============================================================================
-- Migración 042: identificador del set de pruebas DIAN (TestSetId).
--
-- Contexto (18 nov 2026): Deisy ya completó el registro de "modo de
-- operación" (Desarrollo propio) en el portal de Habilitación de la DIAN, y
-- la DIAN le entregó un identificador único para su set de pruebas
-- (TestSetId). No había ningún lugar en GestForce para guardarlo -- se
-- confirmó buscando en el código que no existía ninguna columna ni campo
-- relacionado.
--
-- Nota importante (dejada también en claude/plan-accion-facturacion-dian.md):
-- este campo por ahora es solo de ALMACENAMIENTO/REFERENCIA. GestForce
-- todavía no transmite nada a la DIAN (Fase E del plan, pendiente) -- ese
-- envío real (firmar cada factura de prueba y llamarlo al servicio web de
-- la DIAN pasándole este identificador) es trabajo futuro. Por ahora esto
-- solo le da a Deisy un lugar fijo donde guardar el dato mientras tanto.
--
-- Columna nueva, nullable, aditiva. Es seguro correr esta migración en
-- Supabase ahora mismo.
-- ============================================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_test_set_id text;

COMMENT ON COLUMN public.companies.fe_test_set_id IS
  'Identificador del set de pruebas (TestSetId) que la DIAN asigna al registrar el modo de operación "Desarrollo propio". Necesario para transmitir el set de pruebas de habilitación al servicio web de la DIAN (Fase E, pendiente de construir).';
