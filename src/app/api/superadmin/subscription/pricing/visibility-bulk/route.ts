import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

const ALLOWED_FIELDS = ['show_plan_pricing', 'show_invoice_pack_pricing'] as const
type AllowedField = (typeof ALLOWED_FIELDS)[number]

/**
 * POST /api/superadmin/subscription/pricing/visibility-bulk
 * Body: { field: 'show_plan_pricing' | 'show_invoice_pack_pricing', value: boolean }
 * Aplica el valor a TODAS las empresas de una sola vez -- para cuando el
 * superadmin ya unificó precios y quiere prender (o apagar) el autopago
 * para todo el mundo en lugar de empresa por empresa.
 */
export async function POST(request: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as { field?: string; value?: boolean } | null

  if (!body || !ALLOWED_FIELDS.includes(body.field as AllowedField) || typeof body.value !== 'boolean') {
    return NextResponse.json(
      { error: `field debe ser uno de: ${ALLOWED_FIELDS.join(', ')}, y value un booleano` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('companies')
    .update({ [body.field as AllowedField]: body.value }, { count: 'exact' })
    .not('id', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: count ?? null })
}
