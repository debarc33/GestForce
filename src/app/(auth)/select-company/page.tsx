'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'
import { getUserCompanies } from '@/modules/auth/queries'
import { useCompanyStore } from '@/store/useCompanyStore'

type Company = {
  company_id: string
  role: string
  companies: { id: string; name: string }
}

function SelectCompanyFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm">Cargando empresas...</p>
      </div>
    </main>
  )
}

export default function SelectCompanyPage() {
  return (
    <Suspense fallback={<SelectCompanyFallback />}>
      <SelectCompanyContent />
    </Suspense>
  )
}

function SelectCompanyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setActiveCompany } = useCompanyStore()

  // Ruta a la que volver una vez seleccionada/auto-seleccionada la empresa.
  // Viene de CompanyGuard cuando redirige aquí desde una página distinta al dashboard.
  const redirectTo = searchParams.get('redirect') || '/'

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUserCompanies()
      .then((data) => {
        if (data.length === 1) {
          const c = data[0]
          setActiveCompany(c.company_id, c.companies.name, c.role)
          router.replace(redirectTo)
          return
        }
        setCompanies(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, setActiveCompany])

  function handleSelect(company: Company) {
    setActiveCompany(company.company_id, company.companies.name, company.role)
    router.push(redirectTo)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm">Cargando empresas...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-950/30 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <h2 className="text-lg font-semibold text-white">No se pudo cargar</h2>
          <p className="text-sm text-red-300">{error}</p>
          <p className="text-xs text-zinc-500">Contacta al administrador del sistema.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-400">GestForce ERP</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Selecciona tu empresa
          </h1>
          <p className="text-sm text-zinc-400">
            Tienes acceso a {companies.length} empresas. Elige con cuál trabajar.
          </p>
        </div>

        <div className="space-y-3">
          {companies.map((item) => (
            <button
              key={item.company_id}
              onClick={() => handleSelect(item)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition-all hover:border-blue-500/40 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400 group-hover:bg-blue-600/25">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {item.companies.name}
                </p>
                <p className="mt-0.5 text-xs capitalize text-zinc-500">{item.role}</p>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
