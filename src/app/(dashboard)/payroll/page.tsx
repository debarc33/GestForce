'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type RowSelectionState,
} from '@tanstack/react-table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, FileSpreadsheet, Pencil, RefreshCw, Lock, AlertTriangle, Trash2 } from 'lucide-react'
import { useCompanyStore } from '@/store/useCompanyStore'
import { useCompany } from '@/modules/company/queries'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import { EmployeeForm } from '@/modules/payroll/components/employee-form'
import {
  useEmployees, usePayrollPeriods, usePayrollItems,
  useAbsences, useSocialBenefitsSummary,
  getOrCreatePeriod, generatePayrollItems, updatePayrollItem,
  closePayrollPeriod, deleteEmployees, createAbsence, deleteAbsence,
  mesLabel, calcPayroll,
  type Employee, type PayrollItemWithEmployee, type PayrollItem, type Absence,
} from '@/modules/payroll/queries'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  payrollNovedadesSchema, absenceFormSchema,
  type PayrollNovedadesValues, type AbsenceFormValues,
  ABSENCE_TYPES,
} from '@/modules/payroll/schemas'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'empleados',    label: 'Empleados'     },
  { id: 'liquidar',     label: 'Liquidar'      },
  { id: 'historial',    label: 'Historial'     },
  { id: 'pila',         label: 'Aportes PILA'  },
  { id: 'ausencias',    label: 'Ausencias'     },
  { id: 'prestaciones', label: 'Prestaciones'  },
] as const
type TabId = typeof TABS[number]['id']

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$ ' + Math.round(n).toLocaleString('es-CO')
const fmtDays = (n: number) => `${Math.round(n * 100) / 100} días`

const CONTRACT_LABEL: Record<string, string> = {
  indefinido:  'Indefinido',
  fijo:        'Término fijo',
  obra_labor:  'Obra/labor',
  aprendizaje: 'Aprendizaje',
}

const ABSENCE_COLOR: Record<string, string> = {
  incapacidad_eps:       'bg-yellow-100 text-yellow-700',
  falta_injustificada:   'bg-red-100 text-red-700',
  permiso_remunerado:    'bg-green-100 text-green-700',
  permiso_no_remunerado: 'bg-orange-100 text-orange-700',
  licencia_maternidad:   'bg-blue-100 text-blue-700',
  licencia_paternidad:   'bg-blue-100 text-blue-700',
  licencia_luto:         'bg-blue-100 text-blue-700',
  vacaciones:            'bg-purple-100 text-purple-700',
}

const inp = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

