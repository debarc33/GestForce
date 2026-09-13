'use client'

/**
 * Antes esta pantalla también dejaba elegir color de acento, fondo animado
 * (6 escenas) y una rejilla superpuesta. Se quitó todo eso a pedido del
 * cliente: cada opción de fondo aplicaba sus propios gradientes/blur y
 * multiplicaba las superficies "glass" en pantalla, lo que en equipos sin
 * buena aceleración de GPU congelaba la pestaña al abrir cualquier modal.
 * Ahora queda un único tema visual fijo (ver background-layer.tsx y
 * globals.css) y aquí solo se elige claro/oscuro.
 */

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Check, Moon, Sun } from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  loadUIPreferences, saveUIPreferences,
  type UIPreferences, type ThemeMode,
} from './appearance-queries'

export function AppearanceTab() {
  const { activeCompanyId } = useCompanyStore()
  const { setTheme } = useTheme()

  const [preferences, setPreferences] = useState<UIPreferences | null>(null)
  const [selectedMode, setSelectedMode] = useState<ThemeMode | undefined>(undefined)

  // Cargar preferencias iniciales
  useEffect(() => {
    if (!activeCompanyId) return

    loadUIPreferences(activeCompanyId)
      .then(prefs => {
        setPreferences(prefs)
        setSelectedMode(prefs.mode)
        // Aplicar tema al cargar
        if (prefs.mode) setTheme(prefs.mode)
      })
      .catch(err => console.error('Error loading preferences:', err))
  }, [activeCompanyId])

  const handleModeChange = async (mode: ThemeMode) => {
    setSelectedMode(mode)
    setTheme(mode)

    if (preferences) {
      const updated = { ...preferences, mode }
      setPreferences(updated)
      // Guardar en Supabase
      try {
        await saveUIPreferences(activeCompanyId!, { mode })
      } catch (error) {
        console.error('Error saving theme:', error)
      }
    }
  }

  if (!preferences) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-700/20" />
  }

  return (
    <div className="space-y-8">
      {/* Modo */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Modo</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('light')}
            className={`flex items-center gap-2 rounded-xl p-4 border-2 transition-all cursor-pointer ${
              selectedMode === 'light'
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-slate-500/30 bg-slate-500/10 hover:border-slate-500/50 hover:bg-slate-500/15'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span className="text-sm font-medium">Claro</span>
            {selectedMode === 'light' && <Check className="ml-auto h-4 w-4 text-[var(--accent)]" />}
          </button>
          <button
            onClick={() => handleModeChange('dark')}
            className={`flex items-center gap-2 rounded-xl p-4 border-2 transition-all cursor-pointer ${
              selectedMode === 'dark'
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-slate-500/30 bg-slate-500/10 hover:border-slate-500/50 hover:bg-slate-500/15'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span className="text-sm font-medium">Oscuro</span>
            {selectedMode === 'dark' && <Check className="ml-auto h-4 w-4 text-[var(--accent)]" />}
          </button>
        </div>
      </section>

      {/* Info */}
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
        <p className="text-xs text-muted-foreground">
          ✓ El modo se aplica al instante y se guarda en Supabase. El color de acento y el fondo
          animado se quitaron para mantener la interfaz ágil y estable.
        </p>
      </div>
    </div>
  )
}
