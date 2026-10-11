'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, CheckCircle2 } from 'lucide-react'

type PlanPriceRow = {
  plan_id: string
  name: string
  price_3_months: number
  price_6_months: number
  price_1_year: number
}

type InvoicePack = { quantity: number; price: number }

export default function SubscriptionPlansSettingsPage() {
  const [plans, setPlans] = useState<PlanPriceRow[]>([])
  const [invoicePack, setInvoicePack] = useState<InvoicePack>({ quantity: 20, price: 300_000 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchPricing()
  }, [])

  async function fetchPricing() {
    try {
      setLoading(true)
      const res = await fetch('/api/superadmin/subscription/pricing')
      if (!res.ok) throw new Error('No se pudieron cargar los precios')
      const data = await res.json()
      setPlans(data.plans ?? [])
      setInvoicePack(data.invoicePack ?? { quantity: 20, price: 300_000 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  function updatePlanPrice(planId: string, field: keyof Omit<PlanPriceRow, 'plan_id' | 'name'>, value: string) {
    const num = value === '' ? 0 : Number(value)
    setPlans((prev) => prev.map((p) => (p.plan_id === planId ? { ...p, [field]: num } : p)))
    setSaved(false)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      const res = await fetch('/api/superadmin/subscription/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans, invoicePack }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudieron guardar los precios')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkVisibility(field: 'show_plan_pricing' | 'show_invoice_pack_pricing', value: boolean, label: string) {
    const confirmed = window.confirm(
      `¿${value ? 'Activar' : 'Desactivar'} "${label}" para TODAS las empresas? Esto sobreescribe lo que tengas configurado individualmente por empresa.`
    )
    if (!confirmed) return

    try {
      setBulkSaving(field)
      const res = await fetch('/api/superadmin/subscription/pricing/visibility-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo aplicar el cambio')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aplicar el cambio')
    } finally {
      setBulkSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Planes de suscripción</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Precios de los planes y del paquete de facturas DIAN, y visibilidad del autopago para tus clientes.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Precios de planes */}
      <div className="rounded-2xl glass-surface p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Precios de los planes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-muted-foreground border-b border-[var(--glass-border)]">
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 px-3">3 meses</th>
                <th className="py-2 px-3">6 meses</th>
                <th className="py-2 pl-3">1 año</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.plan_id} className="border-b border-[var(--glass-border)] last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{plan.name}</td>
                  {(['price_3_months', 'price_6_months', 'price_1_year'] as const).map((field, i) => (
                    <td key={field} className={i === 0 ? 'py-2 px-3' : i === 2 ? 'py-2 pl-3' : 'py-2 px-3'}>
                      <input
                        type="number"
                        min={0}
                        value={plan[field]}
                        onChange={(e) => updatePlanPrice(plan.plan_id, field, e.target.value)}
                        className="w-32 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2 border-t border-[var(--glass-border)]">
          <p className="text-xs font-medium text-muted-foreground mb-2">PAQUETE DE FACTURAS DIAN</p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cantidad de facturas</label>
              <input
                type="number"
                min={1}
                value={invoicePack.quantity}
                onChange={(e) => { setInvoicePack((p) => ({ ...p, quantity: Number(e.target.value) || 0 })); setSaved(false) }}
                className="w-28 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Precio (COP)</label>
              <input
                type="number"
                min={0}
                value={invoicePack.price}
                onChange={(e) => { setInvoicePack((p) => ({ ...p, price: Number(e.target.value) || 0 })); setSaved(false) }}
                className="w-36 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar precios'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Guardado
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          El cambio aplica de inmediato: lo que cobra el checkout y lo que ve el cliente (en las empresas que tengan el autopago encendido) se actualiza al instante, sin necesidad de desplegar nada.
        </p>
      </div>

      {/* Visibilidad para todas las empresas */}
      <div className="rounded-2xl glass-surface p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Autopago: aplicar a todas las empresas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Por defecto el autopago está apagado para cada empresa (tú activas el plan y cobras manualmente). Usa esto cuando ya hayas unificado precios y quieras prender (o apagar) el autopago para todo el mundo de una sola vez, en vez de empresa por empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-foreground w-56">Precios y autopago de planes</span>
          <button
            onClick={() => handleBulkVisibility('show_plan_pricing', true, 'Precios y autopago de planes')}
            disabled={bulkSaving === 'show_plan_pricing'}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            Activar para todas
          </button>
          <button
            onClick={() => handleBulkVisibility('show_plan_pricing', false, 'Precios y autopago de planes')}
            disabled={bulkSaving === 'show_plan_pricing'}
            className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-[var(--glass-hover)] disabled:opacity-50 transition-colors"
          >
            Desactivar para todas
          </button>
          {bulkSaving === 'show_plan_pricing' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-foreground w-56">Paquete de facturas DIAN</span>
          <button
            onClick={() => handleBulkVisibility('show_invoice_pack_pricing', true, 'Paquete de facturas DIAN')}
            disabled={bulkSaving === 'show_invoice_pack_pricing'}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            Activar para todas
          </button>
          <button
            onClick={() => handleBulkVisibility('show_invoice_pack_pricing', false, 'Paquete de facturas DIAN')}
            disabled={bulkSaving === 'show_invoice_pack_pricing'}
            className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-[var(--glass-hover)] disabled:opacity-50 transition-colors"
          >
            Desactivar para todas
          </button>
          {bulkSaving === 'show_invoice_pack_pricing' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <p className="text-xs text-muted-foreground">
          Para una empresa puntual, el interruptor individual está en el panel de esa empresa, pestaña Suscripción.
        </p>
      </div>
    </div>
  )
}
