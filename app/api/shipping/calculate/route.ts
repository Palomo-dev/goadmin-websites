import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { calcularTarifas, leerTarifasWeb, tarifasParaDestino } from '@/lib/shipping/resolveShipping'
import { hoyEnZona } from '@/lib/restaurant/horario'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

/**
 * POST /api/shipping/calculate
 * Calcula el costo de envío dinámico usando shipping_rates.
 * Body: { organizationId, city, weight?, subtotal? }
 * Returns: { rates: [{id, name, cost, service_level, carrier_name, free_shipping_threshold}], cheapest, fastest }
 *
 * El cálculo vive en lib/shipping/resolveShipping.ts: es el mismo que usa /api/orders para cobrar
 * el envío con el id de tarifa que elige el checkout. La vigencia (`valid_from`/`valid_until`,
 * columnas `date`) se compara con el día de hoy en la zona de la organización.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, city, weight, subtotal } = await request.json()

    if (!organizationId) {
      return NextResponse.json({ rates: [], cheapest: null, fastest: null })
    }

    const supabase = getSupabase()
    const sb = supabase as any

    const { data: org } = await sb.from('organizations').select('timezone').eq('id', organizationId).maybeSingle()
    const hoy = hoyEnZona(org?.timezone)

    // Buscar tarifas activas y visibles en web para esta organización
    const allRates = await leerTarifasWeb(sb, Number(organizationId))
    if (!allRates || allRates.length === 0) {
      return NextResponse.json({ rates: [], cheapest: null, fastest: null })
    }

    const peso = weight ? Number(weight) : null
    const aplicables = tarifasParaDestino(allRates, city || '', peso, hoy)
    if (aplicables.length === 0) {
      return NextResponse.json({ rates: [], cheapest: null, fastest: null })
    }

    return NextResponse.json(calcularTarifas(aplicables, peso, subtotal))
  } catch (error) {
    console.error('[Shipping] Calculate error:', error)
    return NextResponse.json({ rates: [], cheapest: null, fastest: null }, { status: 500 })
  }
}
