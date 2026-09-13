'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GestForce — Pagination
 *
 * Pie de tabla: "Mostrando X–Y de N" + selector de filas + prev/página/next.
 *
 * @example
 *   <Pagination
 *     page={page} totalItems={rows.length} perPage={perPage}
 *     onPage={setPage} onPerPage={setPerPage}
 *   />
 */
export function Pagination({
  page,
  totalItems,
  perPage,
  onPage,
  onPerPage,
  perPageOptions = [10, 20, 50],
}: {
  page: number
  totalItems: number
  perPage: number
  onPage: (p: number) => void
  onPerPage: (n: number) => void
  perPageOptions?: number[]
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  const from = totalItems === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--glass-border)] px-4 py-2.5 text-[12px] text-muted-foreground">
      <span>
        Mostrando{' '}
        <span className="font-semibold text-foreground">
          {from}–{to}
        </span>{' '}
        de <span className="font-semibold text-foreground">{totalItems}</span> resultados
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span>Filas</span>
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="h-7 cursor-pointer rounded-sm border border-[var(--glass-border)] bg-[var(--glass-strong)] px-1.5 text-[12px] text-muted-foreground outline-none"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <PagerBtn disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </PagerBtn>
          <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-sm border border-primary/35 bg-primary/15 px-2 text-[12px] font-semibold text-primary">
            {page}
          </span>
          <PagerBtn disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </PagerBtn>
        </div>
      </div>
    </div>
  )
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[26px] w-[26px] items-center justify-center rounded-sm border border-[var(--glass-border)] bg-transparent text-muted-foreground transition-colors',
        disabled ? 'cursor-default opacity-50' : 'hover:bg-[var(--glass-strong)]'
      )}
    >
      {children}
    </button>
  )
}
