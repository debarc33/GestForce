'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CreditCard, AlertTriangle, AlertCircle, Check, ShieldCheck, Loader2 } from 'lucide-react'
import { useCompany } from '@/modules/company/queries'
import {
  PERIOD_LABELS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_PRICES,
  getPeriodPriceCOP, type SubscriptionPeriod, type SubscriptionStatus,
} from '@/modules/subscription/constants'
import { useCompanyPayments, startSubscriptionCheckout } from '@/modules/subscription/queries'
import { formatCOP, formatDate } from '@/lib/format-cop'

const PERIODS = Object.keys(SUBSCRIPTION_PRICES) as SubscriptionPeriod[]

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  active:    'bg-green-500/10 border-green-500/20 text-green-700',
  pending:   'bg-amber-500/10 border-amber-500/20 text-amber-700',
  expired:   'bg-red-500/10 border-red-500/20 text-red-700',
  suspended: 'bg-[var(--glass)] border-[var(--glass-border)] text-muted-foreground',
}

const PAYMENT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Completado',  cls: 'bg-green-500/10 border-green-500/20 text-green-700' },
  pending:   { label: 'Pendiente',   cls: 'bg-amber-500/10 border-amber-500/20 text-amber-700' },
  failed:    { label: 'Fallido',     cls: 'bg-red-500/10 border-red-500/20 text-red-700' },
  refunded:  { label: 'Reembolsado', cls: 'bg-[var(--glass)] border-[var(--glass-border)] text-muted-foreground' },
}

export function SubscriptionSection({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient()
  const { data: company, isLoading: loadingCompany } = useCompany(companyId)
  const { data: payments = [], isLoading: loadingPayments, error: paymentsError } = useCompanyPayments(companyId)

  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [returnBanner, setReturnBanner] = useState<'success' | 'cancelled' | null>(null)

  // Banner al volver de la pasarela (?payment=success|cancelled).
  // La página padre limpia el parámetro de la URL después de leerlo.
  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment')
    if (payment === 'success' || payment === 'cancelled') {
      setReturnBanner(payment)
      queryClient.invalidateQueries({ queryKey: ['company', companyId] })
      queryClient.invalidateQueries({ queryKey: ['company_payments', companyId] })
    }
  }, [companyId, queryClient])

  const status = (company?.subscription_status ?? null) as SubscriptionStatus | null
  const period = company?.subscription_period ?? null
  const daysLeft = company?.subscription_end
    ? Math.ceil((new Date(company.subscription_end + 'T12:00:00').getTime() - Date.now()) / 86_400_000)
    : null

  const activePeriod = selectedPeriod ?? period ?? '1_year'

  async function handlePay() {
    setPaying(true)
    setPayError(null)
    try {
      const url = await startSubscriptionCheckout(companyId, activePeriod)
      window.location.href = url
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al iniciar el pago')
      setPaying(false)
    }
  }

  const paymentsStatus = (paymentsError as (Error & { status?: number }) | null)?.status

  return (
    <div className="space-y-4">
      {/* Banner post-retorno de la pasarela */}
      {returnBanner === 'success' && (
        <div className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-700">
          <Check className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Pago recibido. Tu suscripción se activará en cuanto el proveedor confirme la transacción.</p>
        </div>
      )}
      {returnBanner === 'cancelled' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.</p>
        </div>
      )}

      {/* ── Plan actual ─────────────────────────────────────────────── */}
      {loadingCompany ? (
        <div className="h-28 animate-pulse rounded-xl bg-[var(--glass-hover)]" />
      ) : (
        <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Plan actual</h3>
              {status && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
                  {status === 'active' && <ShieldCheck className="h-3 w-3" />}
                  {SUBSCRIPTION_STATUS_LABELS[status]}
                </span>
              )}
            </div>
            {period && (
              <span className="text-sm font-medium text-foreground">{PERIOD_LABELS[period]}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-[var(--glass-border)]/50 pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Inicio</p>
              <p className="text-foreground">{formatDate(company?.subscription_start)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vence</p>
              <p className="text-foreground">{formatDate(company?.subscription_end)}</p>
            </div>
            {daysLeft != null && daysLeft > 0 && (
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {daysLeft} {daysLeft === 1 ? 'día restante' : 'días restantes'}
              </div>
            )}
          </div>

          {/* Alertas de vencimiento / estado */}
          {status === 'suspended' ? (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Tu suscripción está suspendida. Contacta a soporte de GestForce para reactivarla.</p>
            </div>
          ) : status === 'expired' || (daysLeft != null && daysLeft <= 0) ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Tu suscripción venció. Renueva ahora para seguir usando todos los módulos.</p>
            </div>
          ) : daysLeft != null && daysLeft <= 7 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Tu suscripción vence en {daysLeft} {daysLeft === 1 ? 'día' : 'días'}. Renueva para evitar interrupciones.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Renovar / cambiar plan ──────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Renovar o cambiar plan</h3>
        <div className="grid grid-cols-3 gap-3">
          {PERIODS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPeriod(p)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-center ${
                activePeriod === p
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-[var(--glass-border)] glass-surface text-muted-foreground hover:bg-[var(--glass)]'
              }`}
            >
              <span className="block">{PERIOD_LABELS[p]}</span>
              <span className="block text-xs mt-0.5 font-mono">{formatCOP(getPeriodPriceCOP(p))}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handlePay}
          disabled={paying}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {paying ? 'Redirigiendo...' : 'Proceder al pago'}
        </button>
        {payError && (
          <p className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{payError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Serás redirigido a la pasarela segura de pago. GestForce no almacena datos de tarjetas.
        </p>
      </div>

      {/* ── Historial de pagos ──────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Historial de pagos</h3>
        {loadingPayments ? (
          <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--glass-hover)]" />)}</div>
        ) : paymentsStatus === 401 || paymentsStatus === 403 ? (
          <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-5 text-center">
            <p className="text-sm text-muted-foreground">Solo los administradores de la empresa pueden ver el historial de pagos.</p>
          </div>
        ) : paymentsError ? (
          <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-5 text-center">
            <p className="text-sm text-muted-foreground">No se pudo cargar el historial de pagos.</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-5 text-center">
            <p className="text-sm text-muted-foreground">Aún no hay pagos registrados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(order => {
              const st = PAYMENT_STATUS_LABELS[order.payment_status] ?? PAYMENT_STATUS_LABELS.pending
              return (
                <div key={order.id} className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] glass-surface px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground font-mono">{formatCOP(order.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PERIOD_LABELS[order.subscription_period] ?? order.subscription_period} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
