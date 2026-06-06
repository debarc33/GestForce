# PROMPT PARA INTEGRAR EL REDISEÑO "GLASS PREMIUM" EN GESTFORCE

> Copia TODO lo que está debajo de la línea y pégalo como primer mensaje a la IA
> (Claude Code, Cursor, etc.) abriendo tu repo. Ten la carpeta `production/` y el
> archivo `GestForce-respaldo.html` dentro del repo para que pueda leerlos.

---

## ROL Y OBJETIVO

Eres un ingeniero frontend senior. Vas a aplicar un rediseño visual llamado **"Glass Premium"** a esta app **sin cambiar ninguna funcionalidad**. La app es un ERP colombiano multiempresa hecho en **Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase + Zustand + TanStack Query/Table**.

Tienes dos fuentes de verdad del diseño en el repo:
1. `production/` — componentes `.tsx` ya escritos + guías (`README-INTEGRACION.md`, `MODULOS.md`, `CLAUDE-md-snippet.md`).
2. `GestForce-respaldo.html` — el mockup navegable (referencia VISUAL únicamente).

## LA REGLA MÁS IMPORTANTE (por esto fallaron intentos anteriores)

**NO copies el mockup literalmente.** El mockup usa React+Babel en el navegador con estilos inline y un objeto `DATA` ficticio. Eso es solo una *referencia de apariencia*. Tu trabajo es **TRADUCIR** ese look a MI stack real:
- Usa MIS componentes de `production/*.tsx` (Tailwind + shadcn), no estilos inline.
- Usa MIS datos reales (hooks de TanStack Query / props de server components), nunca el objeto `DATA` del mockup.
- Conserva MI lógica intacta.

Si para lograr el look "tuvieras que" tocar una query, una policy RLS, un store o una ruta: **DETENTE y pregúntame**. El rediseño es 100% presentación.

## LO QUE NO SE TOCA (NUNCA)

- Hooks/stores: `useCompanyStore`, `useSidebarStore`, `useEnabledModules`.
- `MODULE_REGISTRY` y `getModuleIdFromPath` (`src/config/modules.ts`).
- Cualquier `*-queries.ts`, `*-mutations.ts`, hooks de datos.
- Supabase client, policies RLS, migrations.
- Rutas y route groups: `(auth)`, `(dashboard)`, `(superadmin)`.
- Los campos, validaciones y tamaños de formularios que YA existen (regla especial: en formularios/modales conserva MIS campos y tamaños actuales; solo cámbiales la apariencia).

## MÉTODO DE TRABAJO (obligatorio: incremental y verificable)

Trabaja en **fases pequeñas**. Después de CADA fase: corre `npm run build` (o `tsc --noEmit`) para confirmar que compila, descríbeme qué cambiaste, y **espera mi visto bueno antes de seguir**. Un commit por fase. No hagas un cambio masivo de todo el repo de una sola vez.

### FASE 0 — Diagnóstico (no cambies nada todavía)
1. Lee `production/README-INTEGRACION.md` y `production/MODULOS.md` completos.
2. Explora mi `src/` real: `app/`, `components/layout/`, `components/ui/`, `config/modules.ts`, y 2–3 páginas de módulo (ej. `customers`, `sales`).
3. Hazme un **plan de integración** mapeando cada archivo de `production/` a su destino en `src/`, y dime qué conflictos ves (nombres de componentes shadcn que ya existen, versiones, etc.). Espera mi OK.

### FASE 1 — Fundaciones (tokens + shell)
1. Agrega `production/globals.patch.css` al FINAL de `src/app/globals.css` (no borres nada existente).
2. Reemplaza `src/components/layout/sidebar.tsx` y `header.tsx` por los de `production/components/layout/`. Si mis imports o nombres de hooks difieren, ADÁPTALOS a los míos (no inventes hooks).
3. Reemplaza `src/app/(dashboard)/layout.tsx` por el de `production/`.
4. Copia a `src/components/ui/` los primitivos de `production/components/ui/`: `glass-card`, `metric-card`, `command-palette`, `glass-table`, `toolbar`, `status-badge`, `status-dropdown`, `pagination`, `background-layer`. Si ya existe uno con ese nombre, fusiona sin romper sus usos actuales.
5. Copia `production/lib/format-cop.ts` a `src/lib/`.
6. Verifica que compila y que la app se ve "glass" (sidebar y topbar flotantes, fondo futurista, claro/oscuro, Cmd+K). **Ningún módulo cambia aún.** Para y muéstrame.

### FASE 2 en adelante — Módulo por módulo
Para CADA módulo, sigue su especificación EXACTA en `production/MODULOS.md` (columnas que se ven, orden de tabs, toolbar, acciones, estados). Reglas transversales:
- Toolbar SIEMPRE en este orden: `[iconos imprimir/importar/exportar] · [buscador flex-1] · [filtros] · [BOTÓN PRIMARIO "Nuevo" al extremo derecho]`.
- Documentos generados desde otro (Facturas←OC, Recibos←pago) NO llevan botón "Nuevo".
- El número de documento (factura, cotización, OC, recibo) es un **link** (color de acento) que abre el detalle.
- Densidad compacta (filas ~36–40px). Soporta claro y oscuro vía tokens (nunca colores hardcodeados).
- La pestaña activa de cada módulo va subrayada y con texto resaltado.
- En formularios/modales: respeta MIS campos y tamaños; solo aplica el estilo glass.

Orden sugerido: Clientes → Cotizaciones/Facturas/Recibos/CxC → Compras → Inventario → Tablero → Finanzas → Contabilidad → Nómina → Configuración → Superadmin.

## SUPERADMIN (caso especial)
Vive en el route group `(superadmin)` con un **layout PROPIO**: barra superior horizontal, fondo negro total, badge "Superadmin", botón "← Volver al ERP". NO usa el shell glass del ERP. Ver detalle en `MODULOS.md`.

## DATOS COLOMBIA
- Moneda COP sin decimales → usa `formatCOP()`. IVA 19%.
- Documentos NIT/CC/CE + régimen DIAN (Resp. IVA / No Resp. IVA / Gran Contribuyente).

## ESTÁNDAR A FUTURO
Cuando termines, agrega el contenido de `production/CLAUDE-md-snippet.md` a mi `CLAUDE.md` (créalo en la raíz si no existe) para que todo lo que generes después mantenga este look.

## EMPIEZA AHORA
Comienza por **FASE 0** y muéstrame el plan de integración. No modifiques archivos hasta que apruebe el plan.
