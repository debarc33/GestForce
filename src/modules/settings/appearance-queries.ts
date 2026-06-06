import { createClient } from '@/lib/supabase/client'

export type ThemeMode = 'light' | 'dark'
export type AccentColor = 'violeta' | 'cian' | 'esmeralda' | 'ámbar' | 'magenta'
export type BackgroundTheme = 'auroras' | 'mesh' | 'nebulosa' | 'horizonte' | 'topográfico' | 'circuito'

export interface UIPreferences {
  mode: ThemeMode
  accent_color: AccentColor
  background_theme: BackgroundTheme
  grid_overlay: boolean
}

const DEFAULT_PREFERENCES: UIPreferences = {
  mode: 'dark',
  accent_color: 'violeta',
  background_theme: 'auroras',
  grid_overlay: false,
}

export async function loadUIPreferences(companyId: string): Promise<UIPreferences> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('ui_preferences')
    .eq('id', companyId)
    .single()

  if (error || !data?.ui_preferences) {
    return DEFAULT_PREFERENCES
  }

  return { ...DEFAULT_PREFERENCES, ...data.ui_preferences } as UIPreferences
}

export async function saveUIPreferences(
  companyId: string,
  preferences: Partial<UIPreferences>
): Promise<UIPreferences> {
  const supabase = createClient()

  // Primero cargar las preferencias actuales
  const current = await loadUIPreferences(companyId)
  const updated = { ...current, ...preferences }

  const { data, error } = await supabase
    .from('companies')
    .update({ ui_preferences: updated })
    .eq('id', companyId)
    .select('ui_preferences')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data?.ui_preferences as UIPreferences
}

// Color hex values
export const ACCENT_COLORS: Record<AccentColor, string> = {
  violeta: '#8b5cff',
  cian: '#06b6d4',
  esmeralda: '#10b981',
  ámbar: '#f59e0b',
  magenta: '#ec4899',
}

// Fondos como gradientes CSS
export const BACKGROUND_THEMES: Record<BackgroundTheme, string> = {
  auroras: `
    radial-gradient(780px 620px at 8% -8%, rgba(139, 92, 255, 0.15) 0%, transparent 58%),
    radial-gradient(680px 560px at 98% 4%, rgba(168, 85, 247, 0.1) 0%, transparent 56%),
    radial-gradient(760px 640px at 78% 102%, rgba(6, 182, 212, 0.08) 0%, transparent 58%),
    radial-gradient(520px 460px at 30% 88%, rgba(168, 85, 247, 0.1) 0%, transparent 60%)
  `,
  mesh: `
    radial-gradient(800px 600px at 20% 30%, rgba(236, 72, 153, 0.12) 0%, transparent 55%),
    radial-gradient(700px 700px at 80% 70%, rgba(6, 182, 212, 0.1) 0%, transparent 60%),
    linear-gradient(135deg, transparent 40%, rgba(139, 92, 255, 0.05) 50%, transparent 60%)
  `,
  nebulosa: `
    radial-gradient(900px 700px at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 60%),
    radial-gradient(600px 600px at 20% 80%, rgba(139, 92, 255, 0.12) 0%, transparent 55%),
    radial-gradient(700px 700px at 80% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 60%)
  `,
  horizonte: `
    linear-gradient(180deg,
      rgba(139, 92, 255, 0.1) 0%,
      rgba(99, 102, 241, 0.08) 30%,
      rgba(6, 182, 212, 0.1) 60%,
      transparent 100%
    ),
    radial-gradient(800px 400px at 50% 0%, rgba(168, 85, 247, 0.12) 0%, transparent 60%)
  `,
  topográfico: `
    repeating-linear-gradient(0deg,
      rgba(139, 92, 255, 0.03) 0px,
      rgba(139, 92, 255, 0.03) 2px,
      transparent 2px,
      transparent 40px
    ),
    repeating-linear-gradient(90deg,
      rgba(6, 182, 212, 0.03) 0px,
      rgba(6, 182, 212, 0.03) 2px,
      transparent 2px,
      transparent 40px
    ),
    radial-gradient(900px 600px at 50% 50%, rgba(139, 92, 255, 0.05) 0%, transparent 60%)
  `,
  circuito: `
    repeating-linear-gradient(0deg,
      transparent 0px,
      rgba(139, 92, 255, 0.04) 1px,
      transparent 2px,
      transparent 40px
    ),
    repeating-linear-gradient(90deg,
      transparent 0px,
      rgba(6, 182, 212, 0.04) 1px,
      transparent 2px,
      transparent 40px
    ),
    radial-gradient(1000px 800px at 50% 50%, rgba(99, 102, 241, 0.06) 0%, transparent 70%)
  `,
}
