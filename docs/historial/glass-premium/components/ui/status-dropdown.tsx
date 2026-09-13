'use client'

import { useState, useRef, useEffect } from 'react'
import { Filter, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GestForce — StatusDropdown
 *
 * Filtro desplegable (régimen, estado, tipo, etc.) con estilo glass.
 * Reemplaza los <select> nativos en las toolbars.
 *
 * @example
 *   <StatusDropdown
 *     value={regime}
 *     onChange={setRegime}
 *     options={[
 *       { id: 'all', label: 'Todos los clientes' },
 *       { id: 'iva', label: 'Resp. IVA' },
 *     ]}
 *   />
 */
export function StatusDropdown({
  value,
  onChange,
  options,
  icon = true,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
  icon?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const current = options.find((o) => o.id === value) ?? options[0]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md border bg-[var(--glass-strong)] px-3 pr-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors',
          open ? 'border-primary/35' : 'border-[var(--glass-border)]'
        )}
      >
        {icon && <Filter className="h-3.5 w-3.5 text-muted-foreground" />}
        {current?.label}
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[180px] rounded-lg border border-[var(--glass-border-strong)] bg-[var(--glass-strong)] p-1.5 shadow-[var(--shadow-float)] backdrop-blur-2xl backdrop-saturate-180">
          {options.map((o) => {
            const sel = o.id === value
            return (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                  sel
                    ? 'border-primary/35 bg-primary/10 font-semibold text-primary'
                    : 'border-transparent font-medium text-muted-foreground hover:bg-[var(--glass)]'
                )}
              >
                <span className="flex-1">{o.label}</span>
                {sel && <Check className="h-3.5 w-3.5" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
