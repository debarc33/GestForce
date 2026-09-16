import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/require-company-admin'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/company/subscription/payments?companyId=...
 * Historial de pagos de suscripción de la empresa.
 * Solo admins de la empresa. Se lee con service role (la RLS de
 * payment_orders es solo-superadmin) exponiendo únicamente columnas seguras —
 * nunca provider_response ni provider_id.
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 })
    }

    const auth = await requireCompanyAdmin(companyId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('payment_orders')
      .select('id, amount, currency, subscription_period, plan_id, billing_start_date, billing_end_date, payment_status, completed_at, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching company payments:', error)
      return NextResponse.json({ error: 'Error al cargar el historial de pagos' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Company payments error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
