/**
 * Handler compartido para procesar pagos de pases de parking desde webhooks.
 *
 * Cuando un webhook recibe una referencia con prefijo "PKP-", este handler:
 * 1. Busca el parking_pass por su referencia (PKP-{id corto})
 * 2. Actualiza parking_pass.status según el resultado del pago
 * 3. Inserta un registro en payments (source: 'parking_pass')
 * 4. Crea parking_payments (junction entre parking_pass y payment)
 * 5. Si es exitoso: envía email de confirmación con datos del pase
 */

import { sendParkingPassConfirmationEmail } from '@/lib/email/send-pass-confirmation'

/**
 * Detecta si una referencia de pago corresponde a un pase de parking.
 */
export function isParkingPassReference(reference: string): boolean {
  return reference?.startsWith('PKP-') ?? false
}

interface PaymentResult {
  handled: boolean
  passId?: string
  passReference?: string
  status?: string
  error?: string
}

/**
 * Procesa un pago de pase de parking desde un webhook.
 */
export async function handleParkingPassPayment(
  supabase: any,
  reference: string,
  paymentStatus: string,
  paymentDetails: {
    transactionId: string
    amount: number
    currency: string
    method: string
    processorResponse: any
    gateway: string
  }
): Promise<PaymentResult> {
  if (!isParkingPassReference(reference)) {
    return { handled: false }
  }

  try {
    // 1. Extraer el ID corto de la referencia PKP-XXXXXXXX
    const shortId = reference.replace('PKP-', '')

    // Buscar parking_pass cuyo id empiece con el shortId
    const { data: passes, error: searchError } = await supabase
      .from('parking_passes')
      .select('id, organization_id, customer_id, pass_type_id, plan_name, start_date, end_date, price, status')
      .ilike('id', `${shortId}%`)

    if (searchError || !passes || passes.length === 0) {
      console.error(`[ParkingPassPayment] Pase no encontrado: ${reference}`, searchError)
      return { handled: true, error: 'Pase no encontrado' }
    }

    const pass = passes[0]

    // 2. Determinar nuevo status del pase
    let newStatus = pass.status
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (paymentStatus === 'paid') {
      newStatus = 'active'
      updateData.status = 'active'
    } else if (paymentStatus === 'failed') {
      newStatus = 'cancelled'
      updateData.status = 'cancelled'
    } else if (paymentStatus === 'refunded') {
      newStatus = 'cancelled'
      updateData.status = 'cancelled'
    }

    // 3. Actualizar parking_pass
    const { error: updateError } = await supabase
      .from('parking_passes')
      .update(updateData)
      .eq('id', pass.id)

    if (updateError) {
      console.error('[ParkingPassPayment] Error actualizando pase:', updateError)
    }

    // 4. Insertar payment
    const { data: paymentRecord } = await supabase
      .from('payments')
      .insert({
        organization_id: pass.organization_id,
        source: 'parking_pass',
        source_id: String(pass.id),
        method: paymentDetails.method,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        reference: paymentDetails.transactionId,
        processor_response: paymentDetails.processorResponse,
        status: paymentStatus,
      })
      .select('id')
      .single()

    // 5. Crear parking_payments (junction)
    if (paymentRecord?.id) {
      await supabase.from('parking_payments').insert({
        parking_pass_id: pass.id,
        payment_id: paymentRecord.id,
      })
    }

    // 6. Si pago exitoso: enviar email de confirmación
    if (paymentStatus === 'paid' && pass.customer_id) {
      try {
        // Obtener datos del customer
        const { data: customer } = await supabase
          .from('customers')
          .select('email, first_name, last_name, phone')
          .eq('id', pass.customer_id)
          .single()

        // Obtener datos del pass_type
        const { data: passType } = await supabase
          .from('parking_pass_types')
          .select('name, description, duration_days, includes_car_wash, includes_valet, max_entries_per_day')
          .eq('id', pass.pass_type_id)
          .single()

        // Obtener vehículos vinculados al pase
        const { data: passVehicles } = await supabase
          .from('parking_pass_vehicles')
          .select('parking_vehicles(plate, brand, model, color, vehicle_type)')
          .eq('pass_id', pass.id)

        // Obtener nombre de la organización
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', pass.organization_id)
          .single()

        const vehicles = (passVehicles || []).map((pv: any) => pv.parking_vehicles).filter(Boolean)

        if (customer?.email) {
          await sendParkingPassConfirmationEmail({
            customerEmail: customer.email,
            customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Cliente',
            organizationName: org?.name || '',
            planName: passType?.name || pass.plan_name || 'Pase',
            planDescription: passType?.description || '',
            startDate: pass.start_date,
            endDate: pass.end_date,
            price: Number(pass.price || 0),
            currency: paymentDetails.currency,
            includesCarWash: passType?.includes_car_wash || false,
            includesValet: passType?.includes_valet || false,
            maxEntriesPerDay: passType?.max_entries_per_day,
            vehicles,
            passReference: reference,
          })
        }
      } catch (emailErr) {
        console.error('[ParkingPassPayment] Error enviando email:', emailErr)
      }
    }

    console.log(
      `[ParkingPassPayment] Procesado: pass=${reference} status=${newStatus} payment=${paymentStatus}`
    )

    return {
      handled: true,
      passId: pass.id,
      passReference: reference,
      status: newStatus,
    }
  } catch (error) {
    console.error('[ParkingPassPayment] Error inesperado:', error)
    return { handled: true, error: 'Error interno procesando pago de pase' }
  }
}
