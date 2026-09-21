'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react'

type SubscriptionData = {
  company_id: string
  company_name: string
  subscription_status: string
  subscription_period: string
  subscription_start: string
  subscription_end: string
  is_active: boolean
}

type PaymentOrder = {
  id: string
  amount: number
  subscription_period: string
  payment_status: string
  completed_at: string | null
  created_at: string
}

const STATUS_COLORS = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  expired: 'bg-red-500/10 text-red-400 border-red-500/20',
  suspended: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

const STATUS_LABELS = {
  active: 'Activa',
  pending: 'Pendiente',
  expired: 'Vencida',
  suspended: 'Suspendida',
}

const PERIOD_LABELS = {
  '3_months': '3 meses',
  '6_months': '6 meses',
  '1_year': '1 año',
}

export default function SubscriptionPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [payments, setPayments] = useState<PaymentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [testCheckoutLoading, setTestCheckoutLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'3_months' | '6_months' | '1_year'>('1_year')

  // Edición manual de fechas (inicio + días de prueba/gracia)
  const [editingDates, setEditingDates] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [trialDaysInput, setTrialDaysInput] = useState(15)
  const [savingDates, setSavingDates] = useState(false)
  const [datesError, setDatesError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [companyId])

  async function fetchData() {
    try {
      setLoading(true)
      // Obtener datos de suscripción
      const subRes = await fetch(`/api/superadmin/companies/${companyId}`)
      const subData = await subRes.json()
      setSubscription(subData)

      // Obtener historial de pagos
      const payRes = await fetch(`/api/superadmin/companies/${companyId}/payments`)
      if (payRes.ok) {
        const payData = await payRes.json()
        setPayments(payData)
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcula la fecha de vencimiento a partir de inicio + días
  function computeEnd(startISO: string, days: number): string {
    const d = new Date(startISO + 'T00:00:00')
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  function openDatesEditor() {
    if (!subscription) return
    const start = subscription.subscription_start
      ? new Date(subscription.subscription_start).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    // Días actuales entre inicio y vencimiento (para precargar)
    let days = 15
    if (subscription.subscription_start && subscription.subscription_end) {
      const diff = Math.round(
        (new Date(subscription.subscription_end).getTime() -
          new Date(subscription.subscription_start).getTime()) / 86_400_000
      )
      if (diff > 0) days = diff
    }
    setStartInput(start)
    setTrialDaysInput(days)
    setDatesError(null)
    setEditingDates(true)
  }

  async function handleSaveDates() {
    if (!startInput) { setDatesError('La fecha de inicio es requerida'); return }
    if (!Number.isFinite(trialDaysInput) || trialDaysInput < 1) {
      setDatesError('Los días deben ser un número mayor a 0'); return
    }
    try {
      setSavingDates(true)
      setDatesError(null)
      const res = await fetch(`/api/superadmin/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_start: startInput,
          subscription_end: computeEnd(startInput, trialDaysInput),
          subscription_status: 'active',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudieron guardar las fechas')
      }
      setEditingDates(false)
      await fetchData()
    } catch (e) {
      setDatesError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSavingDates(false)
    }
  }

  async function handleCheckout() {
    try {
      setCheckoutLoading(true)
      const res = await fetch(
        `/api/superadmin/companies/${companyId}/payment/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription_period: selectedPeriod }),
        }
      )

      const data = await res.json()
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl
      } else {
        console.error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Cargo de prueba muy pequeno ($3.000 COP) para validar Bold de punta a
  // punta sin afectar el plan ni la fecha de vencimiento de la empresa.
  async function handleTestCheckout() {
    try {
      setTestCheckoutLoading(true)
      const res = await fetch(
        `/api/superadmin/companies/${companyId}/payment/test-checkout`,
        { method: 'POST' }
      )

      const data = await res.json()
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl
      } else {
        console.error('Failed to create test checkout session:', data.error)
      }
    } catch (error) {
      console.error('Test checkout error:', error)
    } finally {
      setTestCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!subscription) {
    return <div className="text-red-400">Error loading subscription data</div>
  }

  const daysUntilExpiry = subscription.subscription_end
    ? Math.ceil(
        (new Date(subscription.subscription_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{subscription.company_name}</h1>
        <p className="mt-1 text-sm text-zinc-400">Gestión de suscripción</p>
      </div>

      {/* Pago de prueba -- solo para validar la pasarela (Bold), no afecta el plan */}
      <div className="rounded-2xl border border-amber-800/40 bg-amber-900/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Pago de prueba (integración)</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Cobro real muy pequeño ($3.000 COP) para confirmar que Bold y el webhook funcionan de punta a punta.
          No cambia el plan ni la fecha de vencimiento de esta empresa.
        </p>
        <button
          onClick={handleTestCheckout}
          disabled={testCheckoutLoading}
          className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          {testCheckoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {testCheckoutLoading ? 'Procesando...' : 'Pagar $3.000 COP de prueba'}
        </button>
      </div>

      {/* Estado actual */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Estado Actual</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">ESTADO</p>
            <div
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
                STATUS_COLORS[subscription.subscription_status as keyof typeof STATUS_COLORS]
              }`}
            >
              {subscription.subscription_status === 'active' && (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {subscription.subscription_status === 'expired' && (
                <AlertTriangle className="h-4 w-4" />
              )}
              {STATUS_LABELS[subscription.subscription_status as keyof typeof STATUS_LABELS]}
            </div>
          </div>

          {/* Período */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">PERÍODO</p>
            <p className="text-sm font-medium text-zinc-200">
              {PERIOD_LABELS[subscription.subscription_period as keyof typeof PERIOD_LABELS]}
            </p>
          </div>

          {/* Inicio */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">FECHA INICIO</p>
            <p className="text-sm text-zinc-300">
              {new Date(subscription.subscription_start).toLocaleDateString('es-CO')}
            </p>
          </div>

          {/* Vencimiento */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">FECHA VENCIMIENTO</p>
            <div>
              <p className="text-sm text-zinc-300">
                {new Date(subscription.subscription_end).toLocaleDateString('es-CO')}
              </p>
              {daysUntilExpiry !== null && (
                <p
                  className={`text-xs mt-1 ${
                    daysUntilExpiry > 7
                      ? 'text-zinc-500'
                      : daysUntilExpiry > 0
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {daysUntilExpiry > 0
                    ? `Vence en ${daysUntilExpiry} día${daysUntilExpiry !== 1 ? 's' : ''}`
                    : 'Vencida'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ajustar fechas manualmente */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Ajustar fechas</h2>
            <p className="mt-0.5 text-sm text-zinc-400">
              Define el inicio y los días gratis (prueba/cortesía). El vencimiento se calcula solo.
            </p>
          </div>
          {!editingDates && (
            <button
              onClick={openDatesEditor}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              Editar fechas
            </button>
          )}
        </div>

        {editingDates && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">FECHA DE INICIO</label>
                <input
                  type="date"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">DÍAS GRATIS (PRUEBA)</label>
                <input
                  type="number"
                  min={1}
                  value={trialDaysInput}
                  onChange={(e) => setTrialDaysInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {startInput && trialDaysInput >= 1 && (
              <p className="text-xs text-zinc-400">
                Vencimiento resultante:{' '}
                <span className="text-zinc-200 font-medium">
                  {new Date(computeEnd(startInput, trialDaysInput) + 'T00:00:00').toLocaleDateString('es-CO')}
                </span>
              </p>
            )}

            {datesError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{datesError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveDates}
                disabled={savingDates}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {savingDates && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingDates ? 'Guardando...' : 'Guardar fechas'}
              </button>
              <button
                onClick={() => { setEditingDates(false); setDatesError(null) }}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Renovar suscripción */}
      {subscription.subscription_status === 'expired' ||
      (daysUntilExpiry !== null && daysUntilExpiry <= 7) ? (
        <div className="rounded-2xl border border-amber-800 bg-amber-900/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Renovar Suscripción
          </h2>

          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Selecciona el período de suscripción y realiza el pago
            </p>

            {/* Opciones de período */}
            <div className="grid grid-cols-3 gap-2">
              {(['3_months', '6_months', '1_year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedPeriod === period
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium text-sm">
                    {PERIOD_LABELS[period]}
                  </div>
                </button>
              ))}
            </div>

            {/* Botón de pago */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {checkoutLoading ? 'Procesando...' : 'Proceder al Pago'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Historial de pagos */}
      {payments.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Historial de Pagos</h2>

          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    ${payment.amount.toLocaleString('es-CO')} COP
                  </p>
                  <p className="text-xs text-zinc-500">
                    {PERIOD_LABELS[payment.subscription_period as keyof typeof PERIOD_LABELS]}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-medium ${
                      payment.payment_status === 'completed'
                        ? 'text-emerald-400'
                        : payment.payment_status === 'failed'
                          ? 'text-red-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {payment.payment_status === 'completed'
                      ? 'Completado'
                      : payment.payment_status === 'failed'
                        ? 'Fallido'
                        : 'Pendiente'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(payment.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
