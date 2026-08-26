import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { isReservationReference, handleReservationPayment } from '@/lib/reservations/payment-handler'
import { isMembershipReference, handleMembershipPayment } from '@/lib/memberships/payment-handler'
import { isTicketReference, handleTicketPayment } from '@/lib/transport/payment-handler'
import { isParkingPassReference, handleParkingPassPayment } from '@/lib/parking/payment-handler'
import { isInvoiceReference, handleInvoicePayment } from '@/lib/services/payment-handler'
import { uploadGoogleAdsConversion } from '@/lib/google-ads/upload-conversion'
import { sendMetaCAPIEvent } from '@/lib/meta/send-capi-event'
import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'

export const dynamic = 'force-dynamic'

// Connector ID de Wompi Colombia en integration_connectors
const WOMPI_CONNECTOR_ID = '39950173-5f7c-48a9-a242-c6fdf5a07aee'

/**
 * Mapea el status de Wompi al payment_status de web_orders
 */
function mapWompiStatus(wompiStatus: string): string {
  const map: Record<string, string> = {
    APPROVED: 'paid',
    DECLINED: 'failed',
    VOIDED: 'refunded',
    ERROR: 'failed',
    PENDING: 'pending',
  }
  return map[wompiStatus] || 'pending'
}

/**
 * Valida la firma del webhook de Wompi.
 * checksum = SHA256(concat(property_values) + timestamp + events_secret)
 */
async function validateSignature(
  transaction: Record<string, any>,
  signature: { properties: string[]; checksum: string },
  timestamp: number,
  eventsSecret: string
): Promise<boolean> {
  try {
    // Concatenar los valores de las propiedades listadas
    const values = signature.properties.map((prop) => {
      // Las propiedades vienen como "transaction.id", "transaction.status", etc.
      const key = prop.replace('transaction.', '')
      return String(transaction[key] ?? '')
    })

    const payload = values.join('') + String(timestamp) + eventsSecret

    // SHA256 hash
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return hashHex === signature.checksum
  } catch (error) {
    console.error('[Wompi Webhook] Error validating signature:', error)
    return false
  }
}

/**
 * Obtiene el events_secret de Wompi para una organización.
 * Busca en integration_credentials vía integration_connections.
 */
async function getEventsSecret(
  supabase: any,
  organizationId: number
): Promise<string | null> {
  // 1. Buscar la conexión de Wompi para esta org (active o connected)
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('id, settings')
    .eq('organization_id', organizationId)
    .eq('connector_id', WOMPI_CONNECTOR_ID)
    .in('status', ['active', 'connected'])
    .limit(1)
    .single()

  if (!connection) return null

  // 2. Buscar la credencial de tipo events_secret
  const { data: credential } = await supabase
    .from('integration_credentials')
    .select('secret_ref')
    .eq('connection_id', connection.id)
    .eq('credential_type', 'events_secret')
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!credential?.secret_ref) {
    // Fallback: intentar leer de settings de la conexión
    return connection.settings?.events_secret || null
  }

  // 3. Intentar leer del Vault de Supabase
  try {
    const { data: secret } = await supabase
      .rpc('get_decrypted_secret', { secret_name: credential.secret_ref })
    if (secret) return secret
  } catch {
    // Vault no disponible o función no existe — usar secret_ref directamente
  }

  return credential.secret_ref
}

