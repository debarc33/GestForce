/**
 * Servicio de Bold para procesamiento de pagos
 *
 * Documentacion real usada para esta integracion (la API de Bold NO es la
 * misma que se asumio originalmente -- no existe "https://api.bold.co/v1/..."
 * ni autenticacion "Bearer"):
 *   - Crear link de pago: https://developers.bold.co/pagos-en-linea/api-link-de-pagos
 *   - Webhooks:           https://developers.bold.co/webhook
 *
 * Puntos clave de la API real de Bold (Link de pagos):
 *   - Endpoint: POST https://integrations.api.bold.co/online/link/v1
 *   - Auth:    header "Authorization: x-api-key <llave_de_identidad>"
 *              (NO es "Bearer <key>")
 *   - Body:    { amount_type: 'CLOSE', amount: { currency, total_amount, tip_amount },
 *                description, reference, callback_url }
 *              (total_amount va en PESOS enteros, no en centavos)
 *   - Response: { payload: { payment_link, url }, errors: [] }
 *   - No existe un campo webhook_url por transaccion: el webhook se
 *     configura una sola vez en el dashboard de Bold.
 *   - Firma de webhook: HMAC-SHA256 del cuerpo codificado en Base64
 *     (no del cuerpo crudo), en hexadecimal, comparado contra el header
 *     x-bold-signature.
 *   - Payload de webhook: sobre estilo CloudEvents --
 *     { id, type: 'SALE_APPROVED' | 'SALE_REJECTED' | 'VOID_APPROVED' | 'VOID_REJECTED',
 *       data: { payment_id, bold_code, metadata: { reference }, amount: { currency, total }, ... } }
 */

import { getActivePaymentProvider } from './payment-provider'

const BOLD_LINK_API_URL = 'https://integrations.api.bold.co/online/link/v1'

export type BoldCreateTransactionRequest = {
  /** Monto en PESOS enteros (no centavos) -- ej. 299 para $299 COP */
  amount: number
  currency: string // 'COP'
  description: string
  reference: string // ID unico de la orden (nuestro payment_orders.id)
  customer?: {
    email?: string
    name?: string
  }
  redirect_url?: string // se envia como callback_url a Bold
  metadata?: Record<string, any>
}

/** Forma normalizada que usa el resto de la app (checkout, etc). */
export type BoldTransaction = {
  id: string // = payment_link de Bold
  reference: string
  amount: number
  currency: string
  status: string // 'created' al momento de crear el link; el estado real llega por webhook
  payment_url?: string // = url de Bold, a donde se redirige al cliente
  created_at: string
  updated_at?: string
}

/**
 * Crear un link de pago en Bold.
 */
