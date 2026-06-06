'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Package, Boxes, ArrowDownToLine, ArrowUpFromLine,
  Settings2, Search, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyStore } from '@/store/useCompanyStore'
import {
  useInventoryMovements, createAdjustment,
  MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS,
  type MovementType,
} from '@/modules/inventory/queries'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt   = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

type Product = {
  id: string; name: string; sku: string | null
  unit: string | null; stock: number; min_stock: number | null
}

function useProducts(companyId?: string | null) {
  return useQuery({
    queryKey: ['products_inventory', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, unit, stock, min_stock')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as Product[]
    },
    enabled: !!companyId,
  })
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'movimientos' | 'kardex' | 'ajustes'

// ── Movimientos Tab ───────────────────────────────────────────────────────────

function MovimientosTab({ companyId }: { companyId: string }) {
  const [filterType, setFilterType] = useState<string>('')
  const [filterProduct, setFilterProduct] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data: movements = [], isLoading } = useInventoryMovements(
    companyId,
    filterProduct || null,
  )
  const { data: products = [] } = useProducts(companyId)

  const filtered = movements.filter(m => {
    if (filterType && m.movement_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      const pname = m.product?.name?.toLowerCase() ?? ''
      const ref   = (m.reference_no ?? '').toLowerCase()
      if (!pname.includes(q) && !ref.includes(q)) return false
    }
    return true
  })

  function exportExcel() {
    const rows = [
      ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Stock antes', 'Stock después', 'Referencia', 'Notas'],
      ...filtered.map(m => [
        fmtDate(m.created_at),
        m.product?.name ?? m.product_id,
        MOVEMENT_TYPE_LABELS[m.movement_type],
        m.quantity,
        m.stock_before,
        m.stock_after,
        m.reference_no ?? '',
        m.notes ?? '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = 'movimientos_inventario.csv'; a.click()
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o referencia..."
            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none min-w-44"
        >
          <option value="">Todos los productos</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none min-w-36"
        >
          <option value="">Todos los tipos</option>
          {(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map(t => (
            <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors"
        >
          <Download className="h-4 w-4" />Exportar
        </button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center">
          <Boxes className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>
          <p className="text-xs text-muted-foreground mt-1">Los ajustes manuales aparecerán aquí.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden bg-[var(--glass)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--glass-hover)] border-b border-[var(--glass-border)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Stock antes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Stock después</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-[var(--glass-hover)] transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-48 truncate">
                    {m.product?.name ?? '—'}
                    {m.product?.sku && <span className="ml-1.5 text-xs text-muted-foreground font-mono">{m.product.sku}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${MOVEMENT_TYPE_COLORS[m.movement_type]}`}>
                      {MOVEMENT_TYPE_LABELS[m.movement_type]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium tabular-nums ${m.quantity >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {m.quantity >= 0 ? '+' : ''}{fmt(m.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums">{fmt(m.stock_before)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-foreground tabular-nums">{fmt(m.stock_after)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {m.reference_no
                      ? <span className="font-mono">{m.reference_no}</span>
                      : m.notes
                        ? <span className="italic">{m.notes}</span>
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Kardex Tab ────────────────────────────────────────────────────────────────

function KardexTab({ companyId }: { companyId: string }) {
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const { data: products = [] } = useProducts(companyId)
  const { data: allMovements = [], isLoading } = useInventoryMovements(companyId, selectedProduct || null)

  const product = products.find(p => p.id === selectedProduct)

  // Solo movimientos de este producto, orden cronológico ascendente
  const movements = [...allMovements].reverse()

  function exportExcel() {
    if (!product) return
    const rows = [
      ['Fecha', 'Tipo', 'Entrada', 'Salida', 'Saldo', 'Referencia'],
      ...movements.map(m => [
        fmtDate(m.created_at),
        MOVEMENT_TYPE_LABELS[m.movement_type],
        m.quantity > 0 ? m.quantity : '',
        m.quantity < 0 ? Math.abs(m.quantity) : '',
        m.stock_after,
        m.reference_no ?? m.notes ?? '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `kardex_${product.name.replace(/\s+/g, '_')}.csv`; a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select
          value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
          className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none flex-1 max-w-80"
        >
          <option value="">— Selecciona un producto —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {product && (
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors"
          >
            <Download className="h-4 w-4" />Exportar
          </button>
        )}
      </div>

      {!selectedProduct ? (
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center">
          <Package className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Selecciona un producto para ver su kardex.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>
      ) : (
        <div className="space-y-4">
          {/* Info del producto */}
          {product && (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{product.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {product.sku && <span className="text-xs font-mono text-muted-foreground">SKU: {product.sku}</span>}
                    {product.unit && <span className="text-xs text-muted-foreground">Unidad: {product.unit}</span>}
                    {product.min_stock != null && (
                      <span className="text-xs text-muted-foreground">Stock mín.: {fmt(product.min_stock)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Stock actual</p>
                  <p className={`text-2xl font-bold tabular-nums ${product.min_stock != null && product.stock <= product.min_stock ? 'text-red-600' : 'text-foreground'}`}>
                    {fmt(product.stock)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {movements.length === 0 ? (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin movimientos para este producto.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden bg-[var(--glass)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--glass-hover)] border-b border-[var(--glass-border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground text-green-700">Entrada</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground text-red-600">Salida</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {movements.map(m => (
                    <tr key={m.id} className="hover:bg-[var(--glass-hover)] transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${MOVEMENT_TYPE_COLORS[m.movement_type]}`}>
                          {MOVEMENT_TYPE_LABELS[m.movement_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-700 tabular-nums">
                        {m.quantity > 0 ? fmt(m.quantity) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600 tabular-nums">
                        {m.quantity < 0 ? fmt(Math.abs(m.quantity)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground tabular-nums">
                        {fmt(m.stock_after)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {m.reference_no
                          ? <span className="font-mono">{m.reference_no}</span>
                          : m.notes
                            ? <span className="italic">{m.notes}</span>
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer — saldo final */}
                <tfoot className="border-t-2 border-[var(--glass-border)] bg-[var(--glass-hover)]">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-foreground">Saldo actual</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-lg text-foreground tabular-nums">
                      {product ? fmt(product.stock) : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ajustes Tab ───────────────────────────────────────────────────────────────

function AjustesTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient()
  const { data: products = [] } = useProducts(companyId)

  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [newQty, setNewQty]                   = useState<string>('')
  const [notes, setNotes]                     = useState<string>('')
  const [error, setError]                     = useState<string | null>(null)
  const [success, setSuccess]                 = useState(false)

  const product = products.find(p => p.id === selectedProduct)
  const parsedQty = newQty === '' ? NaN : Number(newQty)
  const diff = !isNaN(parsedQty) && product ? parsedQty - product.stock : null

  const mut = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('Selecciona un producto')
      if (isNaN(parsedQty) || parsedQty < 0) throw new Error('Ingresa una cantidad válida (≥ 0)')
      if (!notes.trim()) throw new Error('El motivo del ajuste es requerido')
      await createAdjustment(companyId, selectedProduct, parsedQty, notes.trim())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_movements', companyId] })
      queryClient.invalidateQueries({ queryKey: ['products_inventory', companyId] })
      setNewQty('')
      setNotes('')
      setError(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-0.5">Ajuste de inventario</h3>
          <p className="text-xs text-muted-foreground">Corrige el stock de un producto (conteo físico o corrección).</p>
        </div>

        {/* Producto */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Producto</label>
          <select
            value={selectedProduct}
            onChange={e => { setSelectedProduct(e.target.value); setNewQty(''); setError(null) }}
            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">— Selecciona un producto —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Stock info */}
        {product && (
          <div className="rounded-lg bg-[var(--glass-hover)] border border-[var(--glass-border)] px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stock registrado actualmente</span>
            <span className="font-mono font-bold text-foreground tabular-nums text-lg">
              {fmt(product.stock)}
              {product.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{product.unit}</span>}
            </span>
          </div>
        )}

        {/* Nueva cantidad */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cantidad real (conteo físico)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={newQty}
            onChange={e => { setNewQty(e.target.value); setError(null) }}
            placeholder="0"
            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {/* Diferencia calculada */}
          {diff !== null && (
            <p className={`text-xs mt-1.5 font-medium ${diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
              {diff === 0 ? 'Sin cambios' : diff > 0 ? `+${fmt(diff)} de entrada` : `${fmt(diff)} de salida`}
            </p>
          )}
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motivo del ajuste</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ej. Conteo físico enero 2026, merma por vencimiento..."
            rows={3}
            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {success && (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
            Ajuste registrado correctamente.
          </p>
        )}

        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !selectedProduct}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {mut.isPending ? 'Guardando...' : 'Registrar ajuste'}
        </button>
      </div>

      <p className="text-xs text-muted-foreground bg-[var(--glass-hover)] rounded-lg border border-[var(--glass-border)] px-4 py-3">
        Los ajustes quedan registrados en el historial de movimientos con tipo "Ajuste".
        Úsalos para correcciones por conteo físico, mermas, devoluciones sin referencia o errores de carga.
      </p>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const [tab, setTab] = useState<Tab>('movimientos')

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'movimientos', label: 'Movimientos',   icon: Boxes },
    { id: 'kardex',      label: 'Kardex',         icon: Package },
    { id: 'ajustes',     label: 'Ajustes',        icon: Settings2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Inventario</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Movimientos, kardex por producto y ajustes de stock.
          </p>
        </div>

        {/* KPIs rápidos */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
            <ArrowDownToLine className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Entradas</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <ArrowUpFromLine className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-red-700">Salidas</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--glass-border)]">
        <nav className="-mb-px flex gap-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-[var(--glass-border)]'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeCompanyId && (
        <>
          {tab === 'movimientos' && <MovimientosTab companyId={activeCompanyId} />}
          {tab === 'kardex'      && <KardexTab      companyId={activeCompanyId} />}
          {tab === 'ajustes'     && <AjustesTab     companyId={activeCompanyId} />}
        </>
      )}
    </div>
  )
}
