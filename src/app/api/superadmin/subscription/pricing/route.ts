import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUBSCRIPTION_PLANS, isPlanId, type PlanId } from '@/modules/subscription/plans'
import type { SubscriptionPeriod } from '@/modules/subscription/constants'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

/**
 * GET /api/superadmin/subscription/pricing
 * Precios editables de los 4 planes + paquete de facturas DIAN, para el
 * editor de Superadmin (ver /superadmin/settings/subscription-plans).
 */
export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: planRows, error: planError } = await admin
    .from('subscription_plan_prices')
    .select('plan_id, price_3_months, price_6_months, price_1_year')

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 })
  }

  const { data: pack, error: packError } = await admin
    .from('invoice_pack_settings')
    .select('quantity, price')
    .eq('id', 1)
    .maybeSingle()

  if (packError) {
    return NextResponse.json({ error: packError.message }, { status: 500 })
  }

  // Siempre devuelve los 4 planes (en el orden de SUBSCRIPTION_PLANS),
  // aunque alguno no tenga fila todavía en BD -- el editor necesita verlos
  // todos para poder crearlos/corregirlos.
  const byId = new Map((planRows ?? []).map((r) => [r.plan_id, r]))
  const plans = SUBSCRIPTION_PLANS.map((plan) => {
    const row = byId.get(plan.id)
    return {
      plan_id: plan.id,
      name: plan.name,
      price_3_months: row ? Number(row.price_3_months) : plan.prices['3_months'],
      price_6_months: row ? Number(row.price_6_months) : plan.prices['6_months'],
      price_1_year:   row ? Number(row.price_1_year)   : plan.prices['1_year'],
    }
  })

  return NextResponse.json({
    plans,
    invoicePack: pack ?? { quantity: 20, price: 300_000 },
  })
}

type PlanPriceInput = {
  plan_id: string
  price_3_months: number
  price_6_months: number
  price_1_year: number
}

/**
 * PUT /api/superadmin/subscription/pricing
 * Body: { plans: PlanPriceInput[], invoicePack: { quantity: number, price: number } }
 * Guarda los precios de los 4 planes y del paquete de facturas DIAN.
 */
export async function PUT(request: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as {
    plans?: PlanPriceInput[]
    invoicePack?: { quantity: number; price: number }
  } | null

  if (!body?.plans || !Array.isArray(body.plans)) {
    return NextResponse.json({ error: 'plans es requerido' }, { status: 400 })
  }

  const periods: SubscriptionPeriod[] = ['3_months', '6_months', '1_year']
  for (const plan of body.plans) {
    if (!isPlanId(plan.plan_id)) {
      return NextResponse.json({ error: `plan_id inválido: ${plan.plan_id}` }, { status: 400 })
    }
    for (const field of ['price_3_months', 'price_6_months', 'price_1_year'] as const) {
      const value = plan[field]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return NextResponse.json(
          { error: `Precio inválido para ${plan.plan_id} (${field})` },
          { status: 400 }
        )
      }
    }
  }
  void periods // usado solo para documentar el tipo esperado arriba

  const admin = createAdminClient()

  for (const plan of body.plans) {
    const { error } = await admin
      .from('subscription_plan_prices')
      .upsert({
        plan_id: plan.plan_id as PlanId,
        price_3_months: plan.price_3_months,
        price_6_months: plan.price_6_months,
        price_1_year: plan.price_1_year,
        updated_at: new Date().toISOString(),
      })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (body.invoicePack) {
    const { quantity, price } = body.invoicePack
    if (
      typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 ||
      typeof price !== 'number' || !Number.isFinite(price) || price < 0
    ) {
      return NextResponse.json({ error: 'Cantidad o precio del paquete DIAN inválido' }, { status: 400 })
    }
    const { error } = await admin
      .from('invoice_pack_settings')
      .upsert({ id: 1, quantity, price, updated_at: new Date().toISOString() })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
