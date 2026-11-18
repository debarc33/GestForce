-- Fase D.2 de claude/plan-accion-facturacion-dian.md: ahora que
-- src/lib/fe/xades.ts puede firmar el XML (XAdES-EPES), el XML que se
-- guarda en xml_ubl puede o no venir firmado -- depende de si la empresa
-- ya tiene certificado .p12 cargado (company_certificates, migración 035).
-- Esta columna deja explícito, sin tener que abrir el XML, si la copia
-- guardada quedó firmada o no.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS fe_xml_signed boolean NOT NULL DEFAULT false;
ALTER TABLE public.credit_debit_notes ADD COLUMN IF NOT EXISTS fe_xml_signed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.invoices.fe_xml_signed IS
  'true si xml_ubl ya incluye la firma XAdES-EPES (src/lib/fe/xades.ts). false si la empresa todavía no tiene certificado .p12 cargado, o si la firma falló y se guardó el XML sin firmar como respaldo.';
COMMENT ON COLUMN public.credit_debit_notes.fe_xml_signed IS
  'Ver companies.fe_xml_signed en invoices -- mismo significado para notas crédito/débito.';
