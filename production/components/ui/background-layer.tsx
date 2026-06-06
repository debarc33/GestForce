'use client'

import { cn } from '@/lib/utils'

/**
 * GestForce — BackgroundLayer
 *
 * Fondo futurista fijo detrás de toda la app. 6 variantes + grid técnico opcional.
 * Lee la preferencia desde props (la pasa el layout leyendo ui_preferences por empresa).
 *
 * Uso en (dashboard)/layout.tsx:
 *   <BackgroundLayer variant={prefs.background} grid={prefs.techGrid} />
 */

type BgVariant = 'aurora' | 'mesh' | 'nebula' | 'synthwave' | 'topo' | 'circuit'

const BG: Record<BgVariant, string> = {
  aurora:
    'radial-gradient(900px 700px at 12% -10%, var(--amb-1, rgba(139,92,255,0.4)), transparent 60%), radial-gradient(800px 600px at 95% 10%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(700px 500px at 60% 100%, rgba(236,72,153,0.14), transparent 55%)',
  mesh:
    'radial-gradient(closest-side at 25% 30%, var(--amb-1, rgba(139,92,255,0.45)), transparent), radial-gradient(closest-side at 80% 25%, rgba(56,189,248,0.30), transparent), radial-gradient(closest-side at 65% 85%, rgba(236,72,153,0.28), transparent)',
  nebula:
    'radial-gradient(ellipse at 70% 20%, var(--amb-1, rgba(139,92,255,0.35)), transparent 55%), radial-gradient(ellipse at 20% 60%, rgba(56,189,248,0.2), transparent 55%)',
  synthwave:
    'linear-gradient(180deg, transparent 40%, var(--amb-1, rgba(139,92,255,0.25)) 70%, transparent 80%), radial-gradient(circle at 50% 70%, rgba(167,139,250,0.4), transparent 45%)',
  topo:
    'radial-gradient(circle at 80% 10%, var(--amb-1, rgba(139,92,255,0.28)), transparent 55%), radial-gradient(circle at 10% 95%, rgba(56,189,248,0.2), transparent 55%)',
  circuit:
    'radial-gradient(circle at 15% 10%, var(--amb-1, rgba(139,92,255,0.28)), transparent 55%)',
}

export function BackgroundLayer({
  variant = 'aurora',
  grid = true,
}: {
  variant?: BgVariant
  grid?: boolean
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: BG[variant] ?? BG.aurora }}
      />
      {grid && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none fixed inset-0 -z-10 opacity-[0.4]',
            'dark:opacity-[0.25]'
          )}
          style={{
            backgroundImage:
              'linear-gradient(var(--glass-border) 1px, transparent 1px), linear-gradient(90deg, var(--glass-border) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)',
          }}
        />
      )}
    </>
  )
}
