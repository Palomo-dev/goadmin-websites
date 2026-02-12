import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/calendar
 *
 * Devuelve datos de disponibilidad y precios por día.
 * Soporta dos modos:
 * - Por spaceId:     disponibilidad de ESE espacio específico.
 * - Por spaceTypeId: disponibilidad agregada del tipo (legacy/multi-room).
 *
 * Input:  { organizationId, spaceId?, spaceTypeId?, month (YYYY-MM) }
 * Output: { days: [{ date, price, available, spacesAvailable, blocked, source, past }], baseRate }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, spaceId, spaceTypeId: rawSpaceTypeId, month } = await request.json()

    if (!organizationId || (!spaceId && !rawSpaceTypeId) || !month) {
      return NextResponse.json(
        { error: 'Faltan campos: organizationId, (spaceId o spaceTypeId), month (YYYY-MM)' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()

    // Resolver spaceTypeId desde spaceId si es necesario
    let spaceTypeId = rawSpaceTypeId
    if (spaceId && !spaceTypeId) {
      const { data: space } = await (supabase as any)
        .from('spaces')
        .select('space_type_id')
        .eq('id', spaceId)
        .single()
      if (space) spaceTypeId = space.space_type_id
    }

    if (!spaceTypeId) {
      return NextResponse.json({ error: 'No se pudo resolver el tipo de espacio' }, { status: 404 })
    }

    // Rango: mes completo + siguiente mes
    const startDate = new Date(`${month}-01T00:00:00`)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 2)
    endDate.setDate(0)

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // 1. Space type info
    const { data: spaceType } = await (supabase as any)
      .from('space_types')
      .select('id, base_rate, booking_rules, is_active')
      .eq('id', spaceTypeId)
      .single()

    if (!spaceType) {
      return NextResponse.json({ error: 'Tipo de espacio no encontrado' }, { status: 404 })
    }

    const baseRate = Number(spaceType.base_rate) || 0

    // 2. Rates (tarifas dinámicas) para el rango
    const { data: rates } = await (supabase as any)
      .from('rates')
      .select('date_from, date_to, price, priority')
      .eq('organization_id', organizationId)
      .eq('space_type_id', spaceTypeId)
      .eq('is_active', true)
      .lte('date_from', endStr)
      .gte('date_to', startStr)
      .order('priority', { ascending: false })

    // 3. Reservaciones y bloqueos según modo
    let totalSpaces = 1
    let reservations: any[] = []
    let blocks: any[] = []

    if (spaceId) {
      // ── MODO A: Espacio específico ──
      const { data: resData } = await (supabase as any)
        .from('reservations')
        .select('checkin, checkout')
        .eq('space_id', spaceId)
        .in('status', ['tentative', 'confirmed', 'checked_in'])
        .lt('checkin', endStr)
        .gt('checkout', startStr)

      reservations = resData || []

      const { data: blkData } = await (supabase as any)
        .from('reservation_blocks')
        .select('date_from, date_to')
        .eq('organization_id', organizationId)
        .or(`space_id.eq.${spaceId},space_type_id.eq.${spaceTypeId}`)
        .lt('date_from', endStr)
        .gt('date_to', startStr)

      blocks = blkData || []
    } else {
      // ── MODO B: Por tipo (legacy) ──
      const { data: spacesData } = await (supabase as any)
        .from('spaces')
        .select('id')
        .eq('space_type_id', spaceTypeId)
        .not('status', 'in', '("maintenance","cleaning","out_of_order")')

      totalSpaces = spacesData?.length || 0

      const { data: resData } = await (supabase as any)
        .from('reservations')
        .select('checkin, checkout')
        .eq('organization_id', organizationId)
        .eq('space_type_id', spaceTypeId)
        .in('status', ['tentative', 'confirmed', 'checked_in'])
        .lt('checkin', endStr)
        .gt('checkout', startStr)

      reservations = resData || []

      const { data: blkData } = await (supabase as any)
        .from('reservation_blocks')
        .select('date_from, date_to')
        .eq('organization_id', organizationId)
        .or(`space_type_id.eq.${spaceTypeId}`)
        .lt('date_from', endStr)
        .gt('date_to', startStr)

      blocks = blkData || []
    }

    // Construir mapa día a día
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days: {
      date: string; price: number; available: boolean
      spacesAvailable: number; blocked: boolean; source: string; past: boolean
    }[] = []

    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const isPast = current < today

      let price = baseRate
      let source = 'base_rate'
      if (rates && rates.length > 0) {
        for (const rate of rates) {
          if (dateStr >= rate.date_from && dateStr <= rate.date_to) {
            price = Number(rate.price)
            source = 'rate'
            break
          }
        }
      }

      let reservedCount = 0
      for (const r of reservations) {
        if (dateStr >= r.checkin && dateStr < r.checkout) reservedCount++
      }

      let blockedCount = 0
      for (const b of blocks) {
        if (dateStr >= b.date_from && dateStr < b.date_to) blockedCount++
      }

      const spacesAvailable = spaceId
        ? (reservedCount === 0 && blockedCount === 0 ? 1 : 0)
        : Math.max(0, totalSpaces - reservedCount - blockedCount)
      const blocked = blockedCount > 0 && (spaceId ? true : blockedCount >= totalSpaces)

      days.push({
        date: dateStr, price,
        available: !isPast && spacesAvailable > 0 && !blocked,
        spacesAvailable, blocked, source, past: isPast,
      })

      current.setDate(current.getDate() + 1)
    }

    return NextResponse.json({
      days, baseRate, totalSpaces,
      bookingRules: spaceType.booking_rules || {},
    })
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
