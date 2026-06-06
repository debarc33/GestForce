import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export type EmailTemplate =
  | 'welcome'
  | 'payment_completed'
  | 'payment_failed'
  | 'trial_expiring'
  | 'subscription_expired'

interface EmailParams {
  to: string
  template: EmailTemplate
  data: Record<string, any>
}

export async function sendEmail({ to, template, data }: EmailParams) {
  try {
    const templates = {
      welcome: getWelcomeTemplate(data),
      payment_completed: getPaymentCompletedTemplate(data),
      payment_failed: getPaymentFailedTemplate(data),
      trial_expiring: getTrialExpiringTemplate(data),
      subscription_expired: getSubscriptionExpiredTemplate(data),
    }

    const { html, subject } = templates[template]

    const result = await resend.emails.send({
      from: process.env.SENDER_EMAIL || 'noreply@gestforce.com',
      to,
      subject,
      html,
    })

    return result
  } catch (error) {
    console.error(`Error sending ${template} email to ${to}:`, error)
    throw error
  }
}

// Templates

function getWelcomeTemplate(data: {
  company_name: string
  owner_name: string
  email: string
  password: string
  trial_days: number
  trial_end_date: string
}) {
  return {
    subject: `¡Bienvenido a GestForce! - ${data.company_name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
            .header { background: #18181b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .creds { background: #f3f4f6; padding: 15px; border-left: 4px solid #6366f1; margin: 20px 0; font-family: monospace; }
            .creds p { margin: 8px 0; }
            .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
            .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; margin-top: 20px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 ¡Bienvenido a GestForce!</h1>
            </div>
            <div class="content">
              <p>Hola ${data.owner_name},</p>

              <p>Tu empresa <strong>${data.company_name}</strong> ha sido creada exitosamente en GestForce.</p>

              <p>Tu período de prueba gratuita de <strong>${data.trial_days} días</strong> comienza ahora y vence el <strong>${new Date(data.trial_end_date).toLocaleDateString('es-CO')}</strong>.</p>

              <p><strong>Tus credenciales de acceso:</strong></p>
              <div class="creds">
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Contraseña:</strong> ${data.password}</p>
              </div>

              <p style="color: #ef4444;"><strong>⚠️ Importante:</strong> Cambia tu contraseña en el primer acceso por seguridad.</p>

              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://gestforce.com'}/login" class="btn">Acceder a GestForce</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Durante tu período de prueba tendrás acceso completo a todos los módulos de GestForce:
                <br>✓ Ventas (Cotizaciones, Facturas, Recibos)
                <br>✓ Compras (Órdenes, Facturas de Proveedor)
                <br>✓ Inventario y Productos
                <br>✓ Nómina y Empleados
                <br>✓ Contabilidad y Finanzas
              </p>

              <div class="footer">
                <p>¿Preguntas? Contáctanos en support@gestforce.com</p>
                <p>GestForce ERP © 2026 - Todos los derechos reservados</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}

function getPaymentCompletedTemplate(data: {
  company_name: string
  owner_name: string
  amount: number
  period: string
  expiry_date: string
}) {
  const periodLabel = {
    '3_months': '3 meses',
    '6_months': '6 meses',
    '1_year': '1 año',
  }[data.period] || data.period

  return {
    subject: `✅ Pago confirmado - GestForce ${data.company_name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
            .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .amount { font-size: 32px; color: #10b981; font-weight: bold; margin: 20px 0; }
            .details { background: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; margin-top: 20px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Pago Confirmado</h1>
            </div>
            <div class="content">
              <p>Hola ${data.owner_name},</p>

              <p>Tu pago ha sido procesado exitosamente.</p>

              <div class="amount">\$${data.amount.toLocaleString('es-CO')}</div>

              <div class="details">
                <p><strong>Empresa:</strong> ${data.company_name}</p>
                <p><strong>Período:</strong> ${periodLabel}</p>
                <p><strong>Tu suscripción vence el:</strong> ${new Date(data.expiry_date).toLocaleDateString('es-CO')}</p>
              </div>

              <p>Tu acceso a GestForce está completamente activo. Puedes seguir usando todos los módulos sin restricciones.</p>

              <div class="footer">
                <p>¿Preguntas? Contáctanos en support@gestforce.com</p>
                <p>GestForce ERP © 2026</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}

function getPaymentFailedTemplate(data: {
  company_name: string
  owner_name: string
  amount: number
}) {
  return {
    subject: `⚠️ Pago fallido - GestForce`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
            .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Pago No Completado</h1>
            </div>
            <div class="content">
              <p>Hola ${data.owner_name},</p>

              <p>Tu intento de pago de \$${data.amount.toLocaleString('es-CO')} no se pudo completar.</p>

              <p><strong>Posibles razones:</strong></p>
              <ul>
                <li>Fondos insuficientes</li>
                <li>Tarjeta expirada</li>
                <li>Datos incorrectos</li>
              </ul>

              <p>Por favor, intenta de nuevo con otra tarjeta o contacta a tu banco.</p>

              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://gestforce.com'}/payment" class="btn">Reintentar Pago</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}

function getTrialExpiringTemplate(data: {
  company_name: string
  owner_name: string
  expiry_date: string
  checkout_url: string
}) {
  return {
    subject: `⏰ Tu prueba de GestForce vence en 7 días`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
            .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Tu prueba vence pronto</h1>
            </div>
            <div class="content">
              <p>Hola ${data.owner_name},</p>

              <p>Tu período de prueba gratuita de GestForce vence el <strong>${new Date(data.expiry_date).toLocaleDateString('es-CO')}</strong> (en 7 días).</p>

              <p>Para continuar usando GestForce y todos sus módulos, renueva tu suscripción ahora.</p>

              <a href="${data.checkout_url}" class="btn">Renovar Ahora</a>

              <p style="margin-top: 30px; color: #666;">Sin renovación, tu acceso será bloqueado después de la fecha de vencimiento.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}

function getSubscriptionExpiredTemplate(data: {
  company_name: string
  owner_name: string
  checkout_url: string
}) {
  return {
    subject: `❌ Tu suscripción a GestForce ha vencido`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; }
            .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Suscripción Vencida</h1>
            </div>
            <div class="content">
              <p>Hola ${data.owner_name},</p>

              <p>Tu suscripción a GestForce ha vencido. Tu acceso ha sido temporalmente bloqueado.</p>

              <p>Para reactivar tu acceso, por favor renueva tu suscripción.</p>

              <a href="${data.checkout_url}" class="btn">Reactivar Suscripción</a>

              <p style="margin-top: 30px; color: #666;">Todos tus datos están seguros y disponibles. Solo necesitas renovar para continuar.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}
