/**
 * Tipos explícitos para el Panel Superadmin.
 * Usados en las API Routes y Server Components del superadmin
 * donde el admin client no usa el generic <Database>.
 */

export type SubscriptionPeriod = '3_months' | '6_months' | '1_year'
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'suspended'

export const SUBSCRIPTION_PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  '3_months': '3 meses',
  '6_months': '6 meses',
  '1_year':   '1 año',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending:   'Pendiente pago',
  active:    'Activa',
  expired:   'Vencida',
  suspended: 'Suspendida',
}

export interface SACompany {
  id: string
  name: string
  nit: string | null
  legal_name: string | null
  address: string | null
  city: string | null
  department: string | null
  phone: string | null
  email: string | null
  fiscal_regime: string
  logo_url: string | null
  dian_resolution: string | null
  is_active: boolean
  subscription_period: SubscriptionPeriod
  subscription_start: string        // DATE → string ISO
  subscription_end: string | null   // DATE → string ISO
  subscription_status: SubscriptionStatus
  created_at: string
}

export interface SACompanyModule {
  company_id: string
  module_id: string
  is_enabled: boolean
  updated_at: string
  updated_by: string | null
}

export interface SACompanyUser {
  user_id: string
  company_id: string
  role: string
  created_at: string
}

export interface SACompanyWithCounts extends SACompany {
  user_count: number
  enabled_modules_count: number
}
