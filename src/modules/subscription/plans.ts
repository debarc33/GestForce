// ─── Suscripciones: planes por paquete de módulos ───────────────────────────
// Los planes son fijos (definidos aquí, no en una tabla de BD). Cada plan
// incluye un conjunto de módulos (además de los alwaysOn: dashboard,
// settings) y un precio por período (3/6/12 meses), en PESOS COP enteros
// (no en "centavos" -- a diferencia de la convención vieja de
// SUBSCRIPTION_PRICES en constants.ts, que causó un bug real de cobro 100x
// con Bold. Aquí el número es directamente lo que se cobra).
//
// Precios anclados en el primer cliente real: pagó $1.200.000 por el plan
// "Comercial" (Ventas + Compras + Inventario) a 12 meses -- ver
// claude/estado-proyecto.md. Los demás planes/periodos son estimaciones
// proporcionales (ver la propuesta de planes) y se pueden ajustar en
// cualquier momento editando este archivo, sin tocar el resto del código.

import type { ModuleId } from '@/config/modules'
import type { SubscriptionPeriod } from './constants'

export type PlanId = 'nucleo' | 'comercial' | 'contable' | 'integral'

export type SubscriptionPlan = {
  id: PlanId
  name: string
  description: string
  /** Módulos incluidos, además de los alwaysOn (dashboard, settings). */
  modules: ModuleId[]
  /** Precio en pesos COP (enteros) por período. */
  prices: Record<SubscriptionPeriod, number>
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'nucleo',
    name: 'Núcleo',
    description: 'Ventas y compras -- lo esencial para empezar a facturar.',
    modules: ['ventas', 'compras'],
    prices: {
      '3_months': 270_000,
      '6_months': 459_000,
      '1_year':   864_000,
    },
  },
  {
    id: 'comercial',
    name: 'Comercial',
    description: 'Ventas, compras e inventario -- control completo del negocio comercial.',
    modules: ['ventas', 'compras', 'inventario'],
    prices: {
      '3_months': 375_000,
      '6_months': 637_500,
      '1_year':   1_200_000,
    },
  },
  {
    id: 'contable',
    name: 'Contable',
    description: 'Todo lo de Comercial, más contabilidad.',
    modules: ['ventas', 'compras', 'inventario', 'contabilidad'],
    prices: {
      '3_months': 525_000,
      '6_months': 892_500,
      '1_year':   1_680_000,
    },
  },
  {
    id: 'integral',
    name: 'Integral',
    description: 'Todos los módulos: ventas, compras, inventario, contabilidad, finanzas y nómina.',
    modules: ['ventas', 'compras', 'inventario', 'contabilidad', 'finanzas', 'nomina'],
    prices: {
      '3_months': 675_000,
      '6_months': 1_147_500,
      '1_year':   2_160_000,
    },
  },
]

/** Plan usado cuando no se especifica ninguno (ej. checkout de superadmin, que
 *  todavía no tiene selector de plan en su UI) -- coincide con el plan del
 *  primer cliente real. */
export const DEFAULT_PLAN_ID: PlanId = 'comercial'

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && SUBSCRIPTION_PLANS.some((p) => p.id === value)
}

export function getPlan(planId: string | null | undefined): SubscriptionPlan {
  return (
    SUBSCRIPTION_PLANS.find((p) => p.id === planId) ??
    SUBSCRIPTION_PLANS.find((p) => p.id === DEFAULT_PLAN_ID)!
  )
}

export function getPlanPriceCOP(planId: string | null | undefined, period: SubscriptionPeriod): number {
  return getPlan(planId).prices[period]
}

// ─── Compra única: paquete de facturas electrónicas (DIAN) ──────────────────
// NO es una suscripción -- es un cargo aparte, de una sola vez. Todavía no
// hay control de cupo/consumo (se descuenta manualmente por ahora); eso
// queda pendiente para cuando se pruebe Facturación Electrónica a fondo.
export const DIAN_INVOICE_PACK = {
  quantity: 20,
  /** Precio en pesos COP (enteros). */
  price: 300_000,
} as const
