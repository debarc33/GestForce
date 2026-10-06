import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type CompanyMemberCheck =
  | { ok: true; user: User; role: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Valida que haya sesión Supabase y que el usuario sea miembro (de
 * cualquier rol) de la empresa indicada. A diferencia de
 * requireCompanyAdmin, no exige rol 'admin' — sirve para acciones que
 * cualquier usuario de la empresa puede hacer (ej. enviar una
 * cotización/factura por correo), mismo patrón de validación contra
 * company_users con el cliente del usuario (RLS activa).
 */
export async function requireCompanyMember(companyId: string): Promise<CompanyMemberCheck> {
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

  if (checkError || !userCompany) {
    return { ok: false, status: 403, error: 'No tienes acceso a esta empresa' }
  }

  return { ok: true, user, role: userCompany.role }
}
