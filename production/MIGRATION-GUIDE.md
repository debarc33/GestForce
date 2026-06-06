# GestForce — Migración al diseño Premium Glass

> **Drop-in**, sin tocar lógica de Supabase, RLS, queries, ni stores.
> Aplicas: nuevos tokens CSS + reemplazo del shell (sidebar/header/layout) + 3 componentes nuevos. Nada más.

## Resumen del cambio

| Antes | Después |
|---|---|
| Sidebar blanco anclado (`border-r`) | Sidebar flotante translúcida con `backdrop-blur` |
| Header blanco anclado (`border-b`) | Topbar flotante translúcida |
| Fondo plano (`#fafafa`) | Canvas con glows ambientales (radial gradients) |
| Cards blancas planas | `GlassCard` semitransparente con sombras delicadas |
| Sin command palette real | `<CommandPalette>` Cmd+K con grupos y atajos |
| Sin KPIs por módulo | `<MetricCard>` reutilizable con sparkline opcional |

**Lo que NO cambia:**
- `useCompanyStore`, `useSidebarStore`, `useEnabledModules` — mismos hooks
- `MODULE_REGISTRY`, `getModuleIdFromPath` — fuente de verdad intacta
- Supabase queries, RLS policies, migrations — sin tocar
- Rutas de Next.js, route groups `(dashboard)`, `(auth)`, `(superadmin)` — iguales
- `class-variance-authority`, `tw-animate-css`, `next-themes`, `sonner` — todo se queda
- `ModuleToolbar`, formularios existentes, dialogs, tabla de TanStack — sin cambios

---

## Paso 1 · Tokens CSS (5 minutos)

**Archivo:** `src/app/globals.css`

Agrega el bloque de abajo **AL FINAL** del archivo (no reemplaces nada). Son tokens nuevos para glassmorphism que conviven con tus `--primary`, `--card`, etc.

📁 Ver: `production/globals.patch.css`

---

## Paso 2 · Shell flotante (15 minutos)

Reemplaza estos tres archivos por las versiones de `production/`:

| Archivo del repo | Reemplazar por |
|---|---|
| `src/components/layout/sidebar.tsx` | `production/components/layout/sidebar.tsx` |
| `src/components/layout/header.tsx` | `production/components/layout/header.tsx` |
| `src/app/(dashboard)/layout.tsx` | `production/app/(dashboard)/layout.tsx` |

**Cambios respecto a tu versión actual:**
- Sidebar: posicionada `fixed top-3 left-3 bottom-3` con `rounded-2xl`, `bg-card/60 backdrop-blur-2xl`. Misma lógica de grupos, mismos hooks, mismas rutas.
- Header: posicionado `fixed top-3` con offset dinámico según `useSidebarStore`. Cmd+K abre `<CommandPalette>` (nuevo) en lugar de solo enfocar el input.
- `(dashboard)/layout.tsx`: añade un `<div className="ambient">` con glows y deja al `<main>` con padding compatible con los shells flotantes.

---

## Paso 3 · Componentes nuevos (10 minutos)

Copia estos archivos nuevos:

| Nuevo archivo | Uso |
|---|---|
| `src/components/ui/glass-card.tsx` | Reemplazo opcional de `Card` para superficies clave |
| `src/components/ui/metric-card.tsx` | KPI con icono, valor, delta y sparkline |
| `src/components/ui/command-palette.tsx` | Diálogo Cmd+K con búsqueda y grupos |
| `src/lib/format-cop.ts` | Helpers de formato COP (peso colombiano) |

Todos usan tu `cn` de `@/lib/utils`, Radix Dialog que ya tienes, Lucide y `class-variance-authority`. **Sin dependencias nuevas.**

---

## Paso 4 · Aplicar GlassCard / MetricCard por módulo (incremental)

No hace falta tocar todos los módulos a la vez. El shell flotante + tokens ya transforman la app en ~95% del impacto visual. Después, módulo por módulo, reemplazas:

```diff
- <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
+ <MetricCard
+   label="Total Clientes"
+   value={stats.total}
+   delta={12.4}
+   icon={Users}
+   sparkline={[...]}
+ />
```

Orden recomendado:
1. **Clientes** (`src/app/(dashboard)/customers/page.tsx`) — ya tienes 4 KPI cards, sustituye por `<MetricCard>`
2. **Ventas** (`/sales`) — toolbar + sub-tabs
3. **Dashboard** (`/`) — agregar grid de KPIs globales
4. Compras / Inventario / Finanzas / Contabilidad / Nómina — igual patrón

Cada cambio es un PR pequeño, fácil de revisar.

---

## Paso 5 · Dark mode (ya funciona)

Tu repo ya tiene `next-themes`. Los nuevos tokens definen variables `dark:` automáticas. Solo asegúrate de que tu `<ThemeProvider>` esté envolviendo el root layout.

---

## Mapeo de impacto

```
src/app/globals.css                              ✏️  +60 líneas (tokens glass)
src/app/(dashboard)/layout.tsx                   🔄  reemplazo (8→15 líneas)
src/components/layout/sidebar.tsx                🔄  reemplazo (preserva lógica)
src/components/layout/header.tsx                 🔄  reemplazo (preserva lógica)
src/components/ui/glass-card.tsx                 ➕  nuevo
src/components/ui/metric-card.tsx                ➕  nuevo
src/components/ui/command-palette.tsx            ➕  nuevo
src/lib/format-cop.ts                            ➕  nuevo

Total: 4 archivos modificados + 4 archivos nuevos
```

---

## Riesgos y rollback

- **Cero impacto en datos.** Si algo se ve raro, `git revert` al commit del rediseño y vuelves al estado anterior.
- **Tokens son aditivos.** Tu paleta indigo `--primary` sigue activa; solo añadimos `--glass-*`, `--bg-glow-*` y derivados.
- **El shell preserva contract.** Sidebar sigue exportando `<Sidebar />`, Header sigue exportando `<Header />`, mismos props/sin-props. Cualquier import existente sigue funcionando.

---

## Variables que controlas en runtime

Tu app está lista para tweaks visuales sin tocar código. Estas CSS vars pueden cambiarse vía un panel de settings/admin:

```css
--accent-hue: 270;        /* 270=violeta, 220=azul, 160=esmeralda */
--ambient-intensity: 1;   /* 0=plano, 1=normal, 2=máximo glow */
--glass-blur: 24px;       /* 0=opaco, 24=default, 40=máximo */
```

Toggleables sugeridos en `/settings`:
- Color de acento (5 opciones curadas)
- Intensidad del fondo ambiental
- Densidad de tablas (compact / regular / comfy)
