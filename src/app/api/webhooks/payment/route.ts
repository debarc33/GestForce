import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/services/email'
import { getAllPaymentProviders } from '@/services/payment-provider'
import Stripe from 'stripe'

/**
 * Webhook agnóstico para manejar pagos de múltiples proveedores
 * - Stripe: `/api/webhooks/payment` con stripe-signature header
 * - Bold: `/api/webhooks/payment` con X-Bold-Signature header
 * - Wompi: `/api/webhooks/payment` con X-Wompi-Signature header
 */
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const stripeSignature = request.headers.get('stripe-signature')
    const boldSignature = request.headers.get('x-bold-signature')
    const wompiSignature = request.headers.get('x-wompi-signature')

    const admin = createAdminClient()
    const providers = await getAllPaymentProviders()

    // Determinar cuál proveedor envió el webhook
    let eventData: any = null
    let providerName = ''

    // ────────────────────────────────────────────────────────────────
    // STRIPE
    // ────────────────────────────────────────────────────────────────
    if (stripeSignature) {
      const stripeProvider = providers.find((p) => p.name === 'stripe')
      if (!stripeProvider || !stripeProvider.webhook_secret) {
        return NextResponse.json(
          { error: 'Stripe not configured' },
          { status: 400 }
        )
      }

      const stripe = new Stripe(stripeProvider.config.secret_key || '', {
        apiVersion: '2023-10-16',
      })

      try {
        const event = stripe.webhooks.constructEvent(
          body,
          stripeSignature,
          stripeProvider.webhook_secret
        )

        providerName = 'stripe'
        eventData = event
      } catch (error) {
        console.error('Stripe signature verification failed:', error)
        return NextResponse.json(
          { error: 'Invalid Stripe signature' },
          { status: 400 }
        )
      }
    }

    // ────────────────────────────────────────────────────────────────
    // BOLD
    // ────────────────────────────────────────────────────────────────
    else if (boldSignature) {
      const boldProvider = providers.find((p) => p.name === 'bold')
      if (!boldProvider || !boldProvider.webhook_secret) {
        return NextResponse.json(
          { error: 'Bold not configured' },
          { status: 400 }
        )
      }

      // Verificar firma de Bold
      const { verifyBoldWebhookSignature, parseBoldWebhookEvent } = await import(
        '@/services/bold'
      )

      const isValid = await verifyBoldWebhookSignature(body, boldSignature)
      if (!isValid) {
        console.error('Bold webhook signature verification failed')
        return NextResponse.json(
          { error: 'Invalid Bold signature' },
          { status: 400 }
        )
      }

      try {
        eventData = parseBoldWebhookEvent(body)
        if (!eventData) {
          return NextResponse.json(
            { error: 'Invalid Bold webhook event' },
            { status: 400 }
          )
        }
        providerName = 'bold'
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
      }
    }

    // ────────────────────────────────────────────────────────────────
    // WOMPI
    // ────────────────────────────────────────────────────────────────
    else if (wompiSignature) {
      const wompiProvider = providers.find((p) => p.name === 'wompi')
      if (!wompiProvider || !wompiProvider.webhook_secret) {
        return NextResponse.json(
          { error: 'Wompi not configured' },
          { status: 400 }
        )
      }

      // TODO: Implementar verificación de firma de Wompi
      // Por ahora, aceptar sin verificación (INSEGURO - solo para desarrollo)
      try {
        eventData = JSON.parse(body)
        providerName = 'wompi'
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
      }
    } else {
      return NextResponse.json(
        { error: 'Unknown payment provider' },
        { status: 400 }
      )
    }

    // ────────────────────────────────────────────────────────────────
    // Procesar según proveedor
    // ────────────────────────────────────────────────────────────────

    if (providerName === 'stripe') {
      return handleStripeWebhook(eventData, admin)
    } else if (providerName === 'bold') {
      return handleBoldWebhook(eventData, admin)
    } else if (providerName === 'wompi') {
      return handleWompiWebhook(eventData, admin)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// ──────────────────────────────────────────────────────────────────
// HANDLERS POR PROVEEDOR
// ──────────────────────────────────────────────────────────────────

async function handleStripeWebhook(event: any, admin: any) {
  if (event.type === 'charge.succeeded') {
    const charge = event.data.object as Stripe.Charge

    const sessionId = charge.payment_intent as string
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    })

    const session = await stripe.checkout.sessions.retrieve(sessionId as string, {
      expand: ['payment_intent'],
    })

    const metadata = session.metadata as {
      company_id?: string
      order_id?: string
      subscription_period?: string
    }

    if (!metadata.company_id || !metadata.order_id) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    return processPaymentSuccess(
      admin,
      metadata.order_id,
      metadata.company_id,
      metadata.subscription_period,
      charge.amount / 100,
      event.id,
      charge
    )
  }

  if (event.type === 'charge.failed') {
    const charge = event.data.object as Stripe.Charge

    const sessionId = charge.payment_intent as string
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    })

    const session = await stripe.checkout.sessions.retrieve(sessionId as string, {
      expand: ['payment_intent'],
    })

    const metadata = session.metadata as {
      company_id?: string
      order_id?: string
    }

    if (metadata.order_id) {
      await admin
        .from('payment_orders')
        .update({
          payment_status: 'failed',
          provider_response: charge as unknown as Record<string, unknown>,
        })
        .eq('id', metadata.order_id)

      await admin.from('payment_events').insert([
        {
          order_id: metadata.order_id,
          event_type: 'payment_failed',
          provider_event_id: event.id,
          provider_event_data: charge as unknown as Record<string, unknown>,
        },
      ])
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ received: true })
}

