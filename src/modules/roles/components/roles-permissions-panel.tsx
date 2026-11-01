'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, Loader, ShieldCheck } from 'lucide-react'
import {
  useCompanyRoles, createRole, renameRole, deleteRole, updateRolePermissions,
  type AccessLevel, type RoleWithPermissions,
} from '../queries'
import { useEnabledModules } from '@/modules/company/module-queries'
import { MODULE_REGISTRY } from '@/config/modules'

const LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'Sin acceso',
  view: 'Solo ver',
  edit: 'Puede editar',
}

const LEVEL_ORDER: AccessLevel[] = ['none', 'view', 'edit']

interface RolesPermissionsPanelProps {
  companyId: string
}

/**
 * Configuración → Roles y permisos (migración 032, 1 nov 2026).
 *
 * Por cada rol de la empresa, permite renombrarlo (menos "Administrador",
 * protegido porque el resto del código lo sigue reconociendo por su
 * nombre literal), borrarlo (si nadie lo tiene asignado) y fijar su
 * nivel de acceso -- Sin acceso / Solo ver / Puede editar -- en cada
 * módulo que ESTA empresa tiene activo (se cruza con `company_modules`,
 * así una empresa sin Nómina activada ni siquiera ve esa fila aquí).
 *
 * "Solo ver" por ahora solo oculta/bloquea el módulo si está en "Sin
 * acceso" (sidebar + ModuleGuard) -- todavía no deshabilita los botones
 * de crear/editar/eliminar DENTRO de un módulo al que el rol sí entra
 * en modo "Solo ver". Eso queda como siguiente paso, módulo por módulo.
 */
