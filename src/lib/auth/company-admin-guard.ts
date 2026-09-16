import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cuenta cuántos usuarios con role='admin' tiene actualmente una empresa.
 * Requiere un cliente con permisos para leer company_users sin RLS
 * (createAdminClient()) porque se usa antes/durante operaciones de
 * escritura que ya validaron el permiso del que llama por otra vía.
 */
export async function countCompanyAdmins(
  admin: SupabaseClient,
  companyId: string
): Promise<number> {
  const { count, error } = await admin
    .from('company_users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', 'admin')

  if (error) {
    throw new Error('Error al contar administradores de la empresa: ' + error.message)
  }

  return count ?? 0
}

/**
 * Regla de negocio: no se puede agregar/invitar un usuario con un rol
 * distinto de 'admin' a una empresa que todavía no tiene ningún
 * administrador registrado. Si se intenta, hay que registrar primero un
 * admin para esa empresa.
 *
 * Devuelve un mensaje de error si la operación debe bloquearse, o `null`
 * si puede continuar.
 */
export async function checkCanAddUserWithRole(
  admin: SupabaseClient,
  companyId: string,
  role: string
): Promise<string | null> {
  if (role === 'admin') return null

  const adminCount = await countCompanyAdmins(admin, companyId)
  if (adminCount === 0) {
    return 'Esta empresa todavía no tiene ningún administrador registrado. Debes agregar primero un usuario con rol "admin" antes de poder agregar usuarios con otros roles.'
  }

  return null
}
