/**
 * Handler compartido para procesar pagos de boletos de transporte desde webhooks.
 *
 * Cuando un webhook recibe una referencia con prefijo "TKT-", este handler:
 * 1. Busca el trip_ticket por ticket_number
 * 2. Actualiza ticket.status y ticket.payment_status según el resultado del pago
 * 3. Inserta un registro en payments (source: 'trip_ticket')
 * 4. Si falla el pago: libera asientos (trip_seats → available, trips.available_seats++)
 * 5. Si es exitoso: envía email de confirmación con QR y datos del viaje
 *
 * Retorna null si la referencia NO es de ticket (para que el webhook
 * continúe con su flujo normal de web_orders).
 */

import { sendTicketConfirmationEmail } from '@/lib/email/send-ticket-confirmation'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'

/**
 * Detecta si una referencia de pago corresponde a un ticket de transporte.
 */
export function isTicketReference(reference: string): boolean {
  return reference?.startsWith('TKT-') ?? false
}

interface PaymentResult {
  handled: boolean
  ticketId?: string
  ticketNumber?: string
  status?: string
  error?: string
}

/**
 * Procesa un pago de ticket de transporte desde un webhook.
 */
export async function handleTicketPayment(
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
  if (!isTicketReference(reference)) {
    return { handled: false }
  }

  try {
    // 1. Buscar ticket por ticket_number
    const { data: ticket, error: searchError } = await supabase
      .from('trip_tickets')
      .select('id, organization_id, trip_id, ticket_number, passenger_name, passenger_email, seat_number, fare, total, currency, status, payment_status, qr_code, checkin_code, boarding_stop_id, alighting_stop_id')
      .eq('ticket_number', reference)
      .single()

    if (searchError || !ticket) {
      console.error(`[TicketPayment] Ticket no encontrado: ${reference}`, searchError)
      return { handled: true, error: 'Ticket no encontrado' }
    }

    // 2. Determinar nuevo status del ticket
    let newStatus = ticket.status
    let newPaymentStatus = ticket.payment_status
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (paymentStatus === 'paid') {
      newStatus = 'confirmed'
      newPaymentStatus = 'paid'
      updateData.status = 'confirmed'
      updateData.payment_status = 'paid'
      updateData.metadata = {
        ...(ticket.metadata || {}),
        payment_confirmed_at: new Date().toISOString(),
        payment_transaction_id: paymentDetails.transactionId,
        payment_gateway: paymentDetails.gateway,
      }
    } else if (paymentStatus === 'failed') {
      newStatus = 'cancelled'
      newPaymentStatus = 'failed'
      updateData.status = 'cancelled'
      updateData.payment_status = 'failed'
      updateData.metadata = {
        ...(ticket.metadata || {}),
        payment_failed_at: new Date().toISOString(),
        cancellation_reason: `Pago rechazado por ${paymentDetails.gateway}`,
      }
    } else if (paymentStatus === 'refunded') {
      newStatus = 'refunded'
      newPaymentStatus = 'refunded'
      updateData.status = 'refunded'
      updateData.payment_status = 'refunded'
      updateData.metadata = {
        ...(ticket.metadata || {}),
        refunded_at: new Date().toISOString(),
      }
    }

    // 3. Actualizar ticket
    const { error: updateError } = await supabase
      .from('trip_tickets')
      .update(updateData)
      .eq('id', ticket.id)

    if (updateError) {
      console.error('[TicketPayment] Error actualizando ticket:', updateError)
    }

    // 4. Insertar payment
    await supabase.from('payments').insert({
      organization_id: ticket.organization_id,
      source: 'trip_ticket',
      source_id: String(ticket.id),
      method: mapToPaymentMethodCode(paymentDetails.method, 'wompi'),
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      reference: paymentDetails.transactionId,
      processor_response: paymentDetails.processorResponse,
      status: paymentStatus,
    })

    // 5. Si falla el pago: liberar asientos
    if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
      try {
        // Buscar trip_seat con este ticket_id
        const { data: seatData } = await (supabase as any)
          .from('trip_seats')
          .select('id')
          .eq('ticket_id', ticket.id)
          .eq('trip_id', ticket.trip_id)

        if (seatData && seatData.length > 0) {
          const seatIds = seatData.map((s: any) => s.id)

          // Liberar asientos
          await (supabase as any)
            .from('trip_seats')
            .update({
              status: 'available',
              ticket_id: null,
              reserved_until: null,
            })
            .in('id', seatIds)

          // Incrementar available_seats en trip
          const { data: trip } = await supabase
            .from('trips')
            .select('available_seats')
            .eq('id', ticket.trip_id)
            .single()

          if (trip) {
            await (supabase as any)
              .from('trips')
              .update({
                available_seats: (trip.available_seats || 0) + seatIds.length,
              })
              .eq('id', ticket.trip_id)
          }

          console.log(`[TicketPayment] ${seatIds.length} asientos liberados para trip ${ticket.trip_id}`)
        }
      } catch (seatErr) {
        console.error('[TicketPayment] Error liberando asientos:', seatErr)
      }
    }

    // 6. Si pago exitoso: enviar email de confirmación
    if (paymentStatus === 'paid' && ticket.passenger_email) {
      try {
        // Obtener datos del viaje para el email
        const { data: tripData } = await supabase
          .from('trips')
          .select(`
            trip_code, trip_date, scheduled_departure,
            transport_routes ( name ),
            organizations ( name )
          `)
          .eq('id', ticket.trip_id)
          .single()

        // Obtener ciudades de paradas de boarding/alighting
        let originCity = ''
        let destinationCity = ''

        if (ticket.boarding_stop_id) {
          const { data: stop } = await supabase
            .from('transport_stops')
            .select('city')
            .eq('id', ticket.boarding_stop_id)
            .single()
          originCity = stop?.city || ''
        }

        if (ticket.alighting_stop_id) {
          const { data: stop } = await supabase
            .from('transport_stops')
            .select('city')
            .eq('id', ticket.alighting_stop_id)
            .single()
          destinationCity = stop?.city || ''
        }

        // Si no hay boarding/alighting stops, usar origen/destino de la ruta
        if (!originCity || !destinationCity) {
          const { data: route } = await supabase
            .from('transport_routes')
            .select(`
              origin:transport_stops!origin_stop_id ( city ),
              destination:transport_stops!destination_stop_id ( city )
            `)
            .eq('id', tripData?.route_id)
            .single()

          if (!originCity) originCity = (route as any)?.origin?.city || 'Origen'
          if (!destinationCity) destinationCity = (route as any)?.destination?.city || 'Destino'
        }

        const departureTime = tripData?.scheduled_departure
          ? new Date(tripData.scheduled_departure).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
          : ''

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''

        await sendTicketConfirmationEmail({
          ticketNumber: ticket.ticket_number,
          passengerEmail: ticket.passenger_email,
          passengerName: ticket.passenger_name || 'Pasajero',
          tripCode: tripData?.trip_code || '',
          routeName: tripData?.transport_routes?.name || '',
          originCity,
          destinationCity,
          tripDate: tripData?.trip_date || '',
          departureTime,
          seatNumber: ticket.seat_number,
          fare: Number(ticket.total || ticket.fare || 0),
          currency: ticket.currency || 'COP',
          qrCode: ticket.qr_code || '',
          checkinCode: ticket.checkin_code || '',
          organizationName: tripData?.organizations?.name || '',
          ticketUrl: `${baseUrl}/ticket/${ticket.ticket_number}`,
        })
      } catch (emailErr) {
        console.error('[TicketPayment] Error enviando email:', emailErr)
      }
    }

    console.log(
      `[TicketPayment] Procesado: ticket=${ticket.ticket_number} status=${newStatus} payment=${newPaymentStatus}`
    )

    return {
      handled: true,
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      status: newStatus,
    }
  } catch (error) {
    console.error('[TicketPayment] Error inesperado:', error)
    return { handled: true, error: 'Error interno procesando pago de ticket' }
  }
}
