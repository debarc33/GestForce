'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppearanceProvider } from '@/components/appearance/appearance-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  // Inicializamos el cliente una sola vez por sesión de usuario
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // Los datos se consideran "frescos" por 5 minutos
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider attribute="class" defaultTheme="dark" storageKey="theme-preference" disableTransitionOnChange>
        <AppearanceProvider>
          {children}
        </AppearanceProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  )
}