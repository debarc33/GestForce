import { NextResponse } from 'next/server'
import { checkSubscriptions, sendExpiryReminders } from '@/cron/subscription-checker'

/**
 * Cron endpoint to check subscription statuses
 * Called by Vercel Cron at 2 AM UTC daily
 */
export async function GET(request: Request) {
  // Verificar token de Vercel Cron (opcional pero recomendado)
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.CRON_SECRET && authHeader !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Ejecutar verificaciones de suscripción
    const expiredResult = await checkSubscriptions()
    const remindersResult = await sendExpiryReminders()

    return NextResponse.json({
      success: true,
      expired: expiredResult.expired,
      reminded: remindersResult.reminded,
    })
  } catch (error) {
    console.error('Cron subscription check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
