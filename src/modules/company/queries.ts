'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type CompanyProfile = {
  id:               string
  name:             string
  nit:              string | null
  legal_name:       string | null
  address:          string | null
  city:             string | null
  department:       string | null
  phone:            string | null
  email:            string | null
  fiscal_regime:    string
  logo_url:         string | null
  ciiu_code:        string | null   // Código Actividad Económica CIIU
  // ── Personalización de documentos ────────────────────────────────
  invoice_footer:         string | null   // pie de página en facturas y OC
  quote_terms:            string | null   // términos y condiciones en cotizaciones
  // ── Formatos de impresión ─────────────────────────────────────────
  print_paper_size:       string    // 'carta' | 'media_carta' | 'tiquete_80mm'
  print_show_logo:        boolean   // mostrar logo en documentos impresos
  print_auto_dian_footer: boolean   // auto-generar línea de resolución DIAN
  print_legal_lines:      string | null   // líneas legales adicionales (separadas por \n)
  // ── Resolución DIAN ──────────────────────────────────────────────
  dian_resolution:      string | null
  dian_resolution_date: string | null   // fecha de la resolución
  dian_prefix:          string | null   // prefijo autorizado (FV, SETP, etc.)
  dian_from_number:     number | null   // inicio rango autorizado
  dian_to_number:       number | null   // fin rango autorizado
  dian_validity_from:   string | null   // vigencia desde (YYYY-MM-DD)
  dian_validity_to:     string | null   // vigencia hasta (YYYY-MM-DD)
  // ── Facturación Electrónica ───────────────────────────────────────
  fe_software_id:    string | null
  fe_software_pin:   string | null
  fe_api_url:        string | null
  fe_test_mode:      boolean
  fe_technical_key:  string | null
  // ── Certificado digital de firma (Fase D) ─────────────────────────
  // Metadatos no sensibles -- el archivo .p12/.pfx y su contraseña
  // (cifrada) viven aparte, en company_certificates, de acceso
  // exclusivamente server-side. Ver claude/plan-accion-facturacion-dian.md
  // y src/lib/fe/certificate.ts.
  fe_cert_filename:    string | null
  fe_cert_valid_from:  string | null   // YYYY-MM-DD
  fe_cert_valid_to:    string | null   // YYYY-MM-DD
  fe_cert_uploaded_at: string | null
  // ── Umbrales ─────────────────────────────────────────────────────
  buyer_threshold:   number   // default 212000 COP
  // ── Impuestos municipales ─────────────────────────────────────────
  ica_rate:          number   // Tasa ICA municipal (ej. 0.00414 = 0.414%)
  // ── Nómina ────────────────────────────────────────────────────────
  smlv:              number   // Salario mínimo legal vigente (actualizar cada enero)
  transport_allowance: number // Auxilio de transporte vigente
  // ── Costeo de inventario (punto 2 del backlog, 27 oct 2026) ──────
  // Cómo se recalcula el precio de Compra de un producto cuando llega
  // una compra nueva (ver receive_purchase_order en
  // supabase/migrations/031_producto_proveedores_costeo_compras.sql):
  //   - 'weighted_avg': promedio ponderado entre el stock que ya tenía
  //     (a su costo anterior) y la cantidad nueva (al costo de esta
  //     compra). Es el default -- recomendado por reflejar el costo
  //     real de todo el inventario.
  //   - 'last_price': el precio de Compra pasa a ser siempre el de la
  //     ÚLTIMA compra recibida, sin mezclar con lo que tenía antes.
  costing_method:    'weighted_avg' | 'last_price'
  // ── Suscripción (solo lectura — la escribe el webhook de pagos) ───
  plan_id:              string | null   // 'nucleo' | 'comercial' | 'contable' | 'integral' | null
  subscription_period: '3_months' | '6_months' | '1_year' | null
  subscription_start:  string | null   // YYYY-MM-DD
  subscription_end:    string | null   // YYYY-MM-DD (calculada por trigger en BD)
  subscription_status: 'pending' | 'active' | 'expired' | 'suspended' | null
  // ── Visibilidad de precios al cliente (editable solo desde Superadmin) ──
  show_plan_pricing:          boolean   // mostrar precios/autopago de planes en Suscripción
  show_invoice_pack_pricing:  boolean   // mostrar compra del paquete de facturas DIAN
}

export type CompanyProfileUpdate = Partial<Omit<CompanyProfile,
  'id' | 'plan_id' | 'subscription_period' | 'subscription_start' | 'subscription_end' | 'subscription_status'
>>

/** Indica si el régimen fiscal requiere funciones de facturación electrónica DIAN */
export function isIvaResponsible(regime: string | null | undefined): boolean {
  return regime === 'iva' || regime === 'gran_contribuyente'
}

