import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { organizacionDeLaReserva } from '@/lib/restaurant/reservas-contexto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/restaurant-reservations/[id]/cancel
 *
 * Cancela una reserva de mesa usando la RPC `cancel_restaurant_reservation`.
 * Respeta `cancellation_hours` de la configuración del restaurante.
 *
 * Paquete D: con la migración D2 aplicada (columna `manage_token`) exige el
 * token del enlace del cliente; el id solo ya no basta. Antes de aplicarla
 * conserva el comportamiento anterior. Lo normal es usar
 * `/api/restaurant-reservations/token/[token]/cancel`.
 *
 * Body: { reason?: string, token?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const reason = body?.reason || null

    if (!id) {
      return NextResponse.json(
        { error: 'ID de reserva requerido' },
        { status: 400 }
      )
    }

    const contexto = await organizacionDeLaReserva(body?.organizationId, 'Restaurant Reservations')
    if ('respuesta' in contexto) return contexto.respuesta

    const supabase = createAdminClient() || createPublicClient()

    // La RPC no comprueba la organización: solo se cancelan reservas de este sitio.
    const conToken = await (supabase as any)
      .from('restaurant_reservations')
      .select('id, manage_token')
      .eq('id', id)
      .eq('organization_id', contexto.orgId)
      .maybeSingle()
    if (!conToken.error) {
      // D2 aplicada: el id solo no basta, hace falta el token del enlace.
      if (!conToken.data) {
        return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
      }
      if (typeof body?.token !== 'string' || body.token !== conToken.data.manage_token) {
        return NextResponse.json({ error: 'Usa el enlace de tu correo para cancelar la reserva.' }, { status: 403 })
      }
    } else {
      // Sin la columna (D2 sin aplicar): comportamiento anterior.
      const { data: propia } = await (supabase as any)
        .from('restaurant_reservations')
        .select('id')
        .eq('id', id)
        .eq('organization_id', contexto.orgId)
        .maybeSingle()
      if (!propia) {
        return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
      }
    }

    const { data: result, error } = await (supabase as any)
      .rpc('cancel_restaurant_reservation', {
        p_reservation_id: id,
        p_reason: reason,
      })

    if (error || !result || !result.success) {
      const errMsg = error?.message || 'Error al cancelar la reserva'

      if (errMsg.includes('no encontrada')) {
        return NextResponse.json({ error: errMsg }, { status: 404 })
      }
      if (errMsg.includes('ya está cancelada') || errMsg.includes('ya esta cancelada')) {
        return NextResponse.json({ error: errMsg }, { status: 409 })
      }
      if (errMsg.includes('completada') || errMsg.includes('sentada')) {
        return NextResponse.json({ error: errMsg }, { status: 409 })
      }
      if (errMsg.includes('anticipación') || errMsg.includes('anticipacion')) {
        return NextResponse.json({ error: errMsg }, { status: 422 })
      }

      return NextResponse.json(
        { error: 'Error al cancelar la reserva', details: errMsg },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.reservation_id,
        status: result.status,
      },
    })
  } catch (error) {
    console.error('[Restaurant Reservations] Cancel error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
