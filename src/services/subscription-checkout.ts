import { createAdminClient } from '@/lib/supabase/admin'
import { getActivePaymentProvider } from '@/services/payment-provider'
import Stripe from 'stripe'
import {
  SUBSCRIPTION_PRICES, PERIOD_LABELS,
  type SubscriptionPeriod,
} from '@/modules/subscription/constants'

export type CheckoutResult =
  | { ok: true; sessionUrl: string; orderId: string }
  | { ok: false; status: number; error: string }

/**
 * Orquesta el checkout de una suscripción: crea la payment_order y la sesión
 * de pago en el proveedor activo (Stripe/Bold). Extraído del checkout de
 * superadmin para reutilizarlo también desde el flujo de empresa.
 *
 * El llamador es responsable de la AUTORIZACIÓN (superadmin o admin de la
 * empresa) antes de invocar esta función.
 */
export async function createSubscriptionCheckout(opts: {
  companyId: string
  subscriptionPeriod: SubscriptionPeriod
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const { companyId, subscriptionPeriod, successUrl, cancelUrl } = opts

  // Obtener información de la empresa
  const admin = createAdminClient()
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, email, subscription_end')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { ok: false, status: 404, error: 'Company not found' }
  }

  // Calcular fechas
  const billingStartDate = new Date()
  const billingEndDate = new Date(billingStartDate)

  if (subscriptionPeriod === '3_months') {
    billingEndDate.setMonth(billingEndDate.getMonth() + 3)
  } else if (subscriptionPeriod === '6_months') {
    billingEndDate.setMonth(billingEndDate.getMonth() + 6)
  } else if (subscriptionPeriod === '1_year') {
    billingEndDate.setFullYear(billingEndDate.getFullYear() + 1)
  }

  // Obtener proveedor de pago activo
  const provider = await getActivePaymentProvider()
  if (!provider) {
    return { ok: false, status: 500, error: 'No payment provider configured' }
  }

  // Crear registro de orden de pago en BD
  const { data: paymentOrder, error: orderError } = await admin
    .from('payment_orders')
    .insert([
      {
        company_id: companyId,
        amount: SUBSCRIPTION_PRICES[subscriptionPeriod] / 100,
        currency: 'COP',
        subscription_period: subscriptionPeriod,
        billing_start_date: billingStartDate.toISOString().split('T')[0],
        billing_end_date: billingEndDate.toISOString().split('T')[0],
        payment_status: 'pending',
        provider: provider.name,
      },
    ])
    .select()
    .single()

  if (orderError || !paymentOrder) {
    return { ok: false, status: 500, error: 'Failed to create payment order' }
  }

  let checkoutUrl = ''

  // Procesar según el proveedor activo
  if (provider.name === 'stripe') {
    const stripe = new Stripe(provider.config.secret_key || '', {
      apiVersion: '2023-10-16',
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
              description: `Período: ${PERIOD_LABELS[subscriptionPeriod]}`,
            },
            unit_amount: SUBSCRIPTION_PRICES[subscriptionPeriod],
          },
          quantity: 1,
        },
      ],
      metadata: {
        company_id: companyId,
        order_id: paymentOrder.id,
        subscription_period: subscriptionPeriod,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    checkoutUrl = session.url || ''

    // Actualizar orden con Stripe session ID
    await admin
      .from('payment_orders')
      .update({ provider_id: session.id })
      .eq('id', paymentOrder.id)
  } else if (provider.name === 'bold') {
    const boldModule = await import('@/services/bold')

    // Bold espera total_amount en PESOS enteros, no en "centavos" (la unidad
    // interna de SUBSCRIPTION_PRICES) -- por eso se divide entre 100 aqui.
    const boldTransaction = await boldModule.createBoldTransaction({
      amount: SUBSCRIPTION_PRICES[subscriptionPeriod] / 100,
      currency: 'COP',
      description: `Suscripción GestForce - ${company.name}`,
      reference: paymentOrder.id,
      customer: {
        email: company.email || undefined,
        name: company.name,
      },
      redirect_url: successUrl,
      metadata: {
        company_id: companyId,
        order_id: paymentOrder.id,
        subscription_period: subscriptionPeriod,
      },
    })

    if (!boldTransaction) {
      // TEMPORAL: se incluye el detalle real de Bold en el mensaje de error
      // para diagnostico. Se lee boldModule.lastBoldError DESPUES de llamar
      // createBoldTransaction (no destructurado antes, que capturaba el
      // valor viejo). Quitar este detalle del mensaje una vez que el pago
      // funcione (no debe llegar a produccion con detalle interno).
      const detail = boldModule.lastBoldError

      // La orden ya se creo en BD (arriba) antes de intentar Bold -- si no
      // se marca como failed aqui, se queda "pending" para siempre y
      // aparece como un intento fantasma en el historial de pagos.
      await admin
        .from('payment_orders')
        .update({
          payment_status: 'failed',
          provider_response: { error: detail || 'Failed to create Bold transaction' },
        })
        .eq('id', paymentOrder.id)

      return {
        ok: false,
        status: 500,
        error: `Failed to create Bold transaction${detail ? ` -- ${detail}` : ' (sin detalle adicional)'}`,
      }
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
    return { ok: false, status: 501, error: 'Wompi payment provider not yet implemented in checkout' }
  } else {
    return { ok: false, status: 400, error: 'Unknown payment provider' }
  }

  return { ok: true, sessionUrl: checkoutUrl, orderId: paymentOrder.id }
}
