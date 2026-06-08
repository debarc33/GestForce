import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/services/email'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      )
    }

    // Verificar firma del webhook
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Manejar diferentes tipos de eventos
    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge

      // Obtener información de la sesión
      const sessionId = charge.payment_intent as string
      const session = await stripe.checkout.sessions.retrieve(sessionId as string, {
        expand: ['payment_intent'],
      })

      const metadata = session.metadata as {
        company_id?: string
        order_id?: string
        subscription_period?: string
      }

      if (!metadata.company_id || !metadata.order_id) {
        console.error('Missing metadata in charge:', charge.id)
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      const { company_id, order_id, subscription_period } = metadata

      // Actualizar estado del pago
      await admin
        .from('payment_orders')
        .update({
          payment_status: 'completed',
          completed_at: new Date().toISOString(),
          provider_response: charge as unknown as Record<string, unknown>,
        })
        .eq('id', order_id)

      // Calcular nueva fecha de vencimiento
      const today = new Date()
      const newExpiry = new Date(today)

      if (subscription_period === '3_months') {
        newExpiry.setMonth(newExpiry.getMonth() + 3)
      } else if (subscription_period === '6_months') {
        newExpiry.setMonth(newExpiry.getMonth() + 6)
      } else if (subscription_period === '1_year') {
        newExpiry.setFullYear(newExpiry.getFullYear() + 1)
      }

      // Actualizar empresa
      const { data: company } = await admin
        .from('companies')
        .update({
          subscription_status: 'active',
          subscription_end: newExpiry.toISOString().split('T')[0],
          subscription_start: today.toISOString().split('T')[0],
          subscription_period: subscription_period,
        })
        .eq('id', company_id)
        .select()
        .single()

      // Registrar evento
      await admin.from('payment_events').insert([
        {
          order_id,
          event_type: 'payment_completed',
          provider_event_id: event.id,
          provider_event_data: event.data.object as unknown as Record<string, unknown>,
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
              amount: charge.amount / 100,
              period: subscription_period,
              expiry_date: newExpiry.toISOString(),
            },
          })
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError)
          // No fallar si el email falla
        }
      }

      return NextResponse.json({ success: true })
    }

    if (event.type === 'charge.failed') {
      const charge = event.data.object as Stripe.Charge

      // Obtener información de la sesión
      const sessionId = charge.payment_intent as string
      const session = await stripe.checkout.sessions.retrieve(sessionId as string, {
        expand: ['payment_intent'],
      })

      const metadata = session.metadata as {
        company_id?: string
        order_id?: string
      }

      if (metadata.order_id) {
        // Actualizar estado del pago
        await admin
          .from('payment_orders')
          .update({
            payment_status: 'failed',
            provider_response: charge as unknown as Record<string, unknown>,
          })
          .eq('id', metadata.order_id)

        // Registrar evento
        await admin.from('payment_events').insert([
          {
            order_id: metadata.order_id,
            event_type: 'payment_failed',
            provider_event_id: event.id,
            provider_event_data: event.data.object as unknown as Record<string, unknown>,
          },
        ])
      }

      return NextResponse.json({ success: true })
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
