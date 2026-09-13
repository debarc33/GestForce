'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Loader, Plus } from 'lucide-react'
import { getCompanyUsers, updateUserRole, removeUserFromCompany, inviteUserToCompany, AVAILABLE_ROLES, type CompanyUser } from '../queries'

interface UsersTableProps {
  companyId: string
}

export function UsersTable({ companyId }: UsersTableProps) {
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({})
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('vendedor')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Cargar usuarios
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['company_users', companyId],
    queryFn: () => getCompanyUsers(companyId),
  })

  // Mutation: cambiar rol
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      updateUserRole(companyId, userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
      setSelectedRole({})
    },
  })

  // Mutation: eliminar usuario
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => removeUserFromCompany(companyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
    },
  })

  // Mutation: invitar usuario
  const inviteUserMutation = useMutation({
    mutationFn: () => inviteUserToCompany(companyId, inviteEmail, inviteRole),
    onSuccess: (data) => {
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

  const handleRoleChange = (userId: string, newRole: string) => {
    setSelectedRole(prev => ({ ...prev, [userId]: newRole }))
    updateRoleMutation.mutate({ userId, newRole })
  }

  const handleRemoveUser = (userId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      removeUserMutation.mutate(userId)
    }
  }

  const handleInviteUser = () => {
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
                autoFocus
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
          <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Email/ID Usuario</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Rol</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Registrado</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">
                      <code className="bg-[var(--glass-hover)] px-2 py-1 rounded text-xs">{user.user_id}</code>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={selectedRole[user.id] || user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
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
        </>
      )}
    </div>
  )
}
