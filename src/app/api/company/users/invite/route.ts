import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'

const VALID_ROLES = ['admin', 'contador', 'vendedor', 'readonly']

/**
 * POST /api/company/users/invite
 * Invita un colaborador a la empresa.
 *
 * - Si el email es nuevo: se crea la cuenta vía
 *   supabase.auth.admin.inviteUserByEmail (Supabase envía el correo con
 *   el link para definir contraseña) y se vincula a la empresa.
 * - Si el email ya tiene cuenta en Supabase Auth: se vincula a la empresa
 *   Y ADEMÁS se le envía un correo de restablecimiento de contraseña
 *   (resetPasswordForEmail). Esto es necesario porque `inviteUserByEmail`
 *   falla con "email_exists" para cualquier cuenta ya registrada — no hay
 *   forma de "reinvitar" a alguien así — y un usuario puede quedar
 *   registrado pero SIN contraseña utilizable si el link de invitación
 *   anterior expiró o se usó sin completar el paso de crear contraseña
 *   (bug real encontrado en testing: el usuario quedaba con la cuenta
 *   confirmada pero sin poder entrar nunca). Enviar el correo de reset es
 *   inofensivo para alguien que sí recuerda su contraseña — puede
 *   simplemente ignorarlo.
 *
 * Ambos casos usan el mismo destino: /auth/callback, que ahora reconoce
 * los links de invitación Y de recuperación (token_hash + type), y manda
 * al usuario a /auth/set-password antes de dejarlo entrar.
 *
 * Antes esta ruta era un stub: validaba permisos y devolvía éxito sin
 * crear ni vincular nada. Ahora sí crea la cuenta/vínculo real.
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    // Verifica sesión + que sea admin de ESTA empresa (nunca confiar en
    // companyId del cliente sin esto).
    const check = await requireCompanyAdmin(companyId)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const admin = createAdminClient()

    // Buscar si el email ya tiene cuenta en Supabase Auth.
    // NOTA: el SDK no filtra listUsers() por email; con el volumen de
    // usuarios esperado (SaaS pequeño/mediano) es aceptable — mismo
    // patrón ya usado en /api/superadmin/companies/[id]/users.
    const { data: authUsers, error: listError } = await admin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json(
        { error: 'Error al consultar usuarios en Auth: ' + listError.message },
        { status: 500 }
      )
    }

    let userId = authUsers.users.find(u => u.email === email)?.id
    let createdNewAccount = false
    let sentPasswordReset = false
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!userId) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/auth/callback`,
      })

      if (inviteError || !invited?.user) {
        return NextResponse.json(
          { error: 'No se pudo enviar la invitación: ' + (inviteError?.message ?? 'error desconocido') },
          { status: 500 }
        )
      }

      userId = invited.user.id
      createdNewAccount = true
    } else {
      // Cuenta ya existente: le mandamos un correo de restablecimiento de
      // contraseña por si nunca llegó a fijar una (ver comentario arriba).
      // Si falla, no bloqueamos el flujo — igual se agrega a la empresa.
      const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/callback`,
      })
      sentPasswordReset = !resetError
    }

    // ¿Ya pertenece a esta empresa?
    const { data: existing } = await admin
      .from('company_users')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Este usuario ya pertenece a esta empresa' },
        { status: 409 }
      )
    }

    const { error: insertError } = await admin
      .from('company_users')
      .insert([{ user_id: userId, company_id: companyId, role }])

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email,
      role,
      message: createdNewAccount
        ? `Se envió un correo de invitación a ${email} para que cree su contraseña y acceda.`
        : sentPasswordReset
          ? `${email} ya tenía cuenta en GestForce — se agregó a la empresa y se le envió un correo para (re)establecer su contraseña, por si no la recuerda o nunca la había definido.`
          : `${email} ya tenía cuenta en GestForce — se agregó directamente a la empresa.`,
    })
  } catch (error) {
    console.error('Error en invite route:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
