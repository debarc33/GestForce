'use client'

/**
 * GestForce — BackgroundLayer  [REEMPLAZO]
 *
 * Pega en: src/components/ui/background-layer.tsx
 *
 * Renderiza la escena futurista detrás de toda la app y lee el fondo elegido
 * desde el AppearanceProvider. Usa clases GLOBALES (.gf-ambient / .gf-grid) que
 * declaraste en globals.css, así Tailwind v4 nunca las elimina.
 *
 * Si todavía NO tienes el AppearanceProvider montado, este componente igual
 * funciona con el fondo "aurora" por defecto (try/catch).
 */

import { useEffect } from 'react'

let useAppearanceSafe: () => { background?: string; grid?: boolean }
try {
  // Import dinámico tolerante: si el provider existe, se usa.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useAppearanceSafe = require('@/components/appearance/appearance-provider').useAppearance
} catch {
  useAppearanceSafe = () => ({ background: 'aurora', grid: true })
}

const SCENE: Record<string, string> = {
  aurora:
    'radial-gradient(900px 700px at 12% -10%, var(--amb-1), transparent 60%), radial-gradient(800px 600px at 95% 8%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(760px 560px at 60% 100%, rgba(236,72,153,0.12), transparent 55%)',
  mesh:
    'radial-gradient(closest-side at 25% 30%, var(--amb-1), transparent), radial-gradient(closest-side at 80% 25%, rgba(56,189,248,0.22), transparent), radial-gradient(closest-side at 65% 85%, rgba(236,72,153,0.20), transparent)',
  nebula:
    'radial-gradient(ellipse at 70% 20%, var(--amb-1), transparent 55%), radial-gradient(ellipse at 20% 60%, rgba(56,189,248,0.16), transparent 55%)',
  horizonte:
    'linear-gradient(180deg, transparent 40%, var(--amb-1) 72%, transparent 82%), radial-gradient(circle at 50% 75%, rgba(167,139,250,0.3), transparent 45%)',
  topo:
    'radial-gradient(circle at 80% 10%, var(--amb-1), transparent 55%), radial-gradient(circle at 10% 95%, rgba(56,189,248,0.16), transparent 55%)',
  circuit:
    'radial-gradient(circle at 15% 10%, var(--amb-1), transparent 55%)',
}

export function BackgroundLayer() {
  const { background = 'aurora', grid = true } = useAppearanceSafe()

  // Aplica la escena elegida a la capa ambiental
  useEffect(() => {
    const el = document.getElementById('gf-ambient')
    if (el) el.style.background = SCENE[background] ?? SCENE.aurora
  }, [background])

  return (
    <>
      <div id="gf-ambient" aria-hidden className="gf-ambient" style={{ background: SCENE[background] ?? SCENE.aurora }} />
      {grid && <div aria-hidden className="gf-grid" />}
    </>
  )
}
