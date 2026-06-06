'use client'

import Link from 'next/link'
import { CreditCard, Settings, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  const sections = [
    {
      id: 'bold-setup',
      title: 'Guía de Configuración Bold',
      description: 'Paso a paso para integrar tu cuenta de Bold',
      icon: <CreditCard className="h-6 w-6" />,
      href: '/superadmin/settings/bold-setup',
      badge: 'NUEVO',
    },
    {
      id: 'payment-providers',
      title: 'Proveedores de Pago',
      description: 'Administra Bold, Wompi, Stripe y otros',
      icon: <CreditCard className="h-6 w-6" />,
      href: '/superadmin/settings/payment-providers',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Administra la configuración de tu sistema GestForce
        </p>
      </div>

      {/* Settings sections */}
      <div className="grid gap-3">
        {sections.map((section: any) => (
          <Link
            key={section.id}
            href={section.href}
            className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-indigo-500/50 hover:bg-zinc-800/50 transition-colors relative"
          >
            {section.badge && (
              <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                {section.badge}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-zinc-400 group-hover:text-indigo-400 transition-colors">
                  {section.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{section.title}</h3>
                  <p className="mt-0.5 text-sm text-zinc-500">{section.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* Info section */}
      <div className="rounded-2xl border border-blue-800/30 bg-blue-900/10 p-6">
        <h3 className="font-semibold text-blue-200">💡 Integración de Pagos</h3>
        <div className="mt-4 space-y-3 text-sm text-blue-100">
          <p>
            <strong>Paso 1:</strong> Dirígete a <Link href="/superadmin/settings/payment-providers" className="underline hover:no-underline">Proveedores de Pago</Link>
          </p>
          <p>
            <strong>Paso 2:</strong> Selecciona tu proveedor (Bold, Wompi, Stripe)
          </p>
          <p>
            <strong>Paso 3:</strong> Ingresa tus credenciales (API keys, webhooks, etc.)
          </p>
          <p>
            <strong>Paso 4:</strong> Activa el proveedor
          </p>
          <p>
            <strong>Paso 5:</strong> Configura el webhook en el dashboard del proveedor para recibir notificaciones de pagos
          </p>
        </div>
      </div>

      {/* Provider guides */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Guías de Configuración</h2>

        {/* Bold */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <h3 className="font-semibold text-white">🏦 Bold</h3>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="border-t border-zinc-800 px-6 py-4 text-sm text-zinc-300 space-y-3">
            <p>
              <strong className="text-white">1. Obtener credenciales:</strong>
              <br />
              Accede a tu dashboard en{' '}
              <a
                href="https://dashboard.bold.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                dashboard.bold.co
              </a>
              {' '} y ve a Settings → API Keys
            </p>
            <p>
              <strong className="text-white">2. Campos a ingresar:</strong>
              <br />
              • API Key (tu clave de desarrollo o producción)<br />
              • Secret Key (tu secret key)
            </p>
            <p>
              <strong className="text-white">3. Webhook:</strong>
              <br />
              URL: <code className="bg-zinc-800 px-2 py-1 rounded text-[11px]">https://tu-dominio.com/api/webhooks/payment</code>
              <br />
              Header esperado: <code className="bg-zinc-800 px-2 py-1 rounded text-[11px]">X-Bold-Signature</code>
            </p>
            <p className="text-[11px] text-zinc-500">
              💡 Bold es el proveedor por defecto. Sus transacciones son procesadas en pesos colombianos (COP).
            </p>
          </div>
        </details>

        {/* Wompi */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <h3 className="font-semibold text-white">💳 Wompi</h3>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="border-t border-zinc-800 px-6 py-4 text-sm text-zinc-300 space-y-3">
            <p>
              <strong className="text-white">1. Obtener credenciales:</strong>
              <br />
              Accede a tu dashboard en{' '}
              <a
                href="https://dashboard.wompi.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                dashboard.wompi.co
              </a>
              {' '} y ve a Configuración → API
            </p>
            <p>
              <strong className="text-white">2. Campos a ingresar:</strong>
              <br />
              • Public Key (para el frontend)<br />
              • Private Key (para el backend)
            </p>
            <p>
              <strong className="text-white">3. Webhook:</strong>
              <br />
              URL: <code className="bg-zinc-800 px-2 py-1 rounded text-[11px]">https://tu-dominio.com/api/webhooks/payment</code>
              <br />
              Header esperado: <code className="bg-zinc-800 px-2 py-1 rounded text-[11px]">X-Wompi-Signature</code>
            </p>
            <p className="text-[11px] text-zinc-500">
              💡 Wompi soporta múltiples métodos de pago (tarjetas, transferencias, nequi, etc.)
            </p>
          </div>
        </details>

        {/* Stripe */}
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900">
          <summary className="flex cursor-pointer items-center justify-between p-6 hover:bg-zinc-800/50 transition-colors">
            <h3 className="font-semibold text-white">💰 Stripe</h3>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="border-t border-zinc-800 px-6 py-4 text-sm text-zinc-300 space-y-3">
            <p>
              <strong className="text-white">1. Obtener credenciales:</strong>
              <br />
              Accede a tu dashboard en{' '}
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                dashboard.stripe.com
              </a>
              {' '} y ve a Configuración → Claves API
            </p>
            <p>
              <strong className="text-white">2. Campos a ingresar:</strong>
              <br />
              • Secret Key (<code className="bg-zinc-800 px-1 rounded text-[10px]">sk_test_...</code> o <code className="bg-zinc-800 px-1 rounded text-[10px]">sk_live_...</code>)<br />
              • Publishable Key (<code className="bg-zinc-800 px-1 rounded text-[10px]">pk_test_...</code> o <code className="bg-zinc-800 px-1 rounded text-[10px]">pk_live_...</code>)
            </p>
            <p>
              <strong className="text-white">3. Webhook:</strong>
              <br />
              URL: <code className="bg-zinc-800 px-2 py-1 rounded text-[11px]">https://tu-dominio.com/api/webhooks/payment</code>
              <br />
              Header esperado: <code className="bg-zinc-800 px-2 py-1 rounded text-[11px]">stripe-signature</code>
              <br />
              Eventos: <code className="bg-zinc-800 px-1 rounded text-[10px]">charge.succeeded</code>, <code className="bg-zinc-800 px-1 rounded text-[10px]">charge.failed</code>
            </p>
            <p className="text-[11px] text-zinc-500">
              💡 Usa <code className="bg-zinc-800 px-1 rounded text-[10px]">sk_test_...</code> para desarrollo y <code className="bg-zinc-800 px-1 rounded text-[10px]">sk_live_...</code> para producción.
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
