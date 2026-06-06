# GestForce — Guía de Integración del Rediseño (para Claude Code)

> **Objetivo:** aplicar el look "glass premium" del mockup a la app real (Next.js + TypeScript + Tailwind 4 + shadcn/ui + Supabase) **sin tocar** lógica de negocio, queries, RLS, stores ni rutas.
>
> **Regla de oro:** el rediseño es **solo presentación**. Cada componente nuevo recibe los MISMOS datos por props/hooks que ya usas. Si un cambio te obliga a modificar una query de Supabase o una policy RLS, DETENTE — no es parte de este trabajo.

---

## 0. Contexto del mockup

El mockup vive como referencia visual. Está hecho en React + Babel en el navegador (un solo árbol de componentes con estilos inline y variables CSS). NO se copia tal cual: se **traduce** a tu stack (TSX + Tailwind + shadcn). Lo que importa de él es:

- El **sistema de diseño** (tokens, superficies glass, sombras, motion) → ya está en `production/globals.patch.css`.
- La **estructura visual de cada módulo** (columnas de tabla, toolbar, drawers, tabs) → se describe módulo por módulo abajo.
- Las **decisiones de UX** acordadas con el cliente (qué columnas se ven, orden de tabs, botón "Nuevo" siempre al extremo derecho, etc.).

---

## 1. Orden de ejecución (fases)

Aplica EN ESTE ORDEN. Cada fase es un commit independiente y verificable.

### FASE 1 — Fundaciones (tokens + shell) ✅ base ya generada en `production/`
1. Agrega `production/globals.patch.css` al final de `src/app/globals.css`.
2. Reemplaza `src/components/layout/sidebar.tsx` por `production/components/layout/sidebar.tsx`.
3. Reemplaza `src/components/layout/header.tsx` por `production/components/layout/header.tsx`.
4. Reemplaza `src/app/(dashboard)/layout.tsx` por `production/app/(dashboard)/layout.tsx`.
5. Copia los componentes nuevos:
   - `production/components/ui/glass-card.tsx`
   - `production/components/ui/metric-card.tsx`
   - `production/components/ui/command-palette.tsx`
   - `production/components/ui/background-layer.tsx`  ← (NUEVO, ver §3)
   - `production/lib/format-cop.ts`
6. `npm run dev` → la app debe verse glass sin que ningún módulo haya cambiado aún.

**Checkpoint:** sidebar flotante, topbar flotante, fondo futurista, claro/oscuro y Cmd+K funcionando. Commit: `feat(ui): glass shell + design tokens`.

### FASE 2 — Componentes compartidos de tabla ✅ incluidos en `production/`
Ya generados (cópialos a `src/components/ui/`):
- `glass-table.tsx` → `GlassTable`, `THead`, `Th`, `Td`, `Tr`, `DocLink`
- `toolbar.tsx` → `Toolbar` (acciones-icono izq · buscador flex · filtros · **botón primario al extremo derecho**)
- `status-badge.tsx` → `StatusBadge`
- `background-layer.tsx` → `BackgroundLayer` (fondo futurista, §3)

- `status-dropdown.tsx` → `StatusDropdown` (filtro desplegable glass)
- `pagination.tsx` → `Pagination` (pie de tabla: "Mostrando X–Y de N" + filas + prev/next)

Paquete de primitivos **100% completo**. Commit: `feat(ui): shared table + toolbar primitives`.

### FASE 3 — Módulos, uno por uno (cada uno su commit)
Orden sugerido (de más usado a menos):
1. Ventas → Clientes
2. Ventas → Cotizaciones, Facturas, Recibos, CxC
3. Compras → Órdenes, Facturas Proveedor, Proveedores, CxP
4. Inventario → Productos, Movimientos, Kardex, Ajustes
5. Dashboard / Tablero
6. Finanzas → Panel, Impuestos, Gastos
7. Contabilidad → Plan de Cuentas, Comprobantes, Informes
8. Nómina → 6 pestañas
9. Configuración (incluye pantalla Apariencia)
10. Superadmin (shell aparte, ver §6)

Cada módulo: ver su sección en `MODULOS.md`.

