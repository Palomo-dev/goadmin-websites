import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/pricing/multi
 *
 * Calcula pricing para múltiples habitaciones en una sola reservación.
 *
 * Input:  { organizationId, checkin, checkout, rooms: [{spaceTypeId, quantity}], occupantCount?, selectedExtras?: number[] }
 * Output: { rooms: [{spaceTypeId, name, quantity, nightlyBreakdown[], subtotal}], totalSubtotal, serviceCharges[], optionalExtras[], selectedExtrasCharges[], extrasTotal, taxName, taxRate, taxAmount, grandTotal, nights }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, checkin, checkout, rooms, occupantCount, selectedExtras } = await request.json()

    if (!organizationId || !checkin || !checkout || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos: organizationId, checkin, checkout, rooms[]' },
        { status: 400 }
      )
    }

    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))

    if (nights < 1) {
      return NextResponse.json({ error: 'El rango debe ser de al menos 1 noche' }, { status: 400 })
    }

    const supabase = createPublicClient()

    // Calcular pricing por cada room type
    const roomResults: {
      spaceTypeId: string
      name: string
      quantity: number
      baseRate: number
      nightlyBreakdown: { date: string; price: number; source: string }[]
      subtotal: number
    }[] = []

    let totalSubtotal = 0

    for (const room of rooms) {
      const { spaceTypeId, quantity } = room
      if (!spaceTypeId || !quantity || quantity < 1) continue

      // Obtener space_type
      const { data: spaceType } = await (supabase as any)
        .from('space_types')
        .select('id, name, base_rate')
        .eq('id', spaceTypeId)
        .eq('organization_id', organizationId)
        .single()

      if (!spaceType) continue

      const baseRate = Number(spaceType.base_rate)

      // Obtener rates activos
      const { data: rates } = await (supabase as any)
        .from('rates')
        .select('date_from, date_to, price, priority')
        .eq('organization_id', organizationId)
        .eq('space_type_id', spaceTypeId)
        .eq('is_active', true)
        .lte('date_from', checkout)
        .gte('date_to', checkin)
        .order('priority', { ascending: false })

      // Calcular precio por noche
      const nightlyBreakdown: { date: string; price: number; source: string }[] = []
      let roomSubtotal = 0

      for (let i = 0; i < nights; i++) {
        const nightDate = new Date(checkinDate)
        nightDate.setDate(nightDate.getDate() + i)
        const nightStr = nightDate.toISOString().split('T')[0]

        let nightPrice = baseRate
        let source = 'base_rate'

        if (rates && rates.length > 0) {
          for (const rate of rates) {
            if (nightStr >= rate.date_from && nightStr <= rate.date_to) {
              nightPrice = Number(rate.price)
              source = 'rate'
              break
            }
          }
        }

        nightlyBreakdown.push({ date: nightStr, price: nightPrice, source })
        roomSubtotal += nightPrice
      }

      // Multiplicar por cantidad de habitaciones
      roomSubtotal *= quantity

      roomResults.push({
        spaceTypeId,
        name: spaceType.name,
        quantity,
        baseRate,
        nightlyBreakdown,
        subtotal: roomSubtotal,
      })

      totalSubtotal += roomSubtotal
    }

    // Service charges (obligatorios + opcionales)
    const { data: allCharges } = await (supabase as any)
      .from('service_charges')
      .select('id, name, charge_type, charge_value, min_amount, min_guests, is_taxable, is_optional')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    const serviceCharges: { name: string; amount: number; isTaxable: boolean }[] = []
    const optionalExtras: { id: number; name: string; chargeType: string; chargeValue: number; amount: number; isTaxable: boolean }[] = []
    const selectedExtrasCharges: { id: number; name: string; amount: number; isTaxable: boolean }[] = []
    let chargesTotal = 0
    let taxableChargesTotal = 0
    let extrasTotal = 0
    let taxableExtrasTotal = 0
    const selectedIds: number[] = Array.isArray(selectedExtras) ? selectedExtras : []

    const calcAmount = (charge: any) => {
      if (charge.charge_type === 'percentage') {
        return Math.round(totalSubtotal * (Number(charge.charge_value) / 100) * 100) / 100
      }
      return Math.round(Number(charge.charge_value) * 100) / 100
    }

    if (allCharges) {
      for (const charge of allCharges) {
        if (charge.min_amount && totalSubtotal < Number(charge.min_amount)) continue
        if (charge.min_guests && (occupantCount || 1) < charge.min_guests) continue

        const amount = calcAmount(charge)

        if (!charge.is_optional) {
          serviceCharges.push({ name: charge.name, amount, isTaxable: charge.is_taxable })
          chargesTotal += amount
          if (charge.is_taxable) taxableChargesTotal += amount
        } else {
          optionalExtras.push({
            id: charge.id, name: charge.name,
            chargeType: charge.charge_type, chargeValue: Number(charge.charge_value),
            amount, isTaxable: charge.is_taxable,
          })
          if (selectedIds.includes(charge.id)) {
            selectedExtrasCharges.push({ id: charge.id, name: charge.name, amount, isTaxable: charge.is_taxable })
            extrasTotal += amount
            if (charge.is_taxable) taxableExtrasTotal += amount
          }
        }
      }
    }

    // Impuesto
    const { data: tax } = await (supabase as any)
      .from('organization_taxes')
      .select('name, rate')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .single()

    const taxRate = tax ? Number(tax.rate) : 0
    const taxName = tax?.name || 'Impuesto'
    const taxableBase = totalSubtotal + taxableChargesTotal + taxableExtrasTotal
    const taxAmount = Math.round(taxableBase * taxRate) / 100
    const grandTotal = Math.round((totalSubtotal + chargesTotal + extrasTotal + taxAmount) * 100) / 100

    return NextResponse.json({
      nights,
      rooms: roomResults,
      totalSubtotal,
      serviceCharges,
      chargesTotal,
      optionalExtras,
      selectedExtrasCharges,
      extrasTotal,
      taxName,
      taxRate,
      taxAmount,
      grandTotal,
    })
  } catch (error) {
    console.error('[MultiPricing API] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
