import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTestPaymentCheckout } from '@/services/subscription-checkout'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// Cargo de prueba muy pequeno ($3.000 COP) para validar la integracion de
// Bold de punta a punta (llave de identidad + webhook) sin afectar el plan
// ni la fecha de vencimiento de ninguna empresa real. Solo superadmin.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: companyId } = await params

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const result = await createTestPaymentCheckout({
      companyId,
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
    console.error('Test checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create test checkout session' },
      { status: 500 }
    )
  }
}
