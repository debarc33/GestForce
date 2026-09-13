'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Trash2, ChevronRight, Info } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompanyStore } from '@/store/useCompanyStore'
import { exportToExcel, type ExcelColumn } from '@/lib/export-excel'
import {
  useChartOfAccounts, useJournalEntries, useJournalEntryLines,
  seedChartOfAccounts, createAccount, createJournalEntry,
  type Account, type JournalEntry, type JournalEntryInput,
} from '@/modules/accounting/queries'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'cuentas',     label: 'Plan de Cuentas' },
  { id: 'comprobantes',label: 'Comprobantes'     },
  { id: 'informes',    label: 'Informes'         },
] as const
type TabId = typeof TABS[number]['id']

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$ ' + Math.round(n).toLocaleString('es-CO')

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  activo: 'Activo', pasivo: 'Pasivo', patrimonio: 'Patrimonio',
  ingreso: 'Ingreso', gasto: 'Gasto', costo: 'Costo',
}

const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  activo:     'bg-[var(--info-bg)] text-[var(--info)] border border-[var(--info-border)]',
  pasivo:     'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)]',
  patrimonio: 'bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)]',
  ingreso:    'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]',
  gasto:      'bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]',
  costo:      'bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]',
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  sale:       'Venta',
  purchase:   'Compra',
  payment:    'Pago',
  payroll:    'Nómina',
  adjustment: 'Ajuste',
}

