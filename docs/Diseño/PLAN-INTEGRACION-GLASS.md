# PLAN DE INTEGRACIÓN GLASS PREMIUM — GESTFORCE

## FASE 0 — DIAGNÓSTICO COMPLETADO ✅

### 1. Fuentes y Conflictos Identificados

#### Paquete `production/` — Estado actual:
- ✅ `README-INTEGRACION.md` — Documentación clara de fases
- ✅ `MODULOS.md` — Especificación visual por módulo  
- ✅ `globals.patch.css` — Tokens y sistema glass (oklch + sombras)
- ✅ `lib/format-cop.ts` — Formateador de dinero COP
- ✅ `components/layout/{sidebar,header}.tsx` — Shell flotante
- ✅ `app/(dashboard)/layout.tsx` — Estructura glass
- ✅ `components/ui/` — Primitivos: glass-card, glass-table, toolbar, status-badge, metric-card, pagination, command-palette, status-dropdown, background-layer

#### Paquete `Temporal/` — **DESCARTADO**
- Archivos temporales/de referencia solo. No son la fuente de verdad.
- Se usó erróneamente en intentos previos.

### 2. Estado Actual del Proyecto

#### Archivos ya modificados (erróneamente):
- `src/app/(dashboard)/layout.tsx` — Usa `DashboardContent` + `useAppearance` (debe reemplazarse)
- `src/app/globals.css` — Tiene mezcla de tokens viejos y nuevos (debe limpiarse)
- `src/components/ui/background-layer.tsx` — Versión provisional (debe reemplazarse)
- `src/app/providers.tsx` — Tiene `AppearanceProvider` injected (debe ajustarse)
- `src/modules/settings/appearance-*.tsx` — Sistema provisional (debe reemplazarse)

#### Archivos que NO han cambiado y deben preservarse:
- ✅ Hooks/stores: `useCompanyStore`, `useSidebarStore`, `useEnabledModules`
- ✅ `src/config/modules.ts` — MODULE_REGISTRY intacto
- ✅ Queries/mutations en `src/modules/*/`
- ✅ Rutas y route groups
- ✅ Tipos de dominio

---

## FASE 1 — FUNDACIONES (TOKENS + SHELL)

### Paso 1.1: Limpiar y reemplazar globals.css
**Archivo:** `src/app/globals.css`

Acciones:
1. Eliminar TODO lo que está debajo de la línea 189 (los tokens duplicados de GLASS)
2. Copiar `production/globals.patch.css` **al final** sin borrar lo anterior
3. Verificar: debe haber un solo `:root { ... }` y un solo `.dark { ... }`
4. Build: `npm run build` → debe compilar sin errores

### Paso 1.2: Reemplazar Sidebar y Header
**Archivos:**
- `src/components/layout/sidebar.tsx` ← `production/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx` ← `production/components/layout/header.tsx`

Notas:
- Mismo contrato de props/hooks (useCompanyStore, useSidebarStore, MODULE_REGISTRY)
- No cambio en lógica, solo estilo visual

### Paso 1.3: Reemplazar Dashboard Layout
**Archivo:** `src/app/(dashboard)/layout.tsx` ← `production/app/(dashboard)/layout.tsx`

Acciones:
1. Remover `dashboard-content.tsx` (no se usa en el nuevo layout)
2. Reemplazar layout.tsx
3. Build check

### Paso 1.4: Copiar componentes UI nuevos a `src/components/ui/`
Desde `production/components/ui/`:
- ✅ `glass-card.tsx`
- ✅ `metric-card.tsx`
- ✅ `command-palette.tsx`
- ✅ `glass-table.tsx`
- ✅ `toolbar.tsx`
- ✅ `status-badge.tsx`
- ✅ `status-dropdown.tsx`
- ✅ `pagination.tsx`
- ⚠️ `background-layer.tsx` — **ESPECIAL** (ver Paso 1.5)

### Paso 1.5: Background Layer (caso especial)
**Situación:**
- El `background-layer.tsx` actual intenta leer un `AppearanceProvider`
- El de `production/` espera que los fondos se lean de `BackgroundLayer` props O de una sesión global

**Decisión:**
- Reemplazar por `production/background-layer.tsx`
- El sistema de Apariencia (Configuración) se implementará en FASE 3.4 (Configuración → Apariencia)
- Por ahora: default a "aurora", sin selector en vivo

### Paso 1.6: Copiar lib/format-cop.ts
**Archivo:** `src/lib/format-cop.ts` ← `production/lib/format-cop.ts`

### Paso 1.7: Ajustar Providers
**Archivo:** `src/app/providers.tsx`

Remover:
```tsx
import { AppearanceProvider } from '@/components/appearance/appearance-provider'
```

Quedará:
```tsx
<QueryClientProvider client={queryClient}>
  <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    {children}
  </NextThemesProvider>
</QueryClientProvider>
```

### Checkpoint FASE 1 ✓
- Sidebar flotante a la izquierda
- Header flotante arriba
- Fondo futurista (aurora por defecto)
- Claro/oscuro funciona
- Cmd+K funciona
- **Ningún módulo ha cambiado** (todas las páginas se ven igual, pero con shell glass)
- Build: `npm run build` pasa
- Commit: `feat(ui): glass shell + design tokens`

