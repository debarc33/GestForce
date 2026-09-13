'use client'

import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Paperclip, X } from 'lucide-react'
import {
  expenseFormSchema, categoryFormSchema,
  type ExpenseFormValues, type CategoryFormValues,
  PAYMENT_METHODS, FREQUENCIES,
} from '../expense-schemas'
import {
  createExpense, updateExpense, createExpenseCategory, uploadReceipt,
  type Expense, type ExpenseCategory,
} from '../expense-queries'

const inp = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'
const lbl = 'block text-xs font-medium text-muted-foreground mb-1'
const err = 'mt-0.5 text-xs text-red-600'

interface ExpenseFormProps {
  companyId: string
  categories: ExpenseCategory[]
  expense?: Expense
  onSuccess: () => void
  onCancel: () => void
}

export function ExpenseForm({
  companyId, categories, expense, onSuccess, onCancel,
}: ExpenseFormProps) {
  const queryClient = useQueryClient()
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [receiptFile, setReceiptFile]         = useState<File | null>(null)
  const [receiptError, setReceiptError]       = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema) as Resolver<ExpenseFormValues>,
    defaultValues: expense ? {
      category_id:          expense.category_id ?? '',
      expense_date:         expense.expense_date,
      description:          expense.description,
      amount:               expense.amount,
      payment_method:       expense.payment_method,
      status:               expense.status,
      notes:                expense.notes ?? '',
      create_journal_entry: false,
      is_recurring:         false,
    } : {
      category_id: '', expense_date: today, description: '', amount: 0,
      payment_method: 'transferencia', status: 'pagado', notes: '',
      create_journal_entry: false, is_recurring: false,
      frequency: 'mensual', day_of_month: 1, end_date: '',
    },
  })

  const watchRecurring = form.watch('is_recurring')
  const watchStatus    = form.watch('status')

  // ── Categoría inline ────────────────────────────────────────────────────────
  const catForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema) as Resolver<CategoryFormValues>,
    defaultValues: { name: '', type: 'variable', account_code: '5195' },
  })

  const catMut = useMutation({
    mutationFn: (v: CategoryFormValues) => createExpenseCategory(companyId, v),
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories', companyId] })
      form.setValue('category_id', newCat.id)
      catForm.reset()
      setShowNewCategory(false)
    },
  })

  // ── Gasto ────────────────────────────────────────────────────────────────────
  const mut = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const category = categories.find(c => c.id === values.category_id) ?? null
      let saved: Expense
      if (expense) {
        saved = await updateExpense(expense.id, values)
      } else {
        saved = await createExpense(companyId, values, category)
      }
      // Subir recibo si hay archivo seleccionado
      if (receiptFile) {
        await uploadReceipt(companyId, saved.id, receiptFile)
      }
      return saved
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', companyId] })
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses', companyId] })
      onSuccess()
    },
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      setReceiptError('El archivo no puede superar 5 MB')
      return
    }
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf']
    if (!allowed.includes(f.type)) {
      setReceiptError('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF')
      return
    }
    setReceiptError(null)
    setReceiptFile(f)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={form.handleSubmit(v => mut.mutate(v))} className="space-y-3">

        {/* Fecha + Categoría */}
        <div className="grid grid-cols-[160px_1fr] gap-3">
          <div>
            <label className={lbl}>Fecha <span className="text-red-500">*</span></label>
            <input type="date" {...form.register('expense_date')} className={inp} />
            {form.formState.errors.expense_date && (
              <p className={err}>{form.formState.errors.expense_date.message}</p>
            )}
          </div>
          <div>
            <label className={lbl}>Categoría</label>
            <div className="flex items-center gap-2">
              <select {...form.register('category_id')} className={inp}>
                <option value="">— Sin categoría —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === 'fijo' ? 'Fijo' : 'Variable'})
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewCategory(v => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg glass-surface text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                title="Nueva categoría">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Nueva categoría inline */}
        {showNewCategory && (
          <div className="rounded-xl glass-surface border border-primary/20 p-3 space-y-3">
            <p className="text-xs font-semibold text-blue-700">Nueva categoría</p>
            <div className="grid grid-cols-[1fr_120px_180px] gap-3">
              <div>
                <label className={lbl}>Nombre</label>
                <input {...catForm.register('name')} className={inp} placeholder="Ej. Arriendo" />
              </div>
              <div>
                <label className={lbl}>Tipo</label>
                <select {...catForm.register('type')} className={inp}>
                  <option value="fijo">Fijo</option>
                  <option value="variable">Variable</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Cuenta contable</label>
                <select {...catForm.register('account_code')} className={inp}>
                  <option value="5195">5195 — Diversos</option>
                  <option value="5155">5155 — Gastos de viaje</option>
                  <option value="5240">5240 — Publicidad</option>
                  <option value="510506">510506 — Sueldos</option>
                  <option value="5105">5105 — Gastos personal</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewCategory(false)}
                className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs text-muted-foreground hover:bg-[var(--glass-hover)]">
                Cancelar
              </button>
              <button type="button"
                onClick={catForm.handleSubmit(v => catMut.mutate(v))}
                disabled={catMut.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {catMut.isPending ? 'Guardando...' : 'Crear categoría'}
              </button>
            </div>
          </div>
        )}

        {/* Descripción */}
        <div>
          <label className={lbl}>Descripción <span className="text-red-500">*</span></label>
          <input {...form.register('description')} className={inp}
            placeholder="Ej. Arriendo mes de enero, Factura EPM, Mantenimiento..." />
          {form.formState.errors.description && (
            <p className={err}>{form.formState.errors.description.message}</p>
          )}
        </div>

        {/* Monto + Método + Estado */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Monto (COP) <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="100"
              {...form.register('amount')} className={inp} placeholder="0" />
            {form.formState.errors.amount && (
              <p className={err}>{form.formState.errors.amount.message}</p>
            )}
          </div>
          <div>
            <label className={lbl}>Método de pago</label>
            <select {...form.register('payment_method')} className={inp}>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Estado</label>
            <select {...form.register('status')} className={inp}>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>

        {/* Recibo */}
        <div>
          <label className={lbl}>Soporte / Recibo</label>
          {expense?.receipt_url ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-hover)] px-3 py-2">
              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={expense.receipt_url} target="_blank" rel="noreferrer"
                className="text-sm text-primary hover:underline truncate">
                Ver recibo actual
              </a>
              <span className="text-xs text-muted-foreground">(subir nuevo reemplazará el anterior)</span>
            </div>
          ) : null}
          <div className="mt-1 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg glass-surface border border-[var(--glass-border)] px-3 py-2 text-sm text-muted-foreground hover:bg-[var(--glass)] transition-colors">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              {receiptFile ? receiptFile.name : 'Adjuntar archivo'}
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            </label>
            {receiptFile && (
              <button type="button" onClick={() => setReceiptFile(null)}
                className="text-muted-foreground hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {receiptError && <p className={err}>{receiptError}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">JPG, PNG, WEBP o PDF — máx. 5 MB</p>
        </div>

        {/* Notas */}
        <div>
          <label className={lbl}>Notas <span className="text-muted-foreground font-normal">(opcional)</span></label>
          <textarea {...form.register('notes')} rows={2}
            className={`${inp} resize-none`} placeholder="Observaciones adicionales..." />
        </div>

        {/* Opciones adicionales */}
        <div className="space-y-2 border-t border-[var(--glass-border)] pt-3">
          {/* Comprobante contable — solo si ya está pagado */}
          {watchStatus === 'pagado' && !expense && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" {...form.register('create_journal_entry')}
                className="mt-0.5 h-4 w-4 rounded border-[var(--glass-border)] accent-indigo-600" />
              <div>
                <p className="text-sm text-foreground font-medium">Crear comprobante contable</p>
                <p className="text-xs text-muted-foreground">
                  Genera automáticamente un comprobante en Contabilidad (débito cuenta gasto / crédito bancos).
                </p>
              </div>
            </label>
          )}

          {/* Recurrente */}
          {!expense && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" {...form.register('is_recurring')}
                className="mt-0.5 h-4 w-4 rounded border-[var(--glass-border)] accent-indigo-600" />
              <div>
                <p className="text-sm text-foreground font-medium">Configurar como recurrente</p>
                <p className="text-xs text-muted-foreground">
                  Crea una plantilla para generar este gasto automáticamente en los períodos futuros.
                </p>
              </div>
            </label>
          )}

          {/* Campos recurrencia */}
          {watchRecurring && (
            <div className="ml-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Frecuencia</label>
                  <select {...form.register('frequency')} className={inp}>
                    {FREQUENCIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Día del mes</label>
                  <input type="number" min="1" max="28"
                    {...form.register('day_of_month')} className={inp} placeholder="1" />
                  <p className="mt-0.5 text-xs text-muted-foreground">Del 1 al 28</p>
                </div>
                <div>
                  <label className={lbl}>Fecha fin <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  <input type="date" {...form.register('end_date')} className={inp} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {mut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {mut.error instanceof Error ? mut.error.message : 'Error al guardar'}
          </p>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={mut.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {mut.isPending ? 'Guardando...' : expense ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </div>
  )
}
