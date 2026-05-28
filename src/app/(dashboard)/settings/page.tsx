'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Check, X, Building2,
  ShieldCheck, Zap, AlertTriangle, AlertCircle, Settings2,
  Upload, Image as ImageIcon, Star, CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  usePaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  type PaymentMethod,
} from '@/modules/sales/queries'
import {
  useCompany, updateCompany, isIvaResponsible, getDianAlerts,
  useCompanyBankAccounts, createCompanyBankAccount,
  deleteCompanyBankAccount, setCompanyBankAccountPrimary,
  type CompanyProfileUpdate, type CompanyBankAccount,
} from '@/modules/company/queries'
import { useCompanyStore } from '@/store/useCompanyStore'

// ─── Constantes ────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
  check: 'Cheque', other: 'Otro',
}

const FISCAL_LABELS: Record<string, string> = {
  iva:               'Responsable de IVA',
  no_iva:            'No Responsable de IVA',
  gran_contribuyente: 'Gran Contribuyente',
}

const inputCls =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors'
const fieldCls = 'w-full ' + inputCls
const lbl = 'block text-xs font-medium text-zinc-500 mb-1.5'

// ─── Fila editable de medio de pago ────────────────────────────────────────

function PaymentMethodRow({
  method, companyId, onDone,
}: { method?: PaymentMethod; companyId: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(method?.name ?? '')
  const [type, setType] = useState<string>(method?.type ?? 'cash')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) { setError('El nombre es requerido'); return Promise.reject() }
      if (method) return updatePaymentMethod(method.id, { name: name.trim(), type })
      return createPaymentMethod({ company_id: companyId, name: name.trim(), type })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_methods', companyId] })
      onDone()
    },
    onError: (e: Error) => setError(e?.message ?? 'Error'),
  })

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-blue-200 bg-blue-50/30">
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && mutation.mutate()}
        placeholder="Ej. Efectivo, Nequi, Daviplata..."
        className={`${inputCls} flex-1`} autoFocus />
      <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
        {Object.entries(TYPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        className="rounded-lg p-2 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={onDone} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 transition-colors">
        <X className="h-4 w-4" />
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Badge de estado DIAN ──────────────────────────────────────────────────

function DianRangeBadge({ alert }: { alert: 'warning' | 'critical' | null }) {
  if (!alert) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700"><Check className="h-3 w-3" />Vigente</span>
  if (alert === 'warning') return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" />Por agotar</span>
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700"><AlertCircle className="h-3 w-3" />Crítico</span>
}

function DianExpiryBadge({ alert }: { alert: 'warning' | 'expired' | null }) {
  if (!alert) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700"><Check className="h-3 w-3" />Vigente</span>
  if (alert === 'warning') return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" />Por vencer</span>
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700"><AlertCircle className="h-3 w-3" />Vencida</span>
}

function FEBadge({ configured, testMode }: { configured: boolean; testMode: boolean }) {
  if (!configured) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500"><Settings2 className="h-3 w-3" />Sin configurar</span>
  if (testMode)    return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"><Zap className="h-3 w-3" />Habilitación</span>
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3" />Producción</span>
}

// ─── Página principal ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { activeCompanyId } = useCompanyStore()
  const queryClient = useQueryClient()

  const [addingNew, setAddingNew]           = useState(false)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [editingCompany, setEditingCompany] = useState(false)
  const [editingDian, setEditingDian]       = useState(false)
  const [editingFE, setEditingFE]           = useState(false)
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [editingIca, setEditingIca]             = useState(false)
  const [editingPayroll, setEditingPayroll]     = useState(false)
  const [editingLogo, setEditingLogo]           = useState(false)
  const [editingPrint, setEditingPrint]         = useState(false)
  const [activeSection, setActiveSection]       = useState('empresa')
  const [companyForm, setCompanyForm]       = useState<CompanyProfileUpdate>({})
  const [companyError, setCompanyError]     = useState<string | null>(null)

  // Logo upload state
  const [logoFile, setLogoFile]         = useState<File | null>(null)
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]       = useState<string | null>(null)
  const logoInputRef                    = useRef<HTMLInputElement>(null)

  // Bank accounts state
  const [addingBank, setAddingBank]     = useState(false)
  const [bankForm, setBankForm]         = useState({
    bank_name: '', account_type: 'ahorros', account_number: '',
    account_holder: '', is_primary: false, is_active: true,
  })
  const [bankError, setBankError]       = useState<string | null>(null)

  useEffect(() => {
    if (!activeCompanyId) router.replace('/select-company')
  }, [activeCompanyId, router])

  const { data: company, isLoading: loadingCompany } = useCompany(activeCompanyId)
  const { data: paymentMethods = [], isLoading } = usePaymentMethods(activeCompanyId ?? undefined)
  const { data: bankAccounts = [], isLoading: loadingBanks } = useCompanyBankAccounts(activeCompanyId)

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name:                 company.name,
        nit:                  company.nit                  ?? '',
        legal_name:           company.legal_name           ?? '',
        address:              company.address              ?? '',
        city:                 company.city                 ?? '',
        department:           company.department           ?? '',
        phone:                company.phone                ?? '',
        email:                company.email                ?? '',
        fiscal_regime:        company.fiscal_regime        ?? 'iva',
        ciiu_code:            company.ciiu_code            ?? '',
        dian_resolution:      company.dian_resolution      ?? '',
        dian_resolution_date: company.dian_resolution_date ?? '',
        dian_prefix:          company.dian_prefix          ?? '',
        dian_from_number:     company.dian_from_number     ?? undefined,
        dian_to_number:       company.dian_to_number       ?? undefined,
        dian_validity_from:   company.dian_validity_from   ?? '',
        dian_validity_to:     company.dian_validity_to     ?? '',
        fe_software_id:       company.fe_software_id       ?? '',
        fe_software_pin:      company.fe_software_pin      ?? '',
        fe_api_url:           company.fe_api_url           ?? '',
        fe_test_mode:         company.fe_test_mode         ?? true,
        fe_technical_key:     company.fe_technical_key     ?? '',
        buyer_threshold:      company.buyer_threshold      ?? 212000,
        ica_rate:             company.ica_rate             ?? 0.00414,
        smlv:                 company.smlv                 ?? 1300000,
        transport_allowance:  company.transport_allowance  ?? 162000,
        invoice_footer:         company.invoice_footer         ?? '',
        quote_terms:            company.quote_terms            ?? '',
        print_paper_size:       company.print_paper_size       ?? 'carta',
        print_show_logo:        company.print_show_logo        ?? true,
        print_auto_dian_footer: company.print_auto_dian_footer ?? true,
        print_legal_lines:      company.print_legal_lines      ?? '',
      })
    }
  }, [company])

  const deleteMut   = useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment_methods', activeCompanyId] }),
  })
  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updatePaymentMethod(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment_methods', activeCompanyId] }),
  })

  // Logo upload
  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setLogoError('El archivo no puede superar 2 MB.'); return }
    if (!file.type.startsWith('image/')) { setLogoError('Solo se aceptan imágenes (PNG, JPG, WebP).'); return }
    setLogoFile(file)
    setLogoError(null)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadLogo() {
    if (!logoFile || !activeCompanyId) return
    setLogoUploading(true)
    setLogoError(null)
    try {
      const supabase = createClient()
      const ext  = logoFile.name.split('.').pop()
      const path = `${activeCompanyId}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from('company-assets')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path)
      await updateCompany(activeCompanyId, { logo_url: publicUrl })
      queryClient.invalidateQueries({ queryKey: ['company', activeCompanyId] })
      setLogoFile(null)
      setLogoPreview(null)
      setEditingLogo(false)
    } catch (e: unknown) {
      setLogoError(e instanceof Error ? e.message : 'Error al subir el logo')
    } finally {
      setLogoUploading(false)
    }
  }

  const saveCompany = (closeSection: () => void) => useMutation({
    mutationFn: () => updateCompany(activeCompanyId!, companyForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', activeCompanyId] })
      closeSection()
      setCompanyError(null)
    },
    onError: (e: Error) => setCompanyError(e.message),
  })

  // Un mutation único para todo — la función es la misma, cambia quién lo llama
  const companyMut = useMutation({
    mutationFn: () => updateCompany(activeCompanyId!, companyForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', activeCompanyId] })
      setEditingCompany(false)
      setEditingDian(false)
      setEditingFE(false)
      setEditingThreshold(false)
      setEditingIca(false)
      setEditingPayroll(false)
      setEditingLogo(false)
      setEditingPrint(false)
      setCompanyError(null)
    },
    onError: (e: Error) => setCompanyError(e.message),
  })

  // Bank account mutations
  const bankCreateMut = useMutation({
    mutationFn: () => {
      if (!bankForm.bank_name.trim()) throw new Error('El banco es requerido')
      if (!bankForm.account_number.trim()) throw new Error('El número de cuenta es requerido')
      return createCompanyBankAccount(activeCompanyId!, {
        bank_name:       bankForm.bank_name.trim(),
        account_type:    bankForm.account_type,
        account_number:  bankForm.account_number.trim(),
        account_holder:  bankForm.account_holder.trim() || null,
        is_primary:      bankForm.is_primary,
        is_active:       true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', activeCompanyId] })
      setAddingBank(false)
      setBankForm({ bank_name: '', account_type: 'ahorros', account_number: '', account_holder: '', is_primary: false, is_active: true })
      setBankError(null)
    },
    onError: (e: Error) => setBankError(e.message),
  })

  const bankDeleteMut = useMutation({
    mutationFn: deleteCompanyBankAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', activeCompanyId] }),
  })

  const bankPrimaryMut = useMutation({
    mutationFn: (id: string) => setCompanyBankAccountPrimary(id, activeCompanyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', activeCompanyId] }),
  })

  const cf = (field: keyof CompanyProfileUpdate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setCompanyForm(prev => ({ ...prev, [field]: e.target.value }))

  const cfNum = (field: keyof CompanyProfileUpdate) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setCompanyForm(prev => ({ ...prev, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))

  const cfBool = (field: keyof CompanyProfileUpdate, value: boolean) =>
    setCompanyForm(prev => ({ ...prev, [field]: value }))

  const ivaMode    = isIvaResponsible(company?.fiscal_regime)
  const { rangeAlert, expiryAlert, feConfigured } = getDianAlerts(company)

  const SectionHeader = ({ title, sub, editing, onEdit, onSave, onCancel, badge }: {
    title: string; sub: string; editing: boolean
    onEdit: () => void; onSave: () => void; onCancel: () => void
    badge?: React.ReactNode
  }) => (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {badge}
        </div>
        <p className="text-sm text-zinc-500 mt-0.5">{sub}</p>
      </div>
      {!editing ? (
        <button onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          <Pencil className="h-3.5 w-3.5" />Editar
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onSave} disabled={companyMut.isPending}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {companyMut.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )

  const NAV_GROUPS = [
    { label: 'Empresa', items: [
      { id: 'empresa',     label: 'Perfil' },
      { id: 'logo',        label: 'Logo y documentos' },
      { id: 'bancos',      label: 'Cuentas bancarias' },
    ]},
    { label: 'Fiscal', items: [
      { id: 'dian',        label: 'Resolución DIAN' },
      { id: 'fe',          label: 'Facturación Electrónica' },
      { id: 'ica',         label: 'ICA municipal' },
    ]},
    { label: 'Documentos', items: [
      { id: 'impresion',   label: 'Formatos de impresión' },
      { id: 'medios_pago', label: 'Medios de pago' },
      { id: 'umbrales',    label: 'Umbrales' },
    ]},
    { label: 'Nómina', items: [
      { id: 'nomina',      label: 'Valores de nómina' },
    ]},
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Configuración</h1>
        <p className="mt-0.5 text-[13px] text-zinc-400">Personaliza el comportamiento de GestForce para tu empresa.</p>
      </div>

      <div className="flex gap-8 items-start">

        {/* ── Navegación lateral ─────────────────────────────────────── */}
        <nav className="w-48 shrink-0 sticky top-6 rounded-xl border border-zinc-200 bg-white p-3 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Contenido ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 max-w-2xl">

      {/* ══ 1. Perfil de empresa ══════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'empresa' ? ' hidden' : ''}`}>
        <SectionHeader
          title="Perfil de empresa" sub="Datos que aparecen en documentos y facturas."
          editing={editingCompany}
          onEdit={() => setEditingCompany(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => { setEditingCompany(false); setCompanyError(null) }}
        />

        {loadingCompany ? (
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
        ) : editingCompany ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Nombre comercial</label>
                <input value={companyForm.name ?? ''} onChange={cf('name')} className={fieldCls} placeholder="Mi Empresa S.A.S." /></div>
              <div><label className={lbl}>NIT</label>
                <input value={companyForm.nit ?? ''} onChange={cf('nit')} className={fieldCls} placeholder="900123456-7" /></div>
            </div>
            <div><label className={lbl}>Razón social</label>
              <input value={companyForm.legal_name ?? ''} onChange={cf('legal_name')} className={fieldCls} placeholder="Mi Empresa S.A.S." /></div>
            <div><label className={lbl}>Dirección</label>
              <input value={companyForm.address ?? ''} onChange={cf('address')} className={fieldCls} placeholder="Calle 10 # 5-30" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Ciudad</label>
                <input value={companyForm.city ?? ''} onChange={cf('city')} className={fieldCls} placeholder="Medellín" /></div>
              <div><label className={lbl}>Departamento</label>
                <input value={companyForm.department ?? ''} onChange={cf('department')} className={fieldCls} placeholder="Antioquia" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Teléfono</label>
                <input value={companyForm.phone ?? ''} onChange={cf('phone')} className={fieldCls} placeholder="+57 604 123 4567" /></div>
              <div><label className={lbl}>Email</label>
                <input value={companyForm.email ?? ''} onChange={cf('email')} type="email" className={fieldCls} placeholder="info@miempresa.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Régimen fiscal</label>
                <select value={companyForm.fiscal_regime ?? 'iva'} onChange={cf('fiscal_regime')} className={fieldCls}>
                  <option value="iva">Responsable de IVA</option>
                  <option value="no_iva">No Responsable de IVA</option>
                  <option value="gran_contribuyente">Gran Contribuyente</option>
                </select>
              </div>
              <div>
                <label className={lbl}>
                  Cód. Actividad Económica (CIIU)
                  <span className="text-zinc-400 font-normal ml-1">(opcional)</span>
                </label>
                <input value={companyForm.ciiu_code ?? ''} onChange={cf('ciiu_code')}
                  className={fieldCls} placeholder="Ej. 4711" maxLength={10} />
              </div>
            </div>
            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            {company ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{company.name}</p>
                    {company.legal_name && company.legal_name !== company.name && (
                      <p className="text-xs text-zinc-400">{company.legal_name}</p>
                    )}
                    {company.nit && <p className="text-xs text-zinc-500 mt-0.5">NIT: <span className="font-mono">{company.nit}</span></p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-zinc-100 pt-3">
                  {company.address && (<div><p className="text-xs text-zinc-400">Dirección</p><p className="text-zinc-700">{company.address}</p></div>)}
                  {(company.city || company.department) && (<div><p className="text-xs text-zinc-400">Ciudad</p><p className="text-zinc-700">{[company.city, company.department].filter(Boolean).join(', ')}</p></div>)}
                  {company.phone && (<div><p className="text-xs text-zinc-400">Teléfono</p><p className="text-zinc-700">{company.phone}</p></div>)}
                  {company.email && (<div><p className="text-xs text-zinc-400">Email</p><p className="text-zinc-700">{company.email}</p></div>)}
                  <div><p className="text-xs text-zinc-400">Régimen fiscal</p><p className="text-zinc-700">{FISCAL_LABELS[company.fiscal_regime] ?? company.fiscal_regime}</p></div>
                  {company.ciiu_code && (<div><p className="text-xs text-zinc-400">CIIU</p><p className="text-zinc-700 font-mono">{company.ciiu_code}</p></div>)}
                </div>
                {!company.nit && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                    Completa el perfil para que tus datos aparezcan en los documentos.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-4">No se pudo cargar el perfil.</p>
            )}
          </div>
        )}
      </section>

      {/* ══ 2. Resolución DIAN ═══════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'dian' ? ' hidden' : ''}`}>
        <SectionHeader
          title="Resolución DIAN"
          sub="Rango de numeración autorizado y vigencia. Aplica para todos los regímenes que emitan facturas."
          editing={editingDian}
          onEdit={() => setEditingDian(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => { setEditingDian(false); setCompanyError(null) }}
          badge={
            company?.dian_resolution ? (
              <div className="flex items-center gap-1.5">
                <DianRangeBadge alert={rangeAlert} />
                <DianExpiryBadge alert={expiryAlert} />
              </div>
            ) : undefined
          }
        />

        {editingDian ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Número de resolución</label>
                <input value={companyForm.dian_resolution ?? ''} onChange={cf('dian_resolution')}
                  className={fieldCls} placeholder="Ej. 18764000999271" /></div>
              <div><label className={lbl}>Fecha de la resolución</label>
                <input type="date" value={companyForm.dian_resolution_date ?? ''} onChange={cf('dian_resolution_date')} className={fieldCls} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Prefijo autorizado</label>
                <input value={companyForm.dian_prefix ?? ''} onChange={cf('dian_prefix')}
                  className={fieldCls} placeholder="FV" maxLength={10} /></div>
              <div><label className={lbl}>Desde #</label>
                <input type="number" min={1} value={companyForm.dian_from_number ?? ''} onChange={cfNum('dian_from_number')} className={fieldCls} placeholder="1" /></div>
              <div><label className={lbl}>Hasta #</label>
                <input type="number" min={1} value={companyForm.dian_to_number ?? ''} onChange={cfNum('dian_to_number')} className={fieldCls} placeholder="1000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Vigencia desde</label>
                <input type="date" value={companyForm.dian_validity_from ?? ''} onChange={cf('dian_validity_from')} className={fieldCls} /></div>
              <div><label className={lbl}>Vigencia hasta</label>
                <input type="date" value={companyForm.dian_validity_to ?? ''} onChange={cf('dian_validity_to')} className={fieldCls} /></div>
            </div>
            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            {company?.dian_resolution ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><p className="text-xs text-zinc-400">Resolución</p><p className="font-mono text-zinc-700">{company.dian_resolution}</p></div>
                {company.dian_resolution_date && <div><p className="text-xs text-zinc-400">Fecha resolución</p><p className="text-zinc-700">{new Date(company.dian_resolution_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>}
                {company.dian_prefix && <div><p className="text-xs text-zinc-400">Prefijo</p><p className="font-mono text-zinc-700">{company.dian_prefix}</p></div>}
                {(company.dian_from_number || company.dian_to_number) && (
                  <div><p className="text-xs text-zinc-400">Rango autorizado</p>
                    <p className="font-mono text-zinc-700">{company.dian_from_number?.toLocaleString()} — {company.dian_to_number?.toLocaleString()}</p>
                  </div>
                )}
                {company.dian_validity_from && <div><p className="text-xs text-zinc-400">Vigencia desde</p><p className="text-zinc-700">{new Date(company.dian_validity_from + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>}
                {company.dian_validity_to && <div><p className="text-xs text-zinc-400">Vigencia hasta</p><p className="text-zinc-700">{new Date(company.dian_validity_to + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-3">No hay resolución configurada. Haz clic en Editar para agregarla.</p>
            )}
          </div>
        )}
      </section>

      {/* ══ 3. Facturación Electrónica ═══════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'fe' ? ' hidden' : ''}`}>
          <SectionHeader
            title="Facturación Electrónica"
            sub="Credenciales de tu Proveedor Tecnológico (PT) autorizado por la DIAN para emitir facturas electrónicas."
            editing={editingFE}
            onEdit={() => setEditingFE(true)}
            onSave={() => companyMut.mutate()}
            onCancel={() => { setEditingFE(false); setCompanyError(null) }}
            badge={<FEBadge configured={feConfigured} testMode={company?.fe_test_mode ?? true} />}
          />

          {editingFE ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
              {/* Modo */}
              <div>
                <p className={lbl}>Modo de operación</p>
                <div className="flex gap-3">
                  <button type="button"
                    onClick={() => cfBool('fe_test_mode', true)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${companyForm.fe_test_mode ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                    🔶 Habilitación (pruebas)
                  </button>
                  <button type="button"
                    onClick={() => cfBool('fe_test_mode', false)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${!companyForm.fe_test_mode ? 'border-green-300 bg-green-50 text-green-700' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                    ✅ Producción
                  </button>
                </div>
              </div>
              <div><label className={lbl}>URL API del Proveedor Tecnológico</label>
                <input value={companyForm.fe_api_url ?? ''} onChange={cf('fe_api_url')}
                  className={fieldCls} placeholder="https://api.tupt.co/v1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>ID de Software</label>
                  <input value={companyForm.fe_software_id ?? ''} onChange={cf('fe_software_id')} className={fieldCls} /></div>
                <div><label className={lbl}>PIN del Software</label>
                  <input type="password" value={companyForm.fe_software_pin ?? ''} onChange={cf('fe_software_pin')} className={fieldCls} /></div>
              </div>
              <div><label className={lbl}>Llave Técnica del PT</label>
                <input type="password" value={companyForm.fe_technical_key ?? ''} onChange={cf('fe_technical_key')}
                  className={fieldCls} placeholder="Clave técnica para el cálculo del CUFE" /></div>
              <p className="text-xs text-zinc-400 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                El CUFE y el XML UBL 2.1 se calculan automáticamente al emitir cada factura.
                La transmisión a la DIAN se realiza a través de tu Proveedor Tecnológico.
              </p>
              {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              {feConfigured ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><p className="text-xs text-zinc-400">URL del PT</p><p className="text-zinc-700 truncate">{company?.fe_api_url ?? '—'}</p></div>
                  <div><p className="text-xs text-zinc-400">ID de Software</p><p className="font-mono text-zinc-700">{company?.fe_software_id ?? '—'}</p></div>
                  <div><p className="text-xs text-zinc-400">PIN</p><p className="text-zinc-700">••••••••</p></div>
                  <div><p className="text-xs text-zinc-400">Llave Técnica</p><p className="text-zinc-700">••••••••</p></div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-3">
                  Configura las credenciales de tu PT para habilitar la Facturación Electrónica DIAN.
                </p>
              )}
            </div>
          )}
        </section>

      {/* ══ 4. ICA municipal ════════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'ica' ? ' hidden' : ''}`}>
        <SectionHeader
          title="ICA municipal"
          sub="Tasa del Impuesto de Industria y Comercio según tu municipio y actividad económica."
          editing={editingIca}
          onEdit={() => setEditingIca(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => { setEditingIca(false); setCompanyError(null) }}
        />
        {editingIca ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
            <div>
              <label className={lbl}>
                Tasa ICA municipal (%)
              </label>
              <input
                type="number"
                min={0}
                step={0.001}
                value={companyForm.ica_rate != null ? Number((companyForm.ica_rate * 100).toFixed(4)) : 0.414}
                onChange={e =>
                  setCompanyForm(prev => ({ ...prev, ica_rate: Number(e.target.value) / 100 }))
                }
                className={fieldCls}
                placeholder="0.414"
              />
              <p className="text-xs text-zinc-400 mt-1">
                Ingresa el porcentaje (%). Ej: Bogotá comercio = 0.414%, industria = 0.966%.
                Consulta la tarifa con tu contador o en el sitio web de tu alcaldía.
              </p>
            </div>
            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Tasa ICA configurada</span>
              <span className="font-mono font-medium text-zinc-900">
                {((company?.ica_rate ?? 0.00414) * 100).toFixed(3)}%
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ══ 5. Nómina ═══════════════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'nomina' ? ' hidden' : ''}`}>
        <SectionHeader
          title="Nómina"
          sub="Valores legales de nómina. Actualizar cada año según decreto del gobierno."
          editing={editingPayroll}
          onEdit={() => setEditingPayroll(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => { setEditingPayroll(false); setCompanyError(null) }}
        />
        {editingPayroll ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>SMLV — Salario mínimo mensual (COP)</label>
                <input type="number" min={0} step={1000}
                  value={companyForm.smlv ?? 1300000}
                  onChange={cfNum('smlv')}
                  className={fieldCls} placeholder="1300000" />
              </div>
              <div>
                <label className={lbl}>Auxilio de transporte (COP)</label>
                <input type="number" min={0} step={1000}
                  value={companyForm.transport_allowance ?? 162000}
                  onChange={cfNum('transport_allowance')}
                  className={fieldCls} placeholder="162000" />
                <p className="text-xs text-zinc-400 mt-1">
                  Se aplica a empleados con salario ≤ 2 SMLV.
                </p>
              </div>
            </div>
            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">SMLV mensual</span>
                <span className="font-mono font-medium text-zinc-900">
                  ${(company?.smlv ?? 1300000).toLocaleString('es-CO')} COP
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Auxilio de transporte</span>
                <span className="font-mono font-medium text-zinc-900">
                  ${(company?.transport_allowance ?? 162000).toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══ 6. Formatos de impresión ════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'impresion' ? ' hidden' : ''}`}>
        <SectionHeader
          title="Formatos de impresión"
          sub="Tamaño de papel, logo y textos legales que aparecen al pie de facturas y cotizaciones."
          editing={editingPrint}
          onEdit={() => setEditingPrint(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => { setEditingPrint(false); setCompanyError(null) }}
        />

        {editingPrint ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-5">

            {/* Tamaño de papel */}
            <div>
              <p className={lbl}>Tamaño de papel predeterminado</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'carta',        label: 'Carta',         hint: '216 × 279 mm' },
                  { value: 'media_carta',  label: 'Media carta',   hint: '216 × 140 mm' },
                  { value: 'tiquete_80mm', label: 'Tiquete 80 mm', hint: 'Impresora térmica' },
                ] as const).map(p => (
                  <button key={p.value} type="button"
                    onClick={() => setCompanyForm(prev => ({ ...prev, print_paper_size: p.value }))}
                    className={`flex flex-col items-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      companyForm.print_paper_size === p.value
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="text-[10px] font-normal opacity-60 mt-0.5">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Opciones toggle */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => cfBool('print_show_logo', !(companyForm.print_show_logo ?? true))}
                  className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer ${companyForm.print_show_logo ?? true ? 'bg-blue-600' : 'bg-zinc-200'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${companyForm.print_show_logo ?? true ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800">Mostrar logo en documentos</p>
                  <p className="text-xs text-zinc-400">Aparece junto al nombre de la empresa en facturas y cotizaciones</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => cfBool('print_auto_dian_footer', !(companyForm.print_auto_dian_footer ?? true))}
                  className={`h-5 w-9 rounded-full transition-colors relative cursor-pointer ${companyForm.print_auto_dian_footer ?? true ? 'bg-blue-600' : 'bg-zinc-200'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${companyForm.print_auto_dian_footer ?? true ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800">Incluir resolución DIAN automática</p>
                  <p className="text-xs text-zinc-400">
                    Genera: &quot;Resolución de Facturación DIAN No. X del fecha, autoriza del FV-1 al FV-1000, vigente hasta...&quot;
                  </p>
                </div>
              </label>
            </div>

            {/* Líneas legales */}
            <div>
              <label className={lbl}>
                Líneas legales adicionales
                <span className="font-normal text-zinc-400 ml-1">(una por línea)</span>
              </label>
              <textarea
                value={companyForm.print_legal_lines ?? ''}
                onChange={cf('print_legal_lines')}
                rows={5}
                placeholder={'No somos autorretenedores de renta\nNo somos grandes contribuyentes\nActuamos como agentes de retención de IVA'}
                className={`${fieldCls} resize-none`}
              />
              <p className="text-xs text-zinc-400 mt-1">
                Estas líneas aparecen al pie de facturas y cotizaciones, después de la resolución DIAN.
              </p>
            </div>

            {/* Preview del pie */}
            {(companyForm.print_auto_dian_footer || companyForm.print_legal_lines) && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Vista previa del pie</p>
                {companyForm.print_auto_dian_footer && company?.dian_resolution && (
                  <p className="text-[10px] text-zinc-600 text-center">
                    Resolución de Facturación DIAN No. {company.dian_resolution}
                    {company.dian_resolution_date ? ` del ${new Date(company.dian_resolution_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}
                    {company.dian_prefix && company.dian_from_number && company.dian_to_number
                      ? `, autoriza del ${company.dian_prefix}${company.dian_from_number} al ${company.dian_prefix}${company.dian_to_number}`
                      : ''}
                    {company.dian_validity_to ? `. Vigente hasta ${new Date(company.dian_validity_to + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}` : '.'}
                  </p>
                )}
                {companyForm.print_auto_dian_footer && !company?.dian_resolution && (
                  <p className="text-[10px] text-zinc-400 italic text-center">
                    (Configura la resolución DIAN para ver la línea automática)
                  </p>
                )}
                {(companyForm.print_legal_lines ?? '').split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-[10px] text-zinc-600 text-center">{line.trim()}</p>
                ))}
              </div>
            )}

            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Tamaño de papel</span>
              <span className="font-medium text-zinc-900">
                {company?.print_paper_size === 'media_carta' ? 'Media carta' :
                 company?.print_paper_size === 'tiquete_80mm' ? 'Tiquete 80 mm' : 'Carta'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-zinc-100 pt-3">
              <span className="text-zinc-500">Logo en documentos</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${company?.print_show_logo !== false ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {company?.print_show_logo !== false ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-zinc-100 pt-3">
              <span className="text-zinc-500">Resolución DIAN automática</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${company?.print_auto_dian_footer !== false ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {company?.print_auto_dian_footer !== false ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            {company?.print_legal_lines && (
              <div className="border-t border-zinc-100 pt-3">
                <p className="text-xs text-zinc-400 mb-1">Líneas legales</p>
                <div className="space-y-0.5">
                  {company.print_legal_lines.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="text-xs text-zinc-600">• {line.trim()}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══ 7. Logo y documentos ════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'logo' ? ' hidden' : ''}`}>
        <SectionHeader
          title="Logo y documentos"
          sub="Logo de la empresa y textos que aparecen en facturas y cotizaciones."
          editing={editingLogo}
          onEdit={() => setEditingLogo(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => {
            setEditingLogo(false)
            setLogoFile(null)
            setLogoPreview(null)
            setLogoError(null)
            setCompanyError(null)
          }}
        />

        {editingLogo ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-5">
            {/* Logo upload */}
            <div>
              <p className="block text-xs font-medium text-zinc-500 mb-3">Logo de la empresa</p>
              <div className="flex items-center gap-5">
                {/* Preview */}
                <div className="h-24 w-24 rounded-xl border-2 border-dashed border-zinc-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {(logoPreview ?? company?.logo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview ?? company?.logo_url ?? ''}
                      alt="Logo preview"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-zinc-300" />
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    {company?.logo_url ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  {logoFile && (
                    <button
                      type="button"
                      onClick={uploadLogo}
                      disabled={logoUploading}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {logoUploading ? 'Subiendo...' : 'Confirmar subida'}
                    </button>
                  )}
                  <p className="text-xs text-zinc-400">PNG, JPG o WebP · máx. 2 MB</p>
                  {logoError && <p className="text-xs text-red-600">{logoError}</p>}
                </div>
              </div>
            </div>

            {/* Pie de factura */}
            <div>
              <label className={lbl}>Pie de página en facturas y OC</label>
              <textarea
                value={companyForm.invoice_footer ?? ''}
                onChange={cf('invoice_footer')}
                rows={3}
                placeholder="Ej. Consigne a Bancolombia Cta Ahorros 123-456789-00 a nombre de Mi Empresa S.A.S."
                className={`${fieldCls} resize-none`}
              />
              <p className="text-xs text-zinc-400 mt-1">Aparece al pie de cada factura y orden de compra impresa o en PDF.</p>
            </div>

            {/* Términos cotizaciones */}
            <div>
              <label className={lbl}>Términos y condiciones en cotizaciones</label>
              <textarea
                value={companyForm.quote_terms ?? ''}
                onChange={cf('quote_terms')}
                rows={4}
                placeholder="Ej. Esta cotización tiene validez de 15 días. Los precios no incluyen IVA. El tiempo de entrega es de 5 días hábiles..."
                className={`${fieldCls} resize-none`}
              />
            </div>

            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden shrink-0">
                {company?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImageIcon className="h-7 w-7 text-zinc-300" />
                )}
              </div>
              <div className="text-sm">
                <p className="font-medium text-zinc-900">{company?.logo_url ? 'Logo cargado' : 'Sin logo'}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {company?.logo_url ? 'Aparece en encabezados de documentos' : 'Agrega tu logo para documentos profesionales'}
                </p>
              </div>
            </div>
            {(company?.invoice_footer || company?.quote_terms) && (
              <div className="border-t border-zinc-100 pt-3 space-y-2 text-sm">
                {company.invoice_footer && (
                  <div>
                    <p className="text-xs text-zinc-400">Pie de facturas</p>
                    <p className="text-zinc-700 text-xs mt-0.5 leading-relaxed">{company.invoice_footer}</p>
                  </div>
                )}
                {company.quote_terms && (
                  <div>
                    <p className="text-xs text-zinc-400">Términos en cotizaciones</p>
                    <p className="text-zinc-700 text-xs mt-0.5 leading-relaxed line-clamp-2">{company.quote_terms}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══ 7. Cuentas bancarias ═════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'bancos' ? ' hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Cuentas bancarias</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Cuentas de la empresa para recibir pagos. Aparecen en el pie de facturas.
            </p>
          </div>
          {!addingBank && (
            <button
              onClick={() => { setAddingBank(true); setBankError(null) }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />Agregar
            </button>
          )}
        </div>

        {/* Formulario nueva cuenta */}
        {addingBank && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Banco</label>
                <input
                  value={bankForm.bank_name}
                  onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))}
                  placeholder="Ej. Bancolombia, Davivienda..."
                  className={fieldCls}
                  autoFocus
                />
              </div>
              <div>
                <label className={lbl}>Tipo de cuenta</label>
                <select
                  value={bankForm.account_type}
                  onChange={e => setBankForm(p => ({ ...p, account_type: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Número de cuenta</label>
                <input
                  value={bankForm.account_number}
                  onChange={e => setBankForm(p => ({ ...p, account_number: e.target.value }))}
                  placeholder="123-456789-00"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={lbl}>Titular <span className="text-zinc-400 font-normal">(opcional)</span></label>
                <input
                  value={bankForm.account_holder}
                  onChange={e => setBankForm(p => ({ ...p, account_holder: e.target.value }))}
                  placeholder={company?.legal_name ?? company?.name ?? ''}
                  className={fieldCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bankForm.is_primary}
                  onChange={e => setBankForm(p => ({ ...p, is_primary: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs text-zinc-600">Marcar como cuenta principal</span>
              </label>
            </div>
            {bankError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{bankError}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => bankCreateMut.mutate()}
                disabled={bankCreateMut.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {bankCreateMut.isPending ? 'Guardando...' : 'Guardar cuenta'}
              </button>
              <button
                onClick={() => { setAddingBank(false); setBankError(null) }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingBanks ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />)}</div>
        ) : bankAccounts.length === 0 && !addingBank ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <CreditCard className="h-9 w-9 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No hay cuentas bancarias configuradas.</p>
            <p className="text-xs text-zinc-400 mt-1">Agrega la cuenta donde tus clientes te consignarán.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map(acc => (
              <div
                key={acc.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 bg-white transition-colors ${acc.is_primary ? 'border-blue-200 bg-blue-50/30' : 'border-zinc-200'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${acc.is_primary ? 'bg-blue-100' : 'bg-zinc-100'}`}>
                    <CreditCard className={`h-4 w-4 ${acc.is_primary ? 'text-blue-600' : 'text-zinc-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900 truncate">{acc.bank_name}</p>
                      {acc.is_primary && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                          <Star className="h-3 w-3" />Principal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-mono">
                      {acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)} · {acc.account_number}
                      {acc.account_holder && <span className="font-sans ml-1.5 text-zinc-400">— {acc.account_holder}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!acc.is_primary && (
                    <button
                      onClick={() => bankPrimaryMut.mutate(acc.id)}
                      title="Marcar como principal"
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-blue-600 transition-colors"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm('¿Eliminar esta cuenta bancaria?')) bankDeleteMut.mutate(acc.id) }}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ 8. Medios de pago ════════════════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'medios_pago' ? ' hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Medios de pago</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Métodos disponibles al registrar pagos en recibos.</p>
          </div>
          {!addingNew && (
            <button onClick={() => setAddingNew(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="h-4 w-4" />Agregar
            </button>
          )}
        </div>

        {addingNew && activeCompanyId && (
          <PaymentMethodRow companyId={activeCompanyId} onDone={() => setAddingNew(false)} />
        )}

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100" />)}</div>
        ) : paymentMethods.length === 0 && !addingNew ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm text-zinc-500">No hay medios de pago configurados.</p>
            <p className="text-xs text-zinc-400 mt-1">Agrega Efectivo, Transferencia, etc.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map(method => {
              if (editingId === method.id && activeCompanyId) {
                return <PaymentMethodRow key={method.id} method={method} companyId={activeCompanyId} onDone={() => setEditingId(null)} />
              }
              return (
                <div key={method.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleActive.mutate({ id: method.id, is_active: !method.is_active })}
                      title={method.is_active ? 'Desactivar' : 'Activar'}
                      className={`h-5 w-9 rounded-full transition-colors relative ${method.is_active ? 'bg-blue-600' : 'bg-zinc-200'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${method.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{method.name}</p>
                      <p className="text-xs text-zinc-400">{TYPE_LABELS[method.type] ?? method.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingId(method.id)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteMut.mutate(method.id)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ══ 9. Umbrales y comportamiento ════════════════════════════ */}
      <section className={`space-y-4${activeSection !== 'umbrales' ? ' hidden' : ''}`}>
        <SectionHeader
          title="Umbrales y comportamiento"
          sub="Límites que activan advertencias y validaciones automáticas."
          editing={editingThreshold}
          onEdit={() => setEditingThreshold(true)}
          onSave={() => companyMut.mutate()}
          onCancel={() => { setEditingThreshold(false); setCompanyError(null) }}
        />
        {editingThreshold ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
            <div>
              <label className={lbl}>
                Umbral identificación del comprador (COP)
              </label>
              <input type="number" min={0} step={1000}
                value={companyForm.buyer_threshold ?? 212000} onChange={cfNum('buyer_threshold')}
                className={fieldCls} />
              <p className="text-xs text-zinc-400 mt-1">
                Cuando una factura o ticket supere este valor sin cliente identificado, aparecerá una advertencia.
                La DIAN exige identificar al comprador cuando el monto supera ~$212.000 COP.
              </p>
            </div>
            {companyError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{companyError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Umbral identificación comprador</span>
              <span className="font-mono font-medium text-zinc-900">
                ${(company?.buyer_threshold ?? 212000).toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>
        )}
      </section>

        </div>{/* content */}
      </div>{/* flex */}
    </div>
  )
}
