'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useMutation } from '@tanstack/react-query'
import { Check, Moon, Sun } from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useAppearance } from '@/components/appearance/appearance-provider'
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
  const { background, grid, accentColor, setBackground, setGrid, setAccentColor, isLoading } = useAppearance()

  const [preferences, setPreferences] = useState<UIPreferences | null>(null)

  // Cargar preferencias iniciales
  useEffect(() => {
    if (!activeCompanyId) return

    loadUIPreferences(activeCompanyId)
      .then(prefs => {
        setPreferences(prefs)
        // Aplicar tema al cargar
        if (prefs.mode) setTheme(prefs.mode)
      })
      .catch(err => console.error('Error loading preferences:', err))
  }, [activeCompanyId, setTheme])

  // Mutation para guardar en Supabase
  const saveMutation = useMutation({
    mutationFn: async (newPrefs: Partial<UIPreferences>) => {
      if (!activeCompanyId) throw new Error('No company selected')
      return saveUIPreferences(activeCompanyId, newPrefs)
    },
  })

  const handleModeChange = (mode: ThemeMode) => {
    setTheme(mode)
    if (preferences) {
      const updated = { ...preferences, mode }
      setPreferences(updated)
      saveMutation.mutate({ mode })
    }
  }

  const handleAccentChange = (accent: AccentColor) => {
    setAccentColor(accent)
    const accentHex = ACCENT_COLORS[accent]
    document.documentElement.style.setProperty('--accent', accentHex)
    document.documentElement.style.setProperty('--accent-soft', accentHex + '99')

    // Actualizar amb-1 según tema
    const opacity = theme === 'dark' ? 0.35 : 0.18
    const rgba = convertHexToRgba(accentHex, opacity)
    document.documentElement.style.setProperty('--amb-1', rgba)

    if (preferences) {
      const updated = { ...preferences, accent_color: accent }
      setPreferences(updated)
      saveMutation.mutate({ accent_color: accent })
    }
  }

  const handleBackgroundChange = (bg: BackgroundTheme) => {
    // Mapear nombres de fondos
    const bgMap: Record<BackgroundTheme, string> = {
      'auroras': 'aurora',
      'mesh': 'mesh',
      'nebulosa': 'nebula',
      'horizonte': 'horizonte',
      'topográfico': 'topo',
      'circuito': 'circuit',
    }

    setBackground(bgMap[bg])

    if (preferences) {
      const updated = { ...preferences, background_theme: bg }
      setPreferences(updated)
      saveMutation.mutate({ background_theme: bg })
    }
  }

  const handleGridToggle = () => {
    const newGrid = !grid
    setGrid(newGrid)

    if (preferences) {
      const updated = { ...preferences, grid_overlay: newGrid }
      setPreferences(updated)
      saveMutation.mutate({ grid_overlay: newGrid })
    }
  }

  if (isLoading || !preferences) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-700/20" />
  }

  // Determinar fondo actual en formato de appearance-queries
  const currentBg = Object.entries({
    'auroras': 'aurora',
    'mesh': 'mesh',
    'nebulosa': 'nebula',
    'horizonte': 'horizonte',
    'topográfico': 'topo',
    'circuito': 'circuit',
  }).find(([_, v]) => v === background)?.[0] as BackgroundTheme || 'auroras'

  return (
    <div className="space-y-8">
      {/* Modo */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Modo</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('light')}
            className={`flex items-center gap-2 rounded-xl p-4 border-2 transition-all cursor-pointer ${
              theme === 'light'
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-slate-500/30 bg-slate-500/10 hover:border-slate-500/50 hover:bg-slate-500/15'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span className="text-sm font-medium">Claro</span>
            {theme === 'light' && <Check className="ml-auto h-4 w-4 text-[var(--accent)]" />}
          </button>
          <button
            onClick={() => handleModeChange('dark')}
            className={`flex items-center gap-2 rounded-xl p-4 border-2 transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-slate-500/30 bg-slate-500/10 hover:border-slate-500/50 hover:bg-slate-500/15'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span className="text-sm font-medium">Oscuro</span>
            {theme === 'dark' && <Check className="ml-auto h-4 w-4 text-[var(--accent)]" />}
          </button>
        </div>
      </section>

      {/* Color de acento */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Color de acento</h3>
        <p className="text-xs text-muted-foreground mb-4">
          El color de la marca. Tine botones, enlaces, gráficos y el resplandor del fondo.
        </p>
        <div className="flex gap-4 flex-wrap">
          {ACCENT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleAccentChange(id)}
              className="flex flex-col items-center gap-2 group cursor-pointer"
              title={`Cambiar a ${label}`}
            >
              <div
                className={`h-14 w-14 rounded-lg border-2 transition-all shadow-lg ${
                  accentColor === id
                    ? 'border-white/80 shadow-xl scale-110'
                    : 'border-white/20 group-hover:border-white/50 group-hover:scale-105'
                }`}
                style={{ background: ACCENT_COLORS[id] }}
              />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Fondo */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">Fondo del espacio de trabajo</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Una escena futurista que se ve difuminada a través de las superficies de vidrio.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {BACKGROUND_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleBackgroundChange(id)}
              className={`relative rounded-lg overflow-hidden border-2 h-28 transition-all cursor-pointer group ${
                currentBg === id
                  ? 'border-white scale-105 shadow-xl'
                  : 'border-white/20 hover:border-white/50 hover:scale-102'
              }`}
            >
              <div
                className="absolute inset-0"
                style={{ background: BACKGROUND_THEMES[id] }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {currentBg === id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Check className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              )}
              <span className="absolute bottom-2 left-3 text-xs font-semibold text-white drop-shadow-md">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Rejilla técnica */}
      <section className="rounded-xl border border-slate-500/30 bg-slate-500/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Rejilla técnica</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Superpone una cuadrícula sutil tipo blueprint sobre el fondo.
            </p>
          </div>
          <button
            onClick={handleGridToggle}
            className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
              grid ? 'bg-[var(--accent)]' : 'bg-slate-500/50'
            }`}
            title="Activar/desactivar rejilla"
          >
            <div
              className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                grid ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Info */}
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
        <p className="text-xs text-muted-foreground">
          ✓ Los cambios se aplican al instante. Se guardan en Supabase y se cargan al iniciar sesión.
        </p>
      </div>
    </div>
  )
}

// Helper para convertir hex a rgba
function convertHexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
