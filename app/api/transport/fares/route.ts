import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/transport/fares
 * Calcula la tarifa dinámica para un viaje.
 * Llamado desde client components (SeatMap, checkout).
 * 
 * Body: { organizationId, tripId, fromStopId?, toStopId?, fareType?, seatIds? }
 * Response: { baseFare, seatModifier, fareDiscount, subtotal, taxes, total, fareDetails }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      organizationId,
      tripId,
      fromStopId,
      toStopId,
      fareType = 'standard',
      seatIds = [],
    } = await request.json()

    if (!organizationId || !tripId) {
      return NextResponse.json(
        { error: 'organizationId y tripId son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient() || createPublicClient()

    // 1. Obtener viaje con tarifa base
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, base_fare, currency, route_id')
      .eq('id', tripId)
      .eq('organization_id', organizationId)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
    }

    const baseFare = Number((trip as any).base_fare) || 0
    const routeId = (trip as any).route_id

    // 2. Buscar tarifa específica por tipo (student, senior, etc.)
    let fareAmount = baseFare
    let fareDiscount = 0
    let fareDetails: any = null

    if (routeId) {
      let query = supabase
        .from('transport_fares')
        .select('*')
        .eq('route_id', routeId)
        .eq('fare_type', fareType)
        .eq('is_active', true)

      // Si hay tramo específico (from_stop → to_stop)
      if (fromStopId) query = query.eq('from_stop_id', fromStopId)
      if (toStopId) query = query.eq('to_stop_id', toStopId)

      const { data: fares } = await query.limit(1)

      if (fares && fares.length > 0) {
        const fare = fares[0] as any
        fareAmount = Number(fare.amount) || baseFare
        fareDiscount = Number(fare.discount_amount) || 0
        if (fare.discount_percent > 0) {
          fareDiscount = Math.round(fareAmount * fare.discount_percent / 100)
        }
        fareDetails = {
          fareId: fare.id,
          fareName: fare.fare_name,
          fareType: fare.fare_type,
          originalAmount: fareAmount,
          discountPercent: fare.discount_percent,
          discountAmount: fareDiscount,
          requiresId: fare.requires_id,
          requiresApproval: fare.requires_approval,
        }
      }
    }

    // 3. Calcular modificador de asientos
    let seatModifier = 0
    if (seatIds.length > 0) {
      const { data: seats } = await supabase
        .from('trip_seats')
        .select(`
          id, seat_label,
          vehicle_seats ( price_modifier )
        `)
        .in('id', seatIds)
        .eq('trip_id', tripId)

      if (seats) {
        for (const seat of seats as any[]) {
          seatModifier += Number(seat.vehicle_seats?.price_modifier) || 0
        }
      }
    }

    // 4. Calcular impuestos de la organización
    const { data: taxes } = await supabase
      .from('organization_taxes')
      .select('id, name, rate')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('is_default', true)

    const subtotal = (fareAmount - fareDiscount + seatModifier) * Math.max(seatIds.length, 1)
    let taxTotal = 0
    const taxBreakdown: any[] = []

    if (taxes) {
      for (const tax of taxes as any[]) {
        const taxAmount = Math.round(subtotal * Number(tax.rate) / 100)
        taxTotal += taxAmount
        taxBreakdown.push({
          name: tax.name,
          rate: tax.rate,
          amount: taxAmount,
        })
      }
    }

    return NextResponse.json({
      baseFare,
      fareAmount,
      fareDiscount,
      seatModifier,
      passengerCount: Math.max(seatIds.length, 1),
      subtotal,
      taxes: taxBreakdown,
      taxTotal,
      total: subtotal + taxTotal,
      currency: (trip as any).currency || 'COP',
      fareDetails,
    })
  } catch (error: any) {
    console.error('Error calculando tarifa:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
