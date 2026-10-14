-- ============================================================================
-- Migración 026: agrega la columna `reference_no` que faltaba en
-- `inventory_movements`.
--
-- Hallazgo (14 oct 2026, al probar en vivo la migración 025): al aprobar una
-- cotización como Factura, Postgres devolvió el error
-- `column "reference_no" of relation "inventory_movements" does not exist`.
--
-- Investigando el historial de migraciones: la 016 agregó `stock_before` y
-- `stock_after` a `inventory_movements`, y la 020 reescribió
-- `receive_purchase_order` e `issue_invoice` para usar también
-- `reference_no` (el número de documento legible, p. ej. "FAC-000005", en
-- vez de solo el UUID interno en `reference_id`) porque la pantalla de
-- Inventario > Movimientos de stock siempre lo mostró vacío. Pero la 020
-- nunca incluyó el `ALTER TABLE` para crear esa columna -- por eso cualquier
-- código que inserte en `inventory_movements` con `reference_no` falla hoy
-- con este error. Esto afecta potencialmente también a
-- `receive_purchase_order` (recibir una orden de compra) y a las funciones
-- del lado del cliente `registerStockEntry`/`recordSaleExit` en
-- `src/modules/inventory/queries.ts` -- vale la pena volver a probar
-- "Compras -> recibir orden" despues de correr esta migracion, por si llevaba
-- un tiempo rota sin que se notara.
--
-- Segura de correr: agrega una columna nueva, nullable, sin tocar datos
-- existentes.
-- ============================================================================

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS reference_no TEXT;
