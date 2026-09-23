'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Sparkles, ShoppingCart, Truck, Boxes, CircleDollarSign,
  BookOpen, Users2, Settings, LayoutDashboard, Users, FileText, Receipt,
  Building2, LogOut, type LucideIcon,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  section: string
  icon: LucideIcon
  kbd?: string
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

/**
 * GestForce — Command Palette (⌘K)
 *
 * Premium command/search dialog. Drop-in companion for the new <Header>.
 * Uses Radix Dialog (already in your repo via shadcn).
 *
 * To extend: edit the COMMANDS array — the dialog handles search, grouping,
 * keyboard nav, and execution automatically.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (href: string) => { router.push(href); onClose() }

  const COMMANDS: Command[] = useMemo(() => [
    // Navegación
    { id: 'nav-dashboard',     label: 'Ir a Dashboard',         section: 'Navegación', icon: LayoutDashboard, kbd: 'G D', action: () => go('/') },
    { id: 'nav-sales-quotes',  label: 'Ventas · Cotizaciones',  section: 'Navegación', icon: FileText,        kbd: 'G C', action: () => go('/sales?tab=quotes') },
    { id: 'nav-sales-inv',     label: 'Ventas · Facturas',      section: 'Navegación', icon: Receipt,         kbd: 'G F', action: () => go('/sales?tab=invoices') },
    { id: 'nav-sales-cxc',     label: 'Ventas · Cartera (CxC)', section: 'Navegación', icon: CircleDollarSign,            action: () => go('/sales/cxc') },
    { id: 'nav-customers',     label: 'Ir a Clientes',          section: 'Navegación', icon: Users,           kbd: 'G K', action: () => go('/customers') },
    { id: 'nav-purchases-ord', label: 'Compras · Órdenes',      section: 'Navegación', icon: ShoppingCart,                action: () => go('/purchases?tab=orders') },
    { id: 'nav-purchases-cxp', label: 'Compras · CxP',          section: 'Navegación', icon: CircleDollarSign,            action: () => go('/purchases/cxp') },
    { id: 'nav-suppliers',     label: 'Ir a Proveedores',       section: 'Navegación', icon: Truck,                       action: () => go('/suppliers') },
    { id: 'nav-products',      label: 'Ir a Productos',         section: 'Navegación', icon: Boxes,           kbd: 'G P', action: () => go('/products') },
    { id: 'nav-inventory',     label: 'Ir a Inventario',        section: 'Navegación', icon: Boxes,           kbd: 'G I', action: () => go('/inventory') },
    { id: 'nav-finances',      label: 'Ir a Finanzas',          section: 'Navegación', icon: CircleDollarSign,            action: () => go('/finances') },
    { id: 'nav-accounting',    label: 'Ir a Contabilidad',      section: 'Navegación', icon: BookOpen,                    action: () => go('/accounting') },
    { id: 'nav-payroll',       label: 'Ir a Nómina',            section: 'Navegación', icon: Users2,                      action: () => go('/payroll') },

    // Acciones
    { id: 'act-new-quote',    label: 'Nueva cotización',       section: 'Acciones', icon: Plus, kbd: 'N C', action: () => go('/sales/quotes/new') },
    { id: 'act-new-invoice',  label: 'Nueva factura',          section: 'Acciones', icon: Plus, kbd: 'N F', action: () => go('/sales/invoices/new') },
    { id: 'act-new-customer', label: 'Nuevo cliente',          section: 'Acciones', icon: Plus, kbd: 'N K', action: () => go('/customers?new=1') },
    { id: 'act-new-product',  label: 'Nuevo producto',         section: 'Acciones', icon: Plus, kbd: 'N P', action: () => go('/products?new=1') },
    { id: 'act-new-order',    label: 'Nueva orden de compra',  section: 'Acciones', icon: Plus,             action: () => go('/purchases/orders/new') },

    // Sistema
    { id: 'sys-company',  label: 'Cambiar de empresa', section: 'Sistema', icon: Building2, action: () => go('/select-company') },
    { id: 'sys-settings', label: 'Configuración',      section: 'Sistema', icon: Settings,  action: () => go('/settings') },
  ], [router])  // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter(c => c.label.toLowerCase().includes(q))
  }, [query, COMMANDS])

  const grouped = useMemo(() => {
    const acc: Record<string, Command[]> = {}
    filtered.forEach(c => { (acc[c.section] = acc[c.section] || []).push(c) })
    return acc
  }, [filtered])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setActiveIdx(0) }, [query])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[activeIdx]?.action() }
  }

  let runningIdx = -1

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="p-0 max-w-[580px] gap-0 overflow-hidden rounded-2xl border-[var(--glass-border-strong)] bg-card/85 shadow-[var(--shadow-pop)]"
        onKeyDown={handleKey}
      >
        {/* Search */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[var(--glass-border)]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo, acción o registro..."
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="flex h-5 items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1.5 text-[10px] font-mono text-muted-foreground">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto p-2">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className="mb-1">
              <div className="px-2.5 pt-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.07em] uppercase text-muted-foreground/60">
                {section}
              </div>
              {items.map((item) => {
                runningIdx++
                const isActive = runningIdx === activeIdx
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => item.action()}
                    onMouseEnter={() => setActiveIdx(filtered.indexOf(item))}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors border',
                      isActive
                        ? 'bg-[var(--glass-strong)] border-[var(--glass-border)] text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                    {item.kbd && (
                      <span className="inline-flex gap-1">
                        {item.kbd.split(' ').map((k, i) => (
                          <kbd key={i} className="flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1 text-[10px] font-mono text-muted-foreground">
                            {k}
                          </kbd>
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-[13px]">
              No se encontraron resultados.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-[var(--glass-border)] bg-background/20 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1 text-[10px] font-mono">↑</kbd>
              <kbd className="flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1 text-[10px] font-mono">↓</kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[var(--glass-border)] bg-background/40 px-1 text-[10px] font-mono">↵</kbd>
              seleccionar
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> GestForce
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
