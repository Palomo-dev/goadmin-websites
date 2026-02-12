import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/cancel
 *
 * Cancela una reservación si cumple las condiciones:
 * - Estado debe ser 'tentative' o 'confirmed' (no checked_in, checked_out, etc.)
 * - Check-in debe ser en el futuro (>= hoy)
 * - Se puede configurar política de cancelación en booking_rules.cancel_before_hours
 *
 * Input:  { reservationId, email (para verificar identidad) }
 * Output: { success, message }
 */
export async function POST(request: NextRequest) {
  try {
    const { reservationId, email } = await request.json()

    if (!reservationId || !email) {
      return NextResponse.json(
        { error: 'Faltan campos: reservationId, email' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()

    // 1. Buscar reservación
    const { data: reservation, error: resError } = await (supabase as any)
      .from('reservations')
      .select('id, status, checkin, space_type_id, space_id, organization_id, customer_id')
      .eq('id', reservationId)
      .single()

    if (resError || !reservation) {
      return NextResponse.json({ error: 'Reservación no encontrada' }, { status: 404 })
    }

    // 2. Verificar email del cliente
    const { data: customer } = await (supabase as any)
      .from('customers')
      .select('email')
      .eq('id', reservation.customer_id)
      .single()

    if (!customer || customer.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'El correo no coincide con la reservación' }, { status: 403 })
    }

    // 3. Verificar estado cancelable
    const cancellableStatuses = ['tentative', 'confirmed']
    if (!cancellableStatuses.includes(reservation.status)) {
      return NextResponse.json(
        { error: `No se puede cancelar una reservación con estado "${reservation.status}"` },
        { status: 400 }
      )
    }

    // 4. Verificar política de cancelación (booking_rules.cancel_before_hours)
    const { data: spaceType } = await (supabase as any)
      .from('space_types')
      .select('booking_rules')
      .eq('id', reservation.space_type_id)
      .single()

    const bookingRules = spaceType?.booking_rules || {}
    const cancelBeforeHours = bookingRules.cancel_before_hours ?? 24

    const checkinDate = new Date(reservation.checkin + 'T14:00:00') // Asumimos check-in a las 14h
    const now = new Date()
    const hoursUntilCheckin = (checkinDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilCheckin < cancelBeforeHours) {
      return NextResponse.json(
        { error: `La cancelación debe realizarse al menos ${cancelBeforeHours} horas antes del check-in` },
        { status: 400 }
      )
    }

    // 5. Cancelar reservación
    const { error: updateError } = await (supabase as any)
      .from('reservations')
      .update({
        status: 'cancelled',
        metadata: {
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'guest_online',
          cancellation_reason: 'Cancelación por el huésped',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.id)

    if (updateError) {
      console.error('[Cancel API] Error actualizando reservación:', updateError)
      return NextResponse.json({ error: 'Error al cancelar la reservación' }, { status: 500 })
    }

    // 6. Liberar habitación si tenía una asignada
    if (reservation.space_id) {
      await (supabase as any)
        .from('spaces')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .eq('id', reservation.space_id)
    }

    // 7. Cerrar folio si existe
    await (supabase as any)
      .from('folios')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('reservation_id', reservation.id)
      .eq('status', 'open')

    console.log(`[Cancel API] Reservación ${reservation.id} cancelada por huésped`)

    return NextResponse.json({
      success: true,
      message: 'Reservación cancelada exitosamente',
    })
  } catch (error) {
    console.error('[Cancel API] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
