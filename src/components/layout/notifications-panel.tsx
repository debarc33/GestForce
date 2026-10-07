'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, PackageX, CircleDollarSign } from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useProducts } from '@/modules/products/queries'
import { useCartera } from '@/modules/finances/queries'

/**
 * GestForce — Notificaciones (campanita del Header)
 *
 * Panel simple de alertas operativas, sin backend nuevo: reutiliza los
 * mismos hooks que ya usan Productos (stock_minimum) y Cartera/CxC
 * (dias_vencido) en el resto de la app.
 *
 * Que avisa hoy:
 * - Inventario: productos agotados o por debajo de su stock minimo.
 * - Cuentas por cobrar: facturas de venta vencidas (saldo pendiente).
 *
 * No es un sistema de notificaciones persistente (no hay tabla en BD, no
 * se "marcan como leidas") — es una vista en vivo de alertas, recalculada
 * cada vez que se abre. Si mas adelante se necesita algo mas (historial,
 * marcar como leida, mas tipos de alerta), esto es la base para extenderlo.
 */

const fmtMoneyCOP = (n: number) =>
  '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

export function NotificationsPanel() {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: products = [] } = useProducts(activeCompanyId ?? undefined)
  const { data: cartera = [] } = useCartera(activeCompanyId ?? undefined)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const lowStock = useMemo(() => {
    type P = { id: string; name: string; stock: number; stock_minimum?: number }
    return (products as P[])
      .filter((p) => {
        const min = p.stock_minimum ?? 0
        return p.stock === 0 || (min > 0 && p.stock <= min)
      })
      .slice(0, 5)
  }, [products])

  const overdue = useMemo(
    () => cartera.filter((r) => r.dias_vencido > 0).slice(0, 5),
    [cartera]
  )

  const total = lowStock.length + overdue.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notificaciones"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--ring)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl glass-surface-strong z-50 overflow-hidden animate-[slideUp_220ms_ease]">
          <div className="px-3.5 py-3 border-b border-[var(--glass-border)]">
            <p className="text-[12px] font-semibold text-foreground">Notificaciones</p>
          </div>

          {total === 0 ? (
            <div className="px-3.5 py-6 text-center text-[12px] text-muted-foreground">
              Sin notificaciones por ahora.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto p-1">
              {lowStock.length > 0 && (
                <div className="mb-1">
                  <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.07em] uppercase text-muted-foreground/60">
                    Inventario
                  </div>
                  {lowStock.map((p) => (
                    <Link
                      key={p.id}
                      href="/products"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-[var(--glass)] transition-colors"
                    >
                      <PackageX className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="flex-1 min-w-0 truncate text-[12.5px] text-foreground">
                        {p.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {p.stock === 0 ? 'Agotado' : `${p.stock} und.`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {overdue.length > 0 && (
                <div>
                  <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.07em] uppercase text-muted-foreground/60">
                    Cuentas por cobrar
                  </div>
                  {overdue.map((r) => (
                    <Link
                      key={r.id}
                      href="/sales?tab=cxc"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-[var(--glass)] transition-colors"
                    >
                      <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="flex-1 min-w-0 truncate text-[12.5px] text-foreground">
                        {r.customer}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {r.dias_vencido}d · {fmtMoneyCOP(r.balance_due)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
