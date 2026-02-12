import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/availability
 *
 * Verifica disponibilidad para un rango de fechas.
 * Soporta dos modos:
 * - Por spaceId:     verifica si ESE espacio específico está libre.
 * - Por spaceTypeId: cuenta cuántos espacios del tipo están libres (legacy/multi-room).
 *
 * Input:  { organizationId, spaceId?, spaceTypeId?, checkin, checkout }
 * Output: { available, totalSpaces, reservedCount, blockedCount, spacesAvailable, bookingRules, errors[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, spaceId, spaceTypeId: rawSpaceTypeId, checkin, checkout } = await request.json()

    if (!organizationId || (!spaceId && !rawSpaceTypeId) || !checkin || !checkout) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, (spaceId o spaceTypeId), checkin, checkout' },
        { status: 400 }
      )
    }

    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    if (checkinDate >= checkoutDate) {
      return NextResponse.json({ error: 'La fecha de check-in debe ser anterior al check-out' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (checkinDate < today) {
      return NextResponse.json({ error: 'La fecha de check-in no puede ser en el pasado' }, { status: 400 })
    }

    const supabase = createPublicClient()
    const errors: string[] = []

    // ── Resolver spaceTypeId desde spaceId si es necesario ──
    let spaceTypeId = rawSpaceTypeId
    let targetSpace: any = null

    if (spaceId) {
      const { data: space, error: spErr } = await (supabase as any)
        .from('spaces')
        .select('id, space_type_id, status, label')
        .eq('id', spaceId)
        .single()

      if (spErr || !space) {
        return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
      }
      targetSpace = space
      spaceTypeId = space.space_type_id

      if (['maintenance', 'cleaning', 'out_of_order'].includes(space.status)) {
        return NextResponse.json({
          available: false, totalSpaces: 1, reservedCount: 0, blockedCount: 0, spacesAvailable: 0,
          errors: [`El espacio "${space.label}" no está disponible (${space.status})`]
        })
      }
    }

    // 1. Obtener space_type para booking_rules
    const { data: spaceType, error: stError } = await (supabase as any)
      .from('space_types')
      .select('id, name, base_rate, capacity, booking_rules, is_active')
      .eq('id', spaceTypeId)
      .single()

    if (stError || !spaceType) {
      return NextResponse.json({ error: 'Tipo de espacio no encontrado' }, { status: 404 })
    }

    if (!spaceType.is_active) {
      return NextResponse.json({ error: 'Este tipo de espacio no está disponible actualmente' }, { status: 400 })
    }

    // 2. Validar booking_rules
    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))
    const bookingRules = spaceType.booking_rules || {}
    const minStay = bookingRules.min_stay || 1
    const maxStay = bookingRules.max_stay || null

    if (nights < minStay) errors.push(`La estadía mínima es de ${minStay} noche(s)`)
    if (maxStay && nights > maxStay) errors.push(`La estadía máxima es de ${maxStay} noche(s)`)

    // ── MODO A: Verificar un espacio específico ──
    if (spaceId && targetSpace) {
      // Reservaciones que solapan para ESTE espacio
      const { data: overlapping } = await (supabase as any)
        .from('reservations')
        .select('id')
        .eq('space_id', spaceId)
        .in('status', ['tentative', 'confirmed', 'checked_in'])
        .lt('checkin', checkout)
        .gt('checkout', checkin)

      const reservedCount = overlapping?.length || 0

      // Bloqueos para ESTE espacio o su tipo
      const { data: blocks } = await (supabase as any)
        .from('reservation_blocks')
        .select('id')
        .eq('organization_id', organizationId)
        .or(`space_id.eq.${spaceId},space_type_id.eq.${spaceTypeId}`)
        .lt('date_from', checkout)
        .gt('date_to', checkin)

      const blockedCount = blocks?.length || 0
      const spacesAvailable = reservedCount === 0 && blockedCount === 0 ? 1 : 0
      const available = spacesAvailable > 0 && errors.length === 0

      return NextResponse.json({
        available, totalSpaces: 1, reservedCount, blockedCount, spacesAvailable, nights,
        bookingRules: { minStay, maxStay }, errors
      })
    }

    // ── MODO B: Contar disponibilidad por tipo (legacy/multi-room) ──
    const { data: totalSpacesData } = await (supabase as any)
      .from('spaces')
      .select('id')
      .eq('space_type_id', spaceTypeId)
      .not('status', 'in', '("maintenance","cleaning","out_of_order")')

    const totalSpaces = totalSpacesData?.length || 0
    if (totalSpaces === 0) {
      return NextResponse.json({
        available: false, totalSpaces: 0, reservedCount: 0, blockedCount: 0, spacesAvailable: 0,
        bookingRules: { minStay, maxStay }, errors: ['No hay espacios de este tipo registrados']
      })
    }

    const { data: overlappingReservations } = await (supabase as any)
      .from('reservations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('space_type_id', spaceTypeId)
      .in('status', ['tentative', 'confirmed', 'checked_in'])
      .lt('checkin', checkout)
      .gt('checkout', checkin)

    const reservedCount = overlappingReservations?.length || 0

    const { data: overlappingBlocks } = await (supabase as any)
      .from('reservation_blocks')
      .select('id')
      .eq('organization_id', organizationId)
      .or(`space_type_id.eq.${spaceTypeId}`)
      .lt('date_from', checkout)
      .gt('date_to', checkin)

    const blockedCount = overlappingBlocks?.length || 0
    const spacesAvailable = Math.max(0, totalSpaces - reservedCount - blockedCount)
    const available = spacesAvailable > 0 && errors.length === 0

    return NextResponse.json({
      available, totalSpaces, reservedCount, blockedCount, spacesAvailable, nights,
      bookingRules: { minStay, maxStay }, errors
    })
  } catch (error) {
    console.error('[Availability API] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
