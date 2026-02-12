import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

/**
 * POST /api/shipping/calculate
 * Calcula el costo de envío dinámico usando shipping_rates.
 * Body: { organizationId, city, weight? }
 * Returns: { rates: [{name, cost, service_level, carrier_name}], cheapest, fastest } o fallback a flat rate
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, city, weight } = await request.json()

    if (!organizationId) {
      return NextResponse.json({ rates: [], cheapest: null, fastest: null })
    }

    const supabase = getSupabase()
    const sb = supabase as any

    // Buscar tarifas activas para esta organización
    let query = sb
      .from('shipping_rates')
      .select('*, transport_carriers:carrier_id(id, name)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    const { data: allRates, error } = await query

    if (error || !allRates || allRates.length === 0) {
      return NextResponse.json({ rates: [], cheapest: null, fastest: null })
    }

    const now = new Date()
    const normalizedCity = (city || '').toLowerCase().trim()

    // Filtrar tarifas válidas por fecha y ciudad
    const validRates = allRates.filter((rate: any) => {
      // Filtrar por vigencia
      if (rate.valid_from && new Date(rate.valid_from) > now) return false
      if (rate.valid_until && new Date(rate.valid_until) < now) return false

      // Filtrar por ciudad destino (si está definida)
      if (rate.destination_city) {
        const destCity = rate.destination_city.toLowerCase().trim()
        if (destCity !== normalizedCity && normalizedCity !== '') return false
      }

      // Filtrar por peso (si se especifica)
      if (weight && rate.min_weight_kg && Number(weight) < Number(rate.min_weight_kg)) return false
      if (weight && rate.max_weight_kg && Number(weight) > Number(rate.max_weight_kg)) return false

      return true
    })

    if (validRates.length === 0) {
      // Intentar con tarifas sin ciudad específica (genéricas)
      const genericRates = allRates.filter((rate: any) => {
        if (rate.valid_from && new Date(rate.valid_from) > now) return false
        if (rate.valid_until && new Date(rate.valid_until) < now) return false
        return !rate.destination_city
      })

      if (genericRates.length === 0) {
        return NextResponse.json({ rates: [], cheapest: null, fastest: null })
      }

      const calculated = calculateRates(genericRates, weight)
      return NextResponse.json(calculated)
    }

    const calculated = calculateRates(validRates, weight)
    return NextResponse.json(calculated)
  } catch (error) {
    console.error('[Shipping] Calculate error:', error)
    return NextResponse.json({ rates: [], cheapest: null, fastest: null }, { status: 500 })
  }
}

function calculateRates(rates: any[], weight?: number) {
  const SERVICE_LEVEL_ORDER: Record<string, number> = {
    same_day: 1,
    overnight: 2,
    express: 3,
    standard: 4,
    economy: 5,
  }

  const calculated = rates.map((rate: any) => {
    let cost = Number(rate.base_rate || 0)

    // Calcular por peso si aplica
    if (weight && rate.rate_per_kg) {
      cost += Number(weight) * Number(rate.rate_per_kg)
    }

    // Fuel surcharge
    if (rate.fuel_surcharge_percent) {
      cost += cost * Number(rate.fuel_surcharge_percent) / 100
    }

    // Aplicar cargo mínimo
    if (rate.min_charge && cost < Number(rate.min_charge)) {
      cost = Number(rate.min_charge)
    }

    cost = Math.round(cost)

    return {
      id: rate.id,
      name: rate.rate_name,
      cost,
      service_level: rate.service_level || 'standard',
      carrier_name: rate.transport_carriers?.name || null,
      destination_zone: rate.destination_zone,
    }
  })

  // Ordenar por costo
  calculated.sort((a: any, b: any) => a.cost - b.cost)

  const cheapest = calculated[0] || null

  // El más rápido es el de menor service_level_order
  const fastest = [...calculated].sort((a: any, b: any) => {
    const orderA = SERVICE_LEVEL_ORDER[a.service_level] || 99
    const orderB = SERVICE_LEVEL_ORDER[b.service_level] || 99
    return orderA - orderB
  })[0] || null

  return { rates: calculated, cheapest, fastest }
}
