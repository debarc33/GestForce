import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SACompany, SACompanyUser, SACompanyModule, SACompanyWithCounts } from '@/types/superadmin'

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
  }

  if (!body.name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: company, error } = await admin
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
      subscription_start: new Date().toISOString().split('T')[0], // today's date YYYY-MM-DD
      subscription_status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(company as SACompany, { status: 201 })
}
