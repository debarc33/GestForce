import { createAdminClient } from '@/lib/supabase/admin'

export type PaymentProvider = {
  id: string
  name: string
  display_name: string
  is_active: boolean
  webhook_url: string | null
  webhook_secret: string | null
  config: Record<string, string>
}

/**
 * Obtiene el proveedor de pago activo
 */
export async function getActivePaymentProvider(): Promise<PaymentProvider | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('payment_providers')
      .select('id, name, display_name, is_active, webhook_url, webhook_secret, config')
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error getting active payment provider:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching payment provider:', error)
    return null
  }
}

/**
 * Obtiene todos los proveedores configurados
 */
export async function getAllPaymentProviders(): Promise<PaymentProvider[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('payment_providers')
      .select('id, name, display_name, is_active, webhook_url, webhook_secret, config')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error getting payment providers:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching payment providers:', error)
    return []
  }
}
