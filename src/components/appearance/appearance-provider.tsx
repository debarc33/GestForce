'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useTheme } from 'next-themes'

export interface AppearanceContextType {
  background: string
  grid: boolean
  accentColor: string
  setBackground: (bg: string) => void
  setGrid: (grid: boolean) => void
  setAccentColor: (color: string) => void
  isLoading: boolean
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined)

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { activeCompanyId } = useCompanyStore()
  const { theme } = useTheme()

  const [background, setBackground] = useState('aurora')
  const [grid, setGrid] = useState(true)
  const [accentColor, setAccentColor] = useState('violeta')
  const [isLoading, setIsLoading] = useState(true)

  // Cargar preferencias de Supabase al iniciar o cambiar empresa
  useEffect(() => {
    if (!activeCompanyId) {
      setIsLoading(false)
      return
    }

    const loadPrefs = async () => {
      try {
        const { loadUIPreferences } = await import('@/modules/settings/appearance-queries')
        const prefs = await loadUIPreferences(activeCompanyId)

        // Mapear nombres de fondos de appearance-queries a background-layer
        const bgMap: Record<string, string> = {
          'auroras': 'aurora',
          'mesh': 'mesh',
          'nebulosa': 'nebula',
          'horizonte': 'horizonte',
          'topográfico': 'topo',
          'circuito': 'circuit',
        }

        setBackground(bgMap[prefs.background_theme] || 'aurora')
        setGrid(prefs.grid_overlay)
        setAccentColor(prefs.accent_color)

        // Aplicar CSS variables para acento
        const { ACCENT_COLORS } = await import('@/modules/settings/appearance-queries')
        const accentHex = ACCENT_COLORS[prefs.accent_color as any]
        if (accentHex) {
          document.documentElement.style.setProperty('--accent', accentHex)
          document.documentElement.style.setProperty('--accent-soft', accentHex + '99')
          document.documentElement.style.setProperty('--amb-1', convertHexToRgba(accentHex, theme === 'dark' ? 0.35 : 0.18))
        }
      } catch (error) {
        console.error('Error loading appearance preferences:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPrefs()
  }, [activeCompanyId, theme])

  const value: AppearanceContextType = {
    background,
    grid,
    accentColor,
    setBackground,
    setGrid,
    setAccentColor,
    isLoading,
  }

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) {
    return { background: 'aurora', grid: true, accentColor: 'violeta', isLoading: false }
  }
  return context
}

// Helper para convertir hex a rgba
function convertHexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
