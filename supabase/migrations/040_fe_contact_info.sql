-- ============================================================
-- MIGRACIÓN 040: Datos de contacto para el botón "Contáctanos"
--                (Fase H -- 9 nov 2026)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Fila única (igual que invoice_pack_settings) con los datos de contacto
-- que se muestran cuando el cliente toca "Contáctanos para contratar" en
-- un ítem del catálogo de Facturación Electrónica que todavía no tiene
-- pago en línea (self_checkout=false, migración 039). Editable desde
-- Superadmin porque pueden cambiar (por ejemplo cuando exista un WhatsApp
-- único de QS Solutions Tech, estos mismos campos se podrán reemplazar o
-- complementar con un número de WhatsApp, sin tocar código).
CREATE TABLE IF NOT EXISTS fe_contact_info (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phone_1 TEXT,
  phone_2 TEXT,
  email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO fe_contact_info (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE fe_contact_info ENABLE ROW LEVEL SECURITY;

-- Mismo patrón de RLS que fe_services_catalog: solo superadmin por RLS
-- directo; la lectura pública (pantalla de Suscripción del cliente) pasa
-- por una ruta de servidor con el admin client.
CREATE POLICY "superadmin_fe_contact_info" ON fe_contact_info
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin') = 'true'
  );
