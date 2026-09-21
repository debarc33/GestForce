import { createAdminClient } from '@/lib/supabase/admin'
import { getActivePaymentProvider } from '@/services/payment-provider'
import Stripe from 'stripe'
import {
  PERIOD_LABELS,
  type SubscriptionPeriod,
} from '@/modules/subscription/constants'
import { getPlan, getPlanPriceCOP } from '@/modules/subscription/plans'

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
 *
 * `planId` es opcional: si no se especifica (ej. el checkout rápido de
 * superadmin, que todavía no tiene selector de plan en su UI), se usa el
 * plan actual de la empresa (`companies.plan_id`), o el plan por defecto
 * (DEFAULT_PLAN_ID) si la empresa tampoco tiene uno asignado.
 */
export async function createSubscriptionCheckout(opts: {
  companyId: string
  subscriptionPeriod: SubscriptionPeriod
  planId?: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const { companyId, subscriptionPeriod, successUrl, cancelUrl } = opts

  // Obtener información de la empresa
  const admin = createAdminClient()
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, email, subscription_end, plan_id')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { ok: false, status: 404, error: 'Company not found' }
  }

  // Plan a cobrar: el que se pasó explícitamente, o el plan actual de la
  // empresa, o el plan por defecto -- getPlan() ya resuelve ese último caso.
  const plan = getPlan(opts.planId ?? company.plan_id)
  const priceCOP = getPlanPriceCOP(plan.id, subscriptionPeriod)

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
        amount: priceCOP,
        currency: 'COP',
        subscription_period: subscriptionPeriod,
        plan_id: plan.id,
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
              name: `Suscripción GestForce - ${plan.name} - ${company.name}`,
              description: `Período: ${PERIOD_LABELS[subscriptionPeriod]}`,
            },
            unit_amount: priceCOP,
          },
          quantity: 1,
        },
      ],
      metadata: {
        company_id: companyId,
        order_id: paymentOrder.id,
        subscription_period: subscriptionPeriod,
        plan_id: plan.id,
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

    const boldTransaction = await boldModule.createBoldTransaction({
      amount: priceCOP,
      currency: 'COP',
      description: `Suscripción GestForce - Plan ${plan.name} - ${company.name}`,
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
        plan_id: plan.id,
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

/**
 * Cargo de prueba muy pequeño ($3.000 COP) para validar de punta a punta la
 * integracion con Bold (llave de identidad + webhook) con dinero real pero
 * minimo. Se modela igual que createInvoicePackCheckout: una fila en
 * one_time_purchases (kind: 'test_payment'), sin tocar el plan ni las
 * fechas de suscripcion de la empresa -- es puramente una prueba de la
 * pasarela, no una compra ni una renovacion real.
 */
export async function createTestPaymentCheckout(opts: {
  companyId: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const { companyId, successUrl, cancelUrl } = opts

  const TEST_PAYMENT_AMOUNT_COP = 3_000

  const admin = createAdminClient()
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, email')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { ok: false, status: 404, error: 'Company not found' }
  }

  const provider = await getActivePaymentProvider()
  if (!provider) {
    return { ok: false, status: 500, error: 'No payment provider configured' }
  }

  const { data: purchase, error: purchaseError } = await admin
    .from('one_time_purchases')
    .insert([
      {
        company_id: companyId,
        kind: 'test_payment',
        quantity: 1,
        amount: TEST_PAYMENT_AMOUNT_COP,
        currency: 'COP',
        payment_status: 'pending',
        provider: provider.name,
      },
    ])
    .select()
    .single()

  if (purchaseError || !purchase) {
    return { ok: false, status: 500, error: 'Failed to create test purchase order' }
  }

  let checkoutUrl = ''

  if (provider.name === 'bold') {
    const boldModule = await import('@/services/bold')

    const boldTransaction = await boldModule.createBoldTransaction({
      amount: TEST_PAYMENT_AMOUNT_COP,
      currency: 'COP',
      description: `Pago de prueba (integracion Bold) - ${company.name}`,
      reference: purchase.id,
      customer: {
        email: company.email || undefined,
        name: company.name,
      },
      redirect_url: successUrl,
      metadata: {
        company_id: companyId,
        purchase_id: purchase.id,
        kind: 'test_payment',
      },
    })

    if (!boldTransaction) {
      const detail = boldModule.lastBoldError

      await admin
        .from('one_time_purchases')
        .update({
          payment_status: 'failed',
          provider_response: { error: detail || 'Failed to create Bold transaction' },
        })
        .eq('id', purchase.id)

      return {
        ok: false,
        status: 500,
        error: `Failed to create Bold transaction${detail ? ` -- ${detail}` : ' (sin detalle adicional)'}`,
      }
    }

    checkoutUrl = boldTransaction.payment_url || ''

    await admin
      .from('one_time_purchases')
      .update({ provider_id: boldTransaction.id })
      .eq('id', purchase.id)
  } else {
    return {
      ok: false,
      status: 501,
      error: `Pago de prueba no soportado todavia con el proveedor "${provider.name}"`,
    }
  }

  return { ok: true, sessionUrl: checkoutUrl, orderId: purchase.id }
}

/**
 * Orquesta la compra única (no recurrente) del paquete de facturas
 * electrónicas DIAN. A diferencia de createSubscriptionCheckout, no toca
 * `payment_orders` ni `company_modules` ni las fechas de suscripción --
 * solo registra la compra en `one_time_purchases`. Todavía NO lleva la
 * cuenta de cuántas facturas quedan disponibles (queda pendiente, ver
 * claude/estado-proyecto.md).
 */
export async function createInvoicePackCheckout(opts: {
  companyId: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const { companyId, successUrl, cancelUrl } = opts
  const { DIAN_INVOICE_PACK } = await import('@/modules/subscription/plans')

  const admin = createAdminClient()
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, email')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { ok: false, status: 404, error: 'Company not found' }
  }

  const provider = await getActivePaymentProvider()
  if (!provider) {
    return { ok: false, status: 500, error: 'No payment provider configured' }
  }

  const { data: purchase, error: purchaseError } = await admin
    .from('one_time_purchases')
    .insert([
      {
        company_id: companyId,
        kind: 'dian_invoice_pack',
        quantity: DIAN_INVOICE_PACK.quantity,
        amount: DIAN_INVOICE_PACK.price,
        currency: 'COP',
        payment_status: 'pending',
        provider: provider.name,
      },
    ])
    .select()
    .single()

  if (purchaseError || !purchase) {
    return { ok: false, status: 500, error: 'Failed to create purchase order' }
  }

  let checkoutUrl = ''

  if (provider.name === 'bold') {
    const boldModule = await import('@/services/bold')

    const boldTransaction = await boldModule.createBoldTransaction({
      amount: DIAN_INVOICE_PACK.price,
      currency: 'COP',
      description: `Paquete de ${DIAN_INVOICE_PACK.quantity} facturas electrónicas DIAN - ${company.name}`,
      reference: purchase.id,
      customer: {
        email: company.email || undefined,
        name: company.name,
      },
      redirect_url: successUrl,
      metadata: {
        company_id: companyId,
        purchase_id: purchase.id,
        kind: 'dian_invoice_pack',
      },
    })

    if (!boldTransaction) {
      const detail = boldModule.lastBoldError

      await admin
        .from('one_time_purchases')
        .update({
          payment_status: 'failed',
          provider_response: { error: detail || 'Failed to create Bold transaction' },
        })
        .eq('id', purchase.id)

      return {
        ok: false,
        status: 500,
        error: `Failed to create Bold transaction${detail ? ` -- ${detail}` : ' (sin detalle adicional)'}`,
      }
    }

    checkoutUrl = boldTransaction.payment_url || ''

    await admin
      .from('one_time_purchases')
      .update({ provider_id: boldTransaction.id })
      .eq('id', purchase.id)
  } else {
    return {
      ok: false,
      status: 501,
      error: `Compra de facturas DIAN no soportada todavía con el proveedor "${provider.name}"`,
    }
  }

  return { ok: true, sessionUrl: checkoutUrl, orderId: purchase.id }
}
