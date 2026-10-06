import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { organizacionDeLaReserva } from '@/lib/restaurant/reservas-contexto'
import { tokenValido } from '@/lib/restaurant/reservas-errores'
import { leerReservaPorToken } from '@/lib/restaurant/reservas-servidor'

export const dynamic = 'force-dynamic'

/**
 * GET /api/restaurant-reservations/token/[token]
 *
 * Detalle de una reserva de mesa para su dueño: el token opaco
 * (`manage_token`, migración D2) del enlace «Consultar o cancelar» que recibe
 * por correo y en la confirmación. Solo reservas de la organización del host;
 * sin teléfono ni correo en la respuesta. 30 consultas/hora/IP.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIP(request)
  const limite = checkRateLimit(`reserva-token:${ip}`, 30, 60 * 60 * 1000)
  if (!limite.allowed) {
    return NextResponse.json({ error: 'Demasiadas consultas. Inténtalo más tarde.' }, { status: 429 })
  }

  const { token } = await params
  if (!tokenValido(token)) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  const contexto = await organizacionDeLaReserva(request.nextUrl.searchParams.get('organizationId'), 'Restaurant Reservations')
  if ('respuesta' in contexto) return contexto.respuesta

  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[Restaurant Reservations] Falta SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 })
  }

  const reserva = await leerReservaPorToken(supabase, contexto.orgId, token)
  if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  return NextResponse.json({ success: true, data: reserva }, { headers: { 'Cache-Control': 'private, no-store' } })
}
