'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, Settings, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react'

type PaymentProvider = {
  id: string
  name: string
  display_name: string
  is_active: boolean
  webhook_url: string | null
  webhook_secret: string | null
  config: Record<string, string>
  created_at: string
}

export default function PaymentProvidersPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<PaymentProvider>>({})
  const [showConfig, setShowConfig] = useState<string | null>(null)
  const [revealField, setRevealField] = useState<Record<string, boolean>>({})
  const toggleReveal = (key: string) =>
    setRevealField((prev) => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    fetchProviders()
  }, [])

  async function fetchProviders() {
    try {
      setLoading(true)
      const res = await fetch('/api/superadmin/payment-providers')
      const data = await res.json()
      setProviders(data)
    } catch (error) {
      console.error('Error fetching providers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate(id: string) {
    try {
      const res = await fetch(`/api/superadmin/payment-providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      if (res.ok) {
        await fetchProviders()
      }
    } catch (error) {
      console.error('Error activating provider:', error)
    }
  }

  async function handleSave(id: string) {
    try {
      const res = await fetch(`/api/superadmin/payment-providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        await fetchProviders()
        setEditingId(null)
        setEditData({})
      }
    } catch (error) {
      console.error('Error saving provider:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Proveedores de Pago</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configura y administra tus proveedores de pago (Bold, Wompi, Stripe, etc.)
        </p>
      </div>

      {/* Cards de proveedores */}
      <div className="grid gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
          >
            {editingId === provider.id ? (
              // Modo edición
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">{provider.display_name}</h2>

                {/* Webhook URL */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    value={editData.webhook_url || provider.webhook_url || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, webhook_url: e.target.value })
                    }
                    placeholder="https://tu-dominio.com/api/webhooks/bold"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    URL donde recibirás los webhooks del proveedor
                  </p>
                </div>

                {/* Webhook Secret */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Webhook Secret
                  </label>
                  <div className="relative">
                    <input
                      type={revealField['webhook_secret'] ? 'text' : 'password'}
                      value={editData.webhook_secret || provider.webhook_secret || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, webhook_secret: e.target.value })
                      }
                      placeholder="Tu secret para validar webhooks"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 pr-9 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleReveal('webhook_secret')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      title={revealField['webhook_secret'] ? 'Ocultar' : 'Mostrar'}
                    >
                      {revealField['webhook_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Credenciales dinámicas por proveedor */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400">
                      Credenciales ({provider.name.toUpperCase()})
                    </label>
                    <button
                      onClick={() =>
                        setShowConfig(showConfig === provider.id ? null : provider.id)
                      }
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      {showConfig === provider.id ? '▼ Ocultar' : '▶ Mostrar'}
                    </button>
                  </div>

                  {showConfig === provider.id && (
                    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                      {provider.name === 'bold' && (
                        <>
                          <div>
                            <label className="text-[10px] text-zinc-500">API Key (llave de identidad de Bold)</label>
                            <div className="relative mt-1">
                              <input
                                type={revealField['bold_api_key'] ? 'text' : 'password'}
                                placeholder="Tu API Key de Bold"
                                defaultValue={provider.config?.api_key || ''}
                                onChange={(e) =>
                                  setEditData({
                                    ...editData,
                                    config: {
                                      ...(editData.config || provider.config || {}),
                                      api_key: e.target.value,
                                    },
                                  })
                                }
                                className="w-full rounded border border-zinc-600 bg-zinc-700 px-2 py-1 pr-7 text-[11px] text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => toggleReveal('bold_api_key')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                title={revealField['bold_api_key'] ? 'Ocultar' : 'Mostrar'}
                              >
                                {revealField['bold_api_key'] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500">Secret Key (llave secreta de Bold — de referencia, no usada aun por la integracion)</label>
                            <div className="relative mt-1">
                              <input
                                type={revealField['bold_secret_key'] ? 'text' : 'password'}
                                placeholder="Tu Secret Key de Bold"
                                defaultValue={provider.config?.secret_key || ''}
                                onChange={(e) =>
                                  setEditData({
                                    ...editData,
                                    config: {
                                      ...(editData.config || provider.config || {}),
                                      secret_key: e.target.value,
                                    },
                                  })
                                }
                                className="w-full rounded border border-zinc-600 bg-zinc-700 px-2 py-1 pr-7 text-[11px] text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => toggleReveal('bold_secret_key')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                title={revealField['bold_secret_key'] ? 'Ocultar' : 'Mostrar'}
                              >
                                {revealField['bold_secret_key'] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {provider.name === 'wompi' && (
                        <div>
                          <label className="text-[10px] text-zinc-500">API Public Key</label>
                          <input
                            type="password"
                            placeholder="Tu Public Key de Wompi"
                            defaultValue={provider.config?.public_key || ''}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                config: {
                                  ...(editData.config || provider.config || {}),
                                  public_key: e.target.value,
                                },
                              })
                            }
                            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-[11px] text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                          <label className="mt-2 block text-[10px] text-zinc-500">
                            API Private Key
                          </label>
                          <input
                            type="password"
                            placeholder="Tu Private Key de Wompi"
                            defaultValue={provider.config?.private_key || ''}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                config: {
                                  ...(editData.config || provider.config || {}),
                                  private_key: e.target.value,
                                },
                              })
                            }
                            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-[11px] text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {provider.name === 'stripe' && (
                        <>
                          <div>
                            <label className="text-[10px] text-zinc-500">
                              Secret Key (sk_...)
                            </label>
                            <input
                              type="password"
                              placeholder="sk_test_... o sk_live_..."
                              defaultValue={provider.config?.secret_key || ''}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  config: {
                                    ...(editData.config || provider.config || {}),
                                    secret_key: e.target.value,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-[11px] text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500">
                              Publishable Key (pk_...)
                            </label>
                            <input
                              type="password"
                              placeholder="pk_test_... o pk_live_..."
                              defaultValue={provider.config?.publishable_key || ''}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  config: {
                                    ...(editData.config || provider.config || {}),
                                    publishable_key: e.target.value,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-[11px] text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        </>
                      )}

                      <p className="mt-2 text-[9px] text-zinc-600">
                        💡 Tip: Usa variables de entorno para valores sensibles. Las credenciales se almacenan encriptadas.
                      </p>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      setEditingId(null)
                      setEditData({})
                    }}
                    className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSave(provider.id)}
                    className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              // Modo vista
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {provider.is_active ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-zinc-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-white">{provider.display_name}</h3>
                    <p className="text-xs text-zinc-500">
                      {provider.is_active ? '✓ Activo' : 'Inactivo'}
                      {provider.webhook_url && ' • Webhook configurado'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!provider.is_active && (
                    <button
                      onClick={() => handleActivate(provider.id)}
                      className="rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(provider.id)
                      setEditData(provider)
                    }}
                    className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-indigo-400 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-4">
        <p className="text-[11px] text-amber-200">
          💡 <strong>Solo un proveedor puede estar activo</strong>. Los webhooks se enviarán al URL configurado del proveedor activo. Asegúrate de actualizar la URL del webhook en el dashboard del proveedor.
        </p>
      </div>
    </div>
  )
}
