import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/restaurant-reservations/[id]
 *
 * Consulta una reserva por su código corto (8 primeros caracteres del UUID)
 * o por el UUID completo.
 *
 * Devuelve los datos de la reserva sin exponer información sensible
 * (sin customer_id, sin created_by).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Código de reserva requerido' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient() || createPublicClient()

    // El código son los primeros 8 caracteres del UUID en mayúsculas.
    // Buscamos por prefijo del ID o por ID completo.
    const upperCode = id.toUpperCase()

    let query = (supabase as any)
      .from('restaurant_reservations')
      .select(`
        id,
        customer_name,
        customer_phone,
        customer_email,
        party_size,
        reservation_date,
        reservation_time,
        duration_minutes,
        status,
        notes,
        special_requests,
        source,
        created_at,
        cancelled_at,
        cancellation_reason,
        confirmed_at
      `)

    // Si es un UUID completo (36 chars), buscar por id exacto
    if (id.length === 36) {
      query = query.eq('id', id)
    } else {
      // Buscar por prefijo del código (case-insensitive en el primer tramo)
      query = query.ilike('id', `${upperCode}%`)
    }

    const { data: reservation, error } = await query.limit(1).maybeSingle()

    if (error) {
      console.error('[Restaurant Reservations] Query error:', error)
      return NextResponse.json({ error: 'Error al consultar la reserva' }, { status: 500 })
    }

    if (!reservation) {
      return NextResponse.json(
        { error: 'No se encontró ninguna reserva con ese código' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: reservation.id,
        code: reservation.id.substring(0, 8).toUpperCase(),
        customerName: reservation.customer_name,
        customerPhone: reservation.customer_phone,
        customerEmail: reservation.customer_email,
        partySize: reservation.party_size,
        date: reservation.reservation_date,
        time: reservation.reservation_time,
        durationMinutes: reservation.duration_minutes,
        status: reservation.status,
        notes: reservation.notes,
        specialRequests: reservation.special_requests,
        source: reservation.source,
        createdAt: reservation.created_at,
        cancelledAt: reservation.cancelled_at,
        cancellationReason: reservation.cancellation_reason,
        confirmedAt: reservation.confirmed_at,
      },
    })
  } catch (error) {
    console.error('[Restaurant Reservations] Query error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
