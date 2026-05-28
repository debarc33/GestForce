import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Building2, Users, LayoutGrid, TrendingUp, ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import type { SACompany } from '@/types/superadmin'

async function getDashboardStats() {
  const admin = createAdminClient()

  const [
    { count: totalCompanies },
    { count: activeCompanies },
    { count: totalUsers },
    { count: totalModuleRows },
    { data: recentCompaniesRaw },
  ] = await Promise.all([
    admin.from('companies').select('*', { count: 'exact', head: true }),
    admin.from('companies').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('company_users').select('*', { count: 'exact', head: true }),
    admin.from('company_modules').select('*', { count: 'exact', head: true }).eq('is_enabled', true),
    admin.from('companies').select('id, name, nit, is_active, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  return {
    totalCompanies: totalCompanies ?? 0,
    activeCompanies: activeCompanies ?? 0,
    totalUsers: totalUsers ?? 0,
    totalModuleRows: totalModuleRows ?? 0,
    recentCompanies: (recentCompaniesRaw ?? []) as Pick<SACompany, 'id' | 'name' | 'nit' | 'is_active' | 'created_at'>[],
  }
}

export default async function SuperadminDashboard() {
  const stats = await getDashboardStats()

  const kpis = [
    {
      label: 'Empresas registradas',
      value: stats.totalCompanies,
      sub: `${stats.activeCompanies} activas`,
      icon: Building2,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
    {
      label: 'Usuarios totales',
      value: stats.totalUsers,
      sub: 'en todas las empresas',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Módulos activados',
      value: stats.totalModuleRows,
      sub: 'filas en company_modules',
      icon: LayoutGrid,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Empresas inactivas',
      value: stats.totalCompanies - stats.activeCompanies,
      sub: 'desactivadas',
      icon: TrendingUp,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Visión global de todas las empresas en el sistema.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg}`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-300">{kpi.label}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Empresas recientes */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-sm font-semibold text-white">Empresas recientes</h2>
          <Link
            href="/superadmin/companies"
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-800">
          {stats.recentCompanies.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zinc-500">
              No hay empresas registradas aún.
            </p>
          ) : (
            stats.recentCompanies.map((c) => (
              <Link
                key={c.id}
                href={`/superadmin/companies/${c.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-[11px] font-bold text-zinc-300">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-zinc-500">{c.nit ?? 'Sin NIT'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.is_active ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5" /> Activa
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> Inactiva
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
