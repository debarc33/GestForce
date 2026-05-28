/**
 * REGISTRO CENTRAL DE MÓDULOS — GestForce ERP
 *
 * Fuente de verdad única para todos los módulos del sistema.
 * Importar desde aquí en:
 *   - src/components/layout/sidebar.tsx        (navegación dinámica con grupos)
 *   - src/components/layout/module-guard.tsx   (protección de rutas)
 *   - src/app/(superadmin)/...                 (Panel Superadmin: toggles)
 *   - src/modules/company/module-queries.ts    (filtrado de módulos habilitados)
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Boxes,
  CircleDollarSign,
  BookOpen,
  Users2,
  Settings,
  type LucideIcon,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ModuleId =
  | 'dashboard'
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'nomina'
  | 'contabilidad'
  | 'finanzas'
  | 'settings'

/** Elemento de sub-navegación dentro de un módulo agrupado. */
export interface SubNavItem {
  /** Etiqueta visible en el sidebar. */
  label: string
  /** Href de Next.js para este ítem (puede incluir ?tab=...). */
  href: string
}

export interface ModuleDefinition {
  /** Identificador único. Coincide con el campo `module_id` en la tabla `company_modules`. */
  id: ModuleId
  /** Nombre a mostrar en el sidebar y en el Panel Superadmin. */
  name: string
  /**
   * Ruta base. Requerida para módulos de enlace único (sin children).
   * Opcional para módulos agrupados (con children).
   */
  href?: string
  /** Ícono de Lucide React. */
  icon: LucideIcon
  /**
   * Si es `true`, el módulo siempre está activo y NO puede desactivarse.
   * Estos módulos NO se almacenan en `company_modules`.
   */
  alwaysOn: boolean
  /** Descripción corta para el Panel Superadmin (toggles). */
  description: string
  /**
   * Sub-ítems de navegación. Cuando está presente, el sidebar renderiza el módulo
   * como una sección colapsable con enlaces indentados.
   * Cuando está ausente, el módulo se renderiza como un enlace directo.
   */
  children?: SubNavItem[]
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
    id: 'ventas',
    name: 'Ventas',
    icon: ShoppingCart,
    alwaysOn: false,
    description: 'Clientes, cotizaciones, facturación y cartera por cobrar',
    children: [
      { label: 'Clientes',           href: '/customers'         },
      { label: 'Cotizaciones',       href: '/sales?tab=quotes'  },
      { label: 'Facturas y Recibos', href: '/sales?tab=invoices'},
      { label: 'CxC',                href: '/sales/cxc'         },
    ],
  },
  {
    id: 'compras',
    name: 'Compras',
    icon: Truck,
    alwaysOn: false,
    description: 'Proveedores, órdenes de compra y cuentas por pagar',
    children: [
      { label: 'Proveedores',        href: '/suppliers'              },
      { label: 'Órdenes de Compra',  href: '/purchases?tab=orders'  },
      { label: 'Facturas Proveedor', href: '/purchases?tab=invoices' },
      { label: 'CxP',                href: '/purchases/cxp'         },
    ],
  },
  {
    id: 'inventario',
    name: 'Inventario',
    icon: Boxes,
    alwaysOn: false,
    description: 'Productos, catálogo y movimientos de stock',
    children: [
      { label: 'Productos',            href: '/products'  },
      { label: 'Movimientos de Stock', href: '/inventory' },
    ],
  },
  {
    id: 'nomina',
    name: 'Nómina',
    href: '/payroll',
    icon: Users2,
    alwaysOn: false,
    description: 'Empleados, liquidación de nómina y aportes PILA',
  },
  {
    id: 'contabilidad',
    name: 'Contabilidad',
    href: '/accounting',
    icon: BookOpen,
    alwaysOn: false,
    description: 'Plan de cuentas, comprobantes contables e informes',
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    href: '/finances',
    icon: CircleDollarSign,
    alwaysOn: false,
    description: 'Flujo de caja, panel financiero e informe de impuestos',
  },
  {
    id: 'settings',
    name: 'Configuración',
    href: '/settings',
    icon: Settings,
    alwaysOn: true,
    description: 'Configuración de la empresa, métodos de pago y datos DIAN',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mapa estático de prefijos de ruta → ModuleId.
 * Usar en lugar de iterar MODULE_REGISTRY para soportar módulos agrupados
 * que no tienen un href propio.
 */
const PATH_TO_MODULE: Array<[prefix: string, moduleId: ModuleId]> = [
  ['/customers',  'ventas'      ],
  ['/sales',      'ventas'      ],
  ['/suppliers',  'compras'     ],
  ['/purchases',  'compras'     ],
  ['/products',   'inventario'  ],
  ['/inventory',  'inventario'  ],
  ['/payroll',    'nomina'      ],
  ['/accounting', 'contabilidad'],
  ['/finances',   'finanzas'    ],
  ['/settings',   'settings'   ],
]

/**
 * Dado un pathname de Next.js, devuelve el ModuleId correspondiente.
 * Retorna `null` si no coincide ningún módulo (ej: rutas de API, superadmin).
 *
 * @example
 * getModuleIdFromPath('/sales/invoices/abc-123') // → 'ventas'
 * getModuleIdFromPath('/customers')              // → 'ventas'
 * getModuleIdFromPath('/')                       // → 'dashboard'
 * getModuleIdFromPath('/superadmin')             // → null
 */
export function getModuleIdFromPath(pathname: string): ModuleId | null {
  if (pathname === '/') return 'dashboard'
  const entry = PATH_TO_MODULE.find(([prefix]) => pathname.startsWith(prefix))
  return entry ? entry[1] : null
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
