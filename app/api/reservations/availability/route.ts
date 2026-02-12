import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/availability
 *
 * Verifica disponibilidad de un tipo de espacio para un rango de fechas.
 * Valida contra: reservaciones activas, bloqueos, spaces físicos disponibles, booking_rules.
 *
 * Input:  { organizationId, spaceTypeId, checkin (YYYY-MM-DD), checkout (YYYY-MM-DD) }
 * Output: { available, totalSpaces, reservedCount, blockedCount, spacesAvailable, bookingRules, errors[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, spaceTypeId, checkin, checkout } = await request.json()

    if (!organizationId || !spaceTypeId || !checkin || !checkout) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, spaceTypeId, checkin, checkout' },
        { status: 400 }
      )
    }

    // Validar que checkin < checkout
    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    if (checkinDate >= checkoutDate) {
      return NextResponse.json(
        { error: 'La fecha de check-in debe ser anterior al check-out' },
        { status: 400 }
      )
    }

    // Validar que checkin >= hoy
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (checkinDate < today) {
      return NextResponse.json(
        { error: 'La fecha de check-in no puede ser en el pasado' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const errors: string[] = []

    // 1. Obtener space_type para booking_rules y verificar que existe
    const { data: spaceType, error: stError } = await (supabase as any)
      .from('space_types')
      .select('id, name, base_rate, capacity, booking_rules, is_active')
      .eq('id', spaceTypeId)
      .eq('organization_id', organizationId)
      .single()

    if (stError || !spaceType) {
      return NextResponse.json(
        { error: 'Tipo de espacio no encontrado' },
        { status: 404 }
      )
    }

    if (!spaceType.is_active) {
      return NextResponse.json(
        { error: 'Este tipo de espacio no está disponible actualmente' },
        { status: 400 }
      )
    }

    // 2. Validar booking_rules (min_stay, max_stay)
    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))
    const bookingRules = spaceType.booking_rules || {}
    const minStay = bookingRules.min_stay || 1
    const maxStay = bookingRules.max_stay || null

    if (nights < minStay) {
      errors.push(`La estadía mínima es de ${minStay} noche(s)`)
    }
    if (maxStay && nights > maxStay) {
      errors.push(`La estadía máxima es de ${maxStay} noche(s)`)
    }

    // 3. Contar spaces físicos del tipo que no están en mantenimiento/limpieza/fuera de servicio
    const { data: totalSpacesData } = await (supabase as any)
      .from('spaces')
      .select('id', { count: 'exact' })
      .eq('space_type_id', spaceTypeId)
      .not('status', 'in', '("maintenance","cleaning","out_of_order")')

    const totalSpaces = totalSpacesData?.length || 0

    if (totalSpaces === 0) {
      return NextResponse.json({
        available: false,
        totalSpaces: 0,
        reservedCount: 0,
        blockedCount: 0,
        spacesAvailable: 0,
        bookingRules: { minStay, maxStay },
        errors: ['No hay espacios de este tipo registrados']
      })
    }

    // 4. Contar reservaciones activas que se solapan con las fechas solicitadas
    //    Solapamiento: reservation.checkin < requested.checkout AND reservation.checkout > requested.checkin
    const { data: overlappingReservations } = await (supabase as any)
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('space_type_id', spaceTypeId)
      .in('status', ['tentative', 'confirmed', 'checked_in'])
      .lt('checkin', checkout)
      .gt('checkout', checkin)

    const reservedCount = overlappingReservations?.length || 0

    // 5. Contar bloqueos que se solapan
    //    Bloqueos pueden ser por space_id o por space_type_id
    const { data: overlappingBlocks } = await (supabase as any)
      .from('reservation_blocks')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId)
      .or(`space_type_id.eq.${spaceTypeId}`)
      .lt('date_from', checkout)
      .gt('date_to', checkin)

    const blockedCount = overlappingBlocks?.length || 0

    // 6. Calcular disponibilidad
    const spacesAvailable = Math.max(0, totalSpaces - reservedCount - blockedCount)
    const available = spacesAvailable > 0 && errors.length === 0

    return NextResponse.json({
      available,
      totalSpaces,
      reservedCount,
      blockedCount,
      spacesAvailable,
      nights,
      bookingRules: { minStay, maxStay },
      errors
    })
  } catch (error) {
    console.error('[Availability API] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
