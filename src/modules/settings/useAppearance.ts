import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useCompanyStore } from '@/store/useCompanyStore'
import { loadUIPreferences, ACCENT_COLORS, BACKGROUND_THEMES } from './appearance-queries'

export function useAppearance() {
  const { activeCompanyId } = useCompanyStore()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!activeCompanyId) return

    loadUIPreferences(activeCompanyId).then(prefs => {
      // Aplicar tema
      if (prefs.mode) {
        setTheme(prefs.mode)
      }

      // Aplicar variables CSS
      const root = document.documentElement
      root.style.setProperty('--accent', ACCENT_COLORS[prefs.accent_color])
      root.style.setProperty('--accent-soft', ACCENT_COLORS[prefs.accent_color] + '99')
      root.style.setProperty('--bg-gradient', BACKGROUND_THEMES[prefs.background_theme])

      // Grid overlay
      if (prefs.grid_overlay) {
        document.body.classList.add('grid-overlay')
      } else {
        document.body.classList.remove('grid-overlay')
      }
    })
  }, [activeCompanyId, setTheme])
}
