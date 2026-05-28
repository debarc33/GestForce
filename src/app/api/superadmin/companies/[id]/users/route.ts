import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SACompanyUser } from '@/types/superadmin'

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

  const { id: companyId } = await params
  const admin = createAdminClient()

  const { data: members, error } = await admin
    .from('company_users')
    .select('user_id, role, created_at')
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!members || members.length === 0) return NextResponse.json([])

  const membersList = members as Pick<SACompanyUser, 'user_id' | 'role' | 'created_at'>[]
  const userIds = membersList.map((m) => m.user_id)

  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers()
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const userMap = new Map(
    (authUsers.users ?? [])
      .filter((u) => userIds.includes(u.id))
      .map((u) => [u.id, u.email])
  )

  const result = membersList.map((m) => ({
    user_id: m.user_id,
    email: userMap.get(m.user_id) ?? '—',
    role: m.role,
    created_at: m.created_at,
  }))

  return NextResponse.json(result)
}

// ── PATCH /api/superadmin/companies/[id]/users ────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: companyId } = await params
  const { user_id, role } = await request.json() as { user_id: string; role: string }

  const validRoles = ['admin', 'contador', 'vendedor', 'readonly']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_users')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── DELETE /api/superadmin/companies/[id]/users ───────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: companyId } = await params
  const { user_id } = await request.json() as { user_id: string }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_users')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
