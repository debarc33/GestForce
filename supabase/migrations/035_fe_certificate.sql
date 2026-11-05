-- ============================================================================
-- Migración 035: certificado digital de firma (Fase D del plan de acción de
-- facturación electrónica, ver claude/plan-accion-facturacion-dian.md).
--
-- Parte 1: captura de las columnas de Facturación Electrónica que ya vivían
-- en el esquema de Supabase pero nunca habían quedado registradas en
-- ninguna migración versionada (mismo caso de next_doc_number antes de la
-- migración 033). No cambia ningún dato existente.
--
-- Parte 2: almacenamiento seguro del certificado digital .p12/.pfx de cada
-- empresa, con su fecha de vigencia, como base para la firma XAdES-BES (a
-- implementar en una fase posterior, cuando se disponga de un certificado
-- real para probarla de punta a punta).
--
-- Diseño de seguridad: el archivo del certificado y su contraseña (cifrada
-- con AES-256-GCM, nunca en texto plano) viven en una tabla aparte,
-- company_certificates, con RLS activado y SIN ninguna política para los
-- roles anon/authenticated -- solo el backend (llave de servicio, que no
-- pasa por RLS) puede leerla o escribirla, siempre a través de
-- /api/company/certificate. Ni siquiera el dueño de la empresa puede leer
-- el archivo o la contraseña cifrada vía la API pública de Supabase.
--
-- Las fechas de vigencia del certificado SÍ son columnas normales en
-- companies (no son secretas, igual que dian_validity_to) para poder
-- calcular la alerta de vencimiento del lado del cliente con el mismo
-- patrón que ya existe para la resolución DIAN (ver getDianAlerts()).
--
-- Todo aditivo y nullable. Es seguro correr esta migración en Supabase
-- ahora mismo.
-- ============================================================================

-- ── Captura de columnas FE existentes (ya vivían en el esquema, sin migración) ──
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_software_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_software_pin text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_api_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_test_mode boolean NOT NULL DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_technical_key text;

-- ── Metadatos del certificado digital (no sensibles) ─────────────────────
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_cert_filename text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_cert_valid_from date;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_cert_valid_to date;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fe_cert_uploaded_at timestamptz;

-- ── Material sensible del certificado: tabla aparte, acceso solo server-side ──
CREATE TABLE IF NOT EXISTS public.company_certificates (
  company_id                     uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  pfx_data_base64                text NOT NULL,   -- contenido del .p12/.pfx, codificado en base64
  pfx_password_encrypted_base64  text NOT NULL,   -- contraseña cifrada (AES-256-GCM), nunca en texto plano
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_certificates ENABLE ROW LEVEL SECURITY;
-- Sin ninguna política para anon/authenticated a propósito: nadie puede
-- leer ni escribir esta tabla vía la API pública de Supabase, ni siquiera
-- el dueño de la empresa. Solo el backend (service role, que no pasa por
-- RLS) puede tocarla.

COMMENT ON TABLE public.company_certificates IS
  'Certificado digital de firma (.p12/.pfx) de cada empresa para Facturación Electrónica DIAN. Acceso exclusivamente server-side (service role) -- RLS activo sin políticas para anon/authenticated.';
