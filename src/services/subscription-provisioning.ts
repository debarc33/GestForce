import { createAdminClient } from '@/lib/supabase/admin'
import { TOGGLEABLE_MODULES } from '@/config/modules'
import { getPlan } from '@/modules/subscription/plans'

/**
 * Aplica los módulos del plan comprado a `company_modules`. Se llama cuando
 * un pago de suscripción se confirma (webhook, processPaymentSuccess).
 *
 * Sobreescribe TODOS los módulos togglables: los incluidos en el plan
 * quedan `is_enabled = true`, el resto `is_enabled = false` -- mismo patrón
 * que ya usa el toggle manual de superadmin
 * (src/app/api/superadmin/companies/[id]/modules/route.ts), solo que ahora
 * lo dispara automáticamente el pago en vez de un clic manual.
 */
export async function provisionModulesForPlan(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  planId: string | null | undefined
): Promise<void> {
  const plan = getPlan(planId)
  const includedIds = new Set<string>(plan.modules)

  const rows = TOGGLEABLE_MODULES.map((m) => ({
    company_id: companyId,
    module_id: m.id,
    is_enabled: includedIds.has(m.id),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('company_modules')
    .upsert(rows, { onConflict: 'company_id,module_id' })

  if (error) {
    // No bloqueamos la confirmación del pago por esto -- el pago ya está
    // marcado como completado. Solo se registra para revisar manualmente
    // si hace falta (el superadmin siempre puede ajustar los módulos a mano
    // desde su panel).
    console.error('[provisionModulesForPlan] Error actualizando company_modules:', error.message)
  }
}
