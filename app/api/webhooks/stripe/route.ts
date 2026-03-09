import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { isReservationReference, handleReservationPayment } from '@/lib/reservations/payment-handler'
import { isMembershipReference, handleMembershipPayment } from '@/lib/memberships/payment-handler'
import { isTicketReference, handleTicketPayment } from '@/lib/transport/payment-handler'
import { isParkingPassReference, handleParkingPassPayment } from '@/lib/parking/payment-handler'
import { isInvoiceReference, handleInvoicePayment } from '@/lib/services/payment-handler'
import { uploadGoogleAdsConversion } from '@/lib/google-ads/upload-conversion'
import { sendMetaCAPIEvent } from '@/lib/meta/send-capi-event'

export const dynamic = 'force-dynamic'

// Connector ID de Stripe Payments en integration_connectors
const STRIPE_CONNECTOR_ID = 'a2b84a76-9557-4fee-88ba-8ee517ed8b88'

// Propósitos de credenciales en integration_credentials
const CREDENTIAL_PURPOSES = {
  SECRET_KEY: 'secret_key',
  WEBHOOK_SECRET: 'webhook_secret',
} as const

// Eventos de Stripe que procesamos para web_orders
const PAYMENT_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'checkout.session.completed',
] as const

/**
 * Mapea el evento/status de Stripe al payment_status de web_orders
 */
function mapStripeStatus(eventType: string, objectStatus?: string): string {
  switch (eventType) {
    case 'payment_intent.succeeded':
    case 'checkout.session.completed':
      return 'paid'
    case 'payment_intent.payment_failed':
      return 'failed'
    case 'payment_intent.canceled':
      return 'failed'
    case 'charge.refunded':
      return 'refunded'
    default:
      return objectStatus === 'succeeded' ? 'paid' : 'pending'
  }
}

/**
 * Verifica la firma HMAC-SHA256 del webhook de Stripe.
 * Header stripe-signature: "t=timestamp,v1=hash"
 * Payload para HMAC: "{timestamp}.{rawBody}"
 * Ref: https://docs.stripe.com/webhooks/signatures#verify-manually
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const elements = signatureHeader.split(',')
    const tElement = elements.find((e) => e.startsWith('t='))
    const v1Element = elements.find((e) => e.startsWith('v1='))

    if (!tElement || !v1Element) return false

    const timestamp = tElement.substring(2)
    const expectedSig = v1Element.substring(3)

    // Verificar tolerancia de tiempo (5 minutos)
    const timestampSeconds = parseInt(timestamp, 10)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestampSeconds) > 300) {
      console.warn('[Stripe Webhook] Timestamp fuera de tolerancia (>5min)')
      return false
    }

    // HMAC-SHA256("{timestamp}.{rawBody}", webhookSecret)
    const payload = `${timestamp}.${rawBody}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(webhookSecret)
    const messageData = encoder.encode(payload)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const calculated = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return calculated === expectedSig
  } catch (error) {
    console.error('[Stripe Webhook] Error validating signature:', error)
    return false
  }
}

/**
 * Obtiene las credenciales de Stripe para una conexión.
 * Retorna { secretKey, webhookSecret }
 */
async function getStripeCredentials(
  supabase: any,
  connectionId: string
): Promise<{ secretKey: string; webhookSecret: string } | null> {
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  let secretKey = ''
  let webhookSecret = ''

  for (const cred of credentials) {
    if (cred.purpose === CREDENTIAL_PURPOSES.SECRET_KEY) {
      secretKey = cred.secret_ref || ''
    } else if (cred.purpose === CREDENTIAL_PURPOSES.WEBHOOK_SECRET) {
      webhookSecret = cred.secret_ref || ''
    }
  }

  if (!webhookSecret) return null
  return { secretKey, webhookSecret }
}

/**
 * Extrae el order_number del objeto de Stripe.
 * Puede estar en metadata.order_number o client_reference_id (Checkout Sessions).
 */
function extractOrderReference(eventType: string, dataObject: Record<string, any>): string | null {
  // 1. metadata.order_number (Payment Intents)
  if (dataObject.metadata?.order_number) {
    return dataObject.metadata.order_number
  }

  // 2. client_reference_id (Checkout Sessions)
  if (dataObject.client_reference_id) {
    return dataObject.client_reference_id
  }

  // 3. Para charge.refunded, buscar en payment_intent metadata
  if (dataObject.payment_intent && typeof dataObject.payment_intent === 'object') {
    return dataObject.payment_intent.metadata?.order_number || null
  }

  // 4. description puede contener la referencia
  if (dataObject.description) {
    const match = dataObject.description.match(/WO-\d+-\d+-\w+/)
    if (match) return match[0]
  }

  return null
}

