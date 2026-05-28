'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Briefcase, Shield, CreditCard } from 'lucide-react'
import {
  employeeFormSchema, type EmployeeFormValues,
  CONTRACT_TYPES, DOC_TYPES, ARL_RATES,
} from '../schemas'
import { createEmployee, updateEmployee, type Employee } from '../queries'
import { useCompanyStore } from '@/store/useCompanyStore'

interface EmployeeFormProps {
  employee?: Employee
  onSuccess?: () => void
  onCancel?: () => void
}

const inp = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors'
const lbl = 'block text-xs font-medium text-zinc-500 mb-1'

type Tab = 'personal' | 'laboral' | 'seguridad' | 'pago'

export function EmployeeForm({ employee, onSuccess, onCancel }: EmployeeFormProps) {
  const queryClient = useQueryClient()
  const activeCompanyId = useCompanyStore(s => s.activeCompanyId)
  const [activeTab, setActiveTab] = useState<Tab>('personal')

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema) as Resolver<EmployeeFormValues>,
    defaultValues: {
      name: '', doc_type: 'CC', doc_number: '', birth_date: '',
      position: '', department: '', hire_date: '',
      contract_type: 'indefinido', salary: 0, is_active: true,
      eps_name: '', afp_name: '', arl_rate: 0.00522, ccf_name: '',
      bank_name: '', bank_account_type: '', bank_account_number: '', notes: '',
    },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        name:                employee.name,
        doc_type:            (employee.doc_type as EmployeeFormValues['doc_type']) ?? 'CC',
        doc_number:          employee.doc_number          ?? '',
        birth_date:          employee.birth_date           ?? '',
        position:            employee.position             ?? '',
        department:          employee.department           ?? '',
        hire_date:           employee.hire_date,
        contract_type:       (employee.contract_type as EmployeeFormValues['contract_type']) ?? 'indefinido',
        salary:              employee.salary,
        is_active:           employee.is_active,
        eps_name:            employee.eps_name             ?? '',
        afp_name:            employee.afp_name             ?? '',
        arl_rate:            employee.arl_rate             ?? 0.00522,
        ccf_name:            employee.ccf_name             ?? '',
        bank_name:           employee.bank_name            ?? '',
        bank_account_type:   employee.bank_account_type    ?? '',
        bank_account_number: employee.bank_account_number  ?? '',
        notes:               employee.notes                ?? '',
      })
    }
  }, [employee, form])

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      if (!activeCompanyId) throw new Error('Sin empresa activa.')
      if (employee) return updateEmployee(employee.id, values)
      return createEmployee({ ...values, company_id: activeCompanyId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', activeCompanyId] })
      form.reset()
      onSuccess?.()
    },
  })

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'personal',  label: 'Personal',  icon: <User      className="h-3.5 w-3.5" /> },
    { id: 'laboral',   label: 'Laboral',   icon: <Briefcase className="h-3.5 w-3.5" /> },
    { id: 'seguridad', label: 'Seg. Social', icon: <Shield  className="h-3.5 w-3.5" /> },
    { id: 'pago',      label: 'Pago',      icon: <CreditCard className="h-3.5 w-3.5" /> },
  ]

  return (
    <form onSubmit={form.handleSubmit(v => mutation.mutate(v))}>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-zinc-200 mb-4">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.icon}{t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* ── PERSONAL ─────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="space-y-3">
          <div>
            <label className={lbl}>Nombre completo <span className="text-red-500">*</span></label>
            <input {...form.register('name')} className={inp} placeholder="Ej. Juan Carlos Pérez López" />
            {form.formState.errors.name && (
              <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <label className={lbl}>Tipo documento</label>
              <select {...form.register('doc_type')} className={inp}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.value}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Número de documento</label>
              <input {...form.register('doc_number')} className={inp} placeholder="1020304050" />
            </div>
          </div>
          <div>
            <label className={lbl}>Fecha de nacimiento <span className="text-zinc-400 font-normal">(opcional)</span></label>
            <input type="date" {...form.register('birth_date')} className={inp} />
          </div>
          <div>
            <label className={lbl}>Notas internas <span className="text-zinc-400 font-normal">(opcional)</span></label>
            <textarea {...form.register('notes')} rows={2} className={`${inp} resize-none`}
              placeholder="Observaciones del empleado..." />
          </div>
          {/* Estado activo */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...form.register('is_active')}
              className="h-4 w-4 rounded border-zinc-300 accent-blue-600" />
            <span className="text-sm text-zinc-700">Empleado activo</span>
          </label>
        </div>
      )}

      {/* ── LABORAL ──────────────────────────────────────────────── */}
      {activeTab === 'laboral' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Cargo / Puesto</label>
              <input {...form.register('position')} className={inp} placeholder="Ej. Auxiliar contable" />
            </div>
            <div>
              <label className={lbl}>Departamento / Área</label>
              <input {...form.register('department')} className={inp} placeholder="Ej. Administración" />
            </div>
          </div>
          <div>
            <label className={lbl}>Fecha de ingreso <span className="text-red-500">*</span></label>
            <input type="date" {...form.register('hire_date')} className={inp} />
            {form.formState.errors.hire_date && (
              <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.hire_date.message}</p>
            )}
          </div>
          <div>
            <label className={lbl}>Tipo de contrato</label>
            <select {...form.register('contract_type')} className={inp}>
              {CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Salario básico mensual (COP) <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="1000" {...form.register('salary')} className={inp}
              placeholder="1300000" />
            {form.formState.errors.salary && (
              <p className="mt-0.5 text-xs text-red-600">{form.formState.errors.salary.message}</p>
            )}
            <p className="text-xs text-zinc-400 mt-0.5">
              El auxilio de transporte se agrega automáticamente si el salario es ≤ 2 SMLV.
            </p>
          </div>
        </div>
      )}

      {/* ── SEGURIDAD SOCIAL ─────────────────────────────────────── */}
      {activeTab === 'seguridad' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>EPS</label>
              <input {...form.register('eps_name')} className={inp}
                placeholder="Ej. Sura, Sanitas, Nueva EPS..." />
            </div>
            <div>
              <label className={lbl}>Fondo de pensiones (AFP)</label>
              <input {...form.register('afp_name')} className={inp}
                placeholder="Ej. Porvenir, Protección, Colpensiones..." />
            </div>
          </div>
          <div>
            <label className={lbl}>Clase de riesgo ARL</label>
            <select {...form.register('arl_rate')} className={inp}>
              {ARL_RATES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Caja de Compensación Familiar (CCF)</label>
            <input {...form.register('ccf_name')} className={inp}
              placeholder="Ej. Compensar, Cafam, Comfenalco..." />
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700 space-y-1">
            <p className="font-medium">Tasas aplicadas automáticamente:</p>
            <p>Salud: empleado 4% · empresa 8.5%</p>
            <p>Pensión: empleado 4% · empresa 12%</p>
            <p>CCF: 4% · ICBF: 3% · SENA: 2% (si nómina ≥ 10 SMLV)</p>
          </div>
        </div>
      )}

      {/* ── DATOS DE PAGO ────────────────────────────────────────── */}
      {activeTab === 'pago' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Cuenta bancaria para el pago del salario.</p>
          <div>
            <label className={lbl}>Banco</label>
            <input {...form.register('bank_name')} className={inp}
              placeholder="Ej. Bancolombia, Davivienda, Nequi..." />
          </div>
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <label className={lbl}>Número de cuenta</label>
              <input {...form.register('bank_account_number')} className={inp}
                placeholder="Ej. 69312345678" />
            </div>
            <div>
              <label className={lbl}>Tipo</label>
              <select {...form.register('bank_account_type')} className={inp}>
                <option value="">Seleccionar</option>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 mt-3">
          {mutation.error instanceof Error ? mutation.error.message : 'Error al guardar'}
        </p>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 mt-4">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Guardando...' : employee ? 'Guardar cambios' : 'Crear empleado'}
        </button>
      </div>
    </form>
  )
}
