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
 * Body: { reason?: string }
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
    const { data: propia } = await (supabase as any)
      .from('restaurant_reservations')
      .select('id')
      .eq('id', id)
      .eq('organization_id', contexto.orgId)
      .maybeSingle()
    if (!propia) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
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