### FASE 4 — Pulido
- Toasts (usa `sonner`, ya instalado) con el estilo glass.
- Microanimaciones de entrada (fade/slide) en cards y filas.
- Revisar responsive y modo claro en cada módulo.

---

## 2. Contratos que NO se tocan (preservar SIEMPRE)

- `useCompanyStore`, `useSidebarStore`, `useEnabledModules`
- `MODULE_REGISTRY`, `getModuleIdFromPath` (`src/config/modules.ts`)
- Cualquier `*-queries.ts`, `*-mutations.ts`, hooks de TanStack Query
- Supabase client, policies RLS, migrations
- Rutas y route groups: `(auth)`, `(dashboard)`, `(superadmin)`
- Tipos de dominio existentes (`types.ts`)

Si un componente nuevo necesita datos, los recibe por **props** desde el page/server component que YA los obtiene. No muevas la obtención de datos hacia abajo.

---

## 3. BackgroundLayer (fondo futurista)

El mockup tiene fondos seleccionables (Aurora, Mesh, Nebulosa, Horizonte, Topográfico, Circuito) + grid técnico, controlados por la pantalla Apariencia y guardados por empresa. Crea `src/components/ui/background-layer.tsx` que:
- Renderiza un `<div fixed inset-0 -z-10>` con el gradiente del fondo elegido.
- Lee la preferencia desde el contexto/store de apariencia (ver §5 Configuración → Apariencia).
- Default: "aurora". Variables CSS de acento ya vienen de los tokens.

(El CSS exacto de cada fondo está en el mockup `app.jsx` → constante `BACKGROUNDS`; cópialo a Tailwind/CSS.)

---

## 4. Patrón uniforme de Toolbar (acordado con el cliente)

TODOS los módulos siguen este orden de izquierda a derecha:
```
[iconos de acción: imprimir · importar · exportar]  [ buscador (flex-1) ]  [filtros/dropdowns]  [BOTÓN PRIMARIO "Nuevo"]
```
- El botón **"Nuevo / +" SIEMPRE va al extremo derecho.**
- Documentos que se generan desde otro (Facturas desde OC, Recibos desde pago) **no llevan "Nuevo"**.
- El número de documento (factura, cotización, OC, recibo) es un **link** en color de acento que abre el detalle.

---

## 5. Notas de datos (Colombia)
- Moneda: **COP** sin decimales → usa `formatCOP()` de `production/lib/format-cop.ts`.
- Documentos: **NIT/CC/CE** + régimen fiscal DIAN (Resp. IVA / No Resp. / Gran Contribuyente) → `FISCAL_LABEL`.
- IVA **19%**.

---

## 6. Reglas de "mismo look a futuro"

Cuando agregues un módulo/pantalla NUEVA después de esta integración:
1. Usa `GlassCard`, `GlassTable`, `Toolbar`, `MetricCard`, `StatusBadge` — nunca tablas/cards crudas.
2. Respeta el patrón de Toolbar (§4).
3. Usa los tokens (`var(--glass)`, `var(--accent)`, etc.), nunca colores hardcodeados.
4. Botón primario al extremo derecho; número de documento como link.
5. Mantén densidad compacta (filas ~36–40px) salvo que el usuario pida lo contrario.

Pega esta sección en tu `CLAUDE.md` del repo para que toda generación futura siga el estándar.

---

## Archivos en este paquete
```
production/
├── README-INTEGRACION.md          ← este archivo (empieza aquí)
├── MODULOS.md                     ← especificación visual módulo por módulo
├── MIGRATION-GUIDE.md             ← guía original de migración del shell
├── CLAUDE-md-snippet.md           ← pegar en el CLAUDE.md del repo
├── globals.patch.css
├── lib/format-cop.ts
├── app/(dashboard)/layout.tsx
└── components/
    ├── layout/{sidebar,header}.tsx
    └── ui/{glass-card,metric-card,command-palette,
          glass-table,toolbar,status-badge,status-dropdown,
          pagination,background-layer}.tsx
```
> Paquete **100% completo** — todos los primitivos listos para copiar a `src/components/ui/`.
