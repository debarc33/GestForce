-- 029_add_product_cost_margin.sql
-- Punto 1 del backlog (25 oct 2026): separar en Productos el valor de
-- venta, el de compra y el margen de ganancia.
--
-- Aditivo, no destructivo: `price` (ya existente) sigue siendo el precio
-- de VENTA -- no se renombra ni se migra ningún dato existente. Se agregan
-- dos columnas nuevas, nullable, para no afectar los productos que la
-- clienta ya tiene cargados:
--   - precio_compra:   lo que cuesta comprar/producir el producto.
--   - margen_ganancia: porcentaje de ganancia usado por el formulario para
--                      proponer el precio de venta a partir de la compra
--                      (default 30%, editable por producto).
--
-- NOTA: la tabla `products`, igual que `categories`, se creó a mano fuera
-- de las migraciones versionadas (no hay ningún CREATE TABLE products en
-- esta carpeta) -- por eso este archivo solo queda como registro/historial
-- del cambio. Para que tenga efecto real hay que ejecutarlo a mano una vez
-- en el editor SQL de Supabase (igual que con init-multiempresa.sql,
-- setup-rapido.sql, etc. en la raíz del proyecto).

alter table public.products
  add column if not exists precio_compra numeric,
  add column if not exists margen_ganancia numeric default 30;
