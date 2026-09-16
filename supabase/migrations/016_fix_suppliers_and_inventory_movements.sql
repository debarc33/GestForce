-- Más columnas faltantes descubiertas al recibir una orden de compra y al
-- revisar el módulo de Inventario antes de probarlo:
--
-- suppliers: el RPC receive_purchase_order falló con
-- "column payment_days does not exist" al generar la factura de proveedor
-- (usa el plazo de pago del proveedor para calcular la fecha de
-- vencimiento). Revisando el código también faltan department,
-- fiscal_regime, contact_name y notes, que ya usa el formulario de
-- proveedores (src/modules/suppliers/queries.ts) pero nunca se agregaron
-- a la tabla.
--
-- inventory_movements: le faltan stock_before y stock_after, que usa
-- createAdjustment() (la función detrás de "Ajustes" en Inventario) para
-- registrar el stock antes/después de un ajuste manual. Sin esto, ajustar
-- el stock de un producto habría fallado igual que las órdenes de compra.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS department    TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_regime TEXT NOT NULL DEFAULT 'no_iva',
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS payment_days  INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS notes         TEXT;

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS stock_before NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS stock_after  NUMERIC(14,2);