function absenceLabel(type: string) {
  return ABSENCE_TYPES.find(t => t.value === type)?.label ?? type
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()
  const cid = activeCompanyId ?? undefined

  const [activeTab, setActiveTab]               = useState<TabId>('empleados')
  const [search, setSearch]                     = useState('')
  const [rowSelection, setRowSelection]         = useState<RowSelectionState>({})
  const [editingEmployee, setEditingEmployee]   = useState<Employee | null>(null)
  const [isNewEmployeeOpen, setIsNewEmployeeOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Liquidar
  const now = new Date()
  const [liqYear, setLiqYear]   = useState(now.getFullYear())
  const [liqMonth, setLiqMonth] = useState(now.getMonth() + 1)
  const [activePeriodId, setActivePeriodId]     = useState<string | null>(null)
  const [editingItem, setEditingItem]           = useState<PayrollItemWithEmployee | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [loadingGenerate, setLoadingGenerate]   = useState(false)

  // Historial mes seleccionado
  const [histPeriodId, setHistPeriodId] = useState<string | null>(null)

  // Ausencias
  const [filterEmpId, setFilterEmpId]     = useState<string>('')
  const [isNewAbsenceOpen, setIsNewAbsenceOpen] = useState(false)
  const [deletingAbsenceId, setDeletingAbsenceId] = useState<string | null>(null)

  useEffect(() => { if (!activeCompanyId) router.replace('/select-company') }, [activeCompanyId, router])

  const { data: company }           = useCompany(activeCompanyId)
  const { data: employees = [] }    = useEmployees(cid)
  const { data: periods = [] }      = usePayrollPeriods(cid)
  const { data: liqItems = [],
          isLoading: loadingItems } = usePayrollItems(activePeriodId ?? undefined)
  const { data: histItems = [] }    = usePayrollItems(histPeriodId ?? undefined)
  const { data: absences = [] }     = useAbsences(cid, filterEmpId || undefined)
  const { data: benefitsSummary = [], isLoading: loadingBenefits } = useSocialBenefitsSummary(cid)

  const smlv              = company?.smlv              ?? 1300000
  const transportAllowance = (company as any)?.transport_allowance ?? 162000

  // ── Filtro empleados ───────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.position ?? '').toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q)
    )
  }, [employees, search])

  const selectedIds = useMemo(() =>
    Object.keys(rowSelection).filter(k => rowSelection[k])
      .map(i => filteredEmployees[parseInt(i)]?.id).filter(Boolean) as string[]
  , [rowSelection, filteredEmployees])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: () => deleteEmployees(selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', cid] })
      setRowSelection({})
      setShowDeleteConfirm(false)
    },
  })

  const closePeriodMut = useMutation({
    mutationFn: () => closePayrollPeriod(activePeriodId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_periods', cid] })
      queryClient.invalidateQueries({ queryKey: ['payroll_items', activePeriodId] })
      setShowCloseConfirm(false)
    },
  })

  const deleteAbsenceMut = useMutation({
    mutationFn: (id: string) => deleteAbsence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences', cid] })
      queryClient.invalidateQueries({ queryKey: ['social_benefits', cid] })
      setDeletingAbsenceId(null)
    },
  })

  // ── Abrir período de liquidación ───────────────────────────────────────────
  const handleOpenPeriod = async () => {
    if (!cid) return
    setLoadingGenerate(true)
    try {
      const period = await getOrCreatePeriod(cid, liqYear, liqMonth)
      setActivePeriodId(period.id)
      if (period.status === 'open') {
        await generatePayrollItems(period.id, cid, smlv, transportAllowance)
        queryClient.invalidateQueries({ queryKey: ['payroll_items', period.id] })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingGenerate(false)
    }
  }

  const activePeriod = periods.find(p => p.id === activePeriodId)
  const periodClosed = activePeriod?.status === 'closed'

  // ── Totales liquidación ────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    gross:    liqItems.reduce((s, i) => s + i.gross_pay,           0),
    netPay:   liqItems.reduce((s, i) => s + i.net_pay,             0),
    employer: liqItems.reduce((s, i) => s + i.total_employer_cost - i.gross_pay, 0),
    total:    liqItems.reduce((s, i) => s + i.total_employer_cost, 0),
  }), [liqItems])

  // ─── Employees table columns ─────────────────────────────────────────────
  const empColumns: ColumnDef<Employee>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox" checked={table.getIsAllPageRowsSelected()}
          ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-4 w-4 accent-blue-600 cursor-pointer" />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 accent-blue-600 cursor-pointer" />
      ),
      size: 40,
    },
    {
      id: 'name',
      header: 'Empleado',
      cell: ({ row }) => (
        <div>
          <button onClick={() => setEditingEmployee(row.original)}
            className="font-medium text-primary hover:underline text-left">
            {row.original.name}
          </button>
          {row.original.position && (
            <p className="text-xs text-muted-foreground">{row.original.position}{row.original.department ? ` · ${row.original.department}` : ''}</p>
          )}
        </div>
      ),
    },
    {
      id: 'contract',
      header: 'Contrato',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{CONTRACT_LABEL[row.original.contract_type] ?? row.original.contract_type}</span>
      ),
    },
    {
      id: 'hire_date',
      header: 'Ingreso',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.hire_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      id: 'salary',
      header: 'Salario base',
      cell: ({ row }) => <span className="text-sm font-medium tabular-nums text-foreground">{fmtCOP(row.original.salary)}</span>,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.original.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-muted-foreground'}`}>
          {row.original.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  const empTable = useReactTable({
    data: filteredEmployees,
    columns: empColumns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Nómina</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Gestión de empleados, liquidación y prestaciones sociales.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-[var(--glass-border)] overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} type="button"
            onClick={() => { setActiveTab(tab.id); setSearch('') }}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
          </button>
        ))}
      </div>

      {/* ══ EMPLEADOS ══════════════════════════════════════════════════════ */}
      {activeTab === 'empleados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <input type="search" placeholder="Buscar empleado, cargo..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none w-56" />
              {selectedIds.length > 0 && (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
                  Eliminar ({selectedIds.length})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportToExcel(employees, [
                { header: 'Nombre',        key: 'name',          width: 30 },
                { header: 'Cargo',         key: 'position',      width: 22 },
                { header: 'Tipo contrato', key: r => CONTRACT_LABEL[r.contract_type], width: 18 },
                { header: 'Ingreso',       key: 'hire_date',     width: 14 },
                { header: 'Salario base',  key: 'salary',        width: 16 },
                { header: 'EPS',           key: 'eps_name',      width: 18 },
                { header: 'AFP',           key: 'afp_name',      width: 18 },
              ] as ExcelColumn<Employee>[], 'empleados')}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)]">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />Exportar
              </button>
              <button onClick={() => setIsNewEmployeeOpen(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 shadow-sm">
                + Nuevo empleado
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-[var(--glass-hover)]/50">
                {empTable.getHeaderGroups().map(hg => (
                  <TableRow key={hg.id} className="border-[var(--glass-border)]">
                    {hg.headers.map(h => (
                      <TableHead key={h.id} className="py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {empTable.getRowModel().rows.length ? (
                  empTable.getRowModel().rows.map(row => (
                    <TableRow key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className="border-zinc-100 hover:bg-[var(--glass-hover)]/60 data-[state=selected]:bg-blue-50/50 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={empColumns.length} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Users className="h-10 w-10 opacity-30" />
                        <div>
                          <p className="text-sm font-medium">{search ? 'Ningún empleado coincide' : 'No hay empleados registrados'}</p>
                          <p className="text-xs">{search ? 'Intenta con otros términos.' : 'Usa el botón "Nuevo empleado" para comenzar.'}</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ══ LIQUIDAR ═══════════════════════════════════════════════════════ */}
      {activeTab === 'liquidar' && (
        <div className="space-y-5">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Año</p>
              <select value={liqYear} onChange={e => { setLiqYear(+e.target.value); setActivePeriodId(null) }}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none">
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Mes</p>
              <select value={liqMonth} onChange={e => { setLiqMonth(+e.target.value); setActivePeriodId(null) }}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{mesLabel(m)}</option>
                ))}
              </select>
            </div>
            <button onClick={handleOpenPeriod} disabled={loadingGenerate}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 shadow-sm">
              <RefreshCw className={`h-4 w-4 ${loadingGenerate ? 'animate-spin' : ''}`} />
              {activePeriodId ? 'Regenerar' : 'Abrir nómina'}
            </button>
            {activePeriodId && !periodClosed && (
              <button onClick={() => setShowCloseConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)]">
                <Lock className="h-4 w-4" />Cerrar y aprobar
              </button>
            )}
            {periodClosed && (
              <span className="flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700">
                <Lock className="h-4 w-4" />Nómina cerrada
              </span>
            )}
          </div>

          {activePeriodId && (
            <>
              {loadingItems ? (
                <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
              ) : liqItems.length === 0 ? (
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center text-muted-foreground">
                  <p className="text-sm">No hay empleados activos para liquidar.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                      <thead className="bg-[var(--glass-hover)]/50 border-b border-[var(--glass-border)]">
                        <tr>
                          {['Empleado','Días','Salario','Aux. Transp.','Extras/Bonos','Salud (4%)','Pensión (4%)','Retención','Neto a pagar',''].map(h => (
                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liqItems.map(item => (
                          <tr key={item.id} className="border-t border-zinc-100 hover:bg-[var(--glass-hover)]/40">
                            <td className="px-3 py-3">
                              <p className="font-medium text-foreground">{item.employee?.name}</p>
                              {item.employee?.position && <p className="text-xs text-muted-foreground">{item.employee.position}</p>}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-muted-foreground">
                              {(item.worked_days ?? 30)}/30
                            </td>
                            <td className="px-3 py-3 tabular-nums text-foreground">{fmtCOP(item.salary)}</td>
                            <td className="px-3 py-3 tabular-nums text-muted-foreground">{fmtCOP(item.transport_allowance)}</td>
                            <td className="px-3 py-3 tabular-nums text-muted-foreground">
                              {fmtCOP(item.overtime_pay + item.bonuses + item.other_income)}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-red-600">-{fmtCOP(item.health_employee)}</td>
                            <td className="px-3 py-3 tabular-nums text-red-600">-{fmtCOP(item.pension_employee)}</td>
                            <td className="px-3 py-3 tabular-nums text-red-600">
                              {item.withholding_tax > 0 ? `-${fmtCOP(item.withholding_tax)}` : '—'}
                            </td>
                            <td className="px-3 py-3 tabular-nums font-bold text-foreground">{fmtCOP(item.net_pay)}</td>
                            <td className="px-3 py-3">
                              {!periodClosed && (
                                <button onClick={() => setEditingItem(item)}
                                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-primary transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Total devengado',     value: totals.gross,    cls: 'text-foreground' },
                      { label: 'Neto a pagar',        value: totals.netPay,   cls: 'text-blue-700' },
                      { label: 'Aportes patronales',  value: totals.employer, cls: 'text-amber-700' },
                      { label: 'Costo total empresa', value: totals.total,    cls: 'text-foreground font-bold' },
                    ].map(card => (
                      <div key={card.label} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                        <p className={`text-lg tabular-nums ${card.cls}`}>{fmtCOP(card.value)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {!activePeriodId && (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center text-muted-foreground">
              <p className="text-sm">Selecciona el año y mes y haz clic en "Abrir nómina" para liquidar.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ HISTORIAL ══════════════════════════════════════════════════════ */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {periods.length === 0 ? (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center text-muted-foreground text-sm">
              Aún no hay nóminas liquidadas.
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-[var(--glass-hover)]/50">
                  <TableRow>
                    {['Período','Estado','Acciones'].map(h => (
                      <TableHead key={h} className="py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map(period => (
                    <TableRow key={period.id} className="border-zinc-100 hover:bg-[var(--glass-hover)]/60">
                      <TableCell className="py-3 font-medium text-foreground">
                        {mesLabel(period.month)} {period.year}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          period.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {period.status === 'closed' ? 'Cerrada' : 'Abierta'}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <button onClick={() => setHistPeriodId(period.id)}
                          className="text-xs text-primary hover:underline">
                          Ver detalle
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {histPeriodId && histItems.length > 0 && (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-x-auto">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {mesLabel(periods.find(p => p.id === histPeriodId)?.month ?? 0)} {periods.find(p => p.id === histPeriodId)?.year}
                </p>
                <button onClick={() => {
                  exportToExcel(histItems, [
                    { header: 'Empleado',       key: r => r.employee?.name ?? '', width: 28 },
                    { header: 'Días trabajados', key: 'worked_days', width: 12 },
                    { header: 'Salario',        key: 'salary',        width: 14 },
                    { header: 'Aux. Transp.',   key: 'transport_allowance', width: 14 },
                    { header: 'Devengado',      key: 'gross_pay',     width: 14 },
                    { header: 'Deducciones',    key: 'total_deductions', width: 14 },
                    { header: 'Neto a pagar',   key: 'net_pay',       width: 14 },
                    { header: 'Costo empresa',  key: 'total_employer_cost', width: 16 },
                    { header: 'Cesantías',      key: 'cesantias_month', width: 14 },
                    { header: 'Prima',          key: 'prima_month',   width: 14 },
                  ] as ExcelColumn<PayrollItemWithEmployee>[], `nomina_${histPeriodId}`)
                }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-700">
                  <FileSpreadsheet className="h-3.5 w-3.5" />Exportar
                </button>
              </div>
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-[var(--glass-hover)]/50">
                  <tr>
                    {['Empleado','Días','Salario','Devengado','Deducciones','Neto','Costo empresa'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {histItems.map(item => (
                    <tr key={item.id} className="border-t border-zinc-100">
                      <td className="px-3 py-2.5 font-medium text-foreground">{item.employee?.name}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{item.worked_days ?? 30}</td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">{fmtCOP(item.salary)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">{fmtCOP(item.gross_pay)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-red-600">-{fmtCOP(item.total_deductions)}</td>
                      <td className="px-3 py-2.5 tabular-nums font-bold text-foreground">{fmtCOP(item.net_pay)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-amber-700">{fmtCOP(item.total_employer_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ APORTES PILA ═══════════════════════════════════════════════════ */}
      {activeTab === 'pila' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">Período:</p>
            <select onChange={e => setHistPeriodId(e.target.value || null)}
              value={histPeriodId ?? ''}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none">
              <option value="">Seleccionar...</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{mesLabel(p.month)} {p.year}</option>
              ))}
            </select>
          </div>

          {histPeriodId && histItems.length > 0 ? (
            <PILATable items={histItems} fmtCOP={fmtCOP} />
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center text-muted-foreground text-sm">
              Selecciona un período para ver el resumen de aportes PILA.
            </div>
          )}
        </div>
      )}

      {/* ══ AUSENCIAS ══════════════════════════════════════════════════════ */}
      {activeTab === 'ausencias' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <select value={filterEmpId} onChange={e => setFilterEmpId(e.target.value)}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:outline-none w-52">
                <option value="">Todos los empleados</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setIsNewAbsenceOpen(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 shadow-sm">
              + Registrar ausencia
            </button>
          </div>

          {absences.length === 0 ? (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center text-muted-foreground text-sm">
              No hay ausencias registradas.
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-[var(--glass-hover)]/50 border-b border-[var(--glass-border)]">
                  <tr>
                    {['Empleado','Tipo','Desde','Hasta','Días','Afecta salario','Descripción',''].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {absences.map(abs => {
                    const emp = employees.find(e => e.id === abs.employee_id)
                    return (
                      <tr key={abs.id} className="border-t border-zinc-100 hover:bg-[var(--glass-hover)]/40">
                        <td className="px-3 py-3 font-medium text-foreground">{emp?.name ?? '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ABSENCE_COLOR[abs.absence_type] ?? 'bg-zinc-100 text-muted-foreground'}`}>
                            {absenceLabel(abs.absence_type)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground tabular-nums">
                          {new Date(abs.date_from + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground tabular-nums">
                          {new Date(abs.date_to + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-foreground">{abs.days}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${abs.affects_salary ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {abs.affects_salary ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground max-w-xs truncate">{abs.description ?? '—'}</td>
                        <td className="px-3 py-3">
                          <button onClick={() => setDeletingAbsenceId(abs.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ PRESTACIONES ═══════════════════════════════════════════════════ */}
      {activeTab === 'prestaciones' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-700">
              Acumulado de prestaciones sociales calculado a partir de los períodos de nómina liquidados.
              Las cesantías y prima se acumulan por período proporcional a los días trabajados.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                exportToExcel(benefitsSummary, [
                  { header: 'Empleado',             key: r => r.employee.name,                width: 28 },
                  { header: 'Períodos liquidados',  key: 'months_worked',                     width: 16 },
                  { header: 'Cesantías acum.',      key: 'cesantias_total',                   width: 16 },
                  { header: 'Int. Cesantías',       key: 'cesantias_interest_total',           width: 16 },
                  { header: 'Prima acum.',          key: 'prima_total',                        width: 16 },
                  { header: 'Vacac. acumulados (días)', key: 'vacation_days_total',            width: 20 },
                  { header: 'Vacac. tomadas (días)',key: 'vacation_days_taken',                width: 18 },
                  { header: 'Vacac. pendientes (días)', key: 'vacation_days_pending',          width: 20 },
                  { header: 'Vacac. pendientes ($)', key: 'vacation_value_pending',            width: 18 },
                ] as ExcelColumn<typeof benefitsSummary[0]>[], 'prestaciones_sociales')
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)]">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />Exportar Excel
            </button>
          </div>

          {loadingBenefits ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : benefitsSummary.length === 0 ? (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center text-muted-foreground text-sm">
              No hay datos de prestaciones. Liquida al menos un período de nómina.
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-[var(--glass-hover)]/50 border-b border-[var(--glass-border)]">
                  <tr>
                    {['Empleado','Períodos','Cesantías acum.','Int. Cesantías','Prima acum.','Vacac. días','Tomados','Pendientes','Valor pendiente'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benefitsSummary.map(row => (
                    <tr key={row.employee.id} className="border-t border-zinc-100 hover:bg-[var(--glass-hover)]/40">
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">{row.employee.name}</p>
                        {row.employee.position && <p className="text-xs text-muted-foreground">{row.employee.position}</p>}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.months_worked}</td>
                      <td className="px-3 py-3 tabular-nums font-medium text-foreground">{fmtCOP(row.cesantias_total)}</td>
                      <td className="px-3 py-3 tabular-nums text-foreground">{fmtCOP(row.cesantias_interest_total)}</td>
                      <td className="px-3 py-3 tabular-nums font-medium text-foreground">{fmtCOP(row.prima_total)}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{fmtDays(row.vacation_days_total)}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{fmtDays(row.vacation_days_taken)}</td>
                      <td className="px-3 py-3 tabular-nums">
                        <span className={row.vacation_days_pending > 0 ? 'font-medium text-amber-700' : 'text-muted-foreground'}>
                          {fmtDays(row.vacation_days_pending)}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums font-semibold text-blue-700">{fmtCOP(row.vacation_value_pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ DIALOGS ═══════════════════════════════════════════════════════ */}

      {/* Nuevo empleado */}
      <Dialog open={isNewEmployeeOpen} onOpenChange={setIsNewEmployeeOpen}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader><DialogTitle>Nuevo empleado</DialogTitle></DialogHeader>
          <EmployeeForm onSuccess={() => setIsNewEmployeeOpen(false)} onCancel={() => setIsNewEmployeeOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Editar empleado */}
      <Dialog open={!!editingEmployee} onOpenChange={v => { if (!v) setEditingEmployee(null) }}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader><DialogTitle>Editar empleado</DialogTitle></DialogHeader>
          {editingEmployee && (
            <EmployeeForm employee={editingEmployee} onSuccess={() => setEditingEmployee(null)} onCancel={() => setEditingEmployee(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Eliminar empleados */}
      <Dialog open={showDeleteConfirm} onOpenChange={v => !deleteMut.isPending && setShowDeleteConfirm(v)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle>¿Eliminar {selectedIds.length === 1 ? 'este empleado' : `estos ${selectedIds.length} empleados`}?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteMut.isPending}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)] disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cerrar nómina */}
      <Dialog open={showCloseConfirm} onOpenChange={v => !closePeriodMut.isPending && setShowCloseConfirm(v)}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>Cerrar nómina de {mesLabel(liqMonth)} {liqYear}</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Una vez cerrada, la nómina queda bloqueada y no puede modificarse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowCloseConfirm(false)} disabled={closePeriodMut.isPending}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)] disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => closePeriodMut.mutate()} disabled={closePeriodMut.isPending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
              {closePeriodMut.isPending ? 'Cerrando...' : 'Cerrar y aprobar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar ausencia */}
      <Dialog open={!!deletingAbsenceId} onOpenChange={v => { if (!v) setDeletingAbsenceId(null) }}>
        <DialogContent className="max-w-sm rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle>¿Eliminar esta ausencia?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-2">
            <button onClick={() => setDeletingAbsenceId(null)}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--glass-hover)]">
              Cancelar
            </button>
            <button onClick={() => deletingAbsenceId && deleteAbsenceMut.mutate(deletingAbsenceId)}
              disabled={deleteAbsenceMut.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleteAbsenceMut.isPending ? 'Eliminando...' : 'Eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar ausencia */}
      {isNewAbsenceOpen && (
        <AbsenciaDialog
          employees={employees}
          companyId={cid ?? ''}
          onClose={() => setIsNewAbsenceOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['absences', cid] })
            queryClient.invalidateQueries({ queryKey: ['social_benefits', cid] })
            setIsNewAbsenceOpen(false)
          }}
        />
      )}

      {/* Editar novedades */}
      {editingItem && (
        <NovedadesDialog
          item={editingItem}
          smlv={smlv}
          transportAllowance={transportAllowance}
          totalSalaryBase={liqItems.reduce((s, i) => s + i.salary, 0)}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['payroll_items', activePeriodId] })
            queryClient.invalidateQueries({ queryKey: ['social_benefits', cid] })
            setEditingItem(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Ausencia dialog ──────────────────────────────────────────────────────────

function AbsenciaDialog({
  employees, companyId, onClose, onSaved,
}: {
  employees: Employee[]
  companyId: string
  onClose: () => void
  onSaved: () => void
}) {
  const form = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema) as Resolver<AbsenceFormValues>,
    defaultValues: {
      absence_type:   'permiso_remunerado',
      affects_salary: false,
      days:           1,
    },
  })

  // Auto-set affects_salary based on type
  const absType = form.watch('absence_type')
  const dateFrom = form.watch('date_from')
  const dateTo   = form.watch('date_to')

  useEffect(() => {
    const found = ABSENCE_TYPES.find(t => t.value === absType)
    if (found) form.setValue('affects_salary', found.affects_salary)
  }, [absType, form])

  // Auto-calculate days from date range
  useEffect(() => {
    if (dateFrom && dateTo) {
      const d1 = new Date(dateFrom)
      const d2 = new Date(dateTo)
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1
      if (diff > 0) form.setValue('days', diff)
    }
  }, [dateFrom, dateTo, form])

  const mutation = useMutation({
    mutationFn: (values: AbsenceFormValues) =>
      createAbsence({ ...values, company_id: companyId }),
    onSuccess: onSaved,
  })

  const inp2 = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg rounded-2xl shadow-xl border-zinc-100">
        <DialogHeader>
          <DialogTitle>Registrar ausencia</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Empleado *</label>
            <select {...form.register('employee_id')} className={inp2}>
              <option value="">Seleccionar empleado...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            {form.formState.errors.employee_id && (
              <p className="text-xs text-red-500 mt-1">{form.formState.errors.employee_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de ausencia *</label>
            <select {...form.register('absence_type')} className={inp2}>
              {ABSENCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Desde *</label>
              <input type="date" {...form.register('date_from')} className={inp2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta *</label>
              <input type="date" {...form.register('date_to')} className={inp2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Días</label>
              <input type="number" step="0.5" min="0.5" {...form.register('days')} className={inp2} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="affects_salary" {...form.register('affects_salary')}
              className="h-4 w-4 accent-blue-600" />
            <label htmlFor="affects_salary" className="text-sm text-muted-foreground">
              Descuenta del salario del período
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción / observación</label>
            <input {...form.register('description')} className={inp2}
              placeholder="Ej. Incapacidad por gripa, certificado adjunto..." />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600">{mutation.error instanceof Error ? mutation.error.message : 'Error al guardar'}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--glass-hover)]">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {mutation.isPending ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Novedades dialog ─────────────────────────────────────────────────────────

function NovedadesDialog({
  item, smlv, transportAllowance, totalSalaryBase, onClose, onSaved,
}: {
  item: PayrollItemWithEmployee
  smlv: number
  transportAllowance: number
  totalSalaryBase: number
  onClose: () => void
  onSaved: () => void
}) {
  const form = useForm<PayrollNovedadesValues>({
    resolver: zodResolver(payrollNovedadesSchema) as Resolver<PayrollNovedadesValues>,
    defaultValues: {
      worked_days:         item.worked_days         ?? 30,
      vacation_days_taken: item.vacation_days_taken ?? 0,
      sick_days:           item.sick_days            ?? 0,
      unpaid_days:         item.unpaid_days          ?? 0,
      overtime_pay:        item.overtime_pay,
      bonuses:             item.bonuses,
      other_income:        item.other_income,
      withholding_tax:     item.withholding_tax,
      other_deductions:    item.other_deductions,
      notes:               item.notes ?? '',
    },
  })

  const watched = form.watch()
  const preview = calcPayroll({
    salary: item.salary, smlv, transportAllowance,
    arl_rate: item.employee.arl_rate, totalSalaryBase,
    worked_days:      watched.worked_days      ?? 30,
    overtime_pay:     watched.overtime_pay     ?? 0,
    bonuses:          watched.bonuses           ?? 0,
    other_income:     watched.other_income      ?? 0,
    withholding_tax:  watched.withholding_tax   ?? 0,
    other_deductions: watched.other_deductions  ?? 0,
  })

  const mutation = useMutation({
    mutationFn: (values: PayrollNovedadesValues) =>
      updatePayrollItem(item as PayrollItem & { employee: Employee }, values, smlv, transportAllowance, totalSalaryBase),
    onSuccess: onSaved,
  })

  const inp2 = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg rounded-2xl shadow-xl border-zinc-100">
        <DialogHeader>
          <DialogTitle>Novedades — {item.employee.name}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Salario base: {fmtCOP(item.salary)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 mt-2">

          {/* Tiempo trabajado */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tiempo trabajado</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Días trabajados (0–30)</label>
                <input type="number" min="0" max="30" step="1" {...form.register('worked_days')} className={inp2} />
                <p className="text-xs text-muted-foreground mt-0.5">Reduce el salario y prestaciones proporcionalmente.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Días de vacaciones</label>
                <input type="number" min="0" max="30" step="0.5" {...form.register('vacation_days_taken')} className={inp2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Días incapacidad</label>
                <input type="number" min="0" max="30" step="1" {...form.register('sick_days')} className={inp2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Días sin pago</label>
                <input type="number" min="0" max="30" step="1" {...form.register('unpaid_days')} className={inp2} />
              </div>
            </div>
          </div>

          {/* Novedades económicas */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Novedades económicas</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Horas extra / recargos</label>
                <input type="number" min="0" step="1000" {...form.register('overtime_pay')} className={inp2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Bonificaciones</label>
                <input type="number" min="0" step="1000" {...form.register('bonuses')} className={inp2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Otros ingresos</label>
                <input type="number" min="0" step="1000" {...form.register('other_income')} className={inp2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Retención en la fuente</label>
                <input type="number" min="0" step="1000" {...form.register('withholding_tax')} className={inp2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Otras deducciones</label>
                <input type="number" min="0" step="1000" {...form.register('other_deductions')} className={inp2} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notas</label>
            <input {...form.register('notes')} className={inp2} placeholder="Observaciones del período..." />
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-[var(--glass-hover)] border border-[var(--glass-border)] px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Neto a pagar</span>
              <span className="text-lg font-bold text-blue-700 tabular-nums">{fmtCOP(preview.net_pay)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Cesantías este mes</span>
              <span className="tabular-nums">{fmtCOP(preview.cesantias_month)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Prima este mes</span>
              <span className="tabular-nums">{fmtCOP(preview.prima_month)}</span>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600">{mutation.error instanceof Error ? mutation.error.message : 'Error'}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[var(--glass-hover)]">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {mutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── PILA table ───────────────────────────────────────────────────────────────

function PILATable({ items, fmtCOP }: { items: PayrollItemWithEmployee[]; fmtCOP: (n: number) => string }) {
  const totals = {
    salud_emp:    items.reduce((s, i) => s + i.health_employee,  0),
    salud_er:     items.reduce((s, i) => s + i.health_employer,  0),
    pension_emp:  items.reduce((s, i) => s + i.pension_employee, 0),
    pension_er:   items.reduce((s, i) => s + i.pension_employer, 0),
    arl:          items.reduce((s, i) => s + i.arl,              0),
    ccf:          items.reduce((s, i) => s + i.ccf,              0),
    icbf:         items.reduce((s, i) => s + i.icbf,             0),
    sena:         items.reduce((s, i) => s + i.sena,             0),
  }

  const rows = [
    { concepto: 'Salud',   pct_emp: '4%',   emp: totals.salud_emp,   pct_er: '8.5%',     er: totals.salud_er,   total: totals.salud_emp + totals.salud_er },
    { concepto: 'Pensión', pct_emp: '4%',   emp: totals.pension_emp, pct_er: '12%',      er: totals.pension_er, total: totals.pension_emp + totals.pension_er },
    { concepto: 'ARL',     pct_emp: '—',    emp: 0,                  pct_er: 'Variable', er: totals.arl,        total: totals.arl },
    { concepto: 'CCF',     pct_emp: '—',    emp: 0,                  pct_er: '4%',       er: totals.ccf,        total: totals.ccf },
    { concepto: 'ICBF',    pct_emp: '—',    emp: 0,                  pct_er: '3%',       er: totals.icbf,       total: totals.icbf },
    { concepto: 'SENA',    pct_emp: '—',    emp: 0,                  pct_er: '2%',       er: totals.sena,       total: totals.sena },
  ]

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--glass-hover)]/50 border-b border-[var(--glass-border)]">
            <tr>
              {['Concepto','% Empleado','Empleado','% Empresa','Empresa','Total'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.concepto} className="border-t border-zinc-100 hover:bg-[var(--glass-hover)]/40">
                <td className="px-4 py-3 font-medium text-foreground">{row.concepto}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.pct_emp}</td>
                <td className="px-4 py-3 tabular-nums text-foreground">{row.emp > 0 ? fmtCOP(row.emp) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.pct_er}</td>
                <td className="px-4 py-3 tabular-nums text-foreground">{row.er > 0 ? fmtCOP(row.er) : '—'}</td>
                <td className="px-4 py-3 tabular-nums font-semibold text-foreground">{fmtCOP(row.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--glass-border)] bg-[var(--glass-hover)]">
              <td colSpan={5} className="px-4 py-3 font-bold text-foreground text-right">Total aportes PILA</td>
              <td className="px-4 py-3 font-bold tabular-nums text-foreground">{fmtCOP(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        * ICBF y SENA aplican solo cuando la nómina total supera 10 SMLV.
      </p>
    </div>
  )
}
