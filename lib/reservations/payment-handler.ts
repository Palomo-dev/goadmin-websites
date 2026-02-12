/**
 * Handler compartido para procesar pagos de reservaciones desde webhooks.
 *
 * Cuando un webhook recibe una referencia con prefijo "RES-", este handler:
 * 1. Busca la reservación por el prefijo del UUID
 * 2. Actualiza reservation.status según el resultado del pago
 * 3. Inserta un registro en payments (source: 'reservation')
 * 4. Actualiza el balance del folio
 * 5. Envía email de confirmación si el pago fue exitoso
 *
 * Retorna null si la referencia NO es de reservación (para que el webhook
 * continúe con su flujo normal de web_orders).
 */

import { sendReservationConfirmationEmail } from '@/lib/email/send-reservation-confirmation'

/**
 * Detecta si una referencia de pago corresponde a una reservación.
 */
export function isReservationReference(reference: string): boolean {
  return reference?.startsWith('RES-') ?? false
}

/**
 * Extrae el prefijo de UUID de la referencia RES-XXXXXXXX
 */
function extractUuidPrefix(reference: string): string {
  return reference.replace('RES-', '').toLowerCase()
}

interface PaymentResult {
  handled: boolean
  reservationId?: string
  status?: string
  error?: string
}

/**
 * Procesa un pago de reservación desde un webhook.
 *
 * @param supabase - Cliente de Supabase con permisos admin
 * @param reference - Referencia de la transacción (ej: "RES-A1B2C3D4")
 * @param paymentStatus - Estado mapeado del pago: 'paid', 'failed', 'refunded', 'pending'
 * @param paymentDetails - Detalles del pago para registrar
 */
