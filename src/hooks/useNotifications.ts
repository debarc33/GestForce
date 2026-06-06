'use client'

import { useMemo } from 'react'
import { useCartera }  from '@/modules/finances/queries'
import { useProducts } from '@/modules/products/queries'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NotificationItem = {
  id:       string
  type:     'cartera' | 'stock'
  title:    string
  detail:   string
  href:     string
  severity: 'high' | 'medium'   // high = >30d vencida / stock agotado
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(companyId?: string) {
  const { data: cartera  = [], isLoading: loadingC } = useCartera(companyId)
  const { data: products = [], isLoading: loadingP } = useProducts(companyId)

  const items = useMemo((): NotificationItem[] => {
    // ── Cartera vencida ────────────────────────────────────────────────────
    const carteraAlerts: NotificationItem[] = cartera
      .filter(r => r.dias_vencido > 0)
      .sort((a, b) => b.dias_vencido - a.dias_vencido)   // más vencidas primero
      .map(r => ({
        id:       `cartera-${r.id}`,
        type:     'cartera' as const,
        title:    `${r.invoice_number} — ${r.customer}`,
        detail:   `${r.dias_vencido}d vencida · Saldo ${fmtCOP(r.balance_due)}`,
        href:     '/sales?tab=cxc',
        severity: r.dias_vencido > 30 ? 'high' : 'medium',
      }))

    // ── Stock bajo ─────────────────────────────────────────────────────────
    const stockAlerts: NotificationItem[] = products
      .filter(p => {
        const min = (p as typeof p & { stock_minimum?: number }).stock_minimum ?? 0
        return min > 0 && p.stock <= min
      })
      .sort((a, b) => a.stock - b.stock)   // menor stock primero
      .map(p => {
        const min = (p as typeof p & { stock_minimum?: number }).stock_minimum ?? 0
        return {
          id:       `stock-${p.id}`,
          type:     'stock' as const,
          title:    p.name,
          detail:   `Stock actual: ${p.stock} ${p.unit ?? ''} · Mínimo: ${min}`,
          href:     '/inventario',
          severity: p.stock === 0 ? 'high' : 'medium',
        }
      })

    return [...carteraAlerts, ...stockAlerts]
  }, [cartera, products])

  const carteraItems = items.filter(i => i.type === 'cartera')
  const stockItems   = items.filter(i => i.type === 'stock')

  return {
    items,
    carteraItems,
    stockItems,
    count:     items.length,
    isLoading: loadingC || loadingP,
  }
}
