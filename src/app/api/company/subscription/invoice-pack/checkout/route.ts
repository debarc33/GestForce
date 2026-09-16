import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { createInvoicePackCheckout } from '@/services/subscription-checkout'

/**
 * POST /api/company/subscription/invoice-pack/checkout
 * Inicia el pago de una compra única del paquete de facturas electrónicas
 * DIAN (20 facturas x $300.000, ver DIAN_INVOICE_PACK en
 * src/modules/subscription/plans.ts). No es una suscripción -- no cambia
 * subscription_period/plan_id ni company_modules.
 * Body: { companyId: string }
 * Solo admins de la empresa.
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId } = (await req.json()) as { companyId?: string }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    const auth = await requireCompanyAdmin(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const result = await createInvoicePackCheckout({
      companyId,
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
    console.error('Invoice pack checkout error:', error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago del paquete de facturas' },
      { status: 500 }
    )
  }
}
