import { createAdminClient } from '@/lib/supabase/admin'
import { Users, Building2 } from 'lucide-react'
import type { SACompany, SACompanyUser } from '@/types/superadmin'

async function getAllUsers() {
  const admin = createAdminClient()

  const [authUsersRes, { data: companyUsersRaw }, { data: companiesRaw }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('company_users').select('user_id, company_id, role'),
    admin.from('companies').select('id, name'),
  ])

  const companyUsers = (companyUsersRaw ?? []) as Pick<SACompanyUser, 'user_id' | 'company_id' | 'role'>[]
  const companies = (companiesRaw ?? []) as Pick<SACompany, 'id' | 'name'>[]
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))

  return (authUsersRes.data.users ?? []).map((u) => {
    const memberships = companyUsers.filter((cu) => cu.user_id === u.id)
    return {
      id: u.id,
      email: u.email ?? '—',
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at ?? null,
      is_superadmin: u.app_metadata?.is_superadmin === true,
      companies: memberships.map((m) => ({
        id: m.company_id,
        name: companyMap.get(m.company_id) ?? m.company_id,
        role: m.role,
      })),
    }
  })
}

export default async function UsersPage() {
  const users = await getAllUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios del sistema</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {users.length} cuenta{users.length !== 1 ? 's' : ''} registrada{users.length !== 1 ? 's' : ''} en total
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-zinc-800 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <span className="col-span-4">Email</span>
          <span className="col-span-4">Empresas</span>
          <span className="col-span-2">Registro</span>
          <span className="col-span-2">Último acceso</span>
        </div>

        <div className="divide-y divide-zinc-800">
          {users.map((u) => (
            <div key={u.id} className="grid grid-cols-12 items-start gap-4 px-6 py-4 hover:bg-zinc-800/30 transition-colors">
              <div className="col-span-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[12px] font-bold text-zinc-300">
                  {u.email[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm text-white">{u.email}</p>
                  {u.is_superadmin && (
                    <span className="text-[10px] font-semibold text-indigo-400">SUPERADMIN</span>
                  )}
                </div>
              </div>

              <div className="col-span-4">
                {u.companies.length === 0 ? (
                  <span className="text-xs text-zinc-600">Sin empresa</span>
                ) : (
                  <div className="flex flex-col gap-1">
                    {u.companies.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 shrink-0 text-zinc-600" />
                        <span className="truncate text-xs text-zinc-300">{c.name}</span>
                        <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-500">
                          {c.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <p className="text-xs text-zinc-500">
                  {new Date(u.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-xs text-zinc-500">
                  {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('es-CO') : 'Nunca'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {users.length === 0 && (
        <div className="py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-2 text-sm text-zinc-500">No hay usuarios registrados.</p>
        </div>
      )}
    </div>
  )
}
