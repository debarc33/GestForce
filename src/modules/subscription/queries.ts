'use client'

import { useQuery } from '@tanstack/react-query'
import type { SubscriptionPeriod } from './constants'

export type LivePlan = {
  id: string
  name: string
  description: string
  prices: Record<SubscriptionPeriod, number>
}

export type LiveInvoicePack = { quantity: number; price: number }

/** Precios vigentes (editados desde Superadmin) de los planes y del
 *  paquete de facturas DIAN -- usar siempre esto para mostrar precios al
 *  cliente, nunca los valores estáticos de modules/subscription/plans.ts
 *  directamente. */
export function usePlanPricing(companyId?: string | null) {
  return useQuery<{ plans: LivePlan[]; invoicePack: LiveInvoicePack }, Error>({
    queryKey: ['subscription_pricing', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/company/subscription/pricing?companyId=${companyId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Error al cargar los precios')
      }
      return res.json()
    },
    enabled: !!companyId,
  })
}

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

// ─── Nueva oferta de Facturación Electrónica (Fase H, Fase 2 -- 9 nov 2026) ─
// Catálogo de 8 ítems separables (servicios de gestión, paquetes de
// facturas, planes ilimitados) -- ver claude/plan-accion-facturacion-dian.md.
// Independiente del paquete viejo de $300.000 (usePlanPricing /
// startInvoicePackCheckout arriba), que sigue intacto.

export type FeCatalogItem = {
  item_id: string
  category: 'servicio_gestion' | 'paquete_facturas' | 'plan_ilimitado'
  label: string
  description: string | null
  billing_type: 'unico' | 'anual' | 'mensual'
  price: number
  quantity: number | null
  /** 9 nov 2026 (migración 039): si false, el ítem es solo informativo
   *  (se ve el precio pero sin botón de pago -- venta presencial). */
  self_checkout: boolean
}

/** Datos de contacto (migración 040) para el botón "Contáctanos" de los
 *  ítems sin pago en línea. Editables desde Superadmin. */
export type FeContactInfo = {
  phone_1: string | null
  phone_2: string | null
  email: string | null
}

/** Ítems activos del catálogo nuevo de Facturación Electrónica, más los
 *  datos de contacto, para mostrar en la pantalla de Suscripción del
 *  cliente. */
export function useFeServicesCatalog(companyId?: string | null) {
  return useQuery<{ items: FeCatalogItem[]; contact: FeContactInfo | null }, Error>({
    queryKey: ['fe_services_catalog', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/company/subscription/fe-services?companyId=${companyId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Error al cargar el catálogo')
      }
      return res.json()
    },
    enabled: !!companyId,
  })
}

/** Inicia el checkout de compra de un ítem puntual del catálogo nuevo
 *  (identificado por itemId). Retorna la URL de la pasarela. */
export async function startFeServiceCheckout(companyId: string, itemId: string): Promise<string> {
  const res = await fetch('/api/company/subscription/fe-services/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, itemId }),
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
