import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyMember } from '@/lib/auth/require-company-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUBSCRIPTION_PLANS } from '@/modules/subscription/plans'
import { getLivePlanPrices, getLiveInvoicePack } from '@/modules/subscription/pricing-db'

/**
 * GET /api/company/subscription/pricing?companyId=...
 * Precios vigentes (editados desde Superadmin) de los 4 planes y del
 * paquete de facturas DIAN, para la pantalla de Suscripción del cliente.
 * Cualquier miembro de la empresa puede leerlo (no requiere rol admin --
 * es solo informativo). La tabla subscription_plan_prices tiene RLS
 * solo-superadmin, así que se lee con el admin client después de validar
 * membresía aquí, mismo patrón que el historial de pagos.
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    const auth = await requireCompanyMember(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = createAdminClient()
    const [livePrices, invoicePack] = await Promise.all([
      getLivePlanPrices(admin),
      getLiveInvoicePack(admin),
    ])

    const plans = SUBSCRIPTION_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      prices: livePrices[plan.id],
    }))

    return NextResponse.json({ plans, invoicePack })
  } catch (error) {
    console.error('Company subscription pricing error:', error)
    return NextResponse.json({ error: 'Error al cargar los precios' }, { status: 500 })
  }
}
