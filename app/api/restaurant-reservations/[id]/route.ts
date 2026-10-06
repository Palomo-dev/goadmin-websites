import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { organizacionDeLaReserva } from '@/lib/restaurant/reservas-contexto'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/restaurant-reservations/[id]
 *
 * Consulta una reserva por su código corto (8 primeros caracteres del UUID)
 * o por el UUID completo.
 *
 * Devuelve los datos de la reserva sin exponer información sensible
 * (sin customer_id, sin created_by).
 *
 * Solo busca reservas de la organización del host: antes buscaba en todas, y
 * con 8 caracteres devolvía nombre, teléfono y email de reservas de otros
 * restaurantes.
 *
 * Paquete D: el código corto se puede adivinar, así que la respuesta ya no
 * lleva teléfono ni correo, y hay límite de 20 consultas/hora/IP. Para ver y
 * cancelar la reserva completa está el enlace por token
 * (`/api/restaurant-reservations/token/[token]`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limite = checkRateLimit(`reserva-codigo:${getClientIP(request)}`, 20, 60 * 60 * 1000)
    if (!limite.allowed) {
      return NextResponse.json({ error: 'Demasiadas consultas. Inténtalo más tarde.' }, { status: 429 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Código de reserva requerido' },
        { status: 400 }
      )
    }

    const contexto = await organizacionDeLaReserva(
      request.nextUrl.searchParams.get('organizationId'),
      'Restaurant Reservations',
    )
    if ('respuesta' in contexto) return contexto.respuesta

    const supabase = createAdminClient() || createPublicClient()

    let query = (supabase as any)
      .from('restaurant_reservations')
      .select(`
        id,
        customer_name,
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
      .eq('organization_id', contexto.orgId)

    const codigo = id.toLowerCase()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(codigo)) {
      query = query.eq('id', codigo)
    } else if (/^[0-9a-f]{8}$/.test(codigo)) {
      // El código son los 8 primeros caracteres del UUID. `ilike` sobre una
      // columna uuid no funciona en Postgres: se busca por rango.
      query = query
        .gte('id', `${codigo}-0000-0000-0000-000000000000`)
        .lte('id', `${codigo}-ffff-ffff-ffff-ffffffffffff`)
    } else {
      return NextResponse.json(
        { error: 'No se encontró ninguna reserva con ese código' },
        { status: 404 }
      )
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
