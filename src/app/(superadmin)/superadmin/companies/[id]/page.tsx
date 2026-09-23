'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { LayoutGrid, Users, ArrowRight, Building2, CheckCircle, XCircle, Mail, Phone, MapPin, Edit2, X, Loader2 } from 'lucide-react'

type Company = {
  id: string
  name: string
  nit: string | null
  legal_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  fiscal_regime: string
  is_active: boolean
  subscription_status: string
  created_at: string
}

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editData, setEditData] = useState<Partial<Company>>({})

  useEffect(() => {
    fetchCompany()
  }, [id])

  async function fetchCompany() {
    try {
      setLoading(true)
      const res = await fetch(`/api/superadmin/companies/${id}`)
      if (!res.ok) throw new Error('No encontrada')
      const data = await res.json()
      setCompany(data)
      setEditData(data)

      // Fetch user count
      const usersRes = await fetch(`/api/superadmin/companies/${id}/users`)
      if (usersRes.ok) {
        const users = await usersRes.json()
        setUserCount(users.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEdit() {
    if (!company) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          legal_name: editData.legal_name,
          nit: editData.nit,
          email: editData.email,
          phone: editData.phone,
          address: editData.address,
          city: editData.city,
          department: editData.department,
          fiscal_regime: editData.fiscal_regime,
          subscription_status: editData.subscription_status,
        }),
      })
      if (!res.ok) throw new Error('Error saving')
      const updated = await res.json()
      setCompany(updated)
      setShowEditModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!company) {
    return <div className="text-red-400">Empresa no encontrada</div>
  }

  const infoRows = [
    { label: 'NIT', value: company.nit ?? '—' },
    { label: 'Razón social', value: company.legal_name ?? '—' },
    { label: 'Email', value: company.email ?? '—' },
    { label: 'Teléfono', value: company.phone ?? '—' },
    { label: 'Dirección', value: company.address ? `${company.address}${company.city ? ', ' + company.city : ''}` : '—' },
    { label: 'Régimen fiscal', value: company.fiscal_regime },
    { label: 'Estado', value: company.subscription_status },
    { label: 'Registrada', value: new Date(company.created_at).toLocaleDateString('es-CO') },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/superadmin/companies" className="hover:text-white transition-colors">Empresas</Link>
        <span>/</span>
        <span className="text-zinc-300">{company.name}</span>
      </div>

      {/* Error */}
      {error && <div className="rounded-xl bg-red-900/20 border border-red-800 p-4 text-sm text-red-400">{error}</div>}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-xl font-bold text-zinc-300">
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{company.name}</h1>
              {company.is_active ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <CheckCircle className="h-3 w-3" /> Activa
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                  <XCircle className="h-3 w-3" /> Inactiva
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400">NIT: {company.nit ?? 'No registrado'}</p>
          </div>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Edit2 className="h-4 w-4" />
          Editar
        </button>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href={`/superadmin/companies/${id}/modules`}
          className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-indigo-500/40 hover:bg-zinc-800/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
              <LayoutGrid className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Módulos</p>
              <p className="text-xs text-zinc-400">Configurar módulos activos</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
        </Link>

        <Link
          href={`/superadmin/companies/${id}/users`}
          className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-emerald-500/40 hover:bg-zinc-800/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Usuarios</p>
              <p className="text-xs text-zinc-400">{userCount} usuario{userCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
        </Link>

        <Link
          href={`/superadmin/companies/${id}/subscription`}
          className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-purple-500/40 hover:bg-zinc-800/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10m4 0a1 1 0 11-2 0 1 1 0 012 0zM7 15a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Suscripción</p>
              <p className="text-xs text-zinc-400">{company.subscription_status}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-purple-400 transition-colors" />
        </Link>
      </div>

      {/* Info de la empresa */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-4">
          <Building2 className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-white">Información general</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-6 py-3">
              <span className="text-xs font-medium text-zinc-500">{row.label}</span>
              <span className="text-sm text-zinc-200">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Editar empresa</h2>
              <button onClick={() => setShowEditModal(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Nombre */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Nombre *</label>
                <input
                  type="text"
                  value={editData.name ?? ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Razón social */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Razón social</label>
                <input
                  type="text"
                  value={editData.legal_name ?? ''}
                  onChange={(e) => setEditData({ ...editData, legal_name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* NIT */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">NIT</label>
                <input
                  type="text"
                  value={editData.nit ?? ''}
                  onChange={(e) => setEditData({ ...editData, nit: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
                <input
                  type="email"
                  value={editData.email ?? ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Teléfono</label>
                <input
                  type="text"
                  value={editData.phone ?? ''}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Dirección</label>
                <input
                  type="text"
                  value={editData.address ?? ''}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Ciudad */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Ciudad</label>
                <input
                  type="text"
                  value={editData.city ?? ''}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Departamento */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Departamento</label>
                <input
                  type="text"
                  value={editData.department ?? ''}
                  onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Régimen fiscal */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Régimen fiscal</label>
                <select
                  value={editData.fiscal_regime ?? ''}
                  onChange={(e) => setEditData({ ...editData, fiscal_regime: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="no_iva">No responsable de IVA</option>
                  <option value="iva">Responsable de IVA</option>
                  <option value="gran_contribuyente">Gran contribuyente</option>
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Estado</label>
                <select
                  value={editData.subscription_status ?? ''}
                  onChange={(e) => setEditData({ ...editData, subscription_status: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="active">Activa</option>
                  <option value="pending">Pendiente pago</option>
                  <option value="expired">Vencida</option>
                  <option value="suspended">Suspendida</option>
                </select>
              </div>
            </div>

            {/* Acciones */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
