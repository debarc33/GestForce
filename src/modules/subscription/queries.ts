'use client'

import { useQuery } from '@tanstack/react-query'
import type { SubscriptionPeriod } from './constants'

export type CompanyPaymentOrder = {
  id: string
  amount: number
  currency: string
  subscription_period: SubscriptionPeriod
  plan_id: string | null
  billing_start_date: string
  billing_end_date: string
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
  completed_at: string | null
  created_at: string
}

/** Historial de pagos de suscripción de la empresa (solo admins). */
export function useCompanyPayments(companyId?: string | null) {
  return useQuery<CompanyPaymentOrder[], Error>({
    queryKey: ['company_payments', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/company/subscription/payments?companyId=${companyId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const err = new Error(body?.error ?? 'Error al cargar el historial de pagos')
        ;(err as Error & { status?: number }).status = res.status
        throw err
      }
      return res.json()
    },
    enabled: !!companyId,
    retry: (failureCount, error) => {
      // No reintentar errores de permisos
      const status = (error as Error & { status?: number }).status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
  })
}

/** Inicia el checkout de renovación/cambio de plan. Retorna la URL de la pasarela. */
export async function startSubscriptionCheckout(
  companyId: string,
  period: SubscriptionPeriod,
  planId: string
): Promise<string> {
  const res = await fetch('/api/company/subscription/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, subscription_period: period, plan_id: planId }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error ?? 'Error al iniciar el pago')
  }
  if (!body?.sessionUrl) {
    throw new Error('El proveedor de pago no devolvió una URL de checkout')
  }
  return body.sessionUrl
}

/**
 * Inicia el checkout de la compra única del paquete de facturas
 * electrónicas DIAN (no es una suscripción). Retorna la URL de la pasarela.
 */
export async function startInvoicePackCheckout(companyId: string): Promise<string> {
  const res = await fetch('/api/company/subscription/invoice-pack/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error ?? 'Error al iniciar el pago')
  }
  if (!body?.sessionUrl) {
    throw new Error('El proveedor de pago no devolvió una URL de checkout')
  }
  return body.sessionUrl
}
