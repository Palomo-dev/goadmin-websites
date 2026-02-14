import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createAdminClient } from '@/lib/supabase/server'

const RESERVATION_TIMEOUT_MINUTES = 10

/**
 * POST /api/transport/reserve-seat
 * Reserva temporal de asientos (10 minutos).
 * Transaccional: verifica disponibilidad + actualiza trip_seats + decrementa available_seats.
 * 
 * Body: { organizationId, tripId, seatIds[] }
 * Response: { success, reservedUntil, seats[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, tripId, seatIds } = await request.json()

    if (!organizationId || !tripId || !seatIds?.length) {
      return NextResponse.json(
        { error: 'organizationId, tripId y seatIds son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient() || createPublicClient()

    // 1. Verificar que el viaje existe y está programado
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, status, available_seats')
      .eq('id', tripId)
      .eq('organization_id', organizationId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    if ((trip as any).status !== 'scheduled') {
      return NextResponse.json(
        { error: 'El viaje no está disponible para reservas' },
        { status: 409 }
      )
    }

    if ((trip as any).available_seats < seatIds.length) {
      return NextResponse.json(
        { error: 'No hay suficientes asientos disponibles' },
        { status: 409 }
      )
    }

    // 2. Verificar que los asientos están disponibles o con reserva expirada
    const now = new Date().toISOString()
    const { data: seats, error: seatsError } = await (supabase as any)
      .from('trip_seats')
      .select('id, seat_label, status, reserved_until')
      .in('id', seatIds)
      .eq('trip_id', tripId)

    if (seatsError || !seats || seats.length !== seatIds.length) {
      return NextResponse.json(
        { error: 'Uno o más asientos no existen en este viaje' },
        { status: 400 }
      )
    }

    // Verificar disponibilidad de cada asiento
    const unavailable: string[] = []
    for (const seat of seats as any[]) {
      if (seat.status === 'sold') {
        unavailable.push(seat.seat_label)
      } else if (seat.status === 'reserved' && seat.reserved_until && seat.reserved_until > now) {
        unavailable.push(seat.seat_label)
      }
    }

    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `Asientos no disponibles: ${unavailable.join(', ')}` },
        { status: 409 }
      )
    }

    // 3. Reservar asientos (temporal)
    const reservedUntil = new Date(Date.now() + RESERVATION_TIMEOUT_MINUTES * 60 * 1000).toISOString()

    const { error: updateError } = await (supabase as any)
      .from('trip_seats')
      .update({
        status: 'reserved',
        reserved_until: reservedUntil,
      })
      .in('id', seatIds)
      .eq('trip_id', tripId)

    if (updateError) {
      console.error('Error reservando asientos:', updateError)
      return NextResponse.json(
        { error: 'Error al reservar asientos' },
        { status: 500 }
      )
    }

    // 4. Decrementar available_seats en trips
    const { error: tripUpdateError } = await (supabase as any)
      .from('trips')
      .update({
        available_seats: (trip as any).available_seats - seatIds.length,
      })
      .eq('id', tripId)

    if (tripUpdateError) {
      // Rollback: liberar asientos
      await (supabase as any)
        .from('trip_seats')
        .update({ status: 'available', reserved_until: null })
        .in('id', seatIds)
        .eq('trip_id', tripId)

      console.error('Error actualizando trip:', tripUpdateError)
      return NextResponse.json(
        { error: 'Error al actualizar disponibilidad del viaje' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reservedUntil,
      timeoutMinutes: RESERVATION_TIMEOUT_MINUTES,
      seats: (seats as any[]).map(s => ({
        id: s.id,
        label: s.seat_label,
      })),
    })
  } catch (error: any) {
    console.error('Error en reserve-seat:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
