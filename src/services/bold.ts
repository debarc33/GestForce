/**
 * Servicio de Bold para procesamiento de pagos
 * Documentación: https://docs.bold.co/api/
 */

import { getActivePaymentProvider } from './payment-provider'

export type BoldCreateTransactionRequest = {
  amount: number // En centavos
  currency: string // 'COP'
  description: string
  reference: string // ID único de la orden
  customer?: {
    email?: string
    name?: string
  }
  redirect_url?: string
  webhook_url?: string
  metadata?: Record<string, any>
}

export type BoldTransaction = {
  id: string
  reference: string
  amount: number
  currency: string
  status: string // 'created', 'approved', 'rejected', 'pending', etc.
  payment_url?: string
  created_at: string
  updated_at?: string
}

export type BoldWebhookEvent = {
  id: string
  event_type: string // 'transaction.success', 'transaction.failed', etc.
  transaction_id: string
  reference: string
  status: string
  amount: number
  currency: string
  created_at: string
  timestamp: number
}

/**
 * Crear una transacción de pago en Bold
 */
export async function createBoldTransaction(
  payload: BoldCreateTransactionRequest
): Promise<BoldTransaction | null> {
  try {
    const provider = await getActivePaymentProvider()

    if (!provider || provider.name !== 'bold') {
      console.error('Bold is not the active payment provider')
      return null
    }

    const apiKey = provider.config?.api_key
    if (!apiKey) {
      console.error('Bold API key not configured')
      return null
    }

    const response = await fetch('https://api.bold.co/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: payload.amount,
        currency: payload.currency,
        description: payload.description,
        reference: payload.reference,
        customer: payload.customer,
        redirect_url: payload.redirect_url,
        webhook_url: payload.webhook_url,
        metadata: payload.metadata,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Bold API error:', response.status, error)
      return null
    }

    const data = await response.json()
    return data as BoldTransaction
  } catch (error) {
    console.error('Error creating Bold transaction:', error)
    return null
  }
}

/**
 * Obtener detalles de una transacción en Bold
 */
export async function getBoldTransaction(transactionId: string): Promise<BoldTransaction | null> {
  try {
    const provider = await getActivePaymentProvider()

    if (!provider || provider.name !== 'bold') {
      console.error('Bold is not the active payment provider')
      return null
    }

    const apiKey = provider.config?.api_key
    if (!apiKey) {
      console.error('Bold API key not configured')
      return null
    }

    const response = await fetch(`https://api.bold.co/v1/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      console.error('Bold API error:', response.status)
      return null
    }

    const data = await response.json()
    return data as BoldTransaction
  } catch (error) {
    console.error('Error fetching Bold transaction:', error)
    return null
  }
}

/**
 * Verificar firma del webhook de Bold
 * Bold envía un header X-Bold-Signature con HMAC-SHA256(body, secret)
 */
export async function verifyBoldWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  try {
    const provider = await getActivePaymentProvider()

    if (!provider || provider.name !== 'bold') {
      return false
    }

    const secret = provider.webhook_secret
    if (!secret) {
      console.error('Bold webhook secret not configured')
      return false
    }

    // Crear HMAC-SHA256
    const crypto = await import('crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body)
    const expectedSignature = hmac.digest('hex')

    return signature === expectedSignature
  } catch (error) {
    console.error('Error verifying Bold webhook signature:', error)
    return false
  }
}

/**
 * Parsear y validar webhook de Bold
 */
export function parseBoldWebhookEvent(body: string): BoldWebhookEvent | null {
  try {
    const event = JSON.parse(body) as BoldWebhookEvent

    // Validar que tenga los campos mínimos
    if (!event.id || !event.event_type || !event.transaction_id || !event.reference) {
      console.error('Invalid Bold webhook event structure')
      return null
    }

    return event
  } catch (error) {
    console.error('Error parsing Bold webhook event:', error)
    return null
  }
}

/**
 * Mapear estado de Bold a estado de transacción local
 */
export function mapBoldStatus(boldStatus: string): 'completed' | 'failed' | 'pending' {
  switch (boldStatus.toLowerCase()) {
    case 'approved':
    case 'success':
    case 'completed':
      return 'completed'

    case 'rejected':
    case 'failed':
    case 'error':
      return 'failed'

    case 'pending':
    case 'created':
    case 'processing':
    default:
      return 'pending'
  }
}
