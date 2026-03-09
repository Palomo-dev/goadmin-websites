import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/parking/passes
 *
 * Crea un pase de parking pendiente de pago.
 * 1. Valida pass_type_id existe y está activo
 * 2. Crea o reutiliza parking_vehicle por placa
 * 3. Crea parking_pass (status: suspended = pendiente de pago)
 * 4. Crea parking_pass_vehicles (junction)
 * 5. Retorna passId + referencia PKP-XXXXXXXX para checkout
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()
    const {
      organizationId,
      passTypeId,
      customerEmail,
      customerName,
      customerPhone,
      customerDocType,
      customerDocNumber,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehicleType,
      startDate,
    } = body

    // Validaciones básicas
    if (!organizationId || !passTypeId || !customerEmail || !vehiclePlate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, passTypeId, customerEmail, vehiclePlate' },
        { status: 400 }
      )
    }

    // 1. Validar que el pass_type existe y está activo
    const { data: passType, error: ptError } = await (supabase as any)
      .from('parking_pass_types')
      .select('id, name, duration_days, price, is_active, allowed_vehicle_types')
      .eq('id', passTypeId)
      .eq('organization_id', organizationId)
      .single()

    if (ptError || !passType) {
      return NextResponse.json({ error: 'Tipo de pase no encontrado' }, { status: 404 })
    }

    if (!passType.is_active) {
      return NextResponse.json({ error: 'Este tipo de pase no está disponible' }, { status: 400 })
    }

    // Validar tipo de vehículo si el plan lo restringe
    const normalizedType = (vehicleType || 'car').toLowerCase()
    if (passType.allowed_vehicle_types && passType.allowed_vehicle_types.length > 0) {
      if (!passType.allowed_vehicle_types.includes(normalizedType)) {
        return NextResponse.json(
          { error: `Este plan no admite vehículos tipo "${normalizedType}". Tipos permitidos: ${passType.allowed_vehicle_types.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // 2. Buscar o crear customer
    let customerId: string | null = null
    const { data: existingCustomer } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('email', customerEmail.toLowerCase().trim())
      .eq('organization_id', organizationId)
      .limit(1)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const nameParts = (customerName || '').trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const { data: newCustomer } = await (supabase as any)
        .from('customers')
        .insert({
          organization_id: organizationId,
          email: customerEmail.toLowerCase().trim(),
          first_name: firstName,
          last_name: lastName,
          phone: customerPhone || null,
          doc_type: customerDocType || null,
          doc_number: customerDocNumber || null,
        })
        .select('id')
        .single()

      customerId = newCustomer?.id || null
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Error al crear/obtener el cliente' }, { status: 500 })
    }

    // 3. Buscar o crear parking_vehicle por placa
    const plateNormalized = vehiclePlate.toUpperCase().trim()
    let vehicleId: string | null = null

    const { data: existingVehicle } = await (supabase as any)
      .from('parking_vehicles')
      .select('id')
      .eq('plate', plateNormalized)
      .eq('organization_id', organizationId)
      .limit(1)
      .maybeSingle()

    if (existingVehicle) {
      vehicleId = existingVehicle.id
      // Actualizar customer_id si no lo tiene
      await (supabase as any)
        .from('parking_vehicles')
        .update({ customer_id: customerId })
        .eq('id', vehicleId)
        .is('customer_id', null)
    } else {
      const { data: newVehicle } = await (supabase as any)
        .from('parking_vehicles')
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          plate: plateNormalized,
          brand: vehicleBrand || null,
          model: vehicleModel || null,
          color: vehicleColor || null,
          vehicle_type: normalizedType,
        })
        .select('id')
        .single()

      vehicleId = newVehicle?.id || null
    }

    if (!vehicleId) {
      return NextResponse.json({ error: 'Error al crear/obtener el vehículo' }, { status: 500 })
    }

    // 4. Calcular fechas
    const start = startDate ? new Date(startDate) : new Date()
    const end = new Date(start)
    end.setDate(end.getDate() + (passType.duration_days || 30))

    // 5. Crear parking_pass (status: suspended = pendiente de pago)
    const { data: newPass, error: passError } = await (supabase as any)
      .from('parking_passes')
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        pass_type_id: passTypeId,
        plan_name: passType.name,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        price: passType.price,
        status: 'suspended',
      })
      .select('id')
      .single()

    if (passError || !newPass) {
      console.error('[Parking Passes] Error creando pase:', passError)
      return NextResponse.json({ error: 'Error al crear el pase' }, { status: 500 })
    }

    // 6. Crear parking_pass_vehicles (junction)
    await (supabase as any)
      .from('parking_pass_vehicles')
      .insert({
        pass_id: newPass.id,
        vehicle_id: vehicleId,
        is_primary: true,
      })

    // 7. Generar referencia PKP-XXXXXXXX
    const passReference = `PKP-${newPass.id.substring(0, 8).toUpperCase()}`

    return NextResponse.json({
      success: true,
      passId: newPass.id,
      passReference,
      planName: passType.name,
      price: Number(passType.price),
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    })
  } catch (error: any) {
    console.error('[Parking Passes] Error:', error)
    return NextResponse.json(
      { error: 'Error interno al crear el pase' },
      { status: 500 }
    )
  }
}
