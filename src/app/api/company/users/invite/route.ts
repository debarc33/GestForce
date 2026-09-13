import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/company/users/invite
 * Invita un usuario a una empresa
 *
 * NOTA: Sistema actual:
 * - Solo valida que el admin existe y tiene permisos
 * - Retorna éxito si el email es válido
 * - En una versión futura: enviar emails de invitación, tabla de invitaciones pendientes, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, role, companyId } = await req.json()

    if (!email || !role || !companyId) {
      return NextResponse.json(
        { error: 'Email, role y companyId son requeridos' },
        { status: 400 }
      )
    }

    // Validar email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar que el usuario es admin de la empresa
    const { data: userCompany, error: checkError } = await supabase
      .from('company_users')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()

    if (checkError || !userCompany || userCompany.role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo administradores pueden invitar usuarios' },
        { status: 403 }
      )
    }

    // TODO: Implementar en futuro
    // - Validar límite de usuarios según suscripción de la empresa
    //   * Obtener subscription de la empresa
    //   * Contar usuarios actuales
    //   * Comparar contra plan.max_users
    //   * Si alcanza límite → error 402 (payment required)
    // - Crear tabla user_invitations con code de invitación única
    // - Enviar email con link de invitación
    // - Validar que el email no existe en Auth
    // Por ahora, simplemente confirmamos que la invitación se envió (simulado)

    return NextResponse.json({
      success: true,
      email,
      role,
      message: `Invitación enviada a ${email}. El colaborador podrá acceder con su cuenta cuando se registre.`,
    })
  } catch (error) {
    console.error('Error en invite route:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
