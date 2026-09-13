'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Phone, CreditCard, Plus, Trash2 } from 'lucide-react'
import {
  supplierFormSchema, type SupplierFormValues,
  DOC_TYPES, FISCAL_REGIMES,
} from '../schemas'
import {
  createSupplier, updateSupplier, saveSupplierBankAccounts,
  useSupplierBankAccounts, type SupplierRow, type BankAccountInput,
} from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'

interface SupplierFormProps {
  supplier?: SupplierRow
  onSuccess?: () => void
  onCancel?: () => void
}

const inp =
  'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors'
const lbl = 'block text-xs font-medium text-muted-foreground mb-1'

type Tab = 'general' | 'pago'

type BankAccountDraft = BankAccountInput & { _key: string }

function emptyAccount(): BankAccountDraft {
  return { _key: Math.random().toString(36).slice(2), bank_name: '', account_type: '', account_number: '', label: '' }
}

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const queryClient = useQueryClient()
  const activeCompanyId = useCompanyStore((state) => state.activeCompanyId)
  const [activeTab, setActiveTab] = useState<Tab>('general')

  // ── Cuentas bancarias (estado local) ──────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAccountDraft[]>([])
  const { data: existingAccounts } = useSupplierBankAccounts(supplier?.id)

  useEffect(() => {
    if (existingAccounts && existingAccounts.length > 0) {
      setBankAccounts(
        existingAccounts.map(a => ({
          _key: a.id,
          bank_name:      a.bank_name,
          account_type:   a.account_type,
          account_number: a.account_number,
          label:          a.label ?? '',
        }))
      )
    }
  }, [existingAccounts])

  // ── Formulario principal ───────────────────────────────────────────────
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema) as Resolver<SupplierFormValues>,
    defaultValues: {
      name: '', doc_type: 'NIT', doc_number: '',
      email: '', phone: '', address: '',
      city: '', department: '', fiscal_regime: 'no_iva',
      contact_name: '', payment_days: 30, notes: '',
      payment_cash: false, payment_transfer: false,
    },
  })

  const watchTransfer = form.watch('payment_transfer')

  useEffect(() => {
    if (supplier) {
      form.reset({
        name:             supplier.name,
        doc_type:         (supplier.doc_type as SupplierFormValues['doc_type']) ?? 'NIT',
        doc_number:       supplier.doc_number   ?? '',
        email:            supplier.email        ?? '',
        phone:            supplier.phone        ?? '',
        address:          supplier.address      ?? '',
        city:             supplier.city         ?? '',
        department:       supplier.department   ?? '',
        fiscal_regime:    (supplier.fiscal_regime as SupplierFormValues['fiscal_regime']) ?? 'no_iva',
        contact_name:     supplier.contact_name ?? '',
        payment_days:     supplier.payment_days ?? 30,
        notes:            supplier.notes        ?? '',
        payment_cash:     supplier.payment_cash      ?? false,
        payment_transfer: supplier.payment_transfer  ?? false,
      })
    }
  }, [supplier, form])

  // ── Mutación ──────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values: SupplierFormValues) => {
      if (!activeCompanyId) throw new Error('Sin empresa activa.')
      let supplierId: string
      if (supplier) {
        const result = await updateSupplier(supplier.id, values)
        supplierId = result.id
      } else {
        const result = await createSupplier({ ...values, company_id: activeCompanyId })
        supplierId = result.id
      }
      // Guardar cuentas bancarias solo si hay transferencia o ya existen cuentas
      const accountsToSave: BankAccountInput[] = bankAccounts
        .filter(a => a.bank_name.trim() && a.account_number.trim())
        .map(({ _key, ...rest }) => rest)
      await saveSupplierBankAccounts(supplierId, accountsToSave)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', activeCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['supplier_bank_accounts', supplier?.id] })
      form.reset()
      setBankAccounts([])
      onSuccess?.()
    },
  })

  // ── Helpers cuentas ───────────────────────────────────────────────────
  const addAccount = () => setBankAccounts(prev => [...prev, emptyAccount()])

  const removeAccount = (key: string) =>
    setBankAccounts(prev => prev.filter(a => a._key !== key))

  const updateAccount = (key: string, field: keyof BankAccountInput, value: string) =>
    setBankAccounts(prev =>
      prev.map(a => a._key === key ? { ...a, [field]: value } : a)
    )

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: 'pago',    label: 'Pago',    icon: <CreditCard  className="h-3.5 w-3.5" /> },
  ]

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-0">

      {/* Pestañas */}
      <div className="flex gap-0.5 border-b border-[var(--glass-border)] mb-4">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.icon}{t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* ── TAB GENERAL ───────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="space-y-3">

          {/* Fila 1: Tipo doc + Número + Razón social */}
          <div className="grid grid-cols-[140px_180px_1fr] gap-3">
            <div>
              <label className={lbl}>Tipo de documento</label>
              <select {...form.register('doc_type')} className={inp}>
                {DOC_TYPES.map(dt => (
                  <option key={dt.value} value={dt.value}>{dt.value} — {dt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Número de documento</label>
              <input {...form.register('doc_number')} className={inp} placeholder="900123456-7" />
            </div>
            <div>
              <label className={lbl}>
                Razón social / Nombre <span className="text-red-500">*</span>
              </label>
              <input {...form.register('name')} className={inp}
                placeholder="Ej. Suministros Industriales S.A.S." />
              {form.formState.errors.name && (
                <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.name.message}</p>
              )}
            </div>
          </div>

          {/* Fila 2: Contacto + Teléfono + Email */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Nombre del contacto</label>
              <input {...form.register('contact_name')} className={inp} placeholder="Juan Pérez" />
            </div>
            <div>
              <label className={lbl}>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Celular / WhatsApp
                </span>
              </label>
              <input {...form.register('phone')} type="tel" className={inp}
                placeholder="+57 300 123 4567" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input {...form.register('email')} type="email" className={inp}
                placeholder="proveedor@empresa.com" />
              {form.formState.errors.email && (
                <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Fila 3: Ciudad + Departamento + Dirección */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Ciudad</label>
              <input {...form.register('city')} className={inp} placeholder="Bogotá" />
            </div>
            <div>
              <label className={lbl}>Departamento</label>
              <input {...form.register('department')} className={inp} placeholder="Cundinamarca" />
            </div>
            <div>
              <label className={lbl}>Dirección <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <input {...form.register('address')} className={inp} placeholder="Calle 80 # 45-20" />
            </div>
          </div>

          {/* Fila 4: Régimen + Días pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Régimen fiscal</label>
              <select {...form.register('fiscal_regime')} className={inp}>
                {FISCAL_REGIMES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Días para pagar facturas</label>
              <input {...form.register('payment_days')} type="number" min="0"
                className={inp} placeholder="30" />
            </div>
          </div>

          {/* Fila 5: Notas */}
          <div>
            <label className={lbl}>Notas internas <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <textarea {...form.register('notes')} rows={2}
              className={`${inp} resize-none`}
              placeholder="Condiciones especiales, observaciones..." />
          </div>
        </div>
      )}

      {/* ── TAB PAGO ──────────────────────────────────────────────── */}
      {activeTab === 'pago' && (
        <div className="space-y-4">

          <p className="text-xs text-muted-foreground">
            Configura los medios de pago aceptados por este proveedor.
          </p>

          {/* Efectivo */}
          <label className="flex items-start gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 cursor-pointer hover:bg-[var(--glass-hover)] transition-colors">
            <input type="checkbox" {...form.register('payment_cash')}
              className="mt-0.5 h-4 w-4 rounded border-[var(--glass-border)] accent-blue-600 cursor-pointer" />
            <div>
              <p className="text-sm font-medium text-foreground">💵 Efectivo</p>
              <p className="text-xs text-muted-foreground">Pago en efectivo al proveedor o al mensajero al momento de la entrega.</p>
            </div>
          </label>

          {/* Transferencia bancaria */}
          <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden">
            <label className="flex items-start gap-3 bg-[var(--glass)] p-3 cursor-pointer hover:bg-[var(--glass-hover)] transition-colors">
              <input type="checkbox" {...form.register('payment_transfer')}
                className="mt-0.5 h-4 w-4 rounded border-[var(--glass-border)] accent-blue-600 cursor-pointer" />
              <div>
                <p className="text-sm font-medium text-foreground">🏦 Transferencia bancaria</p>
                <p className="text-xs text-muted-foreground">Pago por PSE, transferencia entre cuentas o consignación.</p>
              </div>
            </label>

            {/* Cuentas bancarias — solo si transferencia está marcada */}
            {watchTransfer && (
              <div className="border-t border-[var(--glass-border)] bg-zinc-50/60 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Cuentas bancarias del proveedor
                </p>

                {bankAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Sin cuentas registradas. Agrega una usando el botón de abajo.
                  </p>
                )}

                {bankAccounts.map((acct, idx) => (
                  <div key={acct._key}
                    className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] p-3 space-y-2 relative">

                    {/* Encabezado de cuenta */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Cuenta {idx + 1}
                      </span>
                      <button type="button" onClick={() => removeAccount(acct._key)}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-0.5 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Banco */}
                    <div>
                      <label className={lbl}>Banco</label>
                      <input
                        value={acct.bank_name}
                        onChange={e => updateAccount(acct._key, 'bank_name', e.target.value)}
                        className={inp}
                        placeholder="Ej. Bancolombia, Davivienda, Nequi..." />
                    </div>

                    {/* Número + Tipo */}
                    <div className="grid grid-cols-[1fr_140px] gap-2">
                      <div>
                        <label className={lbl}>Número de cuenta</label>
                        <input
                          value={acct.account_number}
                          onChange={e => updateAccount(acct._key, 'account_number', e.target.value)}
                          className={inp}
                          placeholder="Ej. 69312345678" />
                      </div>
                      <div>
                        <label className={lbl}>Tipo</label>
                        <select
                          value={acct.account_type}
                          onChange={e => updateAccount(acct._key, 'account_type', e.target.value)}
                          className={inp}>
                          <option value="">Tipo...</option>
                          <option value="ahorros">Ahorros</option>
                          <option value="corriente">Corriente</option>
                          <option value="nequi">Nequi</option>
                          <option value="daviplata">Daviplata</option>
                        </select>
                      </div>
                    </div>

                    {/* Etiqueta opcional */}
                    <div>
                      <label className={lbl}>Etiqueta <span className="text-muted-foreground font-normal">(opcional)</span></label>
                      <input
                        value={acct.label}
                        onChange={e => updateAccount(acct._key, 'label', e.target.value)}
                        className={inp}
                        placeholder="Ej. Principal, COP, Pagos nacionales..." />
                    </div>
                  </div>
                ))}

                {/* Botón agregar cuenta */}
                <button
                  type="button"
                  onClick={addAccount}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1">
                  <Plus className="h-3.5 w-3.5" />
                  Agregar cuenta bancaria
                </button>
              </div>
            )}
          </div>

          {/* Estado vacío */}
          {!watchTransfer && !form.watch('payment_cash') && (
            <p className="text-xs text-center text-muted-foreground py-2">
              No se ha configurado ningún medio de pago aún.
            </p>
          )}
        </div>
      )}

      {/* Error de mutación */}
      {mutation.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 mt-3">
          {mutation.error instanceof Error ? mutation.error.message : 'Error al guardar'}
        </p>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-4 border-t border-[var(--glass-border)] mt-4">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--glass-hover)] transition-colors">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Guardando...' : supplier ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </form>
  )
}
