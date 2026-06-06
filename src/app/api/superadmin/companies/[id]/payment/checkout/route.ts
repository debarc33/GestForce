import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActivePaymentProvider } from '@/services/payment-provider'
import Stripe from 'stripe'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

// Precios configurables (en centavos)
const PRICES = {
  '3_months': 29900,    // $299 COP (3 months)
  '6_months': 49900,    // $499 COP (6 months) - 15% descuento
  '1_year': 79900,      // $799 COP (1 year) - 20% descuento
}

const PRICE_LABELS = {
  '3_months': '3 meses',
  '6_months': '6 meses',
  '1_year': '1 año',
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

    if (!subscription_period || !Object.keys(PRICES).includes(subscription_period)) {
      return NextResponse.json(
        { error: 'Invalid subscription_period' },
        { status: 400 }
      )
    }

    // Obtener información de la empresa
    const admin = createAdminClient()
    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('id, name, email, subscription_end')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Calcular fechas
    const billingStartDate = new Date()
    const billingEndDate = new Date(billingStartDate)

    if (subscription_period === '3_months') {
      billingEndDate.setMonth(billingEndDate.getMonth() + 3)
    } else if (subscription_period === '6_months') {
      billingEndDate.setMonth(billingEndDate.getMonth() + 6)
    } else if (subscription_period === '1_year') {
      billingEndDate.setFullYear(billingEndDate.getFullYear() + 1)
    }

    // Obtener proveedor de pago activo
    const provider = await getActivePaymentProvider()
    if (!provider) {
      return NextResponse.json(
        { error: 'No payment provider configured' },
        { status: 500 }
      )
    }

    // Crear registro de orden de pago en BD
    const { data: paymentOrder, error: orderError } = await admin
      .from('payment_orders')
      .insert([
        {
          company_id: companyId,
          amount: PRICES[subscription_period as keyof typeof PRICES] / 100,
          currency: 'COP',
          subscription_period,
          billing_start_date: billingStartDate.toISOString().split('T')[0],
          billing_end_date: billingEndDate.toISOString().split('T')[0],
          payment_status: 'pending',
          provider: provider.name,
        },
      ])
      .select()
      .single()

    if (orderError || !paymentOrder) {
      return NextResponse.json(
        { error: 'Failed to create payment order' },
        { status: 500 }
      )
    }

    let checkoutUrl = ''

    // Procesar según el proveedor activo
    if (provider.name === 'stripe') {
      const stripe = new Stripe(provider.config.secret_key || '', {
        apiVersion: '2024-04-10',
      })

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: company.email || undefined,
        line_items: [
          {
            price_data: {
              currency: 'cop',
              product_data: {
                name: `Suscripción GestForce - ${company.name}`,
                description: `Período: ${PRICE_LABELS[subscription_period as keyof typeof PRICE_LABELS]}`,
              },
              unit_amount: PRICES[subscription_period as keyof typeof PRICES],
            },
            quantity: 1,
          },
        ],
        metadata: {
          company_id: companyId,
          order_id: paymentOrder.id,
          subscription_period,
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/superadmin/companies/${companyId}?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/superadmin/companies/${companyId}?payment=cancelled`,
      })

      checkoutUrl = session.url || ''

      // Actualizar orden con Stripe session ID
      await admin
        .from('payment_orders')
        .update({ provider_id: session.id })
        .eq('id', paymentOrder.id)
    } else if (provider.name === 'bold') {
      const { createBoldTransaction } = await import('@/services/bold')

      const boldTransaction = await createBoldTransaction({
        amount: PRICES[subscription_period as keyof typeof PRICES],
        currency: 'COP',
        description: `Suscripción GestForce - ${company.name}`,
        reference: paymentOrder.id,
        customer: {
          email: company.email || undefined,
          name: company.name,
        },
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/superadmin/companies/${companyId}/subscription?payment=success`,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/payment`,
        metadata: {
          company_id: companyId,
          order_id: paymentOrder.id,
          subscription_period,
        },
      })

      if (!boldTransaction) {
        return NextResponse.json(
          { error: 'Failed to create Bold transaction' },
          { status: 500 }
        )
      }

      checkoutUrl = boldTransaction.payment_url || ''

      // Actualizar orden con Bold transaction ID
      await admin
        .from('payment_orders')
        .update({ provider_id: boldTransaction.id })
        .eq('id', paymentOrder.id)
    } else if (provider.name === 'wompi') {
      // TODO: Implementar Wompi checkout
      // Usar provider.config.public_key y provider.config.private_key
      return NextResponse.json(
        { error: 'Wompi payment provider not yet implemented in checkout' },
        { status: 501 }
      )
    } else {
      return NextResponse.json(
        { error: 'Unknown payment provider' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      sessionUrl: checkoutUrl,
      orderId: paymentOrder.id,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
