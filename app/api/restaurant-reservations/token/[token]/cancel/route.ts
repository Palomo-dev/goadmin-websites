import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { organizacionDeLaReserva } from '@/lib/restaurant/reservas-contexto'
import { reglaDeError, respuestaDeRegla, tokenValido } from '@/lib/restaurant/reservas-errores'

export const dynamic = 'force-dynamic'

/**
 * POST /api/restaurant-reservations/token/[token]/cancel
 *
 * El cliente cancela su reserva desde el enlace. La RPC
 * `cancel_restaurant_reservation_by_token` (migración D2) busca por token Y
 * organización del host y aplica las reglas de `cancel_restaurant_reservation`
 * (plazo en la zona de la sede, reserva ya pasada, estados no cancelables).
 * La organización nunca sale del body. 10 cancelaciones/hora/IP.
 *
 * Body: { reason?: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIP(request)
  const limite = checkRateLimit(`reserva-token-cancel:${ip}`, 10, 60 * 60 * 1000)
  if (!limite.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Inténtalo más tarde.' }, { status: 429 })
  }

  const { token } = await params
  if (!tokenValido(token)) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const contexto = await organizacionDeLaReserva(body?.organizationId, 'Restaurant Reservations')
  if ('respuesta' in contexto) return contexto.respuesta

  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[Restaurant Reservations] Falta SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 })
  }

  const motivo = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  const { data, error } = await (supabase as any).rpc('cancel_restaurant_reservation_by_token', {
    p_token: token,
    p_organization_id: contexto.orgId,
    p_reason: motivo ? `[Cliente] ${motivo}` : '[Cliente] Cancelada desde el enlace',
  })

  if (error || !data?.success) {
    const mensaje: string = error?.message || ''
    if (error?.code === 'PGRST202') {
      // Migración D2 aún no aplicada: no hay tokens emitidos.
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }
    const regla = reglaDeError(mensaje)
    if (regla) {
      const { status, mensaje: legible } = respuestaDeRegla(regla)
      return NextResponse.json({ error: legible, code: regla.codigo }, { status: status === 400 ? 422 : status })
    }
    if (error?.code === 'P0002' || mensaje.includes('no encontrada')) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }
    if (/ya esta cancelada|ya está cancelada/i.test(mensaje)) {
      return NextResponse.json({ error: 'La reserva ya estaba cancelada.' }, { status: 409 })
    }
    if (/completada|sentada|no se presento/i.test(mensaje)) {
      return NextResponse.json({ error: 'Esta reserva ya no se puede cancelar.' }, { status: 409 })
    }
    console.error('[Restaurant Reservations] Cancelación por token:', error?.code)
    return NextResponse.json({ error: 'No se pudo cancelar la reserva' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { status: data.status } })
}