/**
 * POST /api/webhooks/stripe
 *
 * Recibe webhooks de Stripe.
 * Flujo:
 *  1. Lee raw body + header stripe-signature
 *  2. Itera conexiones activas de Stripe para verificar firma HMAC-SHA256
 *  3. Parsea evento y filtra solo eventos de pago relevantes
 *  4. Extrae order_number del metadata/client_reference_id
 *  5. Actualiza web_order, crea payment, registra integration_event
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    // Stripe requiere el body RAW para verificar la firma
    const rawBody = await request.text()
    const signatureHeader = request.headers.get('stripe-signature') || ''

    if (!signatureHeader) {
      return NextResponse.json(
        { error: 'No stripe-signature header' },
        { status: 400 }
      )
    }

    // Parsear el body como JSON
    let event: Record<string, any>
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const eventType = event.type || ''
    const eventId = event.id || ''
    const dataObject = event.data?.object || {}

    console.log(
      `[Stripe Webhook] type=${eventType} id=${eventId}`
    )

    // 1. Buscar todas las conexiones activas de Stripe
    const { data: connections } = await (supabase as any)
      .from('integration_connections')
      .select('id, organization_id, settings')
      .eq('connector_id', STRIPE_CONNECTOR_ID)
      .eq('status', 'active')

    if (!connections || connections.length === 0) {
      console.warn('[Stripe Webhook] No hay conexiones activas de Stripe')
      return NextResponse.json({ received: true, processed: false })
    }

    // 2. Verificar firma iterando conexiones
    let matchedConnection: any = null
    let verified = false

    for (const conn of connections) {
      const creds = await getStripeCredentials(supabase, conn.id)
      if (!creds) continue

      const isValid = await verifyStripeSignature(rawBody, signatureHeader, creds.webhookSecret)
      if (isValid) {
        matchedConnection = conn
        verified = true
        break
      }
    }

    if (!matchedConnection) {
      console.warn('[Stripe Webhook] Firma no verificada para evento:', eventId)

      // Registrar evento rechazado
      await (supabase as any).from('integration_events').insert({
        connection_id: null,
        source: 'stripe',
        direction: 'inbound',
        event_type: eventType,
        external_event_id: eventId,
        payload: { type: eventType, id: eventId },
        status: 'rejected',
        error_message: 'Firma de webhook inválida',
        event_time: new Date().toISOString(),
      })

      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      )
    }

    const organizationId = matchedConnection.organization_id

    // 3. Solo procesar eventos de pago relevantes para web_orders
    const isPaymentEvent = (PAYMENT_EVENTS as readonly string[]).includes(eventType)

    if (!isPaymentEvent) {
      // Registrar evento pero no procesar orden
      await (supabase as any).from('integration_events').insert({
        connection_id: matchedConnection.id,
        organization_id: organizationId,
        source: 'stripe',
        direction: 'inbound',
        event_type: eventType,
        external_event_id: eventId,
        payload: { type: eventType, id: eventId, object_id: dataObject.id },
        status: 'processed',
        processed_at: new Date().toISOString(),
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, type: eventType, skipped: true })
    }

    // 4. Extraer referencia de orden
    const reference = extractOrderReference(eventType, dataObject)

    if (!reference) {
      console.warn('[Stripe Webhook] Evento sin order_number en metadata:', eventType, dataObject.id)

      // Registrar evento sin orden vinculada
      await (supabase as any).from('integration_events').insert({
        connection_id: matchedConnection.id,
        organization_id: organizationId,
        source: 'stripe',
        direction: 'inbound',
        event_type: eventType,
        external_event_id: eventId,
        payload: { type: eventType, id: eventId, object_id: dataObject.id, verified },
        status: 'processed',
        processed_at: new Date().toISOString(),
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, processed: true, no_order: true })
    }

    // 5. Mapear estado y calcular monto (necesario para ambos flujos)
    const paymentStatus = mapStripeStatus(eventType, dataObject.status)
    const amountCents = dataObject.amount || dataObject.amount_total || dataObject.amount_received || 0
    const currency = (dataObject.currency || 'usd').toUpperCase()
    const amountDecimal = amountCents / 100
    const paymentMethodType =
      dataObject.payment_method_types?.[0] ||
      dataObject.payment_method_id ||
      'card'
    const stripeObjectId = dataObject.id || ''

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId: stripeObjectId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: dataObject,
        gateway: 'stripe',
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
      const result = await handleMembershipPayment(supabase, reference, paymentStatus, {
        transactionId: stripeObjectId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: dataObject,
        gateway: 'stripe',
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
      const result = await handleTicketPayment(supabase, reference, paymentStatus, {
        transactionId: stripeObjectId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: dataObject,
        gateway: 'stripe',
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
      const result = await handleParkingPassPayment(supabase, reference, paymentStatus, {
        transactionId: stripeObjectId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: dataObject,
        gateway: 'stripe',
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
      const result = await handleInvoicePayment(supabase, reference, paymentStatus, {
        transactionId: stripeObjectId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        gateway: 'stripe',
      })

      return NextResponse.json({
        received: true,
        source: 'invoice',
        invoiceId: result.invoiceId,
        payment_status: paymentStatus,
      })
    }

    // ── Flujo normal: buscar web_order ──
    const { data: webOrder, error: orderError } = await (supabase as any)
      .from('web_orders')
      .select('id, organization_id, branch_id, customer_id, total, payment_status')
      .eq('order_number', reference)
      .limit(1)
      .single()

    if (orderError || !webOrder) {
      console.error('[Stripe Webhook] Orden no encontrada:', reference, orderError)
      return NextResponse.json(
        { error: 'Orden no encontrada', reference },
        { status: 404 }
      )
    }

    console.log(
      `[Stripe Webhook] ref=${reference} event=${eventType} status=${paymentStatus} amount=${amountDecimal} ${currency}`
    )

    // 9. Actualizar web_order
    const { error: updateError } = await (supabase as any)
      .from('web_orders')
      .update({
        payment_status: paymentStatus,
        payment_method: paymentMethodType,
        payment_reference: stripeObjectId,
        updated_at: new Date().toISOString(),
        ...(paymentStatus === 'paid' && {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }),
        ...(paymentStatus === 'failed' && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Pago rechazado por Stripe: ${eventType} (${dataObject.last_payment_error?.message || dataObject.failure_message || ''})`.trim(),
        }),
      })
      .eq('id', webOrder.id)

    if (updateError) {
      console.error('[Stripe Webhook] Error actualizando orden:', updateError)
    }

    // 10. Crear registro en payments
    await (supabase as any).from('payments').insert({
      organization_id: organizationId,
      branch_id: webOrder.branch_id,
      source: 'web_order',
      source_id: String(webOrder.id),
      method: paymentMethodType,
      amount: amountDecimal || webOrder.total,
      currency: currency || 'USD',
      reference: stripeObjectId,
      processor_response: {
        event_type: eventType,
        object_id: dataObject.id,
        status: dataObject.status,
        livemode: event.livemode,
      },
      status: paymentStatus,
    })

    // 11. Registrar evento en integration_events
    await (supabase as any).from('integration_events').insert({
      connection_id: matchedConnection.id,
      organization_id: organizationId,
      source: 'stripe',
      direction: 'inbound',
      event_type: eventType,
      external_event_id: eventId,
      payload: {
        type: eventType,
        id: eventId,
        object_id: dataObject.id,
        status: dataObject.status,
        amount: amountCents,
        currency,
        livemode: event.livemode,
        verified,
      },
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    })

    // 12. Actualizar last_received_at en integration_webhooks
    await (supabase as any)
      .from('integration_webhooks')
      .update({ last_received_at: new Date().toISOString() })
      .eq('connection_id', matchedConnection.id)
      .eq('direction', 'inbound')

    // Google Ads — subir conversión offline si pago exitoso
    if (paymentStatus === 'paid') {
      uploadGoogleAdsConversion(supabase, organizationId, {
        orderId: reference,
        value: amountDecimal || webOrder.total,
        currency: currency || 'USD',
        category: 'purchase',
      }).catch(err => console.error('[Stripe Webhook] Google Ads upload error:', err))

      // Meta CAPI — Purchase event server-side
      sendMetaCAPIEvent(supabase, organizationId, {
        eventName: 'Purchase',
        eventId: reference,
        value: amountDecimal || webOrder.total,
        currency: currency || 'USD',
      }).catch(err => console.error('[Stripe Webhook] Meta CAPI error:', err))
    }

    console.log(
      `[Stripe Webhook] Procesado OK: order=${reference} status=${paymentStatus}`
    )

    return NextResponse.json({
      received: true,
      verified,
      order: reference,
      payment_status: paymentStatus,
    })
  } catch (error) {
    console.error('[Stripe Webhook] Error inesperado:', error)
    // Retornar 200 para evitar reintentos excesivos
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}

/**
 * GET /api/webhooks/stripe
 * Health check — para verificar que el endpoint existe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'stripe_webhook',
    timestamp: new Date().toISOString(),
  })
}