async function handleBoldWebhook(event: any, admin: any) {
  const { mapBoldStatus } = await import('@/services/bold')

  // Bold event structure: { id, event_type, transaction_id, reference, status, amount, ... }
  const eventType = event.event_type || ''
  const transactionId = event.transaction_id
  const reference = event.reference // order_id
  const boldStatus = event.status

  // Solo procesar eventos de pago completado o fallido
  if (!eventType.includes('success') && !eventType.includes('failed')) {
    console.log('Ignoring Bold event:', eventType)
    return NextResponse.json({ received: true })
  }

  if (!reference || !transactionId) {
    console.error('Missing reference or transaction_id in Bold event')
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  // Obtener la orden de pago
  const { data: paymentOrder } = await admin
    .from('payment_orders')
    .select('id, company_id, amount, subscription_period')
    .eq('id', reference)
    .single()

  if (!paymentOrder) {
    console.error('Payment order not found:', reference)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const paymentStatus = mapBoldStatus(boldStatus)

  if (paymentStatus === 'completed') {
    return processPaymentSuccess(
      admin,
      paymentOrder.id,
      paymentOrder.company_id,
      paymentOrder.subscription_period,
      paymentOrder.amount,
      event.id,
      event
    )
  } else if (paymentStatus === 'failed') {
    await admin
      .from('payment_orders')
      .update({
        payment_status: 'failed',
        provider_response: event as unknown as Record<string, unknown>,
      })
      .eq('id', paymentOrder.id)

    await admin.from('payment_events').insert([
      {
        order_id: paymentOrder.id,
        event_type: 'payment_failed',
        provider_event_id: event.id,
        provider_event_data: event as unknown as Record<string, unknown>,
      },
    ])

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ received: true })
}

async function handleWompiWebhook(event: any, admin: any) {
  // TODO: Implementar manejo de webhooks de Wompi
  // Estructura esperada: { event, data: { transaction: { ... } } }
  console.log('Wompi webhook received:', event)
  return NextResponse.json({ received: true })
}

// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────

async function processPaymentSuccess(
  admin: any,
  orderId: string,
  companyId: string,
  subscriptionPeriod: string | undefined,
  amount: number,
  eventId: string,
  providerData: any
) {
  // Actualizar estado del pago
  await admin
    .from('payment_orders')
    .update({
      payment_status: 'completed',
      completed_at: new Date().toISOString(),
      provider_response: providerData as unknown as Record<string, unknown>,
    })
    .eq('id', orderId)

  // Fecha base del nuevo período: si la suscripción actual aún no ha vencido
  // (p. ej. el cliente paga durante el trial), el período pagado arranca al
  // vencer la suscripción actual para no perder los días restantes. Si ya
  // venció, arranca hoy.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: currentCompany } = await admin
    .from('companies')
    .select('subscription_end')
    .eq('id', companyId)
    .single()

  let baseDate = today
  if (currentCompany?.subscription_end) {
    const currentEnd = new Date(currentCompany.subscription_end + 'T00:00:00')
    if (currentEnd.getTime() > today.getTime()) {
      baseDate = currentEnd
    }
  }

  const newStart = new Date(baseDate)
  const newExpiry = new Date(baseDate)

  if (subscriptionPeriod === '3_months') {
    newExpiry.setMonth(newExpiry.getMonth() + 3)
  } else if (subscriptionPeriod === '6_months') {
    newExpiry.setMonth(newExpiry.getMonth() + 6)
  } else if (subscriptionPeriod === '1_year') {
    newExpiry.setFullYear(newExpiry.getFullYear() + 1)
  }

  // Actualizar empresa
  const { data: company } = await admin
    .from('companies')
    .update({
      subscription_status: 'active',
      subscription_end: newExpiry.toISOString().split('T')[0],
      subscription_start: newStart.toISOString().split('T')[0],
      subscription_period: subscriptionPeriod,
    })
    .eq('id', companyId)
    .select()
    .single()

  // Registrar evento
  await admin.from('payment_events').insert([
    {
      order_id: orderId,
      event_type: 'payment_completed',
      provider_event_id: eventId,
      provider_event_data: providerData as unknown as Record<string, unknown>,
    },
  ])

  // Enviar email de confirmación
  if (company) {
    try {
      await sendEmail({
        to: company.email || 'support@gestforce.com',
        template: 'payment_completed',
        data: {
          company_name: company.name,
          owner_name: company.legal_name || company.name,
          amount,
          period: subscriptionPeriod,
          expiry_date: newExpiry.toISOString(),
        },
      })
    } catch (emailError) {
      console.error('Failed to send payment confirmation email:', emailError)
    }
  }

  return NextResponse.json({ success: true })
}
