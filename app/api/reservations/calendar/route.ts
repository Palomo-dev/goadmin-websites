import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/calendar
 *
 * Devuelve datos de disponibilidad y precios por día para un tipo de espacio.
 * Usado por el widget de calendario visual.
 *
 * Input:  { organizationId, spaceTypeId, month (YYYY-MM) }
 * Output: { days: [{ date, price, available, spacesAvailable, blocked, source }], baseRate }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, spaceTypeId, month } = await request.json()

    if (!organizationId || !spaceTypeId || !month) {
      return NextResponse.json(
        { error: 'Faltan campos: organizationId, spaceTypeId, month (YYYY-MM)' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()

    // Rango: mes completo + siguiente mes (para visualizar 2 meses)
    const startDate = new Date(`${month}-01T00:00:00`)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 2)
    endDate.setDate(0) // Último día del mes siguiente

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // 1. Space type info
    const { data: spaceType } = await (supabase as any)
      .from('space_types')
      .select('id, base_rate, booking_rules, is_active')
      .eq('id', spaceTypeId)
      .eq('organization_id', organizationId)
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

    // 3. Total spaces disponibles
    const { data: spacesData } = await (supabase as any)
      .from('spaces')
      .select('id')
      .eq('space_type_id', spaceTypeId)
      .not('status', 'in', '("maintenance","cleaning","out_of_order")')

    const totalSpaces = spacesData?.length || 0

    // 4. Reservaciones activas en el rango
    const { data: reservations } = await (supabase as any)
      .from('reservations')
      .select('checkin, checkout')
      .eq('organization_id', organizationId)
      .eq('space_type_id', spaceTypeId)
      .in('status', ['tentative', 'confirmed', 'checked_in'])
      .lt('checkin', endStr)
      .gt('checkout', startStr)

    // 5. Bloqueos en el rango
    const { data: blocks } = await (supabase as any)
      .from('reservation_blocks')
      .select('date_from, date_to')
      .eq('organization_id', organizationId)
      .or(`space_type_id.eq.${spaceTypeId}`)
      .lt('date_from', endStr)
      .gt('date_to', startStr)

    // Construir mapa día a día
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days: {
      date: string
      price: number
      available: boolean
      spacesAvailable: number
      blocked: boolean
      source: string
      past: boolean
    }[] = []

    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const isPast = current < today

      // Precio: buscar rate con mayor prioridad que cubra esta fecha
      let price = baseRate
      let source = 'base_rate'
      if (rates && rates.length > 0) {
        for (const rate of rates) {
          if (dateStr >= rate.date_from && dateStr <= rate.date_to) {
            price = Number(rate.price)
            source = 'rate'
            break // Ya están ordenadas por prioridad desc
          }
        }
      }

      // Reservaciones que cubren esta fecha (checkin <= date < checkout)
      let reservedCount = 0
      if (reservations) {
        for (const r of reservations) {
          if (dateStr >= r.checkin && dateStr < r.checkout) {
            reservedCount++
          }
        }
      }

      // Bloqueos que cubren esta fecha
      let blockedCount = 0
      if (blocks) {
        for (const b of blocks) {
          if (dateStr >= b.date_from && dateStr < b.date_to) {
            blockedCount++
          }
        }
      }

      const spacesAvailable = Math.max(0, totalSpaces - reservedCount - blockedCount)
      const blocked = blockedCount >= totalSpaces

      days.push({
        date: dateStr,
        price,
        available: !isPast && spacesAvailable > 0 && !blocked,
        spacesAvailable,
        blocked,
        source,
        past: isPast,
      })

      current.setDate(current.getDate() + 1)
    }

    return NextResponse.json({
      days,
      baseRate,
      totalSpaces,
      bookingRules: spaceType.booking_rules || {},
    })
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
