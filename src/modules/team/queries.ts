export interface CompanyUser {
  id: string
  user_id: string
  company_id: string
  role: string
  created_at: string
  user_email?: string
  /**
   * Nombre real de la persona, resuelto desde user_metadata (Supabase Auth).
   * null cuando la cuenta se invitó antes de capturar nombre (invitaciones
   * viejas) -- en ese caso la tabla de Equipo cae de vuelta al correo.
   */
  user_name?: string | null
}

/**
 * Obtener usuarios de una empresa (con email resuelto)
 *
 * Antes esto consultaba company_users directo desde el cliente, que no
 * tiene forma de hacer join contra auth.users (el email vive ahí, no en
 * company_users) — por eso la tabla de Equipo mostraba el UUID crudo.
 * Ahora pasa por /api/company/users, que resuelve el email con el admin
 * client en el servidor.
 */
export async function getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  const response = await fetch(`/api/company/users?companyId=${encodeURIComponent(companyId)}`)

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al cargar los usuarios de la empresa')
  }

  return response.json()
}

/**
 * Actualizar el rol de un usuario en una empresa
 *
 * Antes esto hacia el UPDATE directo contra company_users desde el
 * cliente del navegador. Esa tabla nunca tuvo una politica RLS de
 * UPDATE (solo SELECT, migraciones 012/013), asi que el cambio nunca
 * se guardaba -- fallaba en silencio porque React Query no tenia
 * onError, y el selector de rol volvia a su valor real al recargar la
 * pagina. Ahora pasa por /api/company/users/[userId] (PATCH), que
 * valida que quien llama sea admin de la empresa y usa el admin client
 * para escribir -- bug encontrado y corregido el 16 oct 2026.
 */
export async function updateUserRole(
  companyId: string,
  userId: string,
  newRole: string
): Promise<CompanyUser> {
  const response = await fetch(`/api/company/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, role: newRole }),
  })

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al actualizar el rol del usuario')
  }

  return response.json()
}

/**
 * Eliminar un usuario de una empresa
 *
 * Mismo bug y mismo fix que updateUserRole arriba: antes el DELETE iba
 * directo contra company_users desde el cliente y fallaba en silencio
 * por falta de politica RLS. Ahora pasa por
 * /api/company/users/[userId] (DELETE), con el mismo chequeo de admin.
 */
export async function removeUserFromCompany(
  companyId: string,
  userId: string
): Promise<void> {
  const response = await fetch(
    `/api/company/users/${encodeURIComponent(userId)}?companyId=${encodeURIComponent(companyId)}`,
    { method: 'DELETE' }
  )

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al eliminar el usuario de la empresa')
  }
}

/**
 * Invitar un usuario a la empresa (requiere email y nombre)
 * Llama al endpoint API que valida permisos y envía la invitación
 */
export async function inviteUserToCompany(
  companyId: string,
  email: string,
  role: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/company/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, companyId, name }),
  })

  if (!response.ok) {
    const { error } = await response.json()
    throw new Error(error || 'Error al invitar usuario')
  }

  return response.json()
}

/**
 * Actualizar el nombre de un colaborador ya invitado -- para arreglar
 * cuentas invitadas antes de que el formulario empezara a pedir nombre
 * (esas quedan mostrando "Sin nombre" en la tabla de Equipo).
 */
export async function updateUserName(
  companyId: string,
  userId: string,
  name: string
): Promise<void> {
  const response = await fetch(`/api/company/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, name }),
  })

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }))
    throw new Error(error || 'Error al actualizar el nombre del colaborador')
  }
}

// Tipos de roles disponibles
export const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Administrador' },
  { id: 'contador', label: 'Contador' },
  { id: 'vendedor', label: 'Vendedor' },
  { id: 'readonly', label: 'Solo lectura' },
] as const
