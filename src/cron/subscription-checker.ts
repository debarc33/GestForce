import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/services/email'

/**
 * Check for expired and expiring subscriptions
 * Corre diariamente a las 2 AM UTC
 */
export async function checkSubscriptions() {
  const admin = createAdminClient()

  try {
    // 1. Detectar suscripciones vencidas
    const today = new Date().toISOString().split('T')[0]

    const { data: expiredCompanies } = await admin
      .from('companies')
      .select('id, name, email, subscription_end')
      .eq('subscription_status', 'active')
      .lt('subscription_end', today)

    if (expiredCompanies && expiredCompanies.length > 0) {
      // Cambiar estado a 'expired'
      await admin
        .from('companies')
        .update({ subscription_status: 'expired' })
        .in(
          'id',
          expiredCompanies.map((c) => c.id)
        )

      // Enviar email a cada empresa
      for (const company of expiredCompanies) {
        try {
          await sendEmail({
            to: company.email || 'support@gestforce.com',
            template: 'subscription_expired',
            data: {
              company_name: company.name,
              owner_name: company.name,
              checkout_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/superadmin/companies/${company.id}/payment`,
            },
          })
        } catch (emailError) {
          console.error(`Failed to send expired email to ${company.email}:`, emailError)
        }
      }

      console.log(`[Subscription Checker] ${expiredCompanies.length} subscriptions expired`)
    }

    return {
      success: true,
      expired: expiredCompanies?.length || 0,
    }
  } catch (error) {
    console.error('[Subscription Checker] Error:', error)
    throw error
  }
}

/**
 * Send reminders for subscriptions expiring soon (7 days)
 * Corre diariamente a las 8 AM UTC
 */
export async function sendExpiryReminders() {
  const admin = createAdminClient()

  try {
    const today = new Date()
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const { data: expiringCompanies } = await admin
      .from('companies')
      .select('id, name, email, subscription_end')
      .eq('subscription_status', 'active')
      .gte('subscription_end', todayStr)
      .lte('subscription_end', sevenDaysFromNow)

    if (expiringCompanies && expiringCompanies.length > 0) {
      // Enviar email a cada empresa
      for (const company of expiringCompanies) {
        try {
          await sendEmail({
            to: company.email || 'support@gestforce.com',
            template: 'trial_expiring',
            data: {
              company_name: company.name,
              owner_name: company.name,
              expiry_date: company.subscription_end,
              checkout_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/superadmin/companies/${company.id}/payment`,
            },
          })
        } catch (emailError) {
          console.error(`Failed to send expiry reminder to ${company.email}:`, emailError)
        }
      }

      console.log(`[Expiry Reminders] ${expiringCompanies.length} reminders sent`)
    }

    return {
      success: true,
      reminded: expiringCompanies?.length || 0,
    }
  } catch (error) {
    console.error('[Expiry Reminders] Error:', error)
    throw error
  }
}
