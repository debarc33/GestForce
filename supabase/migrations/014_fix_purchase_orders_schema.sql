-- Corrige el esquema incompleto de purchase_orders y suppliers.
--
-- Diagnóstico: la tabla purchase_orders solo tenía (id, company_id,
-- supplier_id, status, created_at) — le faltaban TODAS las columnas que
-- el código de la app espera (order_number, issue_date, expected_date,
-- subtotal, tax, total, notes). Esto hacía imposible crear una orden de
-- compra nueva (el RPC create_purchase_order_with_items fallaba con
-- "column order_number does not exist"), y la única orden existente en
-- la base se veía con "Invalid Date" / "$NaN" en toda la UI porque esos
-- campos simplemente no existían.
--
-- suppliers también le faltaban doc_type, doc_number, address y city —
-- por eso el detalle de una orden de compra mostraba "Sin proveedor"
-- aunque el proveedor sí estaba asignado (el select en usePurchaseOrder()
-- pedía esas columnas, fallaba en silencio, y el proveedor nunca se
-- resolvía).
--
-- purchase_order_items, supplier_invoices, supplier_invoice_items y
-- supplier_payments SÍ tenían todas las columnas esperadas — no se tocan.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS order_number  TEXT,
  ADD COLUMN IF NOT EXISTS issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS expected_date DATE,
  ADD COLUMN IF NOT EXISTS subtotal      NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax           NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes         TEXT;

-- Backfill de la única orden preexistente (quedó sin items y con estos
-- campos vacíos por el bug de arriba) para que deje de mostrar
-- "Invalid Date" / "$NaN" en la UI. Es una orden vacía de pruebas de una
-- sesión anterior — puede borrarse manualmente si ya no sirve.
UPDATE purchase_orders
SET order_number = 'OC-LEGACY-' || substring(id::text, 1, 8),
    issue_date   = COALESCE(issue_date, created_at::date)
WHERE order_number IS NULL;

-- order_number único por empresa, como quote_number en cotizaciones.
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_company_order_number_key
  ON purchase_orders (company_id, order_number);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS doc_type   TEXT,
  ADD COLUMN IF NOT EXISTS doc_number TEXT,
  ADD COLUMN IF NOT EXISTS address    TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT;
