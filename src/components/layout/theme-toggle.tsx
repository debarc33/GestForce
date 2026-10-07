'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { saveUIPreferences } from '@/modules/settings/appearance-queries'

/**
 * GestForce — Selector rapido de tema (claro/oscuro) en el Header
 *
 * Antes era el icono ✨ sin ninguna funcion detras. El usuario aclaro que la
 * idea original era exactamente esto: un atajo para cambiar entre modo claro
 * y oscuro sin tener que entrar a Configuracion → Apariencia (que ya tiene
 * esta misma opcion, ver appearance-tab.tsx). Reutiliza el mismo mecanismo:
 * next-themes para aplicar el cambio al instante y Supabase
 * (companies.ui_preferences.mode) para que la preferencia quede sincronizada
 * entre este atajo y la pantalla de Configuracion.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)

  // Evita el parpadeo/mismatch de hidratacion: next-themes solo sabe el
  // tema real una vez montado en el navegador.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    if (activeCompanyId) {
      saveUIPreferences(activeCompanyId, { mode: next }).catch((err) =>
        console.error('No se pudo guardar la preferencia de tema:', err)
      )
    }
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
