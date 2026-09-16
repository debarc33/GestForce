// ─── Suscripciones: constantes compartidas (server + client) ────────────────
// Usado por el checkout superadmin, el checkout de empresa y la UI de Settings.
//
// Los PRECIOS reales viven en ./plans.ts (SUBSCRIPTION_PLANS), no aquí --
// cada plan tiene su propio precio por período. Este archivo solo define los
// períodos válidos y sus etiquetas.

export type SubscriptionPeriod = '3_months' | '6_months' | '1_year'

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'suspended'

export const SUBSCRIPTION_PERIODS: SubscriptionPeriod[] = ['3_months', '6_months', '1_year']

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
  return typeof value === 'string' && (SUBSCRIPTION_PERIODS as string[]).includes(value)
}