---

## FASE 2 — COMPONENTES COMPARTIDOS

Ya están listos en `production/components/ui/`. Solo copiar a `src/components/ui/`:
- `glass-table.tsx` → `GlassTable`, `THead`, `Th`, `Td`, `Tr`, `DocLink`
- `toolbar.tsx` → `Toolbar`
- `status-badge.tsx` → `StatusBadge`
- `status-dropdown.tsx` → `StatusDropdown`
- `pagination.tsx` → `Pagination`

Commit: `feat(ui): shared table + toolbar primitives`

---

## FASE 3 — MÓDULOS (UNO POR UNO)

Orden de prioridad (según uso):
1. **Ventas → Clientes** (el más usado, base para otros módulos de Ventas)
2. **Ventas → Cotizaciones**
3. **Ventas → Facturas**
4. **Ventas → Recibos**
5. **Ventas → CxC**
6. **Compras** (4 pestañas)
7. **Inventario** (4 pestañas)
8. **Dashboard**
9. **Finanzas** (3 pestañas)
10. **Contabilidad** (3 pestañas)
11. **Nómina** (6 pestañas)
12. **Configuración** — incluyendo Apariencia
13. **Superadmin** (shell aparte)

### Para cada módulo:
1. Lee su sección en `production/MODULOS.md`
2. Aplica GlassCard/GlassTable/Toolbar/StatusBadge según especificación
3. Mantén los datos (hooks/queries) exactamente igual
4. Commit por módulo: `feat(modules/ventas/clientes): glass design`

---

## FASE 4 — CONFIGURACIÓN → APARIENCIA (especial)

Cuando llegues a Configuración:

### 4.1: Crear AppearanceProvider (correcto, con Supabase)
Ubicación: `src/components/appearance/appearance-provider.tsx`
- Lee `ui_preferences` de Supabase (columna JSON en `companies` o tabla `ui_preferences`)
- Expone hook `useAppearance()` con `{ background, grid, accentColor }`
- Envuelve la app en `providers.tsx`

### 4.2: Pestaña Apariencia en Configuración
Ubicación: `src/modules/settings/appearance-tab.tsx`
- Controles: tema claro/oscuro · 5 botones de acento · 6 previsualizaciones de fondo · toggle rejilla
- Guarda a Supabase en tiempo real
- Actualiza el provider (y así BackgroundLayer)

### 4.3: Integrar en Configuración
Ubicación: `src/app/(dashboard)/settings/page.tsx`
- Agregar pestaña/grupo "Interfaz" → "Apariencia"

---

## FASE 5 — PULIDO (FUTURO)

- Toasts (sonner) con estilo glass
- Transiciones entrada (fade/slide)
- Revisar responsive light mode

---

## CAMBIOS A DESCARTAR

- ❌ `src/app/(dashboard)/dashboard-content.tsx` — **ELIMINAR**
- ❌ `supabase/migrations/010_add_ui_preferences.sql` — **Revisar si ya existe la columna en companies**
- ❌ `src/modules/settings/useAppearance.ts` — **ELIMINAR** (será creado correctamente en FASE 4)

---

## RESUMEN DE ARCHIVOS

| Acción | Desde | Hacia |
|--------|-------|-------|
| Reemplazar | `production/globals.patch.css` | Fin de `src/app/globals.css` |
| Reemplazar | `production/lib/format-cop.ts` | `src/lib/format-cop.ts` |
| Reemplazar | `production/app/(dashboard)/layout.tsx` | `src/app/(dashboard)/layout.tsx` |
| Reemplazar | `production/components/layout/sidebar.tsx` | `src/components/layout/sidebar.tsx` |
| Reemplazar | `production/components/layout/header.tsx` | `src/components/layout/header.tsx` |
| Copiar | `production/components/ui/glass-*.tsx` | `src/components/ui/` |
| Copiar | `production/components/ui/toolbar.tsx` | `src/components/ui/` |
| Copiar | `production/components/ui/status-*.tsx` | `src/components/ui/` |
| Copiar | `production/components/ui/pagination.tsx` | `src/components/ui/` |
| Copiar | `production/components/ui/background-layer.tsx` | `src/components/ui/` |
| Eliminar | N/A | `src/app/(dashboard)/dashboard-content.tsx` |
| Eliminar | N/A | `src/modules/settings/useAppearance.ts` |

---

## NOTAS IMPORTANTES

1. **No toques:** queries, mutations, stores, RLS, rutas, tipos de dominio.
2. **Especificación visual:** `production/MODULOS.md` es la verdad de verdad.
3. **Build tras cada fase:** `npm run build` debe pasar.
4. **Un commit por fase:** facilita revisar cambios.
5. **Cmd+K (CommandPalette):** ya en `production/components/ui/command-palette.tsx`.
6. **formatCOP():** usar `production/lib/format-cop.ts` para todo dinero.

---

**LISTO PARA PROCEDER A FASE 1: FUNDACIONES** ✅

¿Aprobado el plan?
