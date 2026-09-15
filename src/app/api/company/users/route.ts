import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'

/**
 * GET /api/company/users?companyId=...
 * Lista los miembros de una empresa con su email resuelto desde Supabase
 * Auth (company_users solo guarda user_id — el email vive en auth.users,
 * al que el cliente nunca tiene acceso directo por RLS/schema, así que
 * hay que resolverlo aquí con el admin client, igual que en
 * /api/company/users/invite).
 *
 * Antes la tabla de Equipo mostraba el UUID crudo del usuario porque
 * getCompanyUsers() consultaba company_users directo desde el cliente,
 * que no tiene forma de hacer join contra auth.users.
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    // Mismo chequeo de permisos que el resto de endpoints de administración
    // de equipo (solo admins de la empresa).
    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    const { data: companyUsers, error: fetchError } = await admin
      .from('company_users')
      .select('id, user_id, company_id, role, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const rows = companyUsers ?? []

    // Resolver el email de cada miembro. La cantidad de miembros por
    // empresa es chica (equipo interno), así que un lookup por ID en
    // paralelo es más preciso que listUsers() (que pagina y podría no
    // traer a todos si hay muchos usuarios en el proyecto de Supabase).
    const usersWithEmail = await Promise.all(
      rows.map(async row => {
        const { data: authUser } = await admin.auth.admin.getUserById(row.user_id)
        return {
          ...row,
          user_email: authUser?.user?.email ?? null,
        }
      })
    )

    return NextResponse.json(usersWithEmail)
  } catch (error) {
    console.error('Error en GET /api/company/users:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
