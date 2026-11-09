import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { createFeServiceCartCheckout } from '@/services/subscription-checkout'

/**
 * POST /api/company/subscription/fe-services/cart-checkout
 *
 * Fase 3 de la nueva oferta de Facturación Electrónica (9 nov 2026, ver
 * claude/plan-accion-facturacion-dian.md Fase H): igual que
 * /api/company/subscription/fe-services/checkout, pero para pagar VARIOS
 * ítems elegidos a la vez con un solo link de Bold (ver
 * createFeServiceCartCheckout en src/services/subscription-checkout.ts).
 * Body: { companyId: string, itemIds: string[] }
 * Solo admins de la empresa (mismo patrón que el checkout de un solo ítem).
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, itemIds } = (await req.json()) as { companyId?: string; itemIds?: string[] }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Debes seleccionar al menos un ítem' }, { status: 400 })
    }

    const auth = await requireCompanyAdmin(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const result = await createFeServiceCartCheckout({
      companyId,
      itemIds,
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
    console.error('FE service cart checkout error:', error)
    return NextResponse.json(
      { error: 'Error al iniciar el pago de los servicios seleccionados' },
      { status: 500 }
    )
  }
}
