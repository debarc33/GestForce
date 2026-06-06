'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

/**
 * GestForce — Primitivos de tabla (estilo glass)
 *
 * GlassTable + Th + Td + Tr para tablas compactas y elegantes.
 * Mismo look del mockup: header tenue, filas con hover, borde sutil.
 *
 * @example
 *   <GlassTable>
 *     <thead><tr><Th>Cliente</Th><Th align="right">Total</Th></tr></thead>
 *     <tbody><Tr onClick={...}><Td>Acme</Td><Td align="right">$1.000</Td></Tr></tbody>
 *   </GlassTable>
 */

export function GlassTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-[12.5px]', className)}>{children}</table>
    </div>
  )
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className,
  onClick,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <td
      onClick={onClick}
      className={cn(
        'h-[var(--row-h,38px)] whitespace-nowrap px-3.5 align-middle',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  )
}

export const Tr = forwardRef<HTMLTableRowElement, {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}>(({ children, selected, onClick, className }, ref) => {
  return (
    <tr
      ref={ref}
      onClick={onClick}
      className={cn(
        'border-b border-[var(--glass-border)] transition-colors',
        onClick && 'cursor-pointer',
        selected ? 'bg-primary/10' : 'hover:bg-[var(--glass)]',
        className
      )}
    >
      {children}
    </tr>
  )
})
Tr.displayName = 'Tr'

/** thead row con fondo tenue (envuelve los <Th>) */
export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--glass-border)] bg-white/[0.02]">{children}</tr>
    </thead>
  )
}

/** Link de número de documento (factura, cotización, OC, recibo) */
export function DocLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="cursor-pointer border-none bg-transparent p-0 font-mono text-[12px] font-semibold text-[var(--accent-soft,theme(colors.primary.DEFAULT))] underline-offset-2 hover:underline"
      style={{ color: 'var(--accent-soft)' }}
    >
      {children}
    </button>
  )
}
