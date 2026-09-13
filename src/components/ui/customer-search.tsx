'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'

export type CustomerOption = {
  id: string
  name: string
  doc_type?: string | null
  doc_number?: string | null
}

interface CustomerSearchProps {
  customers: CustomerOption[]
  value: string                    // customer id seleccionado
  onChange: (id: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
}

export function CustomerSearch({
  customers,
  value,
  onChange,
  readOnly = false,
  placeholder = 'Buscar cliente por nombre o documento...',
  className = '',
}: CustomerSearchProps) {
  const selected = customers.find(c => c.id === value) ?? null

  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query.trim()
    ? customers.filter(c => {
        const q = query.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          (c.doc_number ?? '').toLowerCase().includes(q) ||
          (c.doc_type ?? '').toLowerCase().includes(q)
        )
      })
    : customers.slice(0, 8) // sin query: mostrar los primeros 8

  const baseCls =
    'w-full rounded-lg border bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors'
  const editCls = `${baseCls} border-[var(--glass-border)] focus:border-blue-500`
  const roCls   = `${baseCls} border-[var(--glass-border)] bg-[var(--glass-hover)] text-muted-foreground cursor-default`

  // Modo solo lectura
  if (readOnly) {
    return (
      <div className={`${roCls} ${className}`}>
        {selected?.name ?? <span className="text-muted-foreground italic">Sin cliente</span>}
      </div>
    )
  }

  // Modo editable
  const handleSelect = (c: CustomerOption) => {
    onChange(c.id)
    setQuery('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected && !open ? (
        // Cliente seleccionado — mostrar nombre con botón para cambiar
        <div className={`${editCls} flex items-center justify-between pr-2`}>
          <span className="text-foreground truncate">{selected.name}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 rounded p-0.5 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-muted-foreground transition-colors shrink-0"
            title="Cambiar cliente"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        // Campo de búsqueda
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={`${editCls} pl-8`}
            autoComplete="off"
          />
        </div>
      )}

      {/* Dropdown de sugerencias */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground italic">
              {query ? 'Sin resultados' : 'No hay clientes'}
            </div>
          ) : (
            <>
              {/* Opción sin cliente */}
              <button
                type="button"
                onMouseDown={() => { onChange(''); setQuery(''); setOpen(false) }}
                className="w-full px-4 py-2 text-left text-sm text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors italic border-b border-[var(--glass-border)]"
              >
                Sin cliente asociado
              </button>
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => handleSelect(c)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--glass-hover)] transition-colors"
                >
                  <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                  {(c.doc_type && c.doc_number) && (
                    <span className="ml-3 text-xs text-muted-foreground shrink-0 font-mono">
                      {c.doc_type} {c.doc_number}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
