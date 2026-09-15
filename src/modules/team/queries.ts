import { createClient } from '@/lib/supabase/client'

export interface CompanyUser {
  id: string
  user_id: string
  company_id: string
  role: string
  created_at: string
  user_email?: string
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
 */
export async function updateUserRole(
  companyId: string,
  userId: string,
  newRole: string
): Promise<CompanyUser> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('company_users')
    .update({ role: newRole })
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Eliminar un usuario de una empresa
 */
export async function removeUserFromCompany(
  companyId: string,
  userId: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('company_users')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

/**
 * Invitar un usuario a la empresa (requiere email)
 * Llama al endpoint API que valida permisos y envía la invitación
 */
export async function inviteUserToCompany(
  companyId: string,
  email: string,
  role: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/company/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, companyId }),
  })

  if (!response.ok) {
    const { error } = await response.json()
    throw new Error(error || 'Error al invitar usuario')
  }

  return response.json()
}

// Tipos de roles disponibles
export const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Administrador' },
  { id: 'contador', label: 'Contador' },
  { id: 'vendedor', label: 'Vendedor' },
  { id: 'readonly', label: 'Solo lectura' },
] as const
