import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { organizacionDeLaReserva } from '@/lib/restaurant/reservas-contexto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/restaurant-reservations/availability
 *
 * Verifica disponibilidad de mesas para una fecha y hora dadas.
 * Usa la RPC `get_restaurant_availability` que lee los horarios
 * desde `restaurant_booking_settings` (o defaults si no hay configuración).
 *
 * Query params: organizationId, date (YYYY-MM-DD), time? (HH:MM), partySize, zone?
 *
 * Si se pasa `time`, devuelve disponibilidad para esa hora exacta.
 * Si NO se pasa `time`, devuelve la lista de slots disponibles del día.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contexto = await organizacionDeLaReserva(searchParams.get('organizationId'), 'Restaurant Availability')
    if ('respuesta' in contexto) return contexto.respuesta
    // La organización sale del host; la del query string solo se compara.
    const organizationId = String(contexto.orgId)
    const date = searchParams.get('date')
    const time = searchParams.get('time')
    const partySizeParam = searchParams.get('partySize')
    const zone = searchParams.get('zone')
    const slotIntervalParam = parseInt(searchParams.get('slotInterval') || '30', 10)

    if (!organizationId || !date) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: organizationId, date' },
        { status: 400 }
      )
    }

    const partySize = partySizeParam ? parseInt(partySizeParam, 10) : 2
    if (isNaN(partySize) || partySize < 1) {
      return NextResponse.json({ error: 'partySize inválido' }, { status: 400 })
    }

    // Validar que la fecha no sea pasada
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const requestDate = new Date(date + 'T00:00:00')
    if (requestDate < today) {
      return NextResponse.json({
        available: false,
        availableTables: 0,
        slots: [],
        suggestedTimes: [],
        error: 'La fecha no puede ser en el pasado',
      })
    }

    const supabase = createAdminClient() || createPublicClient()

    // ── Llamar RPC get_restaurant_availability ──
    const { data: availResult, error: rpcError } = await (supabase as any)
      .rpc('get_restaurant_availability', {
        p_organization_id: parseInt(organizationId, 10),
        p_date: date,
        p_party_size: partySize,
        p_zone: zone || null,
        p_slot_interval: [15, 30, 60, 90].includes(slotIntervalParam) ? slotIntervalParam : 30,
      })

    if (rpcError) {
      console.error('[Restaurant Availability] RPC error:', rpcError)
      // Fallback al método anterior si la RPC falla
      return fallbackAvailability(supabase as any, organizationId, date, time, partySize, zone, slotIntervalParam)
    }

    const slots = availResult?.slots || []
    const suggestedTimes = availResult?.suggestedTimes || []

    // ── Modo hora específica ──
    if (time) {
      const slot = slots.find((s: any) => s.time === time)
      const available = slot ? slot.available : false
      const availableTables = slot ? slot.remaining : 0

      // Sugerir horarios alternativos si no hay disponibilidad
      let altTimes: string[] = []
      if (!available) {
        altTimes = suggestedTimes
      }

      return NextResponse.json({
        available,
        availableTables,
        suggestedTimes: altTimes,
        partySize,
        date,
        time,
      })
    }

    // ── Modo lista de slots del día ──
    const availableSlots = slots.filter((s: any) => s.available)

    return NextResponse.json({
      available: availableSlots.length > 0,
      availableTables: availableSlots.length,
      slots,
      suggestedTimes: suggestedTimes,
      partySize,
      date,
    })
  } catch (error) {
    console.error('[Restaurant Availability] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * Fallback al método anterior (sin RPC) si la RPC falla.
 * Mantiene compatibilidad hacia atrás.
 */
async function fallbackAvailability(
  supabase: any,
  organizationId: string,
  date: string,
  time: string | null,
  partySize: number,
  zone: string | null,
  slotInterval: number
) {
  // Obtener mesas
  let tableQuery = supabase
    .from('restaurant_tables')
    .select('id, name, zone, capacity, state')
    .eq('organization_id', organizationId)
    .gte('capacity', partySize)

  if (zone) {
    tableQuery = tableQuery.eq('zone', zone)
  }

  const { data: tables } = await tableQuery
  if (!tables || tables.length === 0) {
    return NextResponse.json({
      available: false,
      availableTables: 0,
      slots: [],
      suggestedTimes: [],
      partySize,
      date,
      message: 'No hay mesas configuradas para este número de personas',
    })
  }

  const tableIds = tables.map((t: any) => t.id)

  const { data: existingReservations } = await supabase
    .from('restaurant_reservations')
    .select('id, restaurant_table_id, reservation_time, duration_minutes, party_size, status')
    .eq('organization_id', organizationId)
    .eq('reservation_date', date)
    .in('status', ['pending', 'confirmed', 'seated'])

  const TURN_DURATION = 90
  const BUFFER = 15

  function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0
    const parts = timeStr.split(':')
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }

  function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function isTableFree(tableId: string, slotTimeMinutes: number): boolean {
    const slotEnd = slotTimeMinutes + TURN_DURATION + BUFFER
    for (const res of existingReservations || []) {
      if (res.restaurant_table_id !== tableId) continue
      const resTime = timeToMinutes(res.reservation_time)
      const resDuration = res.duration_minutes || TURN_DURATION
      const resEnd = resTime + resDuration + BUFFER
      if (slotTimeMinutes < resEnd && resTime < slotEnd) return false
    }
    return true
  }

  const SERVICE_SLOTS = [
    { from: 12 * 60, to: 15 * 60 },
    { from: 18 * 60, to: 22 * 60 + 30 },
  ]

  const allSlots: Array<{ time: string; minutes: number }> = []
  for (const shift of SERVICE_SLOTS) {
    for (let m = shift.from; m + TURN_DURATION <= shift.to; m += slotInterval) {
      allSlots.push({ time: minutesToTime(m), minutes: m })
    }
  }

  const now = new Date()
  const isToday = new Date(date + 'T00:00:00').toDateString() === now.toDateString()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const validSlots = isToday
    ? allSlots.filter(s => s.minutes > nowMinutes + 60)
    : allSlots

  if (time) {
    const slotMinutes = timeToMinutes(time)
    const freeTables = tableIds.filter((id: string) => isTableFree(id, slotMinutes))
    const available = freeTables.length > 0
    let suggestedTimes: string[] = []
    if (!available) {
      suggestedTimes = validSlots
        .filter(s => tableIds.filter((id: string) => isTableFree(id, s.minutes)).length > 0)
        .slice(0, 5)
        .map(s => s.time)
    }
    return NextResponse.json({
      available,
      availableTables: freeTables.length,
      suggestedTimes,
      partySize,
      date,
      time,
    })
  }

  const slots = validSlots.map(s => {
    const freeTables = tableIds.filter((id: string) => isTableFree(id, s.minutes))
    return { time: s.time, available: freeTables.length > 0, remaining: freeTables.length }
  })

  const availableSlots = slots.filter(s => s.available)
  return NextResponse.json({
    available: availableSlots.length > 0,
    availableTables: tables.length,
    slots,
    suggestedTimes: availableSlots.slice(0, 5).map(s => s.time),
    partySize,
    date,
  })
}
