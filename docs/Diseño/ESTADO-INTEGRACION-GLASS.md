# ESTADO ACTUAL — INTEGRACIÓN GLASS PREMIUM

**Última actualización:** 2026-06-06

---

## ✅ COMPLETADO

### FASE 0: Diagnóstico
- ✅ Identificado `production/` como fuente de verdad
- ✅ Mapeados archivos a `src/`
- ✅ Resueltos conflictos previos

### FASE 1: Fundaciones
- ✅ `globals.css` — Tokens oklch + glass-surface + @theme inline para Tailwind 4
- ✅ `sidebar.tsx` — Glass surface flotante (232px ancho normal, 64px colapsado)
- ✅ `header.tsx` — Estructura flotante correcta
- ✅ `(dashboard)/layout.tsx` — Offsets 260px (izq) / 84px (arriba)
- ✅ `background-layer.tsx` — 6 fondos dinámicos (aurora, mesh, nebula, horizonte, topo, circuit) + grid overlay
- ✅ **Sidebar flotante, Header flotante, Fondo futurista, Cmd+K** — TODO FUNCIONA

### FASE 2: Componentes UI
- ✅ `glass-card.tsx`
- ✅ `metric-card.tsx`
- ✅ `command-palette.tsx`
- ✅ `glass-table.tsx` (con DocLink para números de documento como links)
- ✅ `toolbar.tsx` (orden: [iconos] [buscador flex] [filtros] [BOTÓN NUEVO derecha])
- ✅ `status-badge.tsx`
- ✅ `status-dropdown.tsx`
- ✅ `pagination.tsx`
- ✅ **Todos listos para usar en módulos**

### FASE 4 (Partial): Configuración
- ✅ `AppearanceProvider` creado en `src/components/appearance/appearance-provider.tsx`
- ⚠️ Sistema de Apariencia existe pero requiere integración final con Supabase

---

## 📋 PENDIENTE: FASE 3 — MÓDULOS (Uno por uno)

### Orden de implementación (según `production/MODULOS.md`):

#### 1. **Ventas (5 pestañas)**
- [ ] Clientes
- [ ] Cotizaciones
- [ ] Facturas
- [ ] Recibos
- [ ] CxC (Cartera por cobrar)

#### 2. **Compras (4 pestañas)**
- [ ] Órdenes de Compra
- [ ] Facturas Proveedor
- [ ] Proveedores
- [ ] CxP (Cartera por pagar)

#### 3. **Inventario (4 pestañas)**
- [ ] Productos
- [ ] Movimientos
- [ ] Kardex
- [ ] Ajustes

#### 4. **Dashboard/Tablero**
- [ ] Panel con KPIs + gráficos

#### 5. **Finanzas (3 pestañas)**
- [ ] Panel
- [ ] Impuestos
- [ ] Gastos

#### 6. **Contabilidad (3 pestañas)**
- [ ] Plan de Cuentas
- [ ] Comprobantes
- [ ] Informes

#### 7. **Nómina (6 pestañas)**
- [ ] Empleados
- [ ] Liquidar
- [ ] Historial
- [ ] Aportes PILA
- [ ] Ausencias
- [ ] Prestaciones

#### 8. **Configuración**
- [x] Apariencia (en progreso)
- [ ] Organización
- [ ] Equipo
- [ ] Integraciones
- [ ] Seguridad

#### 9. **Superadmin**
- [ ] Layout propio (barra horizontal, fondo negro)
- [ ] Empresas
- [ ] Módulos
- [ ] Suscripciones
- [ ] Configuración

---

## 🎯 Próximos pasos

### FASE 3.1: Ventas → Clientes
1. Leer especificación en `production/MODULOS.md` (línea 13)
2. Aplicar GlassCard + GlassTable + Toolbar
3. Mantener lógica de queries/mutations exactamente igual
4. Commit: `feat(modules/ventas/clientes): glass design`

### General para cada módulo:
- ✓ Especificación visual: `production/MODULOS.md`
- ✓ Contrato de datos: NO cambiar queries ni mutations
- ✓ Toolbar: `[iconos] [buscador flex] [filtros] [BOTÓN NUEVO derecha]`
- ✓ Números de documento: deben ser links (DocLink)
- ✓ Densidad compacta: filas ~36-40px
- ✓ Soportar claro/oscuro: usar tokens CSS, no hardcodear colores
- ✓ Un commit por módulo

---

## ⚙️ Notas técnicas

### CSS disponibles:
```css
/* Superficies glass */
.glass-surface { blur, border, shadow }
.glass-surface-strong { más opaco, sombra más fuerte }

/* Fondos */
.gf-ambient / .ambient { fondo futurista con glows }
.gf-grid { rejilla técnica 48px, opacidad dinámica por modo }

/* Tokens Tailwind 4 */
--glass, --glass-hover, --glass-strong
--accent, --accent-soft, --amb-1, etc.
```

### Componentes disponibles:
```tsx
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import { GlassTable, Tr, Th, Td, DocLink } from '@/components/ui/glass-table'
import { Toolbar } from '@/components/ui/toolbar'
import { StatusBadge } from '@/components/ui/status-badge'
import { StatusDropdown } from '@/components/ui/status-dropdown'
import { Pagination } from '@/components/ui/pagination'
import { CommandPalette } from '@/components/ui/command-palette'
```

### Datos Colombia:
```tsx
import { formatCOP } from '@/lib/format-cop'

// En tablas: COP sin decimales
<Td>{formatCOP(1500000)}</Td>  // → "1.500.000"

// IVA: 19%
const iva = subtotal * 0.19
```

---

## 📌 Checklist para cada módulo

- [ ] Leo `MODULOS.md` para especificación exacta
- [ ] Identifico columnas que se ven vs. las que se ocultan
- [ ] Creo tabla con GlassTable
- [ ] Creo toolbar con orden correcto ([iconos][buscador][filtros][NUEVO])
- [ ] Números de documento son links con DocLink
- [ ] Estados usan StatusBadge
- [ ] Densidad ~36-40px
- [ ] Soporta dark mode (tokens CSS)
- [ ] npm run build pasa
- [ ] Commit: `feat(modules/...): glass design`
- [ ] Espero aprobación del usuario antes de siguiente módulo

---

## 📚 Referencias
- `production/README-INTEGRACION.md` — Guía oficial de integración
- `production/MODULOS.md` — Especificación visual módulo por módulo
- `production/CLAUDE-md-snippet.md` — Pega esto en CLAUDE.md cuando termines
- `src/app/globals.css` — Tokens CSS disponibles

---

**¿Listo para FASE 3.1: Ventas → Clientes?**

User approves with `aprobado` or similar, then I start on module implementation.
