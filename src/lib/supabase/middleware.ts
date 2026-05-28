import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(request.headers.get('cookie') ?? '').map((c) => ({
            name: c.name,
            value: c.value ?? '',
          })),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  await supabase.auth.getSession();

  return response;
}
