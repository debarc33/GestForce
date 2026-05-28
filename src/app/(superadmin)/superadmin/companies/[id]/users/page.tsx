'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Users, Trash2, Loader2, Shield } from 'lucide-react'

type Member = {
  user_id: string
  email: string
  role: string
  created_at: string
}

const ROLES = [
  { value: 'admin',     label: 'Administrador' },
  { value: 'contador',  label: 'Contador' },
  { value: 'vendedor',  label: 'Vendedor' },
  { value: 'readonly',  label: 'Solo lectura' },
]

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-indigo-500/15 text-indigo-400',
  contador: 'bg-amber-500/15 text-amber-400',
  vendedor: 'bg-emerald-500/15 text-emerald-400',
  readonly: 'bg-zinc-500/15 text-zinc-400',
}

export default function CompanyUsersPage() {
  const params = useParams()
  const companyId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [companyRes, usersRes] = await Promise.all([
      fetch(`/api/superadmin/companies/${companyId}`),
      fetch(`/api/superadmin/companies/${companyId}/users`),
    ])
    const company = await companyRes.json()
    const users = await usersRes.json()
    setCompanyName(company.name ?? '')
    setMembers(users ?? [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  async function changeRole(userId: string, newRole: string) {
    setChangingRoleId(userId)
    await fetch(`/api/superadmin/companies/${companyId}/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    })
    setChangingRoleId(null)
    fetchData()
  }

  async function removeUser(userId: string, email: string) {
    if (!confirm(`¿Seguro que quieres eliminar a ${email} de esta empresa?`)) return
    setDeletingId(userId)
    await fetch(`/api/superadmin/companies/${companyId}/users`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setDeletingId(null)
    fetchData()
  }

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
        <span className="text-zinc-300">Usuarios</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {loading ? '...' : `${members.length} usuario${members.length !== 1 ? 's' : ''} en esta empresa`}
        </p>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-8 w-8 text-zinc-700" />
            <p className="mt-2 text-sm text-zinc-500">No hay usuarios en esta empresa.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {/* Cabecera */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <span className="col-span-5">Usuario</span>
              <span className="col-span-4">Rol</span>
              <span className="col-span-2">Miembro desde</span>
              <span className="col-span-1"></span>
            </div>

            {members.map((member) => (
              <div key={member.user_id} className="grid grid-cols-12 items-center gap-4 px-6 py-4 hover:bg-zinc-800/40 transition-colors">
                {/* Usuario */}
                <div className="col-span-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[12px] font-bold text-zinc-300">
                    {member.email[0]?.toUpperCase() ?? '?'}
                  </div>
                  <p className="truncate text-sm text-white">{member.email}</p>
                </div>

                {/* Rol */}
                <div className="col-span-4">
                  {changingRoleId === member.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) => changeRole(member.user_id, e.target.value)}
                      className={`rounded-lg border-0 bg-transparent px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${ROLE_COLORS[member.role] ?? 'text-zinc-400'}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value} className="bg-zinc-800 text-white">
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Fecha */}
                <div className="col-span-2">
                  <p className="text-xs text-zinc-500">
                    {new Date(member.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>

                {/* Eliminar */}
                <div className="col-span-1 flex justify-end">
                  {deletingId === member.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  ) : (
                    <button
                      onClick={() => removeUser(member.user_id, member.email)}
                      className="rounded-lg p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Eliminar de la empresa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nota */}
      <div className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <Shield className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
        <p className="text-xs text-zinc-500">
          Eliminar un usuario de esta empresa solo lo remueve de la empresa, no elimina su cuenta de GestForce.
          Si el usuario pertenece a otras empresas, sigue teniendo acceso a ellas.
        </p>
      </div>
    </div>
  )
}
