'use client'

import { useRef } from 'react'
import { Plus, Trash2, Printer, Upload, Download, Search, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  label: string
  value: string
}

interface ModuleToolbarProps {
  title?: string
  subtitle?: string
  selectedCount?: number
  onAdd?: () => void
  onDelete?: () => void
  onPrint: () => void
  onUpload: (file: File) => void
  onExport?: () => void
  extraButtons?: React.ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filterOptions?: FilterOption[]
  filterValue?: string
  onFilterChange?: (value: string) => void
}

export function ModuleToolbar({
  title,
  subtitle,
  selectedCount = 0,
  onAdd,
  onDelete,
  onPrint,
  onUpload,
  onExport,
  extraButtons,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  filterOptions,
  filterValue = 'all',
  onFilterChange,
}: ModuleToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const btnBase =
    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

  const iconBtn = cn(
    'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
    'hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors'
  )

  return (
    <div className="space-y-3">
      {/* Título */}
      {(title || subtitle) && (
        <div className="flex items-end justify-between">
          <div>
            {title && (
              <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* Barra de acciones */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">

        {/* Botón Nuevo (principal) */}
        {onAdd && (
          <button
            onClick={onAdd}
            className={cn(btnBase, 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nuevo</span>
          </button>
        )}

        {/* Acciones secundarias: eliminar, imprimir, import, export */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-1 py-1 shadow-sm">
          {onDelete && (
            <>
              <button
                onClick={onDelete}
                disabled={selectedCount === 0}
                title={selectedCount > 0 ? `Eliminar ${selectedCount} seleccionados` : 'Selecciona filas primero'}
                className={cn(
                  'flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors',
                  selectedCount > 0
                    ? 'text-red-500 hover:bg-red-50 hover:text-red-700'
                    : 'text-zinc-300 cursor-not-allowed'
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedCount > 0 && <span>{selectedCount}</span>}
              </button>
              <div className="mx-0.5 h-4 w-px bg-[var(--glass-border)]" />
            </>
          )}

          <button onClick={onPrint} title="Imprimir" className={iconBtn}>
            <Printer className="h-3.5 w-3.5" />
          </button>

          <button onClick={() => fileInputRef.current?.click()} title="Importar Excel / CSV" className={iconBtn}>
            <Upload className="h-3.5 w-3.5" />
          </button>

          <input
            ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) { onUpload(file); e.target.value = '' }
            }}
          />

          {onExport && (
            <button onClick={onExport} title="Exportar a Excel" className={iconBtn}>
              <Download className="h-3.5 w-3.5" />
            </button>
          )}

          {extraButtons && (
            <>
              <div className="mx-0.5 h-4 w-px bg-[var(--glass-border)]" />
              {extraButtons}
            </>
          )}
        </div>

        {/* Buscador */}
        {onSearchChange && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] pl-8 pr-3 py-[7px]',
                'text-[13px] text-foreground placeholder:text-muted-foreground',
                'shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/10 transition-all'
              )}
            />
          </div>
        )}

        {/* Filtro */}
        {filterOptions && filterOptions.length > 0 && onFilterChange && (
          <div className="relative shrink-0">
            <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <select
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              className={cn(
                'appearance-none rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] pl-7 pr-7 py-[7px]',
                'text-[13px] text-foreground shadow-sm cursor-pointer',
                'focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/10 transition-all'
              )}
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  )
}
