'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Loader, Plus, Pencil, Check, X } from 'lucide-react'
import { getCompanyUsers, updateUserRole, updateUserName, removeUserFromCompany, inviteUserToCompany, AVAILABLE_ROLES, type CompanyUser } from '../queries'

/**
 * Código consecutivo por empresa (COL-01, COL-02...), calculado por orden
 * de ingreso (created_at ascendente) -- no se guarda en la base de datos,
 * se deriva en el cliente a partir de la misma lista que ya se consulta.
 */
function useCollaboratorCodes(users: CompanyUser[]) {
  return useMemo(() => {
    const sorted = [...users].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const map = new Map<string, string>()
    sorted.forEach((u, i) => map.set(u.user_id, `COL-${String(i + 1).padStart(2, '0')}`))
    return map
  }, [users])
}

interface UsersTableProps {
  companyId: string
}

export function UsersTable({ companyId }: UsersTableProps) {
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({})
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('vendedor')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  // Error al cambiar un rol o eliminar un usuario (ver nota en updateRoleMutation
  // mas abajo: antes estos fallos eran completamente silenciosos).
  const [teamActionError, setTeamActionError] = useState<string | null>(null)
  // Edición en línea del nombre (para colaboradores invitados antes de que
  // el formulario empezara a pedir nombre, o para corregir un error).
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')

  // Cargar usuarios
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['company_users', companyId],
    queryFn: () => getCompanyUsers(companyId),
  })

  const codeByUserId = useCollaboratorCodes(users)

  // Mutation: cambiar rol
  //
  // BUG ENCONTRADO (16 oct 2026): esta mutacion nunca tuvo onError. El
  // UPDATE real fallaba en silencio (ver nota en updateUserRole, en
  // queries.ts, para la causa raiz y el fix), pero como aqui no habia
  // forma de enterarse, el selector de rol mostraba el cambio como si
  // hubiera funcionado (estado local optimista en selectedRole) hasta
  // que la usuaria recargaba la pagina y el rol volvia a su valor real,
  // sin ningun aviso de por medio. Ahora, ademas del fix de fondo
  // (el UPDATE ya se guarda), se agrega onError para que CUALQUIER
  // fallo futuro en este flujo (de la causa que sea) se muestre en
  // pantalla en vez de desaparecer -- mismo criterio ya aplicado en
  // Nomina el 15 oct (commit 5a4ef26).
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string; rowKey: string }) =>
      updateUserRole(companyId, userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
      setSelectedRole({})
      setTeamActionError(null)
    },
    onError: (error, variables) => {
      setTeamActionError(error instanceof Error ? error.message : 'Error al cambiar el rol del usuario')
      // Revertir el estado local optimista para esta fila: si se deja
      // el valor "nuevo" en selectedRole, el selector seguiria
      // mostrando un rol que en realidad nunca se guardo.
      setSelectedRole(prev => {
        const next = { ...prev }
        delete next[variables.rowKey]
        return next
      })
    },
  })

  // Mutation: eliminar usuario
  // Mismo bug y mismo fix que updateRoleMutation arriba: sin onError,
  // un DELETE bloqueado (por ejemplo, por la regla de "no dejar la
  // empresa sin admin") fallaba sin que la usuaria se enterara.
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => removeUserFromCompany(companyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
      setTeamActionError(null)
    },
    onError: (error) => {
      setTeamActionError(error instanceof Error ? error.message : 'Error al eliminar el usuario')
    },
  })

  // Mutation: editar nombre (colaboradores invitados antes de pedir nombre,
  // o para corregir uno existente).
  const updateNameMutation = useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) =>
      updateUserName(companyId, userId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
      setEditingNameId(null)
      setTeamActionError(null)
    },
    onError: (error) => {
      setTeamActionError(error instanceof Error ? error.message : 'Error al actualizar el nombre')
    },
  })

  const startEditName = (user: CompanyUser) => {
    setEditingNameId(user.id)
    setEditingNameValue(user.user_name ?? '')
  }

  const saveEditName = (userId: string) => {
    if (!editingNameValue.trim()) return
    updateNameMutation.mutate({ userId, name: editingNameValue.trim() })
  }

  // Mutation: invitar usuario
  const inviteUserMutation = useMutation({
    mutationFn: () => inviteUserToCompany(companyId, inviteEmail, inviteRole, inviteName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
      setInviteName('')
      setInviteEmail('')
      setInviteRole('vendedor')
      setInviteError(null)
      setInviteSuccess(data.message)
      // Cerrar formulario después de 2 segundos
      setTimeout(() => {
        setShowInviteForm(false)
        setInviteSuccess(null)
      }, 2000)
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Error al invitar usuario')
      setInviteSuccess(null)
    },
  })

  // BUG ENCONTRADO (16 oct 2026): esto llamaba a updateRoleMutation con
  // user.id -- el id de la propia fila de company_users -- en vez de
  // user.user_id (el id real del usuario en Supabase Auth, que es lo que
  // updateUserRole necesita para encontrar la fila correcta por
  // user_id). Quedaba enmascarado porque el UPDATE ya fallaba antes por
  // falta de politica RLS (ver nota en queries.ts), asi que nunca se
  // notaba que ademas buscaba por el id equivocado. rowKey sigue siendo
  // user.id porque selectedRole solo necesita una llave local unica por
  // fila para el estado optimista del selector; realUserId es lo que de
  // verdad se le manda al servidor.
  const handleRoleChange = (rowKey: string, realUserId: string, newRole: string) => {
    setSelectedRole(prev => ({ ...prev, [rowKey]: newRole }))
    updateRoleMutation.mutate({ userId: realUserId, newRole, rowKey })
  }

  const handleRemoveUser = (userId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      removeUserMutation.mutate(userId)
    }
  }

  const handleInviteUser = () => {
    if (!inviteName.trim()) {
      setInviteError('El nombre es requerido')
      return
    }
    if (!inviteEmail.trim()) {
      setInviteError('El email es requerido')
      return
    }
    inviteUserMutation.mutate()
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
  }

  return (
    <div className="space-y-4">
      {/* Formulario de invitación */}
      {/* TODO: Validar límite de usuarios según suscripción antes de permitir invitar */}
      {showInviteForm && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nombre del colaborador</label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => {
                setInviteName(e.target.value)
                setInviteError(null)
              }}
              placeholder="Ej. María Pérez"
              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email del colaborador</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  setInviteError(null)
                }}
                placeholder="colaborador@example.com"
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rol</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {AVAILABLE_ROLES.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {inviteError && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">{inviteSuccess}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleInviteUser}
              disabled={inviteUserMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {inviteUserMutation.isPending ? 'Invitando...' : 'Enviar invitación'}
            </button>
            <button
              onClick={() => {
                setShowInviteForm(false)
                setInviteError(null)
                setInviteEmail('')
              }}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-[var(--glass)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {teamActionError && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <p className="text-xs text-red-600">{teamActionError}</p>
          <button onClick={() => setTeamActionError(null)} className="text-xs text-red-600 hover:underline shrink-0">
            Cerrar
          </button>
        </div>
      )}

      {/* Tabla de usuarios */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay usuarios registrados aún</p>
          <button
            onClick={() => setShowInviteForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Agregar primer colaborador
          </button>
        </div>
      ) : (
        <>
          {!showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Invitar colaborador
            </button>
          )}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Rol</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Fecha de ingreso</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {codeByUserId.get(user.user_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {editingNameId === user.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditName(user.user_id)
                              if (e.key === 'Escape') setEditingNameId(null)
                            }}
                            className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEditName(user.user_id)}
                            disabled={updateNameMutation.isPending}
                            className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Guardar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingNameId(null)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{user.user_name ?? <span className="text-muted-foreground italic">Sin nombre</span>}</span>
                          <button
                            onClick={() => startEditName(user)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
                            title="Editar nombre"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {user.user_email ? (
                        <span>{user.user_email}</span>
                      ) : (
                        <code className="bg-[var(--glass-hover)] px-2 py-1 rounded text-xs" title="No se pudo resolver el email de este usuario">
                          {user.user_id}
                        </code>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={selectedRole[user.id] || user.role}
                        onChange={e => handleRoleChange(user.id, user.user_id, e.target.value)}
                        disabled={updateRoleMutation.isPending}
                        className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 disabled:opacity-50"
                      >
                        {AVAILABLE_ROLES.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveUser(user.user_id)}
                        disabled={removeUserMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                        title="Eliminar usuario"
                      >
                        {removeUserMutation.isPending ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] divide-y divide-[var(--glass-border)]">
            {users.map(user => (
              <div key={user.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-muted-foreground">{codeByUserId.get(user.user_id)}</span>
                      {editingNameId === user.id ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <input
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditName(user.user_id)
                              if (e.key === 'Escape') setEditingNameId(null)
                            }}
                            className="min-w-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEditName(user.user_id)}
                            disabled={updateNameMutation.isPending}
                            className="shrink-0 rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Guardar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingNameId(null)}
                            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground truncate flex items-center gap-1">
                          {user.user_name ?? <span className="text-muted-foreground italic">Sin nombre</span>}
                          <button
                            onClick={() => startEditName(user)}
                            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
                            title="Editar nombre"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </p>
                      )}
                    </div>
                    {user.user_email ? (
                      <p className="text-xs text-muted-foreground truncate">{user.user_email}</p>
                    ) : (
                      <code className="bg-[var(--glass-hover)] px-2 py-1 rounded text-xs" title="No se pudo resolver el email de este usuario">
                        {user.user_id}
                      </code>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fecha de ingreso: {new Date(user.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(user.user_id)}
                    disabled={removeUserMutation.isPending}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                    title="Eliminar usuario"
                  >
                    {removeUserMutation.isPending ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <select
                  value={selectedRole[user.id] || user.role}
                  onChange={e => handleRoleChange(user.id, user.user_id, e.target.value)}
                  disabled={updateRoleMutation.isPending}
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 disabled:opacity-50"
                >
                  {AVAILABLE_ROLES.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
