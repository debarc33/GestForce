# Pegar esto en el CLAUDE.md del repo GestForce

## Estándar de UI — "Glass Premium" (obligatorio para todo el frontend)

Toda pantalla, módulo o componente nuevo DEBE seguir este sistema de diseño. No crear tablas, cards ni toolbars "crudas".

### Componentes base (usar siempre)
- Superficies → `GlassCard` (`@/components/ui/glass-card`). Nunca `<div>` con bordes/bg propios para contenedores.
- Tablas → `GlassTable` + `StatusBadge` + `DocLink` (`@/components/ui/*`).
- KPIs → `MetricCard` (`@/components/ui/metric-card`).
- Toolbars → componente `Toolbar` con el orden: `[iconos imprimir/importar/exportar] [buscador flex-1] [filtros] [BOTÓN PRIMARIO]`.
- Formato dinero → `formatCOP()` (`@/lib/format-cop`). COP sin decimales.

### Reglas visuales
- Tokens, nunca colores hardcodeados: `var(--glass)`, `var(--glass-border)`, `var(--accent)`, sombras `var(--shadow-*)`.
- El **botón primario "Nuevo/+" SIEMPRE al extremo derecho** de la toolbar.
- Documentos generados desde otro (Facturas←OC, Recibos←pago) **no llevan "Nuevo"**.
- El **número de documento** (factura/cotización/OC/recibo) es un **link** en color de acento que abre el detalle.
- Densidad compacta: filas de tabla ~36–40px.
- Soportar **modo claro y oscuro** (usar tokens, ya cambian solos).
- Pestaña activa de cada módulo: subrayada + texto en color resaltado.

### Lo que NO se toca al rediseñar
- Hooks/stores: `useCompanyStore`, `useSidebarStore`, `useEnabledModules`.
- `MODULE_REGISTRY` (`src/config/modules.ts`), queries/mutations, Supabase, RLS, rutas.
- El rediseño es SOLO presentación: los componentes reciben los mismos datos por props/hooks.

### Superadmin
- Vive en `(superadmin)` con layout PROPIO (barra superior horizontal, fondo negro, badge "Superadmin"). NO usa el shell glass del ERP.

### Datos Colombia
- NIT/CC/CE + régimen DIAN (Resp. IVA / No Resp. / Gran Contribuyente). IVA 19%.
