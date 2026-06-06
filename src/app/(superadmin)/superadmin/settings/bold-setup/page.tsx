'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Copy, ExternalLink, AlertCircle, ChevronDown } from 'lucide-react'

export default function BoldSetupPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/payment`
    : 'https://tu-dominio.com/api/webhooks/payment'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configurar Bold</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Guía paso a paso para integrar Bold con GestForce
        </p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-4">
        {/* Step 1 */}
        <details open className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                1
              </div>
              <h3 className="font-semibold text-white">Obtener credenciales de Bold</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-zinc-600 group-open:rotate-180 transition-transform" />
          </summary>

          <div className="border-t border-zinc-800 px-6 py-6 space-y-4">
            <div className="rounded-lg bg-blue-900/20 border border-blue-800/30 p-4">
              <p className="text-sm text-blue-200">
                1. Accede a{' '}
                <a
                  href="https://dashboard.bold.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-300 hover:text-blue-100 inline-flex items-center gap-1"
                >
                  dashboard.bold.co
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                <strong>2. Ve a:</strong> Configuración → API Keys (o Settings → API)
              </p>

              <p className="text-sm text-zinc-300">
                <strong>3. Copia estos valores:</strong>
              </p>

              <div className="space-y-2">
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <p className="text-xs font-medium text-zinc-500 mb-2">API Key</p>
                  <input
                    type="text"
                    placeholder="pk_... o similar"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600"
                    readOnly
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Copia tu API Key de Bold dashboard
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Secret Key</p>
                  <input
                    type="password"
                    placeholder="sk_... o similar"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600"
                    readOnly
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Copia tu Secret Key de Bold dashboard
                  </p>
                </div>
              </div>
            </div>
          </div>
        </details>

        {/* Step 2 */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                2
              </div>
              <h3 className="font-semibold text-white">Configurar en GestForce</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-zinc-600 group-open:rotate-180 transition-transform" />
          </summary>

          <div className="border-t border-zinc-800 px-6 py-6 space-y-4">
            <div className="rounded-lg bg-emerald-900/20 border border-emerald-800/30 p-4">
              <p className="text-sm text-emerald-200">
                ✓ Ve a{' '}
                <Link
                  href="/superadmin/settings/payment-providers"
                  className="font-semibold text-emerald-300 hover:text-emerald-100 underline"
                >
                  Configuración → Proveedores de Pago
                </Link>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                <strong>1. Click en Bold</strong>
              </p>

              <p className="text-sm text-zinc-300">
                <strong>2. Click en el ícono de engranaje</strong> para editar
              </p>

              <p className="text-sm text-zinc-300">
                <strong>3. Ingresa tu información:</strong>
              </p>

              <div className="space-y-2 ml-4">
                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">
                    Webhook URL (automático)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 break-all">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(webhookUrl, 'webhook-url')}
                      className="text-zinc-400 hover:text-indigo-400 transition-colors"
                      title="Copiar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">
                    Webhook Secret (desde Bold)
                  </p>
                  <input
                    type="password"
                    placeholder="Pega el secret de Bold aquí"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Este es el secret que Bold te proporciona para validar webhooks
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">API Key</p>
                  <input
                    type="password"
                    placeholder="Pega tu API Key aquí"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600"
                  />
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">Secret Key</p>
                  <input
                    type="password"
                    placeholder="Pega tu Secret Key aquí"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <p className="text-sm text-zinc-300 mt-4">
                <strong>4. Click en "Guardar"</strong>
              </p>

              <p className="text-sm text-zinc-300">
                <strong>5. Click en "Activar"</strong> para usar Bold como proveedor activo
              </p>
            </div>
          </div>
        </details>

        {/* Step 3 */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                3
              </div>
              <h3 className="font-semibold text-white">Configurar webhook en Bold</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-zinc-600 group-open:rotate-180 transition-transform" />
          </summary>

          <div className="border-t border-zinc-800 px-6 py-6 space-y-4">
            <div className="rounded-lg bg-amber-900/20 border border-amber-800/30 p-4">
              <p className="text-sm text-amber-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Este paso es importante: Bold enviará notificaciones de pagos a tu sistema
                </span>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                <strong>1. En Bold Dashboard:</strong> Ve a Configuración → Webhooks
              </p>

              <p className="text-sm text-zinc-300">
                <strong>2. Click en "Agregar Webhook"</strong>
              </p>

              <div className="space-y-2 ml-4">
                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">URL del Webhook</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 break-all">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(webhookUrl, 'webhook-url-2')}
                      className="text-zinc-400 hover:text-indigo-400 transition-colors"
                      title="Copiar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">
                    Header: X-Bold-Signature
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    Bold automáticamente enviará este header para validar la autenticidad del webhook
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 mb-1">Eventos a suscribirse</p>
                  <ul className="text-[10px] text-zinc-400 space-y-1">
                    <li>✓ transaction.success</li>
                    <li>✓ transaction.failed</li>
                    <li>✓ transaction.pending</li>
                  </ul>
                </div>
              </div>

              <p className="text-sm text-zinc-300 mt-4">
                <strong>3. Click en "Crear Webhook"</strong>
              </p>

              <p className="text-sm text-zinc-300">
                <strong>4. Copiar el Secret</strong> que Bold genera y pegarlo en GestForce:
                <br /> Configuración → Proveedores de Pago → Bold → Webhook Secret
              </p>
            </div>
          </div>
        </details>

        {/* Step 4 */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                4
              </div>
              <h3 className="font-semibold text-white">Probar la integración</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-zinc-600 group-open:rotate-180 transition-transform" />
          </summary>

          <div className="border-t border-zinc-800 px-6 py-6 space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                <strong>1. Crear una empresa de prueba</strong>
              </p>

              <p className="text-sm text-zinc-300">
                <strong>2. Ve a Empresas → [Tu empresa] → Suscripción</strong>
              </p>

              <p className="text-sm text-zinc-300">
                <strong>3. Selecciona un período y click en "Proceder al Pago"</strong>
              </p>

              <p className="text-sm text-zinc-300">
                <strong>4. Deberías ver:</strong>
              </p>
              <ul className="ml-4 text-sm text-zinc-400 space-y-1">
                <li>• Redirección a Bold (si tienes credenciales válidas)</li>
                <li>• Formulario de pago de Bold</li>
                <li>• Después de pagar, regresará a GestForce</li>
              </ul>

              <p className="text-sm text-zinc-300 mt-4">
                <strong>5. Verificar en BD:</strong>
              </p>
              <ul className="ml-4 text-sm text-zinc-400 space-y-1">
                <li>• Tabla payment_orders debe tener el registro</li>
                <li>• Status debe cambiar a "completed"</li>
                <li>• Email de confirmación debe enviarse</li>
              </ul>
            </div>
          </div>
        </details>

        {/* Help */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                ?
              </div>
              <h3 className="font-semibold text-white">Solución de problemas</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-zinc-600 group-open:rotate-180 transition-transform" />
          </summary>

          <div className="border-t border-zinc-800 px-6 py-6 space-y-4">
            <div className="space-y-3">
              <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3">
                <p className="text-sm font-semibold text-red-200 mb-1">
                  ❌ "No payment provider configured"
                </p>
                <p className="text-[13px] text-red-100">
                  Bold no está activado. Ve a Configuración → Proveedores de Pago → Bold → Activar
                </p>
              </div>

              <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3">
                <p className="text-sm font-semibold text-red-200 mb-1">
                  ❌ "Failed to create Bold transaction"
                </p>
                <p className="text-[13px] text-red-100">
                  Verifica que tu API Key sea correcta. Ve a Bold Dashboard → Settings → API Keys
                </p>
              </div>

              <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3">
                <p className="text-sm font-semibold text-red-200 mb-1">
                  ❌ Webhooks no se reciben
                </p>
                <p className="text-[13px] text-red-100">
                  Verifica que:<br/>
                  1. El webhook URL en Bold es correcto<br/>
                  2. El webhook secret coincide en ambos lados<br/>
                  3. Tu servidor es accesible desde internet (no localhost)
                </p>
              </div>

              <div className="rounded-lg bg-emerald-900/20 border border-emerald-800/30 p-3">
                <p className="text-sm font-semibold text-emerald-200 mb-1">
                  ✅ Todo funciona correctamente
                </p>
                <p className="text-[13px] text-emerald-100">
                  Los pagos se procesan automáticamente. Los clientes reciben emails de confirmación.
                  <br />Las suscripciones se renuevan según el período.
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Final CTA */}
      <div className="rounded-2xl border border-emerald-800 bg-emerald-900/20 p-6">
        <h3 className="font-semibold text-emerald-200 mb-3">¿Listo para comenzar?</h3>
        <Link
          href="/superadmin/settings/payment-providers"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" />
          Ir a Configuración de Bold
        </Link>
      </div>
    </div>
  )
}
