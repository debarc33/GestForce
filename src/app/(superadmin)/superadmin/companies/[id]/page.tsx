import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { LayoutGrid, Users, ArrowRight, Building2, CheckCircle, XCircle, Mail, Phone, MapPin } from 'lucide-react'
import type { SACompany, SACompanyUser, SACompanyModule } from '@/types/superadmin'

async function getCompany(id: string) {
  const admin = createAdminClient()

  const [
    { data: companyRaw },
    { data: usersRaw },
    { data: modulesRaw },
  ] = await Promise.all([
    admin.from('companies').select('*').eq('id', id).single(),
    admin.from('company_users').select('user_id, role').eq('company_id', id),
    admin.from('company_modules').select('module_id, is_enabled').eq('company_id', id),
  ])

  return {
    company: companyRaw as SACompany | null,
    users: (usersRaw ?? []) as Pick<SACompanyUser, 'user_id' | 'role'>[],
    modules: (modulesRaw ?? []) as Pick<SACompanyModule, 'module_id' | 'is_enabled'>[],
  }
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { company, users, modules } = await getCompany(id)

  if (!company) notFound()

  const enabledModules = modules.filter((m) => m.is_enabled).length
  const totalModulesConfigured = modules.length

  const infoRows = [
    { label: 'NIT', value: company.nit ?? '—' },
    { label: 'Razón social', value: company.legal_name ?? '—' },
    { label: 'Email', value: company.email ?? '—', icon: Mail },
    { label: 'Teléfono', value: company.phone ?? '—', icon: Phone },
    { label: 'Dirección', value: company.address ? `${company.address}, ${company.city ?? ''}` : '—', icon: MapPin },
    { label: 'Régimen fiscal', value: company.fiscal_regime },
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
              <p className="text-xs text-zinc-400">
                {totalModulesConfigured === 0
                  ? 'Todos activos (sin configurar)'
                  : `${enabledModules} habilitados de ${totalModulesConfigured} configurados`}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
        </Link>

        <Link
          href={`/superadmin/companies/${id}/users`}
          className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-indigo-500/40 hover:bg-zinc-800/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Usuarios</p>
              <p className="text-xs text-zinc-400">
                {users.length} usuario{users.length !== 1 ? 's' : ''} en esta empresa
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
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
    </div>
  )
}
