import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TOGGLEABLE_MODULES, ALWAYS_ON_MODULE_IDS } from '@/config/modules'
import type { SACompanyModule } from '@/types/superadmin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// ── GET /api/superadmin/companies/[id]/modules ────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('company_modules')
    .select('module_id, is_enabled')
    .eq('company_id', id)

  const moduleRows = (rows ?? []) as Pick<SACompanyModule, 'module_id' | 'is_enabled'>[]
  const moduleMap = new Map(moduleRows.map((r) => [r.module_id, r.is_enabled]))

  const toggleable = TOGGLEABLE_MODULES.map((m) => ({
    module_id: m.id,
    name: m.name,
    description: m.description,
    is_enabled: moduleMap.has(m.id) ? moduleMap.get(m.id)! : true,
  }))

  const always_on = ALWAYS_ON_MODULE_IDS.map((id) => ({
    module_id: id,
    is_enabled: true,
    always_on: true,
  }))

  return NextResponse.json({ toggleable, always_on })
}

// ── PUT /api/superadmin/companies/[id]/modules ────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: companyId } = await params
  const body = await request.json() as { modules: Array<{ module_id: string; is_enabled: boolean }> }

  if (!Array.isArray(body.modules)) {
    return NextResponse.json({ error: 'modules debe ser un array' }, { status: 400 })
  }

  const admin = createAdminClient()

  const toggleableIds = new Set(TOGGLEABLE_MODULES.map((m) => m.id))
  const toUpsert = body.modules
    .filter((m) => toggleableIds.has(m.module_id as never))
    .map((m) => ({
      company_id: companyId,
      module_id: m.module_id,
      is_enabled: m.is_enabled,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }))

  if (toUpsert.length === 0) return NextResponse.json({ success: true, updated: 0 })

  const { error } = await admin
    .from('company_modules')
    .upsert(toUpsert, { onConflict: 'company_id,module_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, updated: toUpsert.length })
}
