// ─── Suscripciones: constantes compartidas (server + client) ────────────────
// Usado por el checkout superadmin, el checkout de empresa y la UI de Settings.

export type SubscriptionPeriod = '3_months' | '6_months' | '1_year'

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'suspended'

/** Precios en centavos COP (29900 = $299 COP) — misma semántica que el checkout original */
export const SUBSCRIPTION_PRICES: Record<SubscriptionPeriod, number> = {
  '3_months': 29900,    // $299 COP (3 months)
  '6_months': 49900,    // $499 COP (6 months) - 15% descuento
  '1_year':   79900,    // $799 COP (1 year) - 20% descuento
}

export const PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  '3_months': '3 meses',
  '6_months': '6 meses',
  '1_year':   '1 año',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active:    'Activa',
  pending:   'Pendiente de pago',
  expired:   'Vencida',
  suspended: 'Suspendida',
}

export function isSubscriptionPeriod(value: unknown): value is SubscriptionPeriod {
  return typeof value === 'string' && value in SUBSCRIPTION_PRICES
}

/** Precio en pesos COP (no centavos), listo para formatCOP() */
export function getPeriodPriceCOP(period: SubscriptionPeriod): number {
  return SUBSCRIPTION_PRICES[period] / 100
}
