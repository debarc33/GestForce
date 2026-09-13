'use client'

import { cn } from '@/lib/utils'

/**
 * GestForce — StatusBadge
 *
 * Badge de estado con punto opcional. Tonos: neutral/accent/success/warning/danger/info.
 *
 * @example <StatusBadge tone="success" dot>Pagada</StatusBadge>
 */

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--glass-strong)] text-muted-foreground border-[var(--glass-border)]',
  accent: 'bg-primary/12 text-primary border-primary/35',
  success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/28',
  warning: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/28',
  danger: 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/30',
  info: 'bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/28',
}

export function StatusBadge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium leading-none',
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
