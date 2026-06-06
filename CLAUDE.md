# GestForce — Documentación del Proyecto

Stack tecnológico: **Next.js 16** · **TypeScript** · **Supabase (PostgreSQL + Auth + Storage)** · **Tailwind CSS** · **TanStack Query** · **Zod** · **React Hook Form**

## Arquitectura

**Multi-tenant SaaS colombiano.** Cada empresa tiene:
- Sus módulos activos/inactivos (toggled en superadmin)
- Sus usuarios con roles (admin, contador, vendedor, readonly)
- Sus datos aislados por **RLS en Supabase**

---

## 🔐 Sistema de Acceso

| Feature | Detalle |
|---------|---------|
| **Autenticación** | Supabase Auth — login/logout, JWT |
| **Protección de rutas** | `proxy.ts` (Next.js 16) — redirige a /login si no autenticado |
| **Multi-empresa** | Un usuario puede pertenecer a varias empresas; selector de empresa activa |
| **Roles por empresa** | admin · contador · vendedor · readonly |
| **Superadmin** | Identificado por `app_metadata.is_superadmin`; acceso a `/superadmin` |
| **ModuleGuard** | Redirige al dashboard si el módulo está desactivado para la empresa |

---

## 👑 Panel Superadmin (`/superadmin`)

- Ver, crear y modificar empresas
- Activar/desactivar módulos por empresa (toggles)
- Gestionar suscripciones: 3 meses / 6 meses / 1 año
- Estados: pending · active · expired · suspended

---

## 📦 Módulos del Sistema

### 1. Dashboard (`/`)
Panel de inicio — siempre activo.

### 2. Ventas (`/sales`) — 5 pestañas
| Pestaña | Contenido |
|---------|-----------|
| **Cotizaciones** | Crear/editar, estados (borrador, enviada, aprobada, rechazada, caducada), exportar Excel |
| **Facturas** | Emitidas desde cotizaciones o tickets directos, nota crédito/débito, detalle con agente |
| **Recibos** | Abonos a facturas, pagos parciales |
| **Clientes** | Directorio CRUD, tipo pago (contado/crédito), días crédito, régimen fiscal |
| **CxC** | Cartera por cobrar con envejecimiento (al día / 1-30 / 31-60 / 61-90 / +90 días) |

### 3. Compras (`/purchases`) — 4 pestañas
| Pestaña | Contenido |
|---------|-----------|
| **Órdenes de Compra** | Crear/editar, estados (borrador, enviada, recibida, anulada) |
| **Facturas Proveedor** | Facturas de compra con ítems, retención, saldo |
| **Proveedores** | Directorio CRUD, cuentas bancarias, métodos de pago, régimen fiscal |
| **CxP** | Obligaciones por pagar con envejecimiento |

### 4. Inventario (`/inventario`) — 4 pestañas
| Pestaña | Contenido |
|---------|-----------|
| **Productos** | Catálogo con SKU, precio, IVA, categorías, stock mínimo, exportar |
| **Movimientos** | Historial completo de entradas/salidas por fecha, tipo y producto |
| **Kardex** | Kardex individual por producto con saldos acumulados, exportar CSV |
| **Ajustes** | Corrección manual de stock (conteo físico), queda registrado en movimientos |

### 5. Nómina (`/payroll`)
| Feature | Detalle |
|---------|---------|
| **Empleados** | CRUD con datos personales, laborales, seguridad social (EPS/AFP/ARL/CCF), bancarios |
| **Tipos de contrato** | Indefinido · Fijo · Obra/labor · Aprendizaje · Por comisión |
| **Contrato por comisión** | Define el % de comisión; el empleado aparece como agente en facturas |
| **Agente en facturas** | Selector en el detalle de factura; calcula comisión estimada en tiempo real |
| **Liquidación** | Cálculo de nómina por período: salud, pensión, ARL, transporte, horas extra |
| **Ausencias** | Registro con impacto en liquidación |
| **Aportes PILA** | Resumen de aportes al sistema |

