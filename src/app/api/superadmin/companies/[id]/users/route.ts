import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCanAddUserWithRole } from '@/lib/auth/company-admin-guard'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// ── GET /api/superadmin/companies/[id]/users ──────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: users, error } = await admin
    .from('company_users')
    .select('id, user_id, role, created_at')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(users ?? [])
}

// ── POST /api/superadmin/companies/[id]/users ──────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { email, role } = await request.json() as { email: string; role: string }

  if (!email || !role) {
    return NextResponse.json(
      { error: 'Email y rol son requeridos' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Regla: no se puede agregar un usuario con rol distinto de 'admin'
  // si la empresa todavía no tiene ningún administrador registrado.
  const blockReason = await checkCanAddUserWithRole(admin, id, role)
  if (blockReason) {
    return NextResponse.json({ error: blockReason }, { status: 400 })
  }

  // 1. Buscar user_id por email en auth.users
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers()
  if (authError) {
    return NextResponse.json(
      { error: 'Error al buscar usuario en auth' },
      { status: 500 }
    )
  }

  const authUser = authUsers.users.find(u => u.email === email)
  if (!authUser) {
    return NextResponse.json(
      { error: `Usuario con email "${email}" no encontrado en Supabase Auth` },
      { status: 404 }
    )
  }

  // 2. Verificar que no exista ya en company_users
  const { data: existing } = await admin
    .from('company_users')
    .select('id')
    .eq('company_id', id)
    .eq('user_id', authUser.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Este usuario ya está asignado a esta empresa' },
      { status: 409 }
    )
  }

  // 3. Crear registro en company_users
  const { data: newUser, error: insertError } = await admin
    .from('company_users')
    .insert([{
      user_id: authUser.id,
      company_id: id,
      role: role,
    }])
    .select()
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(newUser, { status: 201 })
}

// ── DELETE /api/superadmin/companies/[id]/users/[userId] ─────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'userId es requerido' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('company_users')
    .delete()
    .eq('company_id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
