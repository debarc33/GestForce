'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TOGGLEABLE_MODULES, type ModuleId } from '@/config/modules'

/**
 * Roles y permisos editables por empresa (1 nov 2026).
 *
 * Reemplaza la lista fija de 4 roles (admin/contador/vendedor/readonly)
 * por una tabla editable: cada empresa puede renombrar sus roles (menos
 * "admin", que queda protegido porque `requireCompanyAdmin` todavía lo
 * reconoce por ese nombre literal) y crear roles nuevos, con permisos de
 * Sin acceso / Solo ver / Puede editar por cada módulo que esa empresa
 * tenga activo (ver migración 032).
 *
 * Las lecturas van directo contra Supabase (RLS ya permite a cualquier
 * miembro de la empresa leer sus propios roles/permisos, igual que
 * `company_modules`). Las escrituras pasan por /api/company/roles/*,
 * que valida que quien llama sea admin de la empresa -- mismo patrón que
 * invitar/editar usuarios.
 */

export type AccessLevel = 'none' | 'view' | 'edit'

export type RoleRow = {
  id: string
  company_id: string
  name: string
  is_system: boolean
}

export type RolePermissionRow = {
  role_id: string
  module_id: string
  access_level: AccessLevel
}

export type RoleWithPermissions = RoleRow & {
  /** Mapa module_id -> nivel de acceso. Un módulo activo sin fila propia
   *  se trata como 'edit' (acceso completo) -- mismo criterio "a favor
   *  de no restringir por sorpresa" que se usó al sembrar la migración. */
  permissions: Record<string, AccessLevel>
}

async function fetchRolesWithPermissions(companyId: string): Promise<RoleWithPermissions[]> {
  const supabase = createClient()

  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, company_id, name, is_system')
    .eq('company_id', companyId)
    .order('is_system', { ascending: false })
    .order('name')

  if (rolesError) throw new Error(rolesError.message)
  const roleRows = (roles ?? []) as RoleRow[]
  if (roleRows.length === 0) return []

  const roleIds = roleRows.map(r => r.id)
  const { data: perms, error: permsError } = await supabase
    .from('role_permissions')
    .select('role_id, module_id, access_level')
    .in('role_id', roleIds)

  if (permsError) throw new Error(permsError.message)

  const permsByRole = new Map<string, Record<string, AccessLevel>>()
  for (const p of (perms ?? []) as RolePermissionRow[]) {
    const bucket = permsByRole.get(p.role_id) ?? {}
    bucket[p.module_id] = p.access_level
    permsByRole.set(p.role_id, bucket)
  }

  return roleRows.map(r => ({
    ...r,
    permissions: permsByRole.get(r.id) ?? {},
  }))
}

/** Lista de roles de la empresa activa, con sus permisos por módulo. */
export function useCompanyRoles(companyId?: string) {
  return useQuery({
    queryKey: ['company_roles', companyId],
    queryFn: () => fetchRolesWithPermissions(companyId!),
    enabled: !!companyId,
  })
}

/**
 * Acceso del rol actual del usuario a cada módulo ACTIVO de la empresa.
 * Un módulo que la empresa no tiene activo ni aparece aquí (no hace
 * falta -- el sidebar y el ModuleGuard ya lo ocultan por otro lado).
 * Si el rol no existe en la tabla `roles` (no debería pasar, pero por
 * si acaso) se trata como acceso completo, para no dejar a nadie
 * bloqueado por un dato faltante.
 */
export function useMyModuleAccess(companyId?: string, roleName?: string) {
  return useQuery({
    queryKey: ['my_module_access', companyId, roleName],
    queryFn: async (): Promise<Record<ModuleId, AccessLevel>> => {
      const all = await fetchRolesWithPermissions(companyId!)
      const mine = all.find(r => r.name === roleName)
      const result = {} as Record<ModuleId, AccessLevel>
      for (const m of TOGGLEABLE_MODULES) {
        result[m.id] = mine ? (mine.permissions[m.id] ?? 'edit') : 'edit'
      }
      return result
    },
    enabled: !!companyId && !!roleName,
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Escritura (admin de la empresa) ──────────────────────────────────────

export async function createRole(companyId: string, name: string) {
  const res = await fetch('/api/company/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, name }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al crear el rol')
  }
  return res.json()
}

export async function renameRole(roleId: string, companyId: string, name: string) {
  const res = await fetch(`/api/company/roles/${encodeURIComponent(roleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, name }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al renombrar el rol')
  }
  return res.json()
}

export async function updateRolePermissions(
  roleId: string,
  companyId: string,
  permissions: { module_id: string; access_level: AccessLevel }[]
) {
  const res = await fetch(`/api/company/roles/${encodeURIComponent(roleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, permissions }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al actualizar los permisos del rol')
  }
  return res.json()
}

export async function deleteRole(roleId: string, companyId: string) {
  const res = await fetch(`/api/company/roles/${encodeURIComponent(roleId)}?companyId=${encodeURIComponent(companyId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al eliminar el rol')
  }
  return res.json()
}

/** Invalidar todo lo que depende de roles/permisos tras un cambio. */
export function useInvalidateRoles() {
  const qc = useQueryClient()
  return (companyId: string) => {
    qc.invalidateQueries({ queryKey: ['company_roles', companyId] })
    qc.invalidateQueries({ queryKey: ['my_module_access', companyId] })
  }
}
