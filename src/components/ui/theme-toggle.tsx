'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botón que cicla entre los tres modos: light → dark → system.
 * Usa next-themes (ya instalado). El tema se persiste en localStorage.
 * El check `mounted` es necesario para evitar mismatch de hidratación.
 */
export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string
  showLabel?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Esperar a que el cliente hidrate para leer el tema real
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    // Placeholder con el mismo tamaño para evitar salto de layout
    return (
      <div className={cn('flex h-7 items-center gap-1.5 rounded-md px-2', className)}>
        <div className="h-4 w-4 rounded bg-zinc-100" />
      </div>
    )
  }

  const cycle = () =>
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')

  const Icon  = theme === 'dark' ? Moon  : theme === 'system' ? Monitor : Sun
  const label = theme === 'dark' ? 'Oscuro' : theme === 'system' ? 'Sistema' : 'Claro'

  return (
    <button
      onClick={cycle}
      title={`Tema: ${label} — clic para cambiar`}
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-md px-2',
        'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
        'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
        'transition-colors text-[12px] font-medium',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  )
}
