import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/services/email'
import type { SACompany, SACompanyUser, SACompanyModule, SACompanyWithCounts } from '@/types/superadmin'

// Generar contraseña temporal segura
function generateTemporaryPassword(length = 12) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// ── GET /api/superadmin/companies ─────────────────────────────────────────────
export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: companies, error } = await admin
    .from('companies')
    .select('id, name, nit, legal_name, email, phone, is_active, subscription_period, subscription_start, subscription_end, subscription_status, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: userCounts } = await admin
    .from('company_users')
    .select('company_id')

  const { data: moduleCounts } = await admin
    .from('company_modules')
    .select('company_id, is_enabled')
    .eq('is_enabled', true)

  const companiesList = (companies ?? []) as SACompany[]
  const userCountsList = (userCounts ?? []) as Pick<SACompanyUser, 'company_id'>[]
  const moduleCountsList = (moduleCounts ?? []) as Pick<SACompanyModule, 'company_id' | 'is_enabled'>[]

  const result: SACompanyWithCounts[] = companiesList.map((c) => ({
    ...c,
    user_count: userCountsList.filter((u) => u.company_id === c.id).length,
    enabled_modules_count: moduleCountsList.filter((m) => m.company_id === c.id).length,
  }))

  return NextResponse.json(result)
}

// ── POST /api/superadmin/companies ────────────────────────────────────────────
export async function POST(request: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    name: string
    nit?: string
    legal_name?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    fiscal_regime?: string
    subscription_period?: '3_months' | '6_months' | '1_year'
    // NUEVOS CAMPOS
    owner_email: string
    owner_first_name?: string
    trial_days?: number
  }

  if (!body.name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!body.owner_email) return NextResponse.json({ error: 'El email del propietario es requerido' }, { status: 400 })

  const admin = createAdminClient()
  const trialDays = body.trial_days ?? 15

  try {
    // 1. Crear empresa
    const { data: company, error: companyError } = await admin
      .from('companies')
      .insert({
        name: body.name,
        nit: body.nit ?? null,
        legal_name: body.legal_name ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        fiscal_regime: body.fiscal_regime ?? 'no_iva',
        is_active: true,
        subscription_period: body.subscription_period ?? '1_year',
        subscription_start: new Date().toISOString().split('T')[0],
        // CAMBIO: Para período de prueba, usar status='active' (no 'pending')
        subscription_status: 'active',
        // Calcular fecha de vencimiento: hoy + trial_days
        subscription_end: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      })
      .select()
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: companyError?.message || 'Failed to create company' },
        { status: 500 }
      )
    }

    // 2. Crear usuario en Supabase Auth
    const temporaryPassword = generateTemporaryPassword()
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: body.owner_email,
      password: temporaryPassword,
      email_confirm: true, // Marcar como confirmado
      user_metadata: {
        first_name: body.owner_first_name || body.name,
      },
    })

    if (authError || !authUser) {
      // Rollback: eliminar empresa creada
      await admin.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        { error: `Failed to create user: ${authError?.message}` },
        { status: 500 }
      )
    }

    // 3. Asignar usuario a empresa con rol=admin
    const { error: assignError } = await admin
      .from('company_users')
      .insert({
        user_id: authUser.user.id,
        company_id: company.id,
        role: 'admin',
      })

    if (assignError) {
      // Rollback: eliminar usuario y empresa
      await admin.auth.admin.deleteUser(authUser.user.id)
      await admin.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        { error: `Failed to assign user to company: ${assignError.message}` },
        { status: 500 }
      )
    }

    // 4. Enviar email de bienvenida
    try {
      const trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
      await sendEmail({
        to: body.owner_email,
        template: 'welcome',
        data: {
          company_name: body.name,
          owner_name: body.owner_first_name || body.name,
          email: body.owner_email,
          password: temporaryPassword,
          trial_days: trialDays,
          trial_end_date: trialEndDate.toISOString(),
        },
      })
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
      // No fallar si el email no se envía
    }

    return NextResponse.json(company as SACompany, { status: 201 })
  } catch (error) {
    console.error('POST companies error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
