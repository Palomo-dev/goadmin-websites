import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations
 *
 * Crea una reservación validando disponibilidad y generando folio automáticamente.
 * Soporta dos tipos:
 * - Reserva de espacio (hotel): con spaceTypeId, checkin, checkout
 * - Reserva simple (mesa/restaurante): con date, time, guests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      organizationId,
      // Para reservas simples (mesas)
      date, time, guests,
      // Para reservas de espacios (habitaciones) — single room
      spaceTypeId, spaceId, checkin, checkout, occupantCount, totalEstimated,
      // Para reservas multi-room: rooms: [{spaceTypeId, quantity}]
      rooms,
      // Datos del cliente
      firstName, lastName, email, phone,
      identificationType, identificationNumber, notes,
      // Pricing (opcional, si ya se calculó desde /api/reservations/pricing)
      pricingData
    } = body

    if (!organizationId || !firstName || !email || !phone) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, firstName, email, phone' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()
    const isSpaceReservation = !!(spaceTypeId || spaceId || checkin)

    // ── Resolver spaceTypeId desde spaceId si no viene ──
    let resolvedSpaceTypeId = spaceTypeId
    if (spaceId && !resolvedSpaceTypeId) {
      const { data: spaceData } = await (supabase as any)
        .from('spaces')
        .select('space_type_id')
        .eq('id', spaceId)
        .single()
      if (spaceData) resolvedSpaceTypeId = spaceData.space_type_id
    }

    // ── Validar disponibilidad para reservas de espacio ──
    if (isSpaceReservation && checkin && checkout) {
      if (spaceId) {
        // MODO A: Verificar ESE espacio específico
        const { data: overlapping } = await (supabase as any)
          .from('reservations')
          .select('id')
          .eq('space_id', spaceId)
          .in('status', ['tentative', 'confirmed', 'checked_in'])
          .lt('checkin', checkout)
          .gt('checkout', checkin)

        const { data: blocks } = await (supabase as any)
          .from('reservation_blocks')
          .select('id')
          .eq('organization_id', organizationId)
          .or(`space_id.eq.${spaceId},space_type_id.eq.${resolvedSpaceTypeId}`)
          .lt('date_from', checkout)
          .gt('date_to', checkin)

        if ((overlapping?.length || 0) > 0 || (blocks?.length || 0) > 0) {
          return NextResponse.json(
            { error: 'Este espacio no está disponible para las fechas seleccionadas' },
            { status: 409 }
          )
        }
      } else if (resolvedSpaceTypeId) {
        // MODO B: Contar por tipo (legacy)
        const { data: spacesData } = await (supabase as any)
          .from('spaces')
          .select('id')
          .eq('space_type_id', resolvedSpaceTypeId)
          .not('status', 'in', '("maintenance","cleaning","out_of_order")')

        const totalSpaces = spacesData?.length || 0

        const { data: overlapping } = await (supabase as any)
          .from('reservations')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('space_type_id', resolvedSpaceTypeId)
          .in('status', ['tentative', 'confirmed', 'checked_in'])
          .lt('checkin', checkout)
          .gt('checkout', checkin)

        const { data: blocks } = await (supabase as any)
          .from('reservation_blocks')
          .select('id')
          .eq('organization_id', organizationId)
          .or(`space_type_id.eq.${resolvedSpaceTypeId}`)
          .lt('date_from', checkout)
          .gt('date_to', checkin)

        const available = totalSpaces - (overlapping?.length || 0) - (blocks?.length || 0)
        if (available <= 0) {
          return NextResponse.json(
            { error: 'No hay disponibilidad para las fechas seleccionadas', details: { totalSpaces, available: 0 } },
            { status: 409 }
          )
        }
      }
    }

    // ── Validar disponibilidad multi-room ──
    const isMultiRoom = Array.isArray(rooms) && rooms.length > 0 && checkin && checkout
    if (isMultiRoom) {
      for (const room of rooms) {
        const { spaceTypeId: roomTypeId, quantity } = room
        if (!roomTypeId || !quantity || quantity < 1) continue

        const { data: spacesData } = await (supabase as any)
          .from('spaces')
          .select('id')
          .eq('space_type_id', roomTypeId)
          .not('status', 'in', '("maintenance","cleaning","out_of_order")')

        const totalSpaces = spacesData?.length || 0

        const { data: overlapping } = await (supabase as any)
          .from('reservations')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('space_type_id', roomTypeId)
          .in('status', ['tentative', 'confirmed', 'checked_in'])
          .lt('checkin', checkout)
          .gt('checkout', checkin)

        const { data: blocks } = await (supabase as any)
          .from('reservation_blocks')
          .select('id')
          .eq('organization_id', organizationId)
          .or(`space_type_id.eq.${roomTypeId}`)
          .lt('date_from', checkout)
          .gt('date_to', checkin)

        const avail = totalSpaces - (overlapping?.length || 0) - (blocks?.length || 0)
        if (avail < quantity) {
          // Obtener nombre para mensaje de error
          const { data: st } = await (supabase as any)
            .from('space_types').select('name').eq('id', roomTypeId).single()
          return NextResponse.json(
            {
              error: `No hay suficiente disponibilidad para "${st?.name || roomTypeId}": necesitas ${quantity}, disponibles ${Math.max(0, avail)}`,
            },
            { status: 409 }
          )
        }
      }
    }

    // ── Buscar o crear cliente ──
    let customerId: string | null = null

    const { data: existingCustomer } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .single()

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer, error: customerError } = await (supabase as any)
        .from('customers')
        .insert({
          organization_id: organizationId,
          first_name: firstName,
          last_name: lastName || '',
          full_name: `${firstName} ${lastName || ''}`.trim(),
          email: email,
          phone: phone,
          identification_type: identificationType || null,
          identification_number: identificationNumber || null,
          is_registered: false
        })
        .select('id')
        .single()

      if (customerError) {
        console.error('Error creating customer:', customerError)
        return NextResponse.json(
          { error: 'Error al crear el perfil del huésped' },
          { status: 500 }
        )
      }
      customerId = newCustomer?.id || null
    }

    // ── Calcular total si no viene calculado ──
    let finalTotal = totalEstimated || 0
    if (isSpaceReservation && pricingData?.total) {
      finalTotal = pricingData.total
    }
    if (isMultiRoom && pricingData?.grandTotal) {
      finalTotal = pricingData.grandTotal
    }

    // ── Determinar space_type_id principal (para multi-room usa el primero) ──
    const primarySpaceTypeId = isMultiRoom ? rooms[0]?.spaceTypeId : (resolvedSpaceTypeId || spaceTypeId)

    // ── Construir datos de la reservación ──
    const reservationData = (isSpaceReservation || isMultiRoom) ? {
      organization_id: organizationId,
      customer_id: customerId,
      space_type_id: primarySpaceTypeId || null,
      space_id: spaceId || null,
      checkin: checkin,
      checkout: checkout,
      start_date: `${checkin}T14:00:00`,
      end_date: `${checkout}T12:00:00`,
      occupant_count: occupantCount || guests || 1,
      total_estimated: finalTotal,
      status: 'tentative',
      channel: 'website',
      notes: notes || null,
      metadata: {
        customer_name: `${firstName} ${lastName || ''}`.trim(),
        customer_email: email,
        customer_phone: phone,
        pricing: pricingData || null,
        ...(isMultiRoom ? { rooms, is_multi_room: true } : {})
      }
    } : {
      organization_id: organizationId,
      customer_id: customerId,
      start_date: `${date}T${time}:00`,
      end_date: `${date}T${time}:00`,
      occupant_count: guests || 1,
      status: 'tentative',
      channel: 'website',
      notes: notes || null,
      metadata: {
        customer_name: `${firstName} ${lastName || ''}`.trim(),
        customer_email: email,
        customer_phone: phone,
        reservation_type: 'table'
      }
    }

    // ── Insertar reservación ──
    const { data: reservation, error: reservationError } = await (supabase as any)
      .from('reservations')
      .insert(reservationData)
      .select()
      .single()

    if (reservationError || !reservation) {
      console.error('Error creating reservation:', reservationError)
      return NextResponse.json(
        { error: 'Error al crear la reservación', details: reservationError?.message },
        { status: 500 }
      )
    }

    // ── Crear reservation_customers ──
    if (customerId) {
      await (supabase as any)
        .from('reservation_customers')
        .insert({
          reservation_id: reservation.id,
          customer_id: customerId,
          is_primary: true
        })
    }

    // ── Crear folio para reservas de espacio ──
    let folioId: string | null = null
    if ((isSpaceReservation || isMultiRoom) && finalTotal > 0) {
      const { data: folio, error: folioError } = await (supabase as any)
        .from('folios')
        .insert({
          reservation_id: reservation.id,
          balance: finalTotal,
          status: 'open'
        })
        .select('id')
        .single()

      if (!folioError && folio) {
        folioId = folio.id

        // Crear folio_items con desglose si hay pricingData
        if (pricingData?.priceBreakdown) {
          const folioItems = pricingData.priceBreakdown.map((night: any) => ({
            folio_id: folioId,
            source: 'reservation',
            description: `Noche ${night.date}`,
            amount: night.price,
            tax_code: null
          }))

          // Agregar service_charges como folio_items
          if (pricingData.serviceCharges) {
            for (const charge of pricingData.serviceCharges) {
              folioItems.push({
                folio_id: folioId,
                source: 'service_charge',
                description: charge.name,
                amount: charge.amount,
                tax_code: null
              })
            }
          }

          // Agregar impuesto como folio_item
          if (pricingData.taxAmount > 0) {
            folioItems.push({
              folio_id: folioId,
              source: 'tax',
              description: pricingData.taxName || 'Impuesto',
              amount: pricingData.taxAmount,
              tax_code: null
            })
          }

          if (folioItems.length > 0) {
            await (supabase as any).from('folio_items').insert(folioItems)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...reservation,
        folio_id: folioId
      }
    })
  } catch (error) {
    console.error('Reservations API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reservations
 *
 * Lista reservaciones por organización. Filtro opcional por fecha (checkin).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')
    const date = searchParams.get('date')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Se requiere organizationId' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()

    let query = (supabase as any)
      .from('reservations')
      .select('*')
      .eq('organization_id', organizationId)

    if (date) {
      query = query.eq('checkin', date)
    }

    const { data, error } = await query.order('start_date', { ascending: true })

    if (error) {
      console.error('Reservations GET error:', error)
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Reservations GET API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
