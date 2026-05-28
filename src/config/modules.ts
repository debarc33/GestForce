/**
 * REGISTRO CENTRAL DE MÓDULOS — GestForce ERP
 *
 * Fuente de verdad única para todos los módulos del sistema.
 * Importar desde aquí en:
 *   - src/components/layout/sidebar.tsx        (navegación dinámica)
 *   - src/components/layout/module-guard.tsx   (protección de rutas)
 *   - src/app/(superadmin)/...                 (Panel Superadmin: toggles)
 *   - src/modules/company/module-queries.ts    (filtrado de módulos habilitados)
 */

import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Boxes,
  CircleDollarSign,
  BookOpen,
  Users2,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ModuleId =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'finances'
  | 'accounting'
  | 'payroll'
  | 'reports'
  | 'settings'

export interface ModuleDefinition {
  /** Identificador único. Coincide con el campo `module_id` en la tabla `company_modules`. */
  id: ModuleId
  /** Nombre a mostrar en el sidebar y en el Panel Superadmin. */
  name: string
  /** Ruta base de Next.js (href del sidebar). */
  href: string
  /** Ícono de Lucide React. */
  icon: LucideIcon
  /**
   * Si es `true`, el módulo siempre está activo y NO puede desactivarse.
   * Estos módulos NO se almacenan en `company_modules`.
   */
  alwaysOn: boolean
  /** Descripción corta para el Panel Superadmin (toggles). */
  description: string
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    alwaysOn: true,
    description: 'Panel principal con resumen de la empresa',
  },
  {
    id: 'customers',
    name: 'Clientes',
    href: '/customers',
    icon: Users,
    alwaysOn: false,
    description: 'Gestión de clientes y contactos comerciales',
  },
  {
    id: 'products',
    name: 'Productos',
    href: '/products',
    icon: Package,
    alwaysOn: false,
    description: 'Catálogo de productos y servicios con precios e impuestos',
  },
  {
    id: 'sales',
    name: 'Ventas',
    href: '/sales',
    icon: ShoppingCart,
    alwaysOn: false,
    description: 'Cotizaciones, facturas electrónicas y recibos de caja',
  },
  {
    id: 'purchases',
    name: 'Compras',
    href: '/purchases',
    icon: Truck,
    alwaysOn: false,
    description: 'Órdenes de compra y facturas de proveedor',
  },
  {
    id: 'inventory',
    name: 'Inventario',
    href: '/inventory',
    icon: Boxes,
    alwaysOn: false,
    description: 'Movimientos de stock, Kardex y ajustes de inventario',
  },
  {
    id: 'finances',
    name: 'Finanzas',
    href: '/finances',
    icon: CircleDollarSign,
    alwaysOn: false,
    description: 'Cartera de clientes, obligaciones con proveedores e impuestos',
  },
  {
    id: 'accounting',
    name: 'Contabilidad',
    href: '/accounting',
    icon: BookOpen,
    alwaysOn: false,
    description: 'Plan de cuentas, comprobantes contables e informes',
  },
  {
    id: 'payroll',
    name: 'Nomina',
    href: '/payroll',
    icon: Users2,
    alwaysOn: false,
    description: 'Empleados, liquidación de nómina y aportes PILA',
  },
  {
    id: 'reports',
    name: 'Reportes',
    href: '/reports',
    icon: BarChart3,
    alwaysOn: false,
    description: 'Reportes y análisis de datos del negocio',
  },
  {
    id: 'settings',
    name: 'Configuracion',
    href: '/settings',
    icon: Settings,
    alwaysOn: true,
    description: 'Configuración de la empresa, métodos de pago y datos DIAN',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Dado un pathname de Next.js, devuelve el ModuleId correspondiente.
 * Retorna `null` si no coincide ningún módulo (ej: rutas de API).
 *
 * @example
 * getModuleIdFromPath('/sales/invoices/abc-123') // → 'sales'
 * getModuleIdFromPath('/') // → 'dashboard'
 * getModuleIdFromPath('/superadmin') // → null
 */
export function getModuleIdFromPath(pathname: string): ModuleId | null {
  if (pathname === '/') return 'dashboard'
  const match = MODULE_REGISTRY.find(
    (m) => m.href !== '/' && pathname.startsWith(m.href)
  )
  return match?.id ?? null
}

/**
 * Devuelve los IDs de todos los módulos que tienen `alwaysOn: true`.
 * Estos no se almacenan en la DB y siempre están disponibles.
 */
export const ALWAYS_ON_MODULE_IDS: ModuleId[] = MODULE_REGISTRY
  .filter((m) => m.alwaysOn)
  .map((m) => m.id)

/**
 * Devuelve los módulos que SÍ se pueden activar/desactivar (no alwaysOn).
 * Son los que el Panel Superadmin puede togglear.
 */
export const TOGGLEABLE_MODULES: ModuleDefinition[] = MODULE_REGISTRY.filter(
  (m) => !m.alwaysOn
)
