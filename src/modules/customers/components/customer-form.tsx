'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  customerFormSchema, type CustomerFormValues,
  DOC_TYPES, FISCAL_REGIMES,
} from '../schemas'
import { createCustomer, updateCustomer } from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'

type CustomerRow = {
  id: string
  name: string
  doc_type: string
  doc_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  fiscal_regime: string
  payment_type: string | null
  credit_days: number | null
  referencia: string | null
}

interface CustomerFormProps {
  customer?: CustomerRow
  onSuccess?: () => void
  onCancel?: () => void
}

const inp =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm'
const lbl = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1'
const err = 'mt-0.5 text-[11px] text-red-500 font-medium'

export function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const queryClient = useQueryClient()
  const activeCompanyId = useCompanyStore((state) => state.activeCompanyId)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema) as Resolver<CustomerFormValues>,
    defaultValues: {
      name: '', doc_type: 'CC', doc_number: '',
      email: '', phone: '', address: '',
      city: '', department: '', fiscal_regime: 'no_iva',
      payment_type: '', credit_days: 0, referencia: '',
    },
  })

  useEffect(() => {
    if (customer) {
      form.reset({
        name:          customer.name,
        doc_type:      (customer.doc_type as CustomerFormValues['doc_type']) ?? 'CC',
        doc_number:    customer.doc_number    ?? '',
        email:         customer.email         ?? '',
        phone:         customer.phone         ?? '',
        address:       customer.address       ?? '',
        city:          customer.city          ?? '',
        department:    customer.department    ?? '',
        fiscal_regime: (customer.fiscal_regime as CustomerFormValues['fiscal_regime']) ?? 'no_iva',
        payment_type:  customer.payment_type  ?? '',
        credit_days:   customer.credit_days   ?? 0,
        referencia:    customer.referencia    ?? '',
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer])

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) => {
      if (!activeCompanyId) throw new Error('Sin empresa activa.')
      if (customer) return updateCustomer(customer.id, values)
      return createCustomer({ ...values, company_id: activeCompanyId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', activeCompanyId] })
      form.reset()
      onSuccess?.()
    },
  })

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">

      {/* Tipo doc + Número doc */}
      <div className="grid grid-cols-[160px_1fr] gap-3">
        <div>
          <label className={lbl}>Tipo de documento</label>
          <select {...form.register('doc_type')} className={inp}>
            {DOC_TYPES.map(dt => (
              <option key={dt.value} value={dt.value}>{dt.value} — {dt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>
            Número de documento <span className="text-red-500">*</span>
          </label>
          <input {...form.register('doc_number')} className={inp} placeholder="Ej. 900123456-7" />
          {form.formState.errors.doc_number && (
            <p className={err}>{form.formState.errors.doc_number.message}</p>
          )}
        </div>
      </div>

      {/* Nombre */}
      <div>
        <label className={lbl}>
          Nombre / Razón social <span className="text-red-500">*</span>
        </label>
        <input {...form.register('name')} className={inp}
          placeholder="Ej. Distribuciones Pérez S.A.S." />
        {form.formState.errors.name && (
          <p className={err}>{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* Email + Teléfono */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Email</label>
          <input {...form.register('email')} type="email" className={inp}
            placeholder="cliente@empresa.com" />
          {form.formState.errors.email && (
            <p className={err}>{form.formState.errors.email.message}</p>
          )}
        </div>
        <div>
          <label className={lbl}>
            Celular <span className="text-red-500">*</span>
          </label>
          <input {...form.register('phone')} type="tel" className={inp}
            placeholder="+57 300 123 4567" />
          {form.formState.errors.phone && (
            <p className={err}>{form.formState.errors.phone.message}</p>
          )}
        </div>
      </div>

      {/* Dirección */}
      <div>
        <label className={lbl}>Dirección</label>
        <input {...form.register('address')} className={inp}
          placeholder="Calle 10 # 5-30, Bodega 2" />
      </div>

      {/* Ciudad + Departamento */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Ciudad</label>
          <input {...form.register('city')} className={inp} placeholder="Medellín" />
        </div>
        <div>
          <label className={lbl}>Departamento</label>
          <input {...form.register('department')} className={inp} placeholder="Antioquia" />
        </div>
      </div>

      {/* Régimen + Tipo pago + Días crédito */}
      <div className="grid grid-cols-[1fr_130px_110px] gap-3">
        <div>
          <label className={lbl}>Régimen fiscal</label>
          <select {...form.register('fiscal_regime')} className={inp}>
            {FISCAL_REGIMES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Tipo de pago</label>
          <select {...form.register('payment_type')} className={inp}>
            <option value="">Sin definir</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Días crédito</label>
          <input {...form.register('credit_days')} type="number" min="0"
            className={inp} placeholder="30" />
        </div>
      </div>

      {/* Referencia adicional */}
      <div>
        <label className={lbl}>Referencia</label>
        <input
          {...form.register('referencia', {
            setValueAs: (v: string) => (typeof v === 'string' ? v.toUpperCase() : v),
          })}
          className={inp + ' uppercase'}
          placeholder="Ej. placa, código, característica especial"
        />
        <p className="mt-0.5 text-[11px] text-zinc-400">
          Campo libre para identificar al cliente según tu negocio.
        </p>
      </div>

      {mutation.isError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-600 font-medium">
          {mutation.error instanceof Error ? mutation.error.message : 'Error al guardar'}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm shadow-blue-600/20 hover:shadow-md hover:shadow-blue-600/25">
          {mutation.isPending ? 'Guardando...' : customer ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </div>
    </form>
  )
}
