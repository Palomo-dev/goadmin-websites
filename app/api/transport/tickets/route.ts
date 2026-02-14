import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

/**
 * POST /api/transport/tickets
 * Crea boletos de viaje (trip_tickets).
 * Transaccional: valida asientos reservados → crea tickets → actualiza trip_seats.ticket_id → genera QR/checkin code.
 * 
 * Body: {
 *   organizationId, tripId,
 *   passengers: [{ name, docType, docNumber, phone, email, seatId, boardingStopId, alightingStopId }],
 *   fareType, totalAmount
 * }
 * Response: { success, tickets[] }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      organizationId,
      tripId,
      passengers,
      fareType = 'standard',
      totalAmount,
    } = await request.json()

    if (!organizationId || !tripId || !passengers?.length) {
      return NextResponse.json(
        { error: 'organizationId, tripId y passengers son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient() || createPublicClient()

    // 1. Verificar viaje
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, trip_code, status, base_fare, currency, route_id, organization_id')
      .eq('id', tripId)
      .eq('organization_id', organizationId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    if ((trip as any).status !== 'scheduled' && (trip as any).status !== 'boarding') {
      return NextResponse.json(
        { error: 'El viaje no acepta nuevos boletos' },
        { status: 409 }
      )
    }

    // 2. Verificar que los asientos están reservados (no vendidos)
    const seatIds = passengers.map((p: any) => p.seatId).filter(Boolean)

    if (seatIds.length > 0) {
      const { data: seats } = await (supabase as any)
        .from('trip_seats')
        .select('id, seat_label, status')
        .in('id', seatIds)
        .eq('trip_id', tripId)

      if (!seats || seats.length !== seatIds.length) {
        return NextResponse.json(
          { error: 'Uno o más asientos no son válidos' },
          { status: 400 }
        )
      }

      const soldSeats = seats.filter((s: any) => s.status === 'sold')
      if (soldSeats.length > 0) {
        return NextResponse.json(
          { error: `Asientos ya vendidos: ${soldSeats.map((s: any) => s.label).join(', ')}` },
          { status: 409 }
        )
      }
    }

    // 3. Obtener tarifa
    const routeId = (trip as any).route_id
    let fareAmount = Number((trip as any).base_fare) || 0

    if (routeId && fareType !== 'standard') {
      const { data: fares } = await supabase
        .from('transport_fares')
        .select('amount, discount_percent, discount_amount')
        .eq('route_id', routeId)
        .eq('fare_type', fareType)
        .eq('is_active', true)
        .limit(1)

      if (fares && fares.length > 0) {
        const fare = fares[0] as any
        fareAmount = Number(fare.amount) || fareAmount
        if (fare.discount_percent > 0) {
          fareAmount = fareAmount - Math.round(fareAmount * fare.discount_percent / 100)
        } else if (fare.discount_amount > 0) {
          fareAmount = fareAmount - Number(fare.discount_amount)
        }
      }
    }

    // 4. Crear tickets
    const createdTickets: any[] = []
    const tripCode = (trip as any).trip_code

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i]

      // Generar ticket_number único: TKT-{tripCode}-{random}
      const ticketNumber = `TKT-${tripCode}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      const checkinCode = crypto.randomBytes(4).toString('hex').toUpperCase()
      const qrCode = `${ticketNumber}|${checkinCode}`

      // Obtener seat_label
      let seatLabel = null
      if (p.seatId && seatIds.length > 0) {
        const { data: seatData } = await (supabase as any)
          .from('trip_seats')
          .select('seat_label')
          .eq('id', p.seatId)
          .single()
        seatLabel = seatData?.seat_label || null
      }

      const discount = fareAmount > Number((trip as any).base_fare)
        ? 0
        : Number((trip as any).base_fare) - fareAmount

      const { data: ticket, error: ticketError } = await supabase
        .from('trip_tickets')
        .insert({
          organization_id: organizationId,
          trip_id: tripId,
          ticket_number: ticketNumber,
          passenger_name: p.name,
          passenger_doc_type: p.docType || null,
          passenger_doc_number: p.docNumber || null,
          passenger_phone: p.phone || null,
          passenger_email: p.email || null,
          boarding_stop_id: p.boardingStopId || null,
          alighting_stop_id: p.alightingStopId || null,
          seat_number: seatLabel,
          fare: Number((trip as any).base_fare),
          discount,
          total: fareAmount,
          currency: (trip as any).currency || 'COP',
          status: 'reserved',
          payment_status: 'pending',
          qr_code: qrCode,
          checkin_code: checkinCode,
          metadata: {
            fare_type: fareType,
            channel: 'website',
          },
        } as any)
        .select()
        .single()

      if (ticketError) {
        console.error('Error creando ticket:', ticketError)
        return NextResponse.json(
          { error: `Error creando boleto para ${p.name}: ${ticketError.message}` },
          { status: 500 }
        )
      }

      // Actualizar trip_seat con ticket_id
      if (p.seatId) {
        await (supabase as any)
          .from('trip_seats')
          .update({
            status: 'sold',
            ticket_id: (ticket as any).id,
            reserved_until: null,
          })
          .eq('id', p.seatId)
          .eq('trip_id', tripId)
      }

      createdTickets.push({
        id: (ticket as any).id,
        ticketNumber,
        passengerName: p.name,
        seatNumber: seatLabel,
        fare: fareAmount,
        qrCode,
        checkinCode,
        status: 'reserved',
        paymentStatus: 'pending',
      })
    }

    return NextResponse.json({
      success: true,
      tripId,
      tripCode,
      ticketCount: createdTickets.length,
      totalAmount: totalAmount || fareAmount * passengers.length,
      currency: (trip as any).currency || 'COP',
      tickets: createdTickets,
    })
  } catch (error: any) {
    console.error('Error en create tickets:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
