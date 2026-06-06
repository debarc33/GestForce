'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useMutation } from '@tanstack/react-query'
import { Check, Moon, Sun } from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  loadUIPreferences, saveUIPreferences,
  ACCENT_COLORS, BACKGROUND_THEMES,
  type UIPreferences, type AccentColor, type BackgroundTheme, type ThemeMode,
} from './appearance-queries'

const ACCENT_OPTIONS: { id: AccentColor; label: string }[] = [
  { id: 'violeta', label: 'Violeta' },
  { id: 'cian', label: 'Cian' },
  { id: 'esmeralda', label: 'Esmeralda' },
  { id: 'ámbar', label: 'Ámbar' },
  { id: 'magenta', label: 'Magenta' },
]

const BACKGROUND_OPTIONS: { id: BackgroundTheme; label: string }[] = [
  { id: 'auroras', label: 'Auroras' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'nebulosa', label: 'Nebulosa' },
  { id: 'horizonte', label: 'Horizonte' },
  { id: 'topográfico', label: 'Topográfico' },
  { id: 'circuito', label: 'Circuito' },
]

export function AppearanceTab() {
  const { activeCompanyId } = useCompanyStore()
  const { theme, setTheme } = useTheme()

  const [preferences, setPreferences] = useState<UIPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  // Cargar preferencias
  useEffect(() => {
    if (!activeCompanyId) return

    loadUIPreferences(activeCompanyId)
      .then(prefs => {
        setPreferences(prefs)
        // Aplicar tema al cargar
        if (prefs.mode) setTheme(prefs.mode)
        applyTheme(prefs)
      })
      .finally(() => setLoading(false))
  }, [activeCompanyId, setTheme])

  // Mutation para guardar
  const saveMutation = useMutation({
    mutationFn: async (newPrefs: Partial<UIPreferences>) => {
      if (!activeCompanyId) throw new Error('No company selected')
      return saveUIPreferences(activeCompanyId, newPrefs)
    },
    onSuccess: (saved) => {
      setPreferences(saved)
      applyTheme(saved)
    },
  })

  const handleModeChange = (mode: ThemeMode) => {
    setTheme(mode)
    saveMutation.mutate({ mode })
  }

  const handleAccentChange = (accent: AccentColor) => {
    saveMutation.mutate({ accent_color: accent })
  }

  const handleBackgroundChange = (bg: BackgroundTheme) => {
    saveMutation.mutate({ background_theme: bg })
  }

  const handleGridToggle = () => {
    if (!preferences) return
    saveMutation.mutate({ grid_overlay: !preferences.grid_overlay })
  }

  if (loading || !preferences) {
    return <div className="h-40 animate-pulse rounded-xl bg-[var(--glass-hover)]" />
  }

  return (
    <div className="space-y-8">
      {/* Modo */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Modo</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('light')}
            className={`flex items-center gap-2 rounded-xl p-4 border-2 transition-all ${
              theme === 'light'
                ? 'border-primary bg-primary/10'
                : 'border-[var(--border-subtle)] bg-glass-surface hover:bg-[var(--glass-hover)]'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span className="text-sm font-medium">Claro</span>
            {theme === 'light' && <Check className="ml-auto h-4 w-4 text-primary" />}
          </button>
          <button
            onClick={() => handleModeChange('dark')}
            className={`flex items-center gap-2 rounded-xl p-4 border-2 transition-all ${
              theme === 'dark'
                ? 'border-primary bg-primary/10'
                : 'border-[var(--border-subtle)] bg-glass-surface hover:bg-[var(--glass-hover)]'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span className="text-sm font-medium">Oscuro</span>
            {theme === 'dark' && <Check className="ml-auto h-4 w-4 text-primary" />}
          </button>
        </div>
      </section>

      {/* Color de acento */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Color de acento</h3>
        <p className="text-xs text-muted-foreground mb-3">
          El color de la marca. Tine botones, enlaces, gráficos y el resplandor del fondo.
        </p>
        <div className="flex gap-3 flex-wrap">
          {ACCENT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleAccentChange(id)}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className={`h-12 w-12 rounded-lg border-2 transition-all ${
                  preferences.accent_color === id
                    ? 'border-foreground/80'
                    : 'border-transparent group-hover:border-foreground/40'
                }`}
                style={{ background: ACCENT_COLORS[id] }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Fondo */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Fondo del espacio de trabajo</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Una escena futurista que se ve difuminada a través de las superficies de vidrio.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {BACKGROUND_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleBackgroundChange(id)}
              className={`relative rounded-lg overflow-hidden border-2 h-24 transition-all group ${
                preferences.background_theme === id
                  ? 'border-primary'
                  : 'border-[var(--border-subtle)] hover:border-primary/50'
              }`}
            >
              <div
                className="absolute inset-0"
                style={{ background: BACKGROUND_THEMES[id] }}
              />
              <div className="absolute inset-0 bg-black/40" />
              {preferences.background_theme === id && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-5 w-5 text-primary" />
                </div>
              )}
              <span className="absolute bottom-2 left-2 text-xs font-medium text-white">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Rejilla técnica */}
      <section className="rounded-xl glass-surface border border-primary/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Rejilla técnica</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Superpone una cuadrícula sutil tipo blueprint sobre el fondo.
            </p>
          </div>
          <button
            onClick={handleGridToggle}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              preferences.grid_overlay ? 'bg-primary' : 'bg-[var(--border-strong)]'
            }`}
          >
            <div
              className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
                preferences.grid_overlay ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Info */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs text-muted-foreground">
          ✓ Los cambios se aplican al instante. En producción se guardan en Supabase y se cargan al iniciar sesión.
        </p>
      </div>
    </div>
  )
}

// Aplicar tema dinámicamente
function applyTheme(prefs: UIPreferences) {
  const root = document.documentElement
  const accentColor = ACCENT_COLORS[prefs.accent_color]
  const bgGradient = BACKGROUND_THEMES[prefs.background_theme]

  // Actualizar CSS variables
  root.style.setProperty('--accent', accentColor)
  root.style.setProperty('--accent-soft', accentColor + '99')

  // Fondo
  root.style.setProperty('--bg-gradient', bgGradient)
}