export async function createBoldTransaction(
  payload: BoldCreateTransactionRequest
): Promise<BoldTransaction | null> {
  lastBoldError = null
  try {
    const provider = await getActivePaymentProvider()

    if (!provider || provider.name !== 'bold') {
      lastBoldError = 'Bold is not the active payment provider'
      console.error(lastBoldError)
      return null
    }

    const apiKey = provider.config?.api_key
    if (!apiKey) {
      lastBoldError = 'Bold API key not configured'
      console.error(lastBoldError)
      return null
    }

    const body = {
      amount_type: 'CLOSE' as const,
      amount: {
        currency: payload.currency,
        total_amount: payload.amount,
        tip_amount: 0,
      },
      description: payload.description,
      reference: payload.reference,
      callback_url: payload.redirect_url,
      payer_email: payload.customer?.email,
    }

    const response = await fetch(BOLD_LINK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `x-api-key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const text = await response.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      console.error('Bold API returned non-JSON response:', response.status, text.slice(0, 500))
      return null
    }

    if (!response.ok || data?.errors?.length) {
      lastBoldError = `HTTP ${response.status}: ${JSON.stringify(data?.errors ?? data)}`
      console.error('Bold API error:', response.status, JSON.stringify(data?.errors ?? data))
      return null
    }

    const linkId = data?.payload?.payment_link
    const url = data?.payload?.url

    if (!linkId || !url) {
      lastBoldError = `Unexpected response shape: ${JSON.stringify(data)}`
      console.error('Bold API: unexpected response shape:', JSON.stringify(data))
      return null
    }

    return {
      id: linkId,
      reference: payload.reference,
      amount: payload.amount,
      currency: payload.currency,
      status: 'created',
      payment_url: url,
      created_at: new Date().toISOString(),
    }
  } catch (error) {
    lastBoldError = `Exception: ${String((error as any)?.message || error)}`
    console.error('Error creating Bold transaction:', error)
    return null
  }
}

/**
 * TEMPORAL (para diagnostico): guarda el detalle del ultimo error real de
 * Bold para que subscription-checkout.ts lo pueda mostrar en el mensaje de
 * error devuelto al usuario, en vez del generico "Failed to create Bold
 * transaction". Quitar esta variable y su uso una vez que el pago funcione.
 */
export let lastBoldError: string | null = null

/**
 * Obtener detalles/estado de una transaccion en Bold.
 *
 * NOTA: la unica consulta de estado documentada publicamente
 * (GET https://payments.api.bold.co/v2/payment-voucher/<id>) es para
 * integraciones de "boton de pagos", no para "links de pago" (que es lo que
 * usa este proyecto). No esta confirmado que este endpoint aplique a un
 * payment_link. Esta funcion no se usa actualmente en el flujo de checkout
 * (el estado real se recibe por webhook, ver handleBoldWebhook) -- antes de
 * usarla habria que confirmar el endpoint correcto con soporte de Bold.
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

    const response = await fetch(
      `https://payments.api.bold.co/v2/payment-voucher/${transactionId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `x-api-key ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      console.error('Bold API error:', response.status)
      return null
    }

    const data = await response.json()
    return {
      id: data.link_id ?? data.transaction_id ?? transactionId,
      reference: data.reference_id ?? '',
      amount: data.total ?? 0,
      currency: 'COP',
      status: data.payment_status ?? 'unknown',
      created_at: data.transaction_date ?? new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error fetching Bold transaction:', error)
    return null
  }
}

export type BoldWebhookEvent = {
  id: string
  type: string // 'SALE_APPROVED' | 'SALE_REJECTED' | 'VOID_APPROVED' | 'VOID_REJECTED'
  subject?: string
  source?: string
  time?: string
  data: {
    payment_id?: string
    bold_code?: string
    merchant_id?: string
    created_at?: string
    amount?: {
      currency?: string
      total?: number
      tip?: number
      taxes?: any[]
    }
    metadata?: {
      reference?: string
      [key: string]: any
    }
    payer_email?: string
    payment_method?: string
    approval_number?: string
    integration?: string
  }
}

/**
 * Verificar firma del webhook de Bold.
 * Bold envia un header x-bold-signature = HMAC-SHA256(base64(body), secret) en hex.
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

    const crypto = await import('crypto')
    const encodedBody = Buffer.from(body, 'utf-8').toString('base64')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(encodedBody)
    const expectedSignature = hmac.digest('hex')

    const a = Buffer.from(expectedSignature)
    const b = Buffer.from(signature || '')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch (error) {
    console.error('Error verifying Bold webhook signature:', error)
    return false
  }
}

/**
 * Parsear y validar webhook de Bold (formato tipo CloudEvents).
 */
export function parseBoldWebhookEvent(body: string): BoldWebhookEvent | null {
  try {
    const event = JSON.parse(body) as BoldWebhookEvent

    if (!event.id || !event.type || !event.data) {
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
 * Mapear el type del evento de Bold a estado de transaccion local.
 */
export function mapBoldStatus(boldEventType: string): 'completed' | 'failed' | 'pending' {
  switch ((boldEventType || '').toUpperCase()) {
    case 'SALE_APPROVED':
      return 'completed'

    case 'SALE_REJECTED':
    case 'VOID_APPROVED':
    case 'VOID_REJECTED':
      return 'failed'

    default:
      return 'pending'
  }
}
