import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname.startsWith('/login')
  const isSuperadminRoute = pathname.startsWith('/superadmin')

  // 1. Usuario no autenticado → redirigir a /login (excepto si ya está en /login)
  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Usuario autenticado intentando acceder a /login → redirigir a /select-company
  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/select-company'
    return NextResponse.redirect(url)
  }

  // 3. Ruta /superadmin → verificar que sea superadmin
  //    La verificación usa app_metadata del JWT (establecido con service_role,
  //    no modificable por el usuario desde el cliente).
  if (user && isSuperadminRoute) {
    const isSuperadmin = user.app_metadata?.is_superadmin === true

    if (!isSuperadmin) {
      // No es superadmin → redirigir al dashboard sin revelar que la ruta existe
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
