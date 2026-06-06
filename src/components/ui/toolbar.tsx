'use client'

import { cn } from '@/lib/utils'
import { Printer, Upload, Download, Search } from 'lucide-react'

/**
 * GestForce — Toolbar uniforme
 *
 * Orden FIJO (acordado con el cliente):
 *   [iconos imprimir/importar/exportar] [buscador flex-1] [filtros] [BOTÓN PRIMARIO derecha]
 *
 * @example
 *   <Toolbar
 *     onPrint={...} onImport={...} onExport={...}
 *     search={q} onSearch={setQ} searchPlaceholder="Buscar cliente..."
 *     filters={<RegimeFilter .../>}
 *     primary={<Button>Nuevo</Button>}   // SIEMPRE al extremo derecho
 *   />
 */
export function Toolbar({
  onPrint,
  onImport,
  onExport,
  search,
  onSearch,
  searchPlaceholder = 'Buscar...',
  filters,
  primary,
  className,
}: {
  onPrint?: () => void
  onImport?: () => void
  onExport?: () => void
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
  primary?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-[var(--glass-border)] px-3.5 py-3',
        className
      )}
    >
      {(onPrint || onImport || onExport) && (
        <div className="flex gap-1.5">
          {onPrint && <IconBtn icon={Printer} title="Imprimir" onClick={onPrint} />}
          {onImport && <IconBtn icon={Upload} title="Importar" onClick={onImport} />}
          {onExport && <IconBtn icon={Download} title="Exportar a Excel" onClick={onExport} />}
        </div>
      )}

      {onSearch && (
        <div className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[var(--glass-border)] bg-[var(--glass-strong)] px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 border-none bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}

      {filters}

      {/* Botón primario SIEMPRE al extremo derecho */}
      {primary}
    </div>
  )
}

function IconBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--glass-border)] bg-transparent text-muted-foreground transition-colors hover:bg-[var(--glass-strong)] hover:text-foreground"
    >
      <Icon className="h-[15px] w-[15px]" />
    </button>
  )
}
