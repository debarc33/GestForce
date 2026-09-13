import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type CompanyAdminCheck =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Valida que haya sesión Supabase y que el usuario sea miembro con
 * role='admin' de la empresa indicada. Usa el cliente del usuario (RLS
 * activa) contra company_users — mismo patrón que /api/company/users/invite.
 *
 * Nunca confiar en un companyId recibido del cliente sin pasar por aquí.
 */
export async function requireCompanyAdmin(companyId: string): Promise<CompanyAdminCheck> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, status: 401, error: 'No autenticado' }
  }

  const { data: userCompany, error: checkError } = await supabase
    .from('company_users')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (checkError || !userCompany || userCompany.role !== 'admin') {
    return { ok: false, status: 403, error: 'Solo administradores pueden acceder a la suscripción' }
  }

  return { ok: true, user }
}