/**
 * Calcula alertas del rango DIAN y vigencia de la resolución.
 * Retorna null para cada alerta si no hay datos configurados.
 */
export function getDianAlerts(company: CompanyProfile | undefined, currentSequence?: number) {
  if (!company) return { rangeAlert: null, expiryAlert: null, certAlert: null, feConfigured: false }

  // ── Alerta de rango ──────────────────────────────────────────────
  let rangeAlert: 'warning' | 'critical' | null = null
  if (company.dian_from_number && company.dian_to_number && currentSequence !== undefined) {
    const total   = company.dian_to_number - company.dian_from_number + 1
    const used    = currentSequence - company.dian_from_number
    const remaining = total - used
    const pct     = remaining / total
    if (pct <= 0.05 || remaining <= 10) rangeAlert = 'critical'
    else if (pct <= 0.20) rangeAlert = 'warning'
  }

  // ── Alerta de vigencia ───────────────────────────────────────────
  let expiryAlert: 'warning' | 'expired' | null = null
  if (company.dian_validity_to) {
    const daysLeft = Math.floor(
      (new Date(company.dian_validity_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft < 0)  expiryAlert = 'expired'
    else if (daysLeft <= 30) expiryAlert = 'warning'
  }

  // ── Alerta de vigencia del certificado digital (Fase D) ──────────
  // Ventana de 7 dias (mas corta que los 30 dias de la resolucion DIAN):
  // sin certificado vigente, NINGUNA factura se puede firmar, es mas
  // urgente que el aviso de la resolucion.
  let certAlert: 'warning' | 'expired' | null = null
  if (company.fe_cert_valid_to) {
    const daysLeft = Math.floor(
      (new Date(company.fe_cert_valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft < 0)  certAlert = 'expired'
    else if (daysLeft <= 7) certAlert = 'warning'
  }

  // ── FE configurada ───────────────────────────────────────────────
  // Seguridad (Fase A, 4 nov 2026): fe_technical_key ya no se trae al
  // cliente, asi que este check ya no puede validarla aqui. Solo confirma
  // que el ID de software este configurado; la validacion completa
  // (incluyendo la llave tecnica) debe hacerse del lado servidor -- Fase C
  // del plan de facturacion electronica (claude/plan-accion-facturacion-dian.md).
  const feConfigured = !!company.fe_software_id

  return { rangeAlert, expiryAlert, certAlert, feConfigured }
}

export function useCompany(companyId?: string | null) {
  return useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const supabase = createClient()
      // Seguridad (Fase A, 4 nov 2026): ya NO se selecciona fe_software_pin
      // ni fe_technical_key -- son secretos de facturacion electronica y este
      // hook se usa en decenas de pantallas client-side; antes viajaban al
      // navegador de cualquier usuario autenticado sin necesitarlo. Ver
      // claude/informe-auditoria-facturacion-dian.md, Seccion 7.
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id, name, nit, legal_name, address, city, department, phone, email,
          fiscal_regime, logo_url, ciiu_code,
          invoice_footer, quote_terms,
          print_paper_size, print_show_logo, print_auto_dian_footer, print_legal_lines,
          dian_resolution, dian_resolution_date, dian_prefix, dian_from_number,
          dian_to_number, dian_validity_from, dian_validity_to,
          fe_software_id, fe_api_url, fe_test_mode,
          fe_cert_filename, fe_cert_valid_from, fe_cert_valid_to, fe_cert_uploaded_at,
          buyer_threshold, ica_rate, smlv, transport_allowance, costing_method,
          plan_id, subscription_period, subscription_start, subscription_end, subscription_status,
          show_plan_pricing, show_invoice_pack_pricing
        `)
        .eq('id', companyId!)
        .single()
      if (error) throw new Error(error.message)
      return data as unknown as CompanyProfile
    },
    enabled: !!companyId,
  })
}

/**
 * Verifica del lado del servidor si la Facturación Electrónica está
 * realmente completa (ID de Software + Llave Técnica). Fase C de
 * claude/plan-accion-facturacion-dian.md: desde la Fase A, la Llave Técnica
 * ya no llega al cliente, así que ese chequeo no se puede hacer aquí mismo
 * -- se le pregunta a /api/company/fe-status, que solo responde un booleano.
 */
export function useFeStatus(companyId?: string | null) {
  return useQuery({
    queryKey: ['fe-status', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/company/fe-status?companyId=${companyId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo verificar el estado de Facturación Electrónica')
      return data as { configured: boolean }
    },
    enabled: !!companyId,
  })
}

/**
 * Sube o reemplaza el certificado digital (.p12/.pfx) de una empresa.
 * Fase D de claude/plan-accion-facturacion-dian.md -- la contraseña se
 * envía una sola vez al servidor (por HTTPS) para que la valide y la
 * cifre; este archivo nunca la guarda ni la reutiliza después de la
 * llamada.
 */
export async function uploadCertificate(
  companyId: string,
  params: { fileBase64: string; fileName: string; password: string }
) {
  const res = await fetch('/api/company/certificate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, ...params }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? 'No se pudo subir el certificado')
  return data as { ok: true; validFrom: string; validTo: string; subject: string }
}

export async function updateCompany(id: string, data: CompanyProfileUpdate) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Usuario no autenticado.')

  const { data: result, error } = await supabase
    .from('companies')
    .update({
      name:                 data.name                 ?? undefined,
      nit:                  data.nit                  ?? null,
      legal_name:           data.legal_name           ?? null,
      address:              data.address              ?? null,
      city:                 data.city                 ?? null,
      department:           data.department           ?? null,
      phone:                data.phone                ?? null,
      email:                data.email                ?? null,
      fiscal_regime:        data.fiscal_regime        ?? 'iva',
      ciiu_code:            data.ciiu_code            ?? null,
      dian_resolution:      data.dian_resolution      ?? null,
      dian_resolution_date: data.dian_resolution_date ?? null,
      dian_prefix:          data.dian_prefix          ?? null,
      dian_from_number:     data.dian_from_number     ?? null,
      dian_to_number:       data.dian_to_number       ?? null,
      dian_validity_from:   data.dian_validity_from   ?? null,
      dian_validity_to:     data.dian_validity_to     ?? null,
      fe_software_id:       data.fe_software_id       ?? null,
      fe_api_url:           data.fe_api_url           ?? null,
      fe_test_mode:         data.fe_test_mode         ?? true,
      // Seguridad (Fase A, 4 nov 2026): el formulario de Configuracion ya
      // NO precarga el valor real de estos dos secretos (useCompany ya no
      // los trae al cliente), asi que siempre empiezan vacios. Si el campo
      // llega vacio aqui, NO se envia la clave al update -- de lo contrario
      // cada guardado de cualquier otra seccion de Configuracion borraria
      // el PIN/llave tecnica ya guardados en la base de datos.
      ...(data.fe_software_pin  ? { fe_software_pin:  data.fe_software_pin  } : {}),
      ...(data.fe_technical_key ? { fe_technical_key: data.fe_technical_key } : {}),
      buyer_threshold:      data.buyer_threshold      ?? 212000,
      ica_rate:             data.ica_rate             ?? 0.00414,
      smlv:                 data.smlv                 ?? 1300000,
      transport_allowance:  data.transport_allowance  ?? 162000,
      costing_method:       data.costing_method       ?? 'weighted_avg',
      invoice_footer:         data.invoice_footer         ?? null,
      quote_terms:            data.quote_terms            ?? null,
      print_paper_size:       data.print_paper_size       ?? 'carta',
      print_show_logo:        data.print_show_logo        ?? true,
      print_auto_dian_footer: data.print_auto_dian_footer ?? true,
      print_legal_lines:      data.print_legal_lines      ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return result
}

// ── Cuentas bancarias de la empresa ───────────────────────────────────────────

export type CompanyBankAccount = {
  id:              string
  company_id:      string
  bank_name:       string
  account_type:    string   // 'ahorros' | 'corriente' | 'nequi' | 'daviplata'
  account_number:  string
  account_holder:  string | null
  is_primary:      boolean
  is_active:       boolean
  created_at:      string
}

export type CompanyBankAccountInsert = Omit<CompanyBankAccount, 'id' | 'created_at'>

export function useCompanyBankAccounts(companyId?: string | null) {
  return useQuery({
    queryKey: ['company_bank_accounts', companyId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('company_id', companyId!)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as CompanyBankAccount[]
    },
    enabled: !!companyId,
  })
}

export async function createCompanyBankAccount(
  companyId: string,
  data: Omit<CompanyBankAccountInsert, 'company_id'>
) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('company_bank_accounts')
    .insert({ ...data, company_id: companyId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return result as CompanyBankAccount
}

export async function deleteCompanyBankAccount(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('company_bank_accounts')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setCompanyBankAccountPrimary(id: string, companyId: string) {
  const supabase = createClient()
  // Quitar is_primary de todas las cuentas de la empresa
  const { error: e1 } = await supabase
    .from('company_bank_accounts')
    .update({ is_primary: false })
    .eq('company_id', companyId)
  if (e1) throw new Error(e1.message)
  // Marcar la seleccionada como principal
  const { error: e2 } = await supabase
    .from('company_bank_accounts')
    .update({ is_primary: true })
    .eq('id', id)
  if (e2) throw new Error(e2.message)
}