### 6. Contabilidad (`/accounting`) — 3 pestañas
| Pestaña | Contenido |
|---------|-----------|
| **Plan de Cuentas** | PUC colombiano NIIF PYMES (~60 cuentas preconfiguradas) |
| **Comprobantes** | Creación manual con líneas débito/crédito balanceadas, auto-numeración CE-YYYY-NNNN |
| **Informes** | Saldos por cuenta |

### 7. Finanzas (`/finances`) — 3 pestañas
| Pestaña | Contenido |
|---------|-----------|
| **Panel** | KPIs: ingresos, gastos totales, IVA neto, cartera, obligaciones; gráfico barras mensual |
| **Impuestos** | IVA cobrado/descontable/neto, retenciones, ReteIVA, ICA estimado; exportar |
| **Gastos** | Registro de gastos operativos directos |

**Módulo de Gastos (dentro de Finanzas):**
- Categorías personalizadas: tipo fijo/variable, cuenta PUC asignada
- Tabla de gastos con filtros por tipo, búsqueda, exportar Excel
- KPIs del período: fijos / variables / total directo
- Adjuntar recibo o soporte (imagen/PDF → Supabase Storage)
- Opción de crear comprobante contable automático al registrar
- Gastos recurrentes: plantillas con frecuencia (mensual/trimestral/semestral/anual), día del mes, botón "Generar"

### 8. Configuración (`/settings`)
- Datos de la empresa: razón social, NIT, dirección, ciudad, régimen fiscal, tasa ICA
- Logo de empresa (upload a Supabase Storage)
- Configuración DIAN: resolución, prefijo, numeración, fecha vencimiento
- Facturación electrónica: software_id, technical_key, modo prueba
- Umbral comprador (para imprimir datos en facturas)
- Métodos de pago disponibles

---

## 🎨 UX / Interfaz

| Feature | Detalle |
|---------|---------|
| **Sidebar** | Colapsable, navegación plana, módulos filtrados por empresa, activo resaltado |
| **Header** | Búsqueda global (⌘K), notificaciones, ayuda, toggle claro/oscuro, menú de usuario |
| **Modo claro/oscuro** | ☀️ Claro → 🌙 Oscuro → 🖥️ Sistema; persiste en localStorage |
| **Exportar Excel** | Disponible en todas las tablas principales |
| **Dialogs** | Formularios modales con validación Zod en tiempo real |
| **Tablas** | Paginación, selección múltiple, filtros, búsqueda, eliminación masiva |

---

## 🗄️ Base de Datos — Migraciones

| Migración | Descripción |
|-----------|-------------|
| 001 | Módulos por empresa (company_modules) |
| 002 | Superadmins |
| 003 | Suscripciones por empresa |
| 004 | Renombrado de IDs de módulos |
| 005 | Comisiones: commission_rate en empleados, agent_id en facturas |
| 006 | Gastos: expense_categories, expenses, recurring_expenses |
| 007 | Payment orders para suscripciones |
| 008 | Payment events para webhook tracking |
| 009 | Payment providers (Bold, Wompi, Stripe) |

---

## Estándar de UI — "Glass Premium" (obligatorio para todo el frontend)

Toda pantalla, módulo o componente nuevo DEBE seguir este sistema de diseño. No crear tablas, cards ni toolbars "crudas".

### Componentes base (usar siempre)
- **Superficies** → `GlassCard` (`@/components/ui/glass-card`). Nunca `<div>` con bordes/bg propios para contenedores.
- **Tablas** → `GlassTable` + `StatusBadge` + `DocLink` (`@/components/ui/*`).
- **KPIs** → `MetricCard` (`@/components/ui/metric-card`).
- **Toolbars** → componente `Toolbar` con el orden: `[iconos imprimir/importar/exportar] [buscador flex-1] [filtros] [BOTÓN PRIMARIO]`.
- **Formato dinero** → `formatCOP()` (`@/lib/format-cop`). COP sin decimales.

### Reglas visuales
- **Tokens, nunca colores hardcodeados:** `var(--glass)`, `var(--glass-border)`, `var(--accent)`, sombras `var(--shadow-*)`.
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
- **NIT/CC/CE** + régimen DIAN (Resp. IVA / No Resp. / Gran Contribuyente). 
- **IVA 19%**.
