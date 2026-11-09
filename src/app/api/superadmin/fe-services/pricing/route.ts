import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.is_superadmin !== true) return null
  return user
}

const CATEGORIES = ['servicio_gestion', 'paquete_facturas', 'plan_ilimitado'] as const
const BILLING_TYPES = ['unico', 'anual', 'mensual'] as const

type Category = (typeof CATEGORIES)[number]
type BillingType = (typeof BILLING_TYPES)[number]

type CatalogRow = {
  item_id: string
  category: Category
  label: string
  description: string | null
  billing_type: BillingType
  price: number
  quantity: number | null
  active: boolean
  /** 9 nov 2026 (migración 039): si el cliente puede pagar este ítem él
   *  mismo desde la plataforma (botón "Comprar" -> Bold), o si es solo
   *  informativo (se ve el precio pero sin botón de pago -- venta
   *  presencial, que es como opera Deisy hoy). */
  self_checkout: boolean
  sort_order: number
}

/**
 * GET /api/superadmin/fe-services/pricing
 *
 * Fase 1 de la nueva oferta de Facturación Electrónica (8 nov 2026, ver
 * claude/plan-accion-facturacion-dian.md Fase H): catálogo de los 8 ítems
 * vendibles por separado (3 servicios de gestión + 3 paquetes de facturas +
 * 2 planes ilimitados), para el editor de Superadmin
 * (/superadmin/settings/subscription-plans). Tabla nueva (fe_services_catalog,
 * migración 037) -- no toca invoice_pack_settings ni el checkout actual de
 * $300.000, que sigue intacto mientras no se decida lo contrario.
 */
export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('fe_services_catalog')
    .select('item_id, category, label, description, billing_type, price, quantity, active, self_checkout, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: (data ?? []) as CatalogRow[] })
}

type CatalogItemInput = {
  item_id: string
  price: number
  active: boolean
  self_checkout: boolean
}

/**
 * PUT /api/superadmin/fe-services/pricing
 * Body: { items: { item_id, price, active, self_checkout }[] }
 * Guarda precio, disponibilidad y si el cliente puede pagarlo él mismo
 * desde la plataforma (self_checkout, migración 039). No permite crear ni
 * borrar ítems desde aquí (los 8 ya están sembrados por la migración 037)
 * ni cambiar category/billing_type/quantity -- eso es estructura, no
 * precio, y cambiarlo a mano podría desalinear el ítem con lo que muestre
 * la pantalla de compra del cliente.
 */
export async function PUT(request: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as { items?: CatalogItemInput[] } | null

  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items es requerido' }, { status: 400 })
  }

  for (const item of body.items) {
    if (typeof item.item_id !== 'string' || !item.item_id) {
      return NextResponse.json({ error: 'item_id inválido' }, { status: 400 })
    }
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) {
      return NextResponse.json({ error: `Precio inválido para ${item.item_id}` }, { status: 400 })
    }
    if (typeof item.active !== 'boolean') {
      return NextResponse.json({ error: `Valor de "activo" inválido para ${item.item_id}` }, { status: 400 })
    }
    if (typeof item.self_checkout !== 'boolean') {
      return NextResponse.json({ error: `Valor de "pago en línea" inválido para ${item.item_id}` }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  for (const item of body.items) {
    const { error } = await admin
      .from('fe_services_catalog')
      .update({
        price: item.price,
        active: item.active,
        self_checkout: item.self_checkout,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', item.item_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
