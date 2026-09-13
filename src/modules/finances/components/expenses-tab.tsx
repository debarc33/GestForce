'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Download, Search, Paperclip, FileText,
  ChevronDown, RefreshCw, Pencil, Trash2, ToggleLeft,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import type { FinancePeriod } from '../queries'
import {
  useExpenses, useExpenseCategories, useRecurringExpenses,
  deleteExpense, toggleRecurring, generateFromRecurring,
  createRecurringExpense, nextDueDate,
  type Expense, type RecurringExpense, type ExpenseCategory,
} from '../expense-queries'
import { ExpenseForm } from './expense-form'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { recurringFormSchema, type RecurringFormValues, PAYMENT_METHODS, FREQUENCIES } from '../expense-schemas'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

const FREQ_LABEL: Record<string, string> = {
  mensual: 'Mensual', trimestral: 'Trimestral',
  semestral: 'Semestral', anual: 'Anual',
}

const inp = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'
const lbl = 'block text-xs font-medium text-muted-foreground mb-1'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpensesTabProps {
  companyId: string
  period: FinancePeriod
}

// ─── Formulario de recurrente ─────────────────────────────────────────────────

function RecurringForm({
  companyId,
  categories,
  onSuccess,
  onCancel,
}: {
  companyId: string
  categories: ExpenseCategory[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema) as Resolver<RecurringFormValues>,
    defaultValues: {
      category_id: '', description: '', amount: 0,
      frequency: 'mensual', day_of_month: 1,
      start_date: new Date().toISOString().split('T')[0],
      end_date: '', payment_method: 'transferencia', notes: '',
    },
  })

  const mut = useMutation({
    mutationFn: (v: RecurringFormValues) => createRecurringExpense(companyId, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses', companyId] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={form.handleSubmit(v => mut.mutate(v))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Descripción *</label>
          <input {...form.register('description')} className={inp} placeholder="Ej. Arriendo local" />
        </div>
        <div>
          <label className={lbl}>Categoría</label>
          <select {...form.register('category_id')} className={inp}>
            <option value="">— Sin categoría —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Monto (COP) *</label>
          <input type="number" min="0" step="100" {...form.register('amount')} className={inp} />
        </div>
        <div>
          <label className={lbl}>Frecuencia</label>
          <select {...form.register('frequency')} className={inp}>
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Día del mes (1-28)</label>
          <input type="number" min="1" max="28" {...form.register('day_of_month')} className={inp} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Fecha inicio *</label>
          <input type="date" {...form.register('start_date')} className={inp} />
        </div>
        <div>
          <label className={lbl}>Fecha fin (opcional)</label>
          <input type="date" {...form.register('end_date')} className={inp} />
        </div>
        <div>
          <label className={lbl}>Método de pago</label>
          <select {...form.register('payment_method')} className={inp}>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      {mut.isError && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-600">
          {mut.error instanceof Error ? mut.error.message : 'Error al guardar'}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--glass)]">
          Cancelar
        </button>
        <button type="submit" disabled={mut.isPending}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {mut.isPending ? 'Guardando...' : 'Crear plantilla'}
        </button>
      </div>
    </form>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ExpensesTab({ companyId, period }: ExpensesTabProps) {
  const queryClient = useQueryClient()

  const { data: expenses    = [], isLoading } = useExpenses(companyId, period)
  const { data: categories  = [] }             = useExpenseCategories(companyId)
  const { data: recurrentes = [] }             = useRecurringExpenses(companyId)

  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState<'all' | 'fijo' | 'variable'>('all')
  const [showForm, setShowForm]           = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showRecurring, setShowRecurring] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // ── Filtros ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenses.filter(e => {
      if (typeFilter !== 'all' && e.category?.type !== typeFilter) return false
      if (q && !e.description.toLowerCase().includes(q) &&
          !(e.category?.name ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [expenses, search, typeFilter])

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const totalFijo     = expenses.filter(e => e.category?.type === 'fijo').reduce((s, e) => s + e.amount, 0)
  const totalVariable = expenses.filter(e => e.category?.type === 'variable').reduce((s, e) => s + e.amount, 0)
  const totalDirecto  = totalFijo + totalVariable

  // ── Mutaciones ───────────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', companyId] })
      setConfirmDelete(null)
    },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleRecurring(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring_expenses', companyId] }),
  })

  const generateMut = useMutation({
    mutationFn: (rec: RecurringExpense) =>
      generateFromRecurring(companyId, rec, new Date().toISOString().split('T')[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', companyId] })
    },
  })

  // ── Exportar ──────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const cols: ExcelColumn<Expense>[] = [
      { header: 'Fecha',       key: e => fmtDate(e.expense_date), width: 14 },
      { header: 'Categoría',   key: e => e.category?.name ?? '—',  width: 20 },
      { header: 'Tipo',        key: e => e.category?.type === 'fijo' ? 'Fijo' : e.category?.type === 'variable' ? 'Variable' : '—', width: 10 },
      { header: 'Descripción', key: 'description',                 width: 34 },
      { header: 'Monto',       key: e => fmtCOP(e.amount),         width: 16 },
      { header: 'Método',      key: 'payment_method',              width: 16 },
      { header: 'Estado',      key: e => e.status === 'pagado' ? 'Pagado' : 'Pendiente', width: 12 },
    ]
    exportToExcel(filtered, cols, `gastos_${period.from}_${period.to}`)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl glass-surface p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Gastos fijos</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtCOP(totalFijo)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Arriendo, seguros, suscripciones…</p>
        </div>
        <div className="rounded-2xl glass-surface p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Gastos variables</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtCOP(totalVariable)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Servicios, mantenimiento, viáticos…</p>
        </div>
        <div className={`rounded-2xl p-4 ${totalDirecto > 0 ? 'glass-surface border border-amber-500/20 bg-amber-500/5' : 'glass-surface'}`}>
          <p className="text-xs font-medium text-muted-foreground mb-1">Total gastos directos</p>
          <p className={`text-xl font-bold tabular-nums ${totalDirecto > 0 ? 'text-amber-600' : 'text-foreground'}`}>
            {fmtCOP(totalDirecto)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">En el período seleccionado</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Nuevo gasto
        </button>

        <div className="flex items-center gap-0.5 rounded-lg glass-surface px-1 py-1">
          <button onClick={handleExport} title="Exportar Excel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por descripción o categoría..."
            className="w-full rounded-lg glass-surface border border-[var(--glass-border)] pl-8 pr-3 py-[7px] text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-all"
          />
        </div>

        {/* Filtro tipo */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          className="rounded-lg glass-surface border border-[var(--glass-border)] px-3 py-[7px] text-sm text-foreground focus:outline-none focus:border-primary"
        >
          <option value="all">Todos los tipos</option>
          <option value="fijo">Solo fijos</option>
          <option value="variable">Solo variables</option>
        </select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl glass-surface" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl glass-surface py-16 text-center">
          <p className="text-sm text-muted-foreground">No hay gastos registrados en este período.</p>
          <button onClick={() => setShowForm(true)}
            className="mt-3 text-xs text-primary hover:underline">
            Registrar primer gasto →
          </button>
        </div>
      ) : (
        <div className="rounded-2xl glass-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--glass-border)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Soporte</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-[var(--glass)] transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(e.expense_date)}
                  </td>
                  <td className="px-4 py-3">
                    {e.category ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          e.category.type === 'fijo'
                            ? 'bg-blue-500/10 border-blue-500/20 text-primary'
                            : 'bg-orange-500/10 border-orange-500/20 text-orange-600'
                        }`}>
                          {e.category.type === 'fijo' ? 'Fijo' : 'Variable'}
                        </span>
                        <span className="text-sm text-foreground">{e.category.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">
                    {e.description}
                    {e.recurring_expense_id && (
                      <span className="ml-1.5 text-[10px] text-primary font-medium">↻ recurrente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {fmtCOP(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${
                      e.status === 'pagado'
                        ? 'bg-green-500/10 border-green-500/20 text-green-600'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                    }`}>
                      {e.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {e.receipt_url ? (
                      <a href={e.receipt_url} target="_blank" rel="noreferrer"
                        title="Ver soporte"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors">
                        <Paperclip className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/20">—</span>
                    )}
                    {e.journal_entry_id && (
                      <span title="Comprobante contable registrado"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary/60">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => setEditingExpense(e)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--glass-strong)] hover:text-foreground transition-colors"
                        title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(e.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
                        title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-[var(--glass-border)] bg-[var(--glass)]">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  {filtered.length} gasto{filtered.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                  {fmtCOP(filtered.reduce((s, e) => s + e.amount, 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Sección de Gastos Recurrentes */}
      <div className="rounded-2xl glass-surface">
        <button
          onClick={() => setShowRecurring(v => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--glass)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Gastos recurrentes</span>
            {recurrentes.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                {recurrentes.length}
              </span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showRecurring ? 'rotate-180' : ''}`} />
        </button>

        {showRecurring && (
          <div className="border-t border-[var(--glass-border)] p-4 space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setShowRecurringForm(true)}
                className="flex items-center gap-1.5 rounded-lg glass-surface border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Nueva plantilla
              </button>
            </div>

            {recurrentes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay plantillas de gastos recurrentes configuradas.
              </p>
            ) : (
              <div className="space-y-2">
                {recurrentes.map(rec => (
                  <div key={rec.id}
                    className="flex items-center gap-3 rounded-lg glass-surface border border-[var(--glass-border)] px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{rec.description}</span>
                        {rec.category && (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            rec.category.type === 'fijo'
                              ? 'bg-blue-500/10 border-blue-500/20 text-primary'
                              : 'bg-orange-500/10 border-orange-500/20 text-orange-600'
                          }`}>
                            {rec.category.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtCOP(rec.amount)} · {FREQ_LABEL[rec.frequency]} día {rec.day_of_month}
                        {' · '}
                        <span className="text-primary font-medium">
                          Próxima: {fmtDate(nextDueDate(rec))}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => generateMut.mutate(rec)}
                        disabled={generateMut.isPending}
                        title="Generar gasto hoy"
                        className="flex items-center gap-1 rounded-lg glass-surface border border-green-500/30 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:bg-green-500/10 disabled:opacity-50 transition-colors">
                        <RefreshCw className="h-3 w-3" />
                        Generar
                      </button>
                      <button
                        onClick={() => toggleMut.mutate({ id: rec.id, active: false })}
                        title="Desactivar plantilla"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors">
                        <ToggleLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Nuevo gasto */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false) }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl glass-surface shadow-xl border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Registrar gasto</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            companyId={companyId}
            categories={categories}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Editar gasto */}
      <Dialog open={!!editingExpense} onOpenChange={v => { if (!v) setEditingExpense(null) }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl glass-surface shadow-xl border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Editar gasto</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <ExpenseForm
              companyId={companyId}
              categories={categories}
              expense={editingExpense}
              onSuccess={() => setEditingExpense(null)}
              onCancel={() => setEditingExpense(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Nueva plantilla recurrente */}
      <Dialog open={showRecurringForm} onOpenChange={v => { if (!v) setShowRecurringForm(false) }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl glass-surface shadow-xl border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Nueva plantilla recurrente</DialogTitle>
          </DialogHeader>
          <RecurringForm
            companyId={companyId}
            categories={categories}
            onSuccess={() => setShowRecurringForm(false)}
            onCancel={() => setShowRecurringForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null) }}>
        <DialogContent className="sm:max-w-sm rounded-2xl glass-surface shadow-xl border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">¿Eliminar este gasto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setConfirmDelete(null)}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--glass)]">
              Cancelar
            </button>
            <button
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete)}
              disabled={deleteMut.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
