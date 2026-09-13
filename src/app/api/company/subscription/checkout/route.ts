import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { createSubscriptionCheckout } from '@/services/subscription-checkout'
import { isSubscriptionPeriod } from '@/modules/subscription/constants'

/**
 * POST /api/company/subscription/checkout
 * Inicia el pago de renovación/cambio de plan de la empresa.
 * Body: { companyId: string, subscription_period: '3_months' | '6_months' | '1_year' }
 * Solo admins de la empresa. El pago se procesa en la pasarela externa (Bold).
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, subscription_period } = (await req.json()) as {
      companyId?: string
      subscription_period?: string
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
