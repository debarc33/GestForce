'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Building2, Plus, Search, ArrowRight, Users, LayoutGrid,
  Loader2, X, Calendar, Clock, CheckCircle2, AlertCircle,
  XCircle, PauseCircle,
} from 'lucide-react'
import type { SACompanyWithCounts, SubscriptionStatus, SubscriptionPeriod } from '@/types/superadmin'
import { SUBSCRIPTION_PERIOD_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@/types/superadmin'

// ── Helpers de UI ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<SubscriptionStatus, { icon: React.ReactNode; className: string }> = {
    active:    { icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-emerald-500/10 text-emerald-400' },
    pending:   { icon: <AlertCircle  className="h-3 w-3" />, className: 'bg-amber-500/10  text-amber-400'   },
    expired:   { icon: <XCircle      className="h-3 w-3" />, className: 'bg-red-500/10    text-red-400'     },
    suspended: { icon: <PauseCircle  className="h-3 w-3" />, className: 'bg-zinc-500/10   text-zinc-400'    },
  }
  const { icon, className } = config[status] ?? config.pending
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {icon}
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </span>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntilExpiry(endDate: string | null): number | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [companies, setCompanies]   = useState<SACompanyWithCounts[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]         = useState(false)

  const [newCompany, setNewCompany] = useState({
    name:            '',
    nit:             '',
    legal_name:      '',
    email:           '',
    fiscal_regime:   'no_iva',
    subscription_period: '1_year' as SubscriptionPeriod,
  })

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/superadmin/companies')
    const data = await res.json()
    setCompanies(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  const filtered = companies.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.nit ?? '').includes(search)
    const matchesStatus = filterStatus === 'all' || c.subscription_status === filterStatus
    return matchesSearch && matchesStatus
  })

  async function updateStatus(company: SACompanyWithCounts, newStatus: SubscriptionStatus) {
    await fetch(`/api/superadmin/companies/${company.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription_status: newStatus }),
    })
    fetchCompanies()
  }

  async function createCompany() {
    if (!newCompany.name.trim()) return
    setSaving(true)
    await fetch('/api/superadmin/companies', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(newCompany),
    })
    setSaving(false)
    setShowCreate(false)
    setNewCompany({ name: '', nit: '', legal_name: '', email: '', fiscal_regime: 'no_iva', subscription_period: '1_year' })
    fetchCompanies()
  }

  // Contadores para el resumen rápido
  const counts = {
    all:       companies.length,
    active:    companies.filter(c => c.subscription_status === 'active').length,
    pending:   companies.filter(c => c.subscription_status === 'pending').length,
    expired:   companies.filter(c => c.subscription_status === 'expired').length,
    suspended: companies.filter(c => c.subscription_status === 'suspended').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva empresa
        </button>
      </div>

      {/* Filtros rápidos por estado */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all',       label: `Todas (${counts.all})` },
          { key: 'active',    label: `Activas (${counts.active})` },
          { key: 'pending',   label: `Pendiente pago (${counts.pending})` },
          { key: 'expired',   label: `Vencidas (${counts.expired})` },
          { key: 'suspended', label: `Suspendidas (${counts.suspended})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === key
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por nombre o NIT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-zinc-700" />
            <p className="mt-2 text-sm text-zinc-500">No se encontraron empresas.</p>
          </div>
        ) : (
          <>
            {/* Cabecera */}
            <div className="grid grid-cols-12 gap-3 border-b border-zinc-800 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <span className="col-span-3">Empresa</span>
              <span className="col-span-2 text-center">Inicio</span>
              <span className="col-span-2 text-center">Período</span>
              <span className="col-span-2 text-center">Vencimiento</span>
              <span className="col-span-2 text-center">Estado</span>
              <span className="col-span-1 text-right">Ver</span>
            </div>

            {/* Filas */}
            <div className="divide-y divide-zinc-800/70">
              {filtered.map((company) => {
                const days = daysUntilExpiry(company.subscription_end)
                const isExpiringSoon = days !== null && days > 0 && days <= 15

                return (
                  <div
                    key={company.id}
                    className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Empresa */}
                    <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-[11px] font-bold text-zinc-300">
                        {company.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{company.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500">{company.nit ?? 'Sin NIT'}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
                            <Users className="h-2.5 w-2.5" />{company.user_count}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
                            <LayoutGrid className="h-2.5 w-2.5" />
                            {company.enabled_modules_count === 0 ? 'Todos' : company.enabled_modules_count}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fecha inicio */}
                    <div className="col-span-2 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
                      <Calendar className="h-3 w-3 text-zinc-600 shrink-0" />
                      {formatDate(company.subscription_start)}
                    </div>

                    {/* Período */}
                    <div className="col-span-2 flex justify-center">
                      <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
                        {SUBSCRIPTION_PERIOD_LABELS[company.subscription_period]}
                      </span>
                    </div>

                    {/* Vencimiento */}
                    <div className="col-span-2 flex flex-col items-center">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Clock className={`h-3 w-3 shrink-0 ${isExpiringSoon ? 'text-amber-400' : 'text-zinc-600'}`} />
                        {formatDate(company.subscription_end)}
                      </div>
                      {isExpiringSoon && (
                        <span className="mt-0.5 text-[10px] font-medium text-amber-400">
                          Vence en {days} día{days !== 1 ? 's' : ''}
                        </span>
                      )}
                      {days !== null && days <= 0 && company.subscription_status !== 'expired' && (
                        <span className="mt-0.5 text-[10px] font-medium text-red-400">Vencida</span>
                      )}
                    </div>

                    {/* Estado con dropdown de cambio rápido */}
                    <div className="col-span-2 flex justify-center">
                      {/* Badge visual + select invisible superpuesto */}
                      <div className="relative inline-flex">
                        <StatusBadge status={company.subscription_status} />
                        <select
                          value={company.subscription_status}
                          onChange={(e) => updateStatus(company, e.target.value as SubscriptionStatus)}
                          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                          title="Cambiar estado"
                        >
                          <option value="active">Activa</option>
                          <option value="pending">Pendiente pago</option>
                          <option value="expired">Vencida</option>
                          <option value="suspended">Suspendida</option>
                        </select>
                      </div>
                    </div>

                    {/* Ver detalle */}
                    <div className="col-span-1 flex justify-end">
                      <Link
                        href={`/superadmin/companies/${company.id}`}
                        className="flex items-center justify-center rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-700 hover:text-indigo-400 transition-colors"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal crear empresa */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Nueva empresa</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Nombre *</label>
                <input
                  type="text"
                  placeholder="Ej: Mi Empresa S.A.S."
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* NIT */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">NIT</label>
                <input
                  type="text"
                  placeholder="Ej: 900123456-1"
                  value={newCompany.nit}
                  onChange={(e) => setNewCompany({ ...newCompany, nit: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
                <input
                  type="email"
                  placeholder="empresa@email.com"
                  value={newCompany.email}
                  onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Régimen fiscal */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Régimen fiscal</label>
                <select
                  value={newCompany.fiscal_regime}
                  onChange={(e) => setNewCompany({ ...newCompany, fiscal_regime: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="no_iva">No responsable de IVA</option>
                  <option value="iva">Responsable de IVA</option>
                  <option value="gran_contribuyente">Gran contribuyente</option>
                </select>
              </div>

              {/* Período de suscripción */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Período de suscripción *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['3_months', '6_months', '1_year'] as SubscriptionPeriod[]).map((period) => {
                    const selected = newCompany.subscription_period === period
                    // Calcular fecha de vencimiento estimada
                    const today = new Date()
                    const end = new Date(today)
                    if (period === '3_months') end.setMonth(end.getMonth() + 3)
                    else if (period === '6_months') end.setMonth(end.getMonth() + 6)
                    else end.setFullYear(end.getFullYear() + 1)
                    const endStr = end.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setNewCompany({ ...newCompany, subscription_period: period })}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                          selected
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        <span className="text-sm font-bold">{SUBSCRIPTION_PERIOD_LABELS[period]}</span>
                        <span className="text-[10px] opacity-70">Vence: {endStr}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  La fecha de inicio es hoy y el estado inicial será <strong className="text-zinc-500">Pendiente pago</strong> hasta confirmar el cobro.
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createCompany}
                disabled={saving || !newCompany.name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Crear empresa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