/**
 * POST /api/webhooks/wompi_co
 *
 * Recibe notificaciones de eventos de transacciones de Wompi Colombia.
 * Actualiza el estado de pago de web_orders y registra el pago en payments.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()
    const { event, data, timestamp, signature, environment } = body

    // Solo procesar eventos de transacción
    if (event !== 'transaction.updated') {
      return NextResponse.json({ received: true, skipped: true })
    }

    const transaction = data?.transaction
    if (!transaction) {
      return NextResponse.json(
        { error: 'Payload inválido: falta transaction' },
        { status: 400 }
      )
    }

    const {
      id: transactionId,
      reference,
      status: wompiStatus,
      amount_in_cents: amountInCents,
      currency,
      payment_method_type: paymentMethodType,
    } = transaction

    console.log(
      `[Wompi Webhook] event=${event} ref=${reference} status=${wompiStatus} amount=${amountInCents} env=${environment}`
    )

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const paymentStatus = mapWompiStatus(wompiStatus)
      const amountDecimal = amountInCents ? amountInCents / 100 : 0

      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethodType?.toLowerCase() || 'card',
        processorResponse: transaction,
        gateway: 'wompi_co',
      })

      return NextResponse.json({
        received: true,
        source: 'reservation',
        reservationId: result.reservationId,
        payment_status: paymentStatus,
      })
    }

    // ── Verificar si es pago de membresía ──
    if (isMembershipReference(reference)) {
      const paymentStatus = mapWompiStatus(wompiStatus)
      const amountDecimal = amountInCents ? amountInCents / 100 : 0

      const result = await handleMembershipPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethodType?.toLowerCase() || 'card',
        processorResponse: transaction,
        gateway: 'wompi_co',
      })

      return NextResponse.json({
        received: true,
        source: 'membership',
        membershipId: result.membershipId,
        payment_status: paymentStatus,
      })
    }

    // ── Verificar si es pago de ticket de transporte ──
    if (isTicketReference(reference)) {
      const paymentStatus = mapWompiStatus(wompiStatus)
      const amountDecimal = amountInCents ? amountInCents / 100 : 0

      const result = await handleTicketPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethodType?.toLowerCase() || 'card',
        processorResponse: transaction,
        gateway: 'wompi_co',
      })

      return NextResponse.json({
        received: true,
        source: 'trip_ticket',
        ticketId: result.ticketId,
        payment_status: paymentStatus,
      })
    }

    // ── Verificar si es pago de pase de parking ──
    if (isParkingPassReference(reference)) {
      const paymentStatus = mapWompiStatus(wompiStatus)
      const amountDecimal = amountInCents ? amountInCents / 100 : 0

      const result = await handleParkingPassPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethodType?.toLowerCase() || 'card',
        processorResponse: transaction,
        gateway: 'wompi_co',
      })

      return NextResponse.json({
        received: true,
        source: 'parking_pass',
        passId: result.passId,
        payment_status: paymentStatus,
      })
    }

    // ── Verificar si es pago de factura (services) ──
    if (isInvoiceReference(reference)) {
      const paymentStatus = mapWompiStatus(wompiStatus)
      const amountDecimal = amountInCents ? amountInCents / 100 : 0

      const result = await handleInvoicePayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethodType?.toLowerCase() || 'card',
        gateway: 'wompi_co',
      })

      return NextResponse.json({
        received: true,
        source: 'invoice',
        invoiceId: result.invoiceId,
        payment_status: paymentStatus,
      })
    }

    // ── Flujo normal: buscar web_order por referencia ──
    const { data: webOrder, error: orderError } = await (supabase as any)
      .from('web_orders')
      .select('id, organization_id, branch_id, customer_id, total, payment_status')
      .eq('order_number', reference)
      .limit(1)
      .single()

    if (orderError || !webOrder) {
      console.error('[Wompi Webhook] Orden no encontrada:', reference, orderError)
      return NextResponse.json(
        { error: 'Orden no encontrada', reference },
        { status: 404 }
      )
    }

    const organizationId = (webOrder as any).organization_id

    // 2. Validar firma si hay events_secret configurado
    const eventsSecret = await getEventsSecret(supabase, organizationId)

    if (eventsSecret && signature) {
      const isValid = await validateSignature(
        transaction,
        signature,
        timestamp,
        eventsSecret
      )

      if (!isValid) {
        console.error('[Wompi Webhook] Firma inválida para org:', organizationId)

        // Registrar intento con firma inválida
        await supabase.from('integration_events').insert({
          connection_id: null,
          organization_id: organizationId,
          source: 'wompi',
          direction: 'inbound',
          event_type: 'transaction.updated',
          external_event_id: transactionId,
          payload: body,
          status: 'rejected',
          error_message: 'Firma de webhook inválida',
          event_time: new Date().toISOString(),
        } as any)

        return NextResponse.json(
          { error: 'Firma inválida' },
          { status: 401 }
        )
      }
    }

    // 3. Mapear estado de Wompi → payment_status
    const paymentStatus = mapWompiStatus(wompiStatus)

    // 4. Actualizar web_order
    const { error: updateError } = await (supabase as any)
      .from('web_orders')
      .update({
        payment_status: paymentStatus,
        payment_method: paymentMethodType?.toLowerCase() || 'card',
        payment_reference: transactionId,
        updated_at: new Date().toISOString(),
        ...(paymentStatus === 'paid' && {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }),
        ...(paymentStatus === 'failed' && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Pago rechazado por Wompi: ${wompiStatus}`,
        }),
      } as any)
      .eq('id', (webOrder as any).id)

    if (updateError) {
      console.error('[Wompi Webhook] Error actualizando orden:', updateError)
    }

    // 5. Crear registro en payments
    const amountDecimal = amountInCents ? amountInCents / 100 : (webOrder as any).total
    await (supabase as any).from('payments').insert({
      organization_id: organizationId,
      branch_id: (webOrder as any).branch_id,
      source: 'web_order',
      source_id: String((webOrder as any).id),
      method: paymentMethodType?.toLowerCase() || 'card',
      amount: amountDecimal,
      currency: currency || 'COP',
      reference: transactionId,
      processor_response: transaction,
      status: paymentStatus,
    } as any)

    // 6. Registrar evento en integration_events
    // Buscar connection_id para la org
    const { data: conn } = await supabase
      .from('integration_connections')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('connector_id', WOMPI_CONNECTOR_ID)
      .limit(1)
      .single()

    await (supabase as any).from('integration_events').insert({
      connection_id: (conn as any)?.id || null,
      organization_id: organizationId,
      source: 'wompi',
      direction: 'inbound',
      event_type: event,
      external_event_id: transactionId,
      payload: body,
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    } as any)

    // 7. Actualizar last_received_at en integration_webhooks
    if ((conn as any)?.id) {
      await (supabase as any)
        .from('integration_webhooks')
        .update({ last_received_at: new Date().toISOString() })
        .eq('connection_id', (conn as any).id)
        .eq('direction', 'inbound')
    }

    // 8. Google Ads — subir conversión offline si pago exitoso
    if (paymentStatus === 'paid') {
      uploadGoogleAdsConversion(supabase, organizationId, {
        orderId: reference,
        value: amountDecimal,
        currency: currency || 'COP',
        category: 'purchase',
      }).catch(err => console.error('[Wompi Webhook] Google Ads upload error:', err))

      // Meta CAPI — Purchase event server-side
      sendMetaCAPIEvent(supabase, organizationId, {
        eventName: 'Purchase',
        eventId: reference,
        value: amountDecimal,
        currency: currency || 'COP',
      }).catch(err => console.error('[Wompi Webhook] Meta CAPI error:', err))

      // Notificar al ERP para crear venta, factura, cuenta por cobrar, stock y envío
      notifyErpAutoConfirm((webOrder as any).id).catch(err =>
        console.error('[Wompi Webhook] ERP auto-confirm error:', err)
      )
    }

    console.log(
      `[Wompi Webhook] Procesado OK: order=${reference} status=${paymentStatus}`
    )

    return NextResponse.json({
      received: true,
      order: reference,
      payment_status: paymentStatus,
    })
  } catch (error) {
    console.error('[Wompi Webhook] Error inesperado:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/wompi_co
 * Health check — Wompi puede verificar que el endpoint existe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'wompi_co_webhook',
    timestamp: new Date().toISOString(),
  })
}