export async function handleReservationPayment(
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
  if (!isReservationReference(reference)) {
    return { handled: false }
  }

  const uuidPrefix = extractUuidPrefix(reference)

  try {
    // 1. Buscar reservación por prefijo de UUID
    const { data: reservations, error: searchError } = await supabase
      .from('reservations')
      .select('id, organization_id, branch_id, customer_id, total_estimated, status, metadata')
      .ilike('id', `${uuidPrefix}%`)
      .limit(1)

    if (searchError || !reservations || reservations.length === 0) {
      console.error(`[ReservationPayment] Reservación no encontrada: ${reference}`, searchError)
      return { handled: true, error: 'Reservación no encontrada' }
    }

    const reservation = reservations[0]

    // 2. Determinar nuevo status de la reservación
    let newStatus = reservation.status
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (paymentStatus === 'paid') {
      newStatus = 'confirmed'
      updateData.status = 'confirmed'
      updateData.metadata = {
        ...(reservation.metadata || {}),
        payment_confirmed_at: new Date().toISOString(),
        payment_transaction_id: paymentDetails.transactionId,
        payment_gateway: paymentDetails.gateway,
      }
    } else if (paymentStatus === 'failed') {
      newStatus = 'cancelled'
      updateData.status = 'cancelled'
      updateData.metadata = {
        ...(reservation.metadata || {}),
        payment_failed_at: new Date().toISOString(),
        cancellation_reason: `Pago rechazado por ${paymentDetails.gateway}`,
      }
    } else if (paymentStatus === 'refunded') {
      newStatus = 'cancelled'
      updateData.status = 'cancelled'
      updateData.metadata = {
        ...(reservation.metadata || {}),
        refunded_at: new Date().toISOString(),
      }
    }

    // 3. Actualizar reservación
    const { error: updateError } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservation.id)

    if (updateError) {
      console.error('[ReservationPayment] Error actualizando reservación:', updateError)
    }

    // 4. Insertar payment
    await supabase.from('payments').insert({
      organization_id: reservation.organization_id,
      branch_id: reservation.branch_id,
      source: 'reservation',
      source_id: String(reservation.id),
      method: paymentDetails.method,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      reference: paymentDetails.transactionId,
      processor_response: paymentDetails.processorResponse,
      status: paymentStatus,
    })

    // 5. Actualizar folio si el pago fue exitoso
    if (paymentStatus === 'paid') {
      const { data: folio } = await supabase
        .from('folios')
        .select('id, balance')
        .eq('reservation_id', reservation.id)
        .eq('status', 'open')
        .limit(1)
        .single()

      if (folio) {
        const newBalance = Math.max(0, Number(folio.balance) - paymentDetails.amount)
        await supabase
          .from('folios')
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', folio.id)
      }
    }

    // 6. Asignar habitación(es) automáticamente si el pago fue exitoso
    if (paymentStatus === 'paid') {
      try {
        const { data: resForAssign } = await supabase
          .from('reservations')
          .select('space_type_id, space_id, checkin, checkout, metadata')
          .eq('id', reservation.id)
          .single()

        const meta = resForAssign?.metadata as any
        const isMultiRoom = meta?.is_multi_room && Array.isArray(meta?.rooms)

        // Si ya tiene space_id asignado (reserva directa por espacio), solo marcar como reserved
        if (resForAssign?.space_id && !isMultiRoom) {
          await supabase.from('spaces').update({ status: 'reserved', updated_at: new Date().toISOString() }).eq('id', resForAssign.space_id)
          console.log(`[ReservationPayment] Espacio ${resForAssign.space_id} ya asignado, marcado como reserved`)
        } else if (isMultiRoom) {
          // Multi-room: asignar N spaces por cada room type vía reservation_spaces
          for (const room of meta.rooms) {
            const { spaceTypeId: roomTypeId, quantity } = room
            if (!roomTypeId || !quantity) continue

            const { data: availableSpaces } = await supabase
              .from('spaces')
              .select('id')
              .eq('space_type_id', roomTypeId)
              .eq('status', 'available')
              .limit(quantity)

            if (availableSpaces) {
              for (const space of availableSpaces) {
                await supabase.from('reservation_spaces').insert({
                  reservation_id: reservation.id,
                  space_id: space.id,
                  checkin: resForAssign?.checkin,
                  checkout: resForAssign?.checkout,
                })
                await supabase.from('spaces').update({ status: 'reserved', updated_at: new Date().toISOString() }).eq('id', space.id)
              }
              console.log(`[ReservationPayment] ${availableSpaces.length}/${quantity} habitaciones tipo ${roomTypeId} asignadas a ${reservation.id}`)
            }
          }
          // Asignar el primer space como space_id principal en la reservación
          const { data: firstAssigned } = await supabase
            .from('reservation_spaces')
            .select('space_id')
            .eq('reservation_id', reservation.id)
            .limit(1)
            .single()
          if (firstAssigned) {
            await supabase.from('reservations').update({ space_id: firstAssigned.space_id, updated_at: new Date().toISOString() }).eq('id', reservation.id)
          }
        } else if (resForAssign?.space_type_id && !resForAssign.space_id) {
          // Single-room: flujo original
          const { data: availableSpace } = await supabase
            .from('spaces')
            .select('id')
            .eq('space_type_id', resForAssign.space_type_id)
            .eq('status', 'available')
            .limit(1)
            .single()

          if (availableSpace) {
            await supabase.from('reservations').update({ space_id: availableSpace.id, updated_at: new Date().toISOString() }).eq('id', reservation.id)
            await supabase.from('spaces').update({ status: 'reserved', updated_at: new Date().toISOString() }).eq('id', availableSpace.id)
            console.log(`[ReservationPayment] Habitación ${availableSpace.id} asignada a reservación ${reservation.id}`)
          } else {
            console.warn(`[ReservationPayment] No hay habitaciones disponibles para asignar a ${reservation.id}`)
          }
        }
      } catch (assignErr) {
        console.error('[ReservationPayment] Error asignando habitación:', assignErr)
      }
    }

    // 7. Enviar email de confirmación si el pago fue exitoso
    if (paymentStatus === 'paid') {
      try {
        const { data: fullRes } = await supabase
          .from('reservations')
          .select('checkin, checkout, occupant_count, space_type_id, customers(first_name, last_name, email), organizations(name)')
          .eq('id', reservation.id)
          .single()

        if (fullRes?.customers?.email) {
          const spaceTypeName = await (async () => {
            if (!fullRes.space_type_id) return 'Habitación'
            const { data: st } = await supabase
              .from('space_types').select('name').eq('id', fullRes.space_type_id).single()
            return st?.name || 'Habitación'
          })()

          const { data: folioForEmail } = await supabase
            .from('folios')
            .select('total, folio_items(description, amount)')
            .eq('reservation_id', reservation.id)
            .limit(1)
            .single()

          const nights = Math.ceil(
            (new Date(fullRes.checkout).getTime() - new Date(fullRes.checkin).getTime()) / (1000 * 60 * 60 * 24)
          )

          await sendReservationConfirmationEmail({
            reservationId: reservation.id,
            customerEmail: fullRes.customers.email,
            customerName: `${fullRes.customers.first_name || ''} ${fullRes.customers.last_name || ''}`.trim() || 'Huésped',
            spaceTypeName,
            checkin: fullRes.checkin,
            checkout: fullRes.checkout,
            nights,
            guests: fullRes.occupant_count || 1,
            folioItems: folioForEmail?.folio_items || [],
            total: Number(folioForEmail?.total || reservation.total_estimated || 0),
            organizationName: fullRes.organizations?.name || '',
            trackingUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/reserva/${reservation.id}`,
          })
        }
      } catch (emailErr) {
        console.error('[ReservationPayment] Error enviando email:', emailErr)
      }
    }

    console.log(
      `[ReservationPayment] Procesado: reservation=${reservation.id} status=${newStatus} payment=${paymentStatus}`
    )

    return {
      handled: true,
      reservationId: reservation.id,
      status: newStatus,
    }
  } catch (error) {
    console.error('[ReservationPayment] Error inesperado:', error)
    return { handled: true, error: 'Error interno procesando pago de reservación' }
  }
}
