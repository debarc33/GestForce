import { LoginForm } from '@/modules/auth/components/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
        <section className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <div className="inline-flex items-center gap-3 rounded-full bg-sky-500/10 px-4 py-2 text-sm font-semibold tracking-[0.3em] text-sky-200">
            NUEVO ERP PREMIUM
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white">Bienvenido a GestForce</h1>
            <p className="max-w-xl text-base text-slate-300">
              Inicia sesión para acceder a tu panel de administración multiempresa con diseño premium y gestión segura de clientes.
            </p>
          </div>
          <div className="grid gap-4 rounded-[1.8rem] border border-white/10 bg-slate-950/70 p-6 text-slate-200 shadow-lg shadow-slate-950/20">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Control centralizado</p>
              <p className="mt-3 text-lg font-medium">Crea clientes, consulta ventas y administra tu compañía con un solo click.</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Seguridad</p>
              <p className="mt-3 text-lg font-medium">Acceso protegido por Supabase y políticas de RLS por empresa.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/95 p-8 shadow-2xl shadow-slate-950/15 text-slate-950">
          <div className="mb-6">
            <div className="mb-4 text-sm uppercase tracking-[0.3em] text-slate-500">Ingresa a tu cuenta</div>
            <h2 className="text-3xl font-semibold">Accede a tu panel</h2>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  )
}