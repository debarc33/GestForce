import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SACompany } from '@/types/superadmin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// ── GET /api/superadmin/companies/[id] ────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: company, error } = await admin
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  return NextResponse.json(company as SACompany)
}

// ── PATCH /api/superadmin/companies/[id] ──────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as Partial<Omit<SACompany, 'id' | 'created_at'>>
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('companies')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data as SACompany)
}
