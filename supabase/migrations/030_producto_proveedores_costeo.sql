-- 030_producto_proveedores_costeo.sql
-- Punto 2 del backlog (27 oct 2026): precio por proveedor + método de
-- costeo configurable por empresa. Decisiones de Deisy (27 oct 2026):
--   - Dejar ambos métodos de costeo disponibles, elegibles en
--     Configuración > Inventario > Costeo de compras.
--   - El precio de Venta también se recalcula automáticamente cuando
--     cambia el de Compra (ver receive_purchase_order en la migración
--     031, que es la que de verdad aplica este cambio en cada compra).
--
-- Esta migración es aditiva: no toca ninguna tabla ni columna existente,
-- solo agrega una columna nueva y una tabla nueva.

-- 1) Método de costeo de la empresa.
--    - 'weighted_avg' (default): promedio ponderado entre el stock que
--      ya tenía (a su costo anterior) y la cantidad nueva (al costo de
--      esta compra).
--    - 'last_price': el precio de Compra pasa a ser siempre el de la
--      ÚLTIMA compra recibida (sin mezclar con lo que tenía antes).
alter table public.companies
  add column if not exists costing_method text not null default 'weighted_avg';

alter table public.companies
  drop constraint if exists companies_costing_method_check;
alter table public.companies
  add constraint companies_costing_method_check
  check (costing_method in ('weighted_avg', 'last_price'));

-- 2) Precio pagado a CADA proveedor por producto (lista de precios por
--    proveedor). No se sobrescribe entre proveedores -- cada fila es
--    independiente y se actualiza sola cada vez que se recibe una orden
--    de compra de ese proveedor (ver receive_purchase_order en 031).
--    El precio se guarda CON IVA incluido (decisión ya registrada en el
--    plan de este backlog: "costo incluye IVA pagado").
create table if not exists public.producto_proveedores (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  price       numeric(14,2) not null,
  updated_at  timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create index if not exists producto_proveedores_company_id_idx
  on public.producto_proveedores (company_id);

-- RLS -- OJO: sin esto la tabla queda bloqueada para todo el mundo (el
-- mismo bug que pasó con expense_categories/expenses en la migración 027:
-- toda tabla nueva necesita su propia política, no se hereda de ninguna
-- otra tabla). Mismo patrón que el resto de la app.
alter table public.producto_proveedores enable row level security;

drop policy if exists "company_members_producto_proveedores" on public.producto_proveedores;
create policy "company_members_producto_proveedores" on public.producto_proveedores
  for all
  using (company_id in (select public.get_my_company_ids()))
  with check (company_id in (select public.get_my_company_ids()));
