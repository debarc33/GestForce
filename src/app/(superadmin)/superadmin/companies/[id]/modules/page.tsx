'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Lock, Loader2, Save, CheckCircle } from 'lucide-react'
import { MODULE_REGISTRY } from '@/config/modules'

type ModuleState = {
  module_id: string
  name: string
  description: string
  is_enabled: boolean
}

export default function CompanyModulesPage() {
  const params = useParams()
  const companyId = params.id as string

  const [modules, setModules] = useState<ModuleState[]>([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [companyRes, modulesRes] = await Promise.all([
      fetch(`/api/superadmin/companies/${companyId}`),
      fetch(`/api/superadmin/companies/${companyId}/modules`),
    ])
    const company = await companyRes.json()
    const { toggleable } = await modulesRes.json()
    setCompanyName(company.name ?? '')
    setModules(toggleable ?? [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  function toggle(moduleId: string) {
    setModules((prev) =>
      prev.map((m) => m.module_id === moduleId ? { ...m, is_enabled: !m.is_enabled } : m)
    )
    setSaved(false)
  }

  function enableAll() {
    setModules((prev) => prev.map((m) => ({ ...m, is_enabled: true })))
    setSaved(false)
  }

  function disableAll() {
    setModules((prev) => prev.map((m) => ({ ...m, is_enabled: false })))
    setSaved(false)
  }

  async function saveChanges() {
    setSaving(true)
    await fetch(`/api/superadmin/companies/${companyId}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const enabledCount = modules.filter((m) => m.is_enabled).length
  // Módulos alwaysOn: dashboard y settings (siempre activos)
  const alwaysOnModules = MODULE_REGISTRY.filter((m) => m.alwaysOn)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/superadmin/companies" className="hover:text-white transition-colors">Empresas</Link>
        <span>/</span>
        <Link href={`/superadmin/companies/${companyId}`} className="hover:text-white transition-colors">
          {companyName || '...'}
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Módulos</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Módulos</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {loading ? '...' : `${enabledCount} de ${modules.length} módulos habilitados`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={disableAll}
            disabled={loading}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Deshabilitar todos
          </button>
          <button
            onClick={enableAll}
            disabled={loading}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Habilitar todos
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || loading}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Módulos siempre activos */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-800/40 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Siempre activos — no se pueden desactivar
              </p>
            </div>
            <div className="divide-y divide-zinc-800">
              {alwaysOnModules.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800">
                      <m.icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-300">{m.name}</p>
                      <p className="text-xs text-zinc-500">{m.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                    <Lock className="h-3 w-3" />
                    Fijo
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Módulos configurables */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-800/40 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Módulos configurables
              </p>
            </div>
            <div className="divide-y divide-zinc-800">
              {modules.map((m) => {
                const def = MODULE_REGISTRY.find((r) => r.id === m.module_id)
                return (
                  <div
                    key={m.module_id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                        m.is_enabled ? 'bg-indigo-500/15' : 'bg-zinc-800'
                      }`}>
                        {def && (
                          <def.icon className={`h-4 w-4 ${m.is_enabled ? 'text-indigo-400' : 'text-zinc-500'}`} />
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold transition-colors ${m.is_enabled ? 'text-white' : 'text-zinc-400'}`}>
                          {m.name}
                        </p>
                        <p className="text-xs text-zinc-500">{m.description}</p>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <button
                      onClick={() => toggle(m.module_id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                        m.is_enabled ? 'bg-indigo-600' : 'bg-zinc-700'
                      }`}
                      role="switch"
                      aria-checked={m.is_enabled}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          m.is_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <p className="text-xs text-zinc-600 text-center">
        Los cambios se aplican inmediatamente al guardar. Los usuarios de la empresa verán el sidebar actualizado en su próxima carga de página.
      </p>
    </div>
  )
}
