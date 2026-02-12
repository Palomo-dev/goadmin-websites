import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reservations/pricing
 *
 * Calcula el precio dinámico de una reservación usando:
 * 1. Tabla `rates` (tarifas por temporada/fecha, con priority)
 * 2. Fallback a `space_types.base_rate`
 * 3. `service_charges` obligatorios (is_optional=false)
 * 4. `organization_taxes` (is_default, is_active)
 *
 * Input:  { organizationId, spaceId?, spaceTypeId?, checkin, checkout, occupantCount?, selectedExtras?: number[] }
 * Output: { nights, priceBreakdown[], subtotal, serviceCharges[], optionalExtras[], selectedExtrasCharges[], taxRate, taxName, taxAmount, total }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, spaceId, spaceTypeId: rawSpaceTypeId, checkin, checkout, occupantCount, selectedExtras } = await request.json()

    if (!organizationId || (!spaceId && !rawSpaceTypeId) || !checkin || !checkout) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, (spaceId o spaceTypeId), checkin, checkout' },
        { status: 400 }
      )
    }

    // Resolver spaceTypeId desde spaceId si es necesario
    let spaceTypeId = rawSpaceTypeId
    if (spaceId && !spaceTypeId) {
      const supabaseResolve = createPublicClient()
      const { data: space } = await (supabaseResolve as any)
        .from('spaces')
        .select('space_type_id')
        .eq('id', spaceId)
        .single()
      if (space) spaceTypeId = space.space_type_id
    }

    if (!spaceTypeId) {
      return NextResponse.json({ error: 'No se pudo resolver el tipo de espacio' }, { status: 404 })
    }

    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))

    if (nights < 1) {
      return NextResponse.json(
        { error: 'El rango de fechas debe ser de al menos 1 noche' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()

    // 1. Obtener space_type con base_rate
    const { data: spaceType, error: stError } = await (supabase as any)
      .from('space_types')
      .select('id, name, base_rate')
      .eq('id', spaceTypeId)
      .eq('organization_id', organizationId)
      .single()

    if (stError || !spaceType) {
      return NextResponse.json({ error: 'Tipo de espacio no encontrado' }, { status: 404 })
    }

    const baseRate = Number(spaceType.base_rate)

    // 2. Obtener rates activos que cubren alguna noche del rango
    const { data: rates } = await (supabase as any)
      .from('rates')
      .select('date_from, date_to, price, priority')
      .eq('organization_id', organizationId)
      .eq('space_type_id', spaceTypeId)
      .eq('is_active', true)
      .lte('date_from', checkout)
      .gte('date_to', checkin)
      .order('priority', { ascending: false })

    // 3. Calcular precio por noche
    const priceBreakdown: { date: string; price: number; source: string }[] = []
    let subtotal = 0

    for (let i = 0; i < nights; i++) {
      const nightDate = new Date(checkinDate)
      nightDate.setDate(nightDate.getDate() + i)
      const nightStr = nightDate.toISOString().split('T')[0]

      // Buscar rate aplicable (mayor priority primero, ya ordenado)
      let nightPrice = baseRate
      let source = 'base_rate'

      if (rates && rates.length > 0) {
        for (const rate of rates) {
          const from = new Date(rate.date_from)
          const to = new Date(rate.date_to)
          if (nightDate >= from && nightDate <= to) {
            nightPrice = Number(rate.price)
            source = 'rate'
            break // Ya están ordenados por priority DESC
          }
        }
      }

      priceBreakdown.push({ date: nightStr, price: nightPrice, source })
      subtotal += nightPrice
    }

    // 4. Obtener TODOS los service_charges activos (obligatorios + opcionales)
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

    const calcChargeAmount = (charge: any) => {
      let amount = 0
      if (charge.charge_type === 'percentage') {
        amount = subtotal * (Number(charge.charge_value) / 100)
      } else {
        amount = Number(charge.charge_value)
      }
      return Math.round(amount * 100) / 100
    }

    if (allCharges && allCharges.length > 0) {
      for (const charge of allCharges) {
        // Verificar min_amount y min_guests
        if (charge.min_amount && subtotal < Number(charge.min_amount)) continue
        if (charge.min_guests && (occupantCount || 1) < charge.min_guests) continue

        const chargeAmount = calcChargeAmount(charge)

        if (!charge.is_optional) {
          // Cargo obligatorio — siempre se suma
          serviceCharges.push({ name: charge.name, amount: chargeAmount, isTaxable: charge.is_taxable })
          chargesTotal += chargeAmount
          if (charge.is_taxable) taxableChargesTotal += chargeAmount
        } else {
          // Cargo opcional — devolver para que el frontend muestre checkboxes
          optionalExtras.push({
            id: charge.id,
            name: charge.name,
            chargeType: charge.charge_type,
            chargeValue: Number(charge.charge_value),
            amount: chargeAmount,
            isTaxable: charge.is_taxable,
          })

          // Si el usuario lo seleccionó, sumarlo al total
          if (selectedIds.includes(charge.id)) {
            selectedExtrasCharges.push({ id: charge.id, name: charge.name, amount: chargeAmount, isTaxable: charge.is_taxable })
            extrasTotal += chargeAmount
            if (charge.is_taxable) taxableExtrasTotal += chargeAmount
          }
        }
      }
    }

    // 5. Obtener impuesto default de la organización
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
    // Impuesto se aplica sobre subtotal + cargos taxables (obligatorios + extras seleccionados)
    const taxableBase = subtotal + taxableChargesTotal + taxableExtrasTotal
    const taxAmount = Math.round(taxableBase * taxRate) / 100

    const total = Math.round((subtotal + chargesTotal + extrasTotal + taxAmount) * 100) / 100

    return NextResponse.json({
      spaceTypeName: spaceType.name,
      nights,
      priceBreakdown,
      subtotal,
      serviceCharges,
      chargesTotal,
      optionalExtras,
      selectedExtrasCharges,
      extrasTotal,
      taxName,
      taxRate,
      taxAmount,
      total
    })
  } catch (error) {
    console.error('[Pricing API] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
