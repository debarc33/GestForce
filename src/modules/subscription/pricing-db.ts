// ─── Precios en vivo (editables desde Superadmin) ───────────────────────────
// SUBSCRIPTION_PLANS y DIAN_INVOICE_PACK (en ./plans.ts) siguen existiendo
// como la IDENTIDAD de cada plan (nombre, descripción, módulos) y como
// valores de respaldo -- pero el PRECIO real que se cobra y se muestra al
// cliente ahora vive en las tablas subscription_plan_prices /
// invoice_pack_settings (migración 021), editable desde
// /superadmin/settings/subscription-plans. Estas funciones son las únicas
// que deben usarse para resolver un precio a cobrar o a mostrar -- nunca
// leer plan.prices[...] / DIAN_INVOICE_PACK.price directamente en código
// nuevo, para que un cambio de precio en Superadmin aplique de inmediato
// en todos lados (checkout y pantalla de cliente) sin reconstruir la app.

import type { SupabaseClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PLANS, DIAN_INVOICE_PACK, type PlanId } from './plans'
import type { SubscriptionPeriod } from './constants'

export type LivePlanPrices = Record<PlanId, Record<SubscriptionPeriod, number>>
export type LiveInvoicePack = { quantity: number; price: number }

const PERIOD_COLUMN: Record<SubscriptionPeriod, 'price_3_months' | 'price_6_months' | 'price_1_year'> = {
  '3_months': 'price_3_months',
  '6_months': 'price_6_months',
  '1_year':   'price_1_year',
}

/** Lee los precios vigentes de los 4 planes. Si falta alguna fila en BD
 *  (no debería pasar tras la migración 021), usa el precio fijo de
 *  ./plans.ts como respaldo para ese plan puntual. */
export async function getLivePlanPrices(admin: SupabaseClient): Promise<LivePlanPrices> {
  const { data } = await admin
    .from('subscription_plan_prices')
    .select('plan_id, price_3_months, price_6_months, price_1_year')

  const byId = new Map((data ?? []).map((row) => [row.plan_id as PlanId, row]))

  const result = {} as LivePlanPrices
  for (const plan of SUBSCRIPTION_PLANS) {
    const row = byId.get(plan.id)
    result[plan.id] = row
      ? {
          '3_months': Number(row.price_3_months),
          '6_months': Number(row.price_6_months),
          '1_year':   Number(row.price_1_year),
        }
      : { ...plan.prices }
  }
  return result
}

/** Precio vigente de un plan/período puntual (para el checkout). */
export async function getLivePlanPrice(
  admin: SupabaseClient,
  planId: PlanId,
  period: SubscriptionPeriod
): Promise<number> {
  const { data } = await admin
    .from('subscription_plan_prices')
    .select(PERIOD_COLUMN[period])
    .eq('plan_id', planId)
    .maybeSingle()

  if (data) {
    const value = (data as Record<string, unknown>)[PERIOD_COLUMN[period]]
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value)
  }

  const fallback = SUBSCRIPTION_PLANS.find((p) => p.id === planId)
  return fallback ? fallback.prices[period] : SUBSCRIPTION_PLANS[0].prices[period]
}

/** Cantidad y precio vigentes del paquete de facturas DIAN. */
export async function getLiveInvoicePack(admin: SupabaseClient): Promise<LiveInvoicePack> {
  const { data } = await admin
    .from('invoice_pack_settings')
    .select('quantity, price')
    .eq('id', 1)
    .maybeSingle()

  if (data) {
    return { quantity: Number(data.quantity), price: Number(data.price) }
  }
  return { quantity: DIAN_INVOICE_PACK.quantity, price: DIAN_INVOICE_PACK.price }
}
