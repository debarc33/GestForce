import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { createFeServiceCheckout } from '@/services/subscription-checkout'

/**
 * POST /api/company/subscription/fe-services/checkout
 *
 * Fase 2 de la nueva oferta de Facturación Electrónica (9 nov 2026, ver
 * claude/plan-accion-facturacion-dian.md Fase H): inicia el pago de
 * cualquier ítem ACTIVO del catálogo nuevo (fe_services_catalog, migración
 * 037) -- servicios de gestión, paquetes de facturas o planes ilimitados.
 * No es una suscripción recurrente -- cada compra es un cargo puntual (ver
 * createFeServiceCheckout en src/services/subscription-checkout.ts).
 * Body: { companyId: string, itemId: string }
 * Solo admins de la empresa (mismo patrón que invoice-pack/checkout).
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, itemId } = (await req.json()) as { companyId?: string; itemId?: string }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }
    if (!itemId) {
      return NextResponse.json({ error: 'itemId es requerido' }, { status: 400 })
    }

    const auth = await requireCompanyAdmin(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const result = await createFeServiceCheckout({
      companyId,
      itemId,
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
    console.error('FE service checkout error:', error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago del servicio' },
      { status: 500 }
    )
  }
}