const inp = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()
  const cid = activeCompanyId ?? undefined

  const [activeTab, setActiveTab]   = useState<TabId>('cuentas')
  const [search, setSearch]         = useState('')

  // Período para comprobantes e informes
  const now = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const [fromDate, setFromDate]     = useState(firstDay)
  const [toDate, setToDate]         = useState(now.toISOString().slice(0, 10))

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [showNewEntry, setShowNewEntry]   = useState(false)

  useEffect(() => { if (!activeCompanyId) router.replace('/select-company') }, [activeCompanyId, router])

  const { data: accounts = [], isLoading: loadingCOA } = useChartOfAccounts(cid)
  const { data: entries  = [], isLoading: loadingJE  } = useJournalEntries(cid, fromDate, toDate)
  const { data: entryLines = [] } = useJournalEntryLines(selectedEntry?.id)

  // Auto-seed PUC when company has no accounts
  useEffect(() => {
    if (cid && !loadingCOA && accounts.length === 0) {
      seedChartOfAccounts(cid)
        .then(() => queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', cid] }))
        .catch(console.error)
    }
  }, [cid, loadingCOA, accounts.length, queryClient])

  // ── Filtros plan de cuentas ──────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(a =>
      a.code.includes(q) || a.name.toLowerCase().includes(q)
    )
  }, [accounts, search])

  // ── Informes: agregar saldos por tipo de cuenta ──────────────────────────
  const balances = useMemo(() => {
    // Saldo = débito - crédito por cuenta
    // Para informes básicos: usamos invoices (ingresos) y supplier_invoices (gastos)
    // desde el módulo de finanzas. Aquí calculamos desde journal_entry_lines cuando haya datos.
    return {
      activo:     accounts.filter(a => a.account_type === 'activo'),
      pasivo:     accounts.filter(a => a.account_type === 'pasivo'),
      patrimonio: accounts.filter(a => a.account_type === 'patrimonio'),
      ingreso:    accounts.filter(a => a.account_type === 'ingreso'),
      gasto:      accounts.filter(a => a.account_type === 'gasto'),
      costo:      accounts.filter(a => a.account_type === 'costo'),
    }
  }, [accounts])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Contabilidad</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Plan de cuentas PUC, comprobantes y estados financieros.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-[var(--glass-border)]">
        {TABS.map(tab => (
          <button key={tab.id} type="button"
            onClick={() => { setActiveTab(tab.id); setSearch('') }}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
          </button>
        ))}
      </div>

      {/* ══ PLAN DE CUENTAS ═══════════════════════════════════════════════ */}
      {activeTab === 'cuentas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <input type="search" placeholder="Buscar por código o nombre..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none w-64" />
            <div className="flex gap-2">
              <button onClick={() => exportToExcel(filteredAccounts, [
                { header: 'Código',  key: 'code',         width: 12 },
                { header: 'Nombre',  key: 'name',         width: 40 },
                { header: 'Tipo',    key: r => ACCOUNT_TYPE_LABEL[r.account_type], width: 14 },
                { header: 'Naturaleza', key: 'nature',    width: 12 },
              ] as ExcelColumn<Account>[], 'plan_de_cuentas')}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-foreground hover:bg-[var(--glass-hover)]">
                Exportar
              </button>
              <button onClick={() => setShowNewAccount(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 shadow-sm">
                <Plus className="h-4 w-4" />Nueva cuenta
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-[var(--info-bg)] border border-[var(--info-border)] px-3 py-2.5">
            <Info className="h-4 w-4 text-[var(--info)] mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/80">
              Plan Único de Cuentas (PUC) pre-cargado con las cuentas NIIF PYMES más usadas. Las cuentas del sistema no pueden eliminarse. Puedes agregar sub-cuentas propias.
            </p>
          </div>

          {loadingCOA ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-[var(--glass-hover)]/50">
                  <TableRow className="border-[var(--glass-border)]">
                    {['Código','Nombre','Tipo','Naturaleza','Nivel'].map(h => (
                      <TableHead key={h} className="py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.length ? (
                    filteredAccounts.map(acct => {
                      const indent = (acct.code.length - 1) * 8
                      return (
                        <TableRow key={acct.id} className="border-zinc-100 hover:bg-[var(--glass-hover)]/40">
                          <TableCell className="py-2.5 font-mono text-sm text-foreground">{acct.code}</TableCell>
                          <TableCell className="py-2.5">
                            <span style={{ paddingLeft: indent }} className="text-sm text-foreground">
                              {!acct.is_leaf && <span className="text-muted-foreground mr-1">▸</span>}
                              {acct.name}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_TYPE_COLOR[acct.account_type] ?? 'bg-zinc-100 text-muted-foreground'}`}>
                              {ACCOUNT_TYPE_LABEL[acct.account_type] ?? acct.account_type}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground capitalize">{acct.nature}</TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {acct.is_leaf ? 'Auxiliar' : 'Mayor'}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                        {search ? 'Sin resultados.' : 'Cargando plan de cuentas...'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ══ COMPROBANTES ══════════════════════════════════════════════════ */}
      {activeTab === 'comprobantes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Selector de período */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs font-medium">Desde:</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
              <span className="text-muted-foreground">→</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-sm focus:border-primary focus:outline-none" />
            </div>
            <button onClick={() => setShowNewEntry(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 shadow-sm">
              <Plus className="h-4 w-4" />Asiento manual
            </button>
          </div>

          {loadingJE ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-12 text-center">
              <BookOpen className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay comprobantes en el período seleccionado.</p>
              <p className="text-xs text-muted-foreground mt-1">Los asientos se generan automáticamente al emitir facturas, registrar pagos o cerrar nómina.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-[var(--glass-hover)]/50">
                  <TableRow className="border-[var(--glass-border)]">
                    {['#Comprobante','Fecha','Tipo','Descripción','Débito = Crédito',''].map(h => (
                      <TableHead key={h} className="py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(entry => (
                    <TableRow key={entry.id} className="border-zinc-100 hover:bg-[var(--glass-hover)]/40">
                      <TableCell className="py-3 font-mono text-sm text-foreground">{entry.entry_number}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{fmtDate(entry.entry_date)}</TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs bg-zinc-100 text-muted-foreground rounded-full px-2 py-0.5">
                          {ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-foreground">{entry.description}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="py-3">
                        <button onClick={() => setSelectedEntry(entry)}
                          className="text-primary hover:underline text-xs flex items-center gap-1">
                          Ver <ChevronRight className="h-3 w-3" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ══ INFORMES ══════════════════════════════════════════════════════ */}
      {activeTab === 'informes' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-[var(--warning)] mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/80">
              Los informes financieros completos (Balance General y Estado de Resultados con saldos reales) estarán disponibles una vez que los comprobantes automáticos estén activos.
              Por ahora puedes ver la estructura del plan de cuentas y los comprobantes manuales que registres.
            </p>
          </div>

          {/* Vista del plan de cuentas agrupado por tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Activos', type: 'activo', accounts: balances.activo, cls: 'border-[var(--info-border)] bg-[var(--info-bg)]' },
              { label: 'Pasivos', type: 'pasivo', accounts: balances.pasivo, cls: 'border-[var(--danger-border)] bg-[var(--danger-bg)]' },
              { label: 'Patrimonio', type: 'patrimonio', accounts: balances.patrimonio, cls: 'border-[var(--accent-border)] bg-[var(--accent-bg)]' },
              { label: 'Ingresos', type: 'ingreso', accounts: balances.ingreso, cls: 'border-[var(--success-border)] bg-[var(--success-bg)]' },
              { label: 'Gastos', type: 'gasto', accounts: balances.gasto, cls: 'border-[var(--warning-border)] bg-[var(--warning-bg)]' },
              { label: 'Costo de ventas', type: 'costo', accounts: balances.costo, cls: 'border-[var(--warning-border)] bg-[var(--warning-bg)]' },
            ].map(group => (
              <div key={group.type} className={`rounded-xl border p-4 ${group.cls}`}>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {group.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({group.accounts.length} cuentas)</span>
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {group.accounts.filter(a => a.is_leaf).slice(0, 12).map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground w-16 shrink-0">{a.code}</span>
                      <span className="text-foreground flex-1 truncate">{a.name}</span>
                      <span className="text-muted-foreground ml-2">$ 0</span>
                    </div>
                  ))}
                  {group.accounts.filter(a => a.is_leaf).length > 12 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{group.accounts.filter(a => a.is_leaf).length - 12} más...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ DIALOGS ═══════════════════════════════════════════════════════ */}

      {/* Detalle asiento */}
      <Dialog open={!!selectedEntry} onOpenChange={v => { if (!v) setSelectedEntry(null) }}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-zinc-100">
          <DialogHeader>
            <DialogTitle>Comprobante {selectedEntry?.entry_number}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedEntry && fmtDate(selectedEntry.entry_date)} · {selectedEntry && (ENTRY_TYPE_LABEL[selectedEntry.entry_type] ?? selectedEntry.entry_type)}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-foreground">{selectedEntry.description}</p>
              {entryLines.length > 0 ? (
                <table className="w-full text-sm border rounded-xl overflow-hidden">
                  <thead className="bg-[var(--glass-hover)]">
                    <tr>
                      {['Cuenta','Descripción','Débito','Crédito'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entryLines.map(line => (
                      <tr key={line.id} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-mono text-foreground">{line.account_code}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.description ?? '—'}</td>
                        <td className="px-3 py-2 tabular-nums text-foreground">{line.debit > 0 ? fmtCOP(line.debit) : '—'}</td>
                        <td className="px-3 py-2 tabular-nums text-foreground">{line.credit > 0 ? fmtCOP(line.credit) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[var(--glass-border)] bg-[var(--glass-hover)]">
                      <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-right text-muted-foreground">Totales</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-foreground">{fmtCOP(entryLines.reduce((s, l) => s + l.debit, 0))}</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-foreground">{fmtCOP(entryLines.reduce((s, l) => s + l.credit, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin líneas de detalle.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nueva cuenta */}
      {showNewAccount && cid && (
        <NewAccountDialog
          companyId={cid}
          accounts={accounts}
          onClose={() => setShowNewAccount(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['chart_of_accounts', cid] })
            setShowNewAccount(false)
          }}
        />
      )}

      {/* Asiento manual */}
      {showNewEntry && cid && (
        <NewJournalEntryDialog
          companyId={cid}
          accounts={accounts.filter(a => a.is_leaf)}
          onClose={() => setShowNewEntry(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['journal_entries', cid] })
            setShowNewEntry(false)
          }}
        />
      )}
    </div>
  )
}

// ─── New Account dialog ───────────────────────────────────────────────────────

function NewAccountDialog({ companyId, accounts, onClose, onSaved }: {
  companyId: string; accounts: Account[]
  onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    code: '', name: '', account_type: 'activo' as Account['account_type'],
    nature: 'debito' as Account['nature'], parent_code: '', is_leaf: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('Código y nombre son requeridos.'); return }
    if (accounts.find(a => a.code === form.code.trim())) { setError('Ya existe una cuenta con ese código.'); return }
    setSaving(true)
    try {
      await createAccount(companyId, {
        code:         form.code.trim(),
        name:         form.name.trim(),
        account_type: form.account_type,
        nature:       form.nature,
        is_leaf:      form.is_leaf,
        parent_code:  form.parent_code || null,
        is_system:    false,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inp2 = 'w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md rounded-2xl shadow-xl border-zinc-100">
        <DialogHeader><DialogTitle>Nueva cuenta</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-[130px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código PUC <span className="text-red-500">*</span></label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                className={inp2} placeholder="Ej. 110510" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={inp2} placeholder="Nombre de la cuenta" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value as Account['account_type'] }))} className={inp2}>
                {['activo','pasivo','patrimonio','ingreso','gasto','costo'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Naturaleza</label>
              <select value={form.nature} onChange={e => setForm(p => ({ ...p, nature: e.target.value as Account['nature'] }))} className={inp2}>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cuenta padre (código)</label>
            <input value={form.parent_code} onChange={e => setForm(p => ({ ...p, parent_code: e.target.value }))}
              className={inp2} placeholder="Ej. 1105" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_leaf} onChange={e => setForm(p => ({ ...p, is_leaf: e.target.checked }))}
              className="h-4 w-4 accent-blue-600" />
            <span className="text-sm text-foreground">Cuenta auxiliar (acepta movimientos)</span>
          </label>
          {error && <p className="text-xs text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--glass-hover)]">Cancelar</button>
            <button onClick={handle} disabled={saving}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── New Journal Entry dialog ─────────────────────────────────────────────────

type LineForm = { account_code: string; description: string; debit: string; credit: string }

function NewJournalEntryDialog({ companyId, accounts, onClose, onSaved }: {
  companyId: string; accounts: Account[]
  onClose: () => void; onSaved: () => void
}) {
  const now = new Date().toISOString().slice(0, 10)
  const [date, setDate]       = useState(now)
  const [desc, setDesc]       = useState('')
  const [lines, setLines]     = useState<LineForm[]>([
    { account_code: '', description: '', debit: '', credit: '' },
    { account_code: '', description: '', debit: '', credit: '' },
  ])
  const [error, setError]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const setLine = (i: number, field: keyof LineForm, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const handle = async () => {
    if (!desc.trim()) { setError('La descripción es requerida.'); return }
    if (!balanced)    { setError('Los débitos y créditos no cuadran.'); return }
    setSaving(true)
    try {
      const validLines = lines
        .filter(l => l.account_code.trim())
        .map(l => ({
          account_code: l.account_code.trim(),
          description:  l.description || undefined,
          debit:        parseFloat(l.debit)  || 0,
          credit:       parseFloat(l.credit) || 0,
        }))
      await createJournalEntry(companyId, { entry_date: date, description: desc, lines: validLines } as JournalEntryInput)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const inp2 = 'rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-sm focus:border-primary focus:outline-none w-full'

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-zinc-100">
        <DialogHeader><DialogTitle>Asiento contable manual</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción <span className="text-red-500">*</span></label>
              <input value={desc} onChange={e => setDesc(e.target.value)} className={inp2} placeholder="Ej. Ajuste provisión diciembre" />
            </div>
          </div>

          {/* Líneas */}
          <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--glass-hover)]">
                <tr>
                  {['Cuenta','Descripción','Débito','Crédito',''].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-2 py-1.5 w-36">
                      <input list={`accts-${i}`} value={line.account_code}
                        onChange={e => setLine(i, 'account_code', e.target.value)}
                        className={inp2} placeholder="Código" />
                      <datalist id={`accts-${i}`}>
                        {accounts.map(a => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}
                      </datalist>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={line.description} onChange={e => setLine(i, 'description', e.target.value)}
                        className={inp2} placeholder="Concepto" />
                    </td>
                    <td className="px-2 py-1.5 w-28">
                      <input type="number" min="0" step="1000" value={line.debit}
                        onChange={e => setLine(i, 'debit', e.target.value)}
                        className={inp2} placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5 w-28">
                      <input type="number" min="0" step="1000" value={line.credit}
                        onChange={e => setLine(i, 'credit', e.target.value)}
                        className={inp2} placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-zinc-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Totales */}
                <tr className="border-t-2 border-[var(--glass-border)] bg-[var(--glass-hover)]">
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-right text-muted-foreground">Totales</td>
                  <td className={`px-2 py-2 tabular-nums font-bold text-sm ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                    $ {totalDebit.toLocaleString('es-CO')}
                  </td>
                  <td className={`px-2 py-2 tabular-nums font-bold text-sm ${balanced ? 'text-green-700' : 'text-red-600'}`}>
                    $ {totalCredit.toLocaleString('es-CO')}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <button onClick={() => setLines(prev => [...prev, { account_code: '', description: '', debit: '', credit: '' }])}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80">
            <Plus className="h-3.5 w-3.5" />Agregar línea
          </button>

          {!balanced && totalDebit > 0 && (
            <p className="text-xs text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-lg px-3 py-2">
              El asiento no cuadra. Diferencia: $ {Math.abs(totalDebit - totalCredit).toLocaleString('es-CO')}
            </p>
          )}

          {error && <p className="text-xs text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-[var(--glass-border)] px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--glass-hover)]">Cancelar</button>
            <button onClick={handle} disabled={saving || !balanced}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Registrar asiento'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
