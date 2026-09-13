'use client'

/**
 * Antes este provider cargaba desde Supabase un color de acento (5 opciones)
 * y un fondo animado (6 escenas), y en cada cambio de empresa recalculaba un
 * montón de variables CSS (--accent-glow, --accent-bg, --amb-1, etc.) más el
 * gradiente de fondo. Eso multiplicaba las superficies "glass" con blur en
 * pantalla y, combinado con el blur de los modales, congelaba la pestaña en
 * equipos sin buena aceleración de GPU.
 *
 * Ahora el acento y el fondo son fijos (ver globals.css / background-layer.tsx)
 * y este provider ya no depende de la empresa activa ni hace llamadas a
 * Supabase. Se deja el contexto para no romper a los componentes que todavía
 * importan `useAppearance()` (ej. BackgroundLayer), pero devuelve valores
 * constantes.
 */

import { createContext, useContext } from 'react'

export interface AppearanceContextType {
  background: string
  grid: boolean
  accentColor: string
  isLoading: boolean
}

const FIXED_APPEARANCE: AppearanceContextType = {
  background: 'aurora',
  grid: true,
  accentColor: 'violeta',
  isLoading: false,
}

const AppearanceContext = createContext<AppearanceContextType>(FIXED_APPEARANCE)

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppearanceContext.Provider value={FIXED_APPEARANCE}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}