export function RolesPermissionsPanel({ companyId }: RolesPermissionsPanelProps) {
  const queryClient = useQueryClient()
  const { data: roles = [], isLoading, isError } = useCompanyRoles(companyId)
  const { data: enabledModuleIds } = useEnabledModules(companyId)

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [showNewRoleForm, setShowNewRoleForm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['company_roles', companyId] })
    queryClient.invalidateQueries({ queryKey: ['my_module_access', companyId] })
  }

  const createMut = useMutation({
    mutationFn: () => createRole(companyId, newRoleName.trim()),
    onSuccess: () => {
      setNewRoleName('')
      setShowNewRoleForm(false)
      setActionError(null)
      invalidate()
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const renameMut = useMutation({
    mutationFn: (vars: { roleId: string; name: string }) => renameRole(vars.roleId, companyId, vars.name),
    onSuccess: () => {
      setEditingRoleId(null)
      setActionError(null)
      invalidate()
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId, companyId),
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const permMut = useMutation({
    mutationFn: (vars: { roleId: string; moduleId: string; level: AccessLevel }) =>
      updateRolePermissions(vars.roleId, companyId, [{ module_id: vars.moduleId, access_level: vars.level }]),
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (e: Error) => setActionError(e.message),
  })

  // Solo los módulos que ESTA empresa tiene activo (y que son
  // asignables -- dashboard/settings siempre están prendidos para todos,
  // no tienen fila de permiso que configurar aquí).
  const visibleModules = MODULE_REGISTRY.filter(
    (m) => !m.alwaysOn && (!enabledModuleIds || enabledModuleIds.has(m.id))
  )

  if (isLoading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Cargando roles...</div>
  }
  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se pudieron cargar los roles. Si esto es la primera vez que abres esta pantalla, puede que falte correr la migración 032 en Supabase.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-bg)] p-4 text-sm text-foreground">
        <p className="font-medium">ℹ️ Qué puede ver y editar cada rol</p>
        <p className="mt-1 text-muted-foreground">
          Por cada rol, elige para cada módulo si queda Sin acceso, Solo ver, o Puede editar.
          El rol &quot;Administrador&quot; no se puede renombrar ni borrar, ni se le puede quitar acceso --
          siempre mantiene acceso completo.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 text-red-700/70 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            visibleModules={visibleModules}
            isExpanded={expandedRoleId === role.id}
            onToggleExpand={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
            isEditingName={editingRoleId === role.id}
            editingName={editingName}
            onStartEditName={() => { setEditingRoleId(role.id); setEditingName(role.name) }}
            onChangeEditingName={setEditingName}
            onConfirmEditName={() => renameMut.mutate({ roleId: role.id, name: editingName })}
            onCancelEditName={() => setEditingRoleId(null)}
            onDelete={() => {
              if (confirm(`¿Eliminar el rol "${role.name}"? Esto no se puede deshacer.`)) {
                deleteMut.mutate(role.id)
              }
            }}
            onChangeLevel={(moduleId, level) => permMut.mutate({ roleId: role.id, moduleId, level })}
            isSavingName={renameMut.isPending}
            isDeleting={deleteMut.isPending}
            isSavingPerm={permMut.isPending}
          />
        ))}
      </div>

      {showNewRoleForm ? (
        <div className="rounded-xl border border-[var(--glass-border)] glass-surface p-4 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Nombre del rol nuevo</label>
          <input
            autoFocus
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Ej: Supervisor de bodega"
            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <p className="text-xs text-muted-foreground">Arranca sin acceso a ningún módulo -- lo asignas después de crearlo.</p>
          <div className="flex gap-2">
            <button
              disabled={!newRoleName.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMut.isPending ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Crear rol
            </button>
            <button
              onClick={() => { setShowNewRoleForm(false); setNewRoleName('') }}
              className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewRoleForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-sm text-foreground hover:bg-[var(--glass)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo rol
        </button>
      )}
    </div>
  )
}

// ─── Tarjeta de un rol ──────────────────────────────────────────────────

interface RoleCardProps {
  role: RoleWithPermissions
  visibleModules: typeof MODULE_REGISTRY
  isExpanded: boolean
  onToggleExpand: () => void
  isEditingName: boolean
  editingName: string
  onStartEditName: () => void
  onChangeEditingName: (v: string) => void
  onConfirmEditName: () => void
  onCancelEditName: () => void
  onDelete: () => void
  onChangeLevel: (moduleId: string, level: AccessLevel) => void
  isSavingName: boolean
  isDeleting: boolean
  isSavingPerm: boolean
}

function RoleCard({
  role, visibleModules, isExpanded, onToggleExpand,
  isEditingName, editingName, onStartEditName, onChangeEditingName, onConfirmEditName, onCancelEditName,
  onDelete, onChangeLevel, isSavingName, isDeleting, isSavingPerm,
}: RoleCardProps) {
  const isAdmin = role.is_system

  return (
    <div className="rounded-xl border border-[var(--glass-border)] glass-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button onClick={onToggleExpand} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {isAdmin && <ShieldCheck className="h-4 w-4 text-[var(--accent)] shrink-0" />}
          {isEditingName ? (
            <input
              autoFocus
              value={editingName}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChangeEditingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onConfirmEditName() }}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          ) : (
            <span className="font-medium text-foreground truncate">{role.name}</span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {isEditingName ? (
            <>
              <button onClick={onConfirmEditName} disabled={isSavingName} className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--glass)]">
                {isSavingName ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button onClick={onCancelEditName} className="p-1.5 rounded-lg text-muted-foreground hover:bg-[var(--glass)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : !isAdmin ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); onStartEditName() }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--glass)]">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete() }} disabled={isDeleting} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                {isDeleting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground px-1.5">Protegido</span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-[var(--glass-border)] px-4 py-3 space-y-2">
          {visibleModules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta empresa no tiene módulos activables en su plan.</p>
          ) : (
            visibleModules.map((m) => {
              const level = isAdmin ? 'edit' : (role.permissions[m.id] ?? 'edit')
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm text-foreground">{m.name}</span>
                  {isAdmin ? (
                    <span className="text-xs text-muted-foreground">Acceso completo</span>
                  ) : (
                    <div className="flex rounded-lg border border-[var(--glass-border)] overflow-hidden text-xs">
                      {LEVEL_ORDER.map((lvl) => (
                        <button
                          key={lvl}
                          disabled={isSavingPerm}
                          onClick={() => onChangeLevel(m.id, lvl)}
                          className={
                            'px-2.5 py-1 transition-colors ' +
                            (level === lvl
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-[var(--glass)] text-muted-foreground hover:text-foreground')
                          }
                        >
                          {LEVEL_LABELS[lvl]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
