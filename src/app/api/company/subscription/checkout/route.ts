import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { createSubscriptionCheckout } from '@/services/subscription-checkout'
import { isSubscriptionPeriod } from '@/modules/subscription/constants'
import { isPlanId } from '@/modules/subscription/plans'

/**
 * POST /api/company/subscription/checkout
 * Inicia el pago de renovación/cambio de plan de la empresa.
 * Body: { companyId: string, subscription_period: '3_months' | '6_months' | '1_year', plan_id?: string }
 * Solo admins de la empresa. El pago se procesa en la pasarela externa (Bold).
 * `plan_id` es opcional: si no se envía (o no es válido), createSubscriptionCheckout
 * usa el plan actual de la empresa o el plan por defecto.
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, subscription_period, plan_id } = (await req.json()) as {
      companyId?: string
      subscription_period?: string
      plan_id?: string
    }

    if (!companyId || !isSubscriptionPeriod(subscription_period)) {
      return NextResponse.json(
        { error: 'companyId y subscription_period válido son requeridos' },
        { status: 400 }
      )
    }

    const auth = await requireCompanyAdmin(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const result = await createSubscriptionCheckout({
      companyId,
      subscriptionPeriod: subscription_period,
      planId: isPlanId(plan_id) ? plan_id : undefined,
      successUrl: `${appUrl}/settings?payment=success`,
      cancelUrl: `${appUrl}/settings?payment=cancelled`,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      sessionUrl: result.sessionUrl,
      orderId: result.orderId,
    })
  } catch (error) {
    console.error('Company checkout error:', error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago' },
      { status: 500 }
    )
  }
}
