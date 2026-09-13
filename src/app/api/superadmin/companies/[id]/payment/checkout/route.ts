import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSubscriptionCheckout } from '@/services/subscription-checkout'
import { isSubscriptionPeriod } from '@/modules/subscription/constants'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: companyId } = await params

  try {
    const { subscription_period } = (await request.json()) as {
      subscription_period?: string
    }

    if (!isSubscriptionPeriod(subscription_period)) {
      return NextResponse.json(
        { error: 'Invalid subscription_period' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const result = await createSubscriptionCheckout({
      companyId,
      subscriptionPeriod: subscription_period,
      successUrl: `${appUrl}/superadmin/companies/${companyId}/subscription?payment=success`,
      cancelUrl: `${appUrl}/superadmin/companies/${companyId}?payment=cancelled`,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      sessionUrl: result.sessionUrl,
      orderId: result.orderId,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
