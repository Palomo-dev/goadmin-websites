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

// Connector ID de PayPal Checkout en integration_connectors
const PAYPAL_CONNECTOR_ID = '944c6b76-e8bf-49f9-90ea-06f906e152e7'

// Propósitos de credenciales en integration_credentials
const CREDENTIAL_PURPOSES = {
  CLIENT_ID: 'client_id',
  CLIENT_SECRET: 'client_secret',
  WEBHOOK_ID: 'webhook_id',
} as const

// URLs base de PayPal API
const PAYPAL_API_URLS = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
} as const

// Eventos de pago relevantes para web_orders
const PAYMENT_EVENTS = [
  'CHECKOUT.ORDER.COMPLETED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
] as const

/**
 * Mapea el evento/status de PayPal al payment_status de web_orders
 */
function mapPayPalStatus(eventType: string): string {
  switch (eventType) {
    case 'CHECKOUT.ORDER.COMPLETED':
    case 'PAYMENT.CAPTURE.COMPLETED':
      return 'paid'
    case 'PAYMENT.CAPTURE.DENIED':
      return 'failed'
    case 'PAYMENT.CAPTURE.REFUNDED':
      return 'refunded'
    case 'PAYMENT.CAPTURE.REVERSED':
      return 'refunded'
    default:
      return 'pending'
  }
}

/**
 * Obtiene credenciales de PayPal para una conexión.
 * Retorna { clientId, clientSecret, webhookId }
 */
async function getPayPalCredentials(
  supabase: any,
  connectionId: string
): Promise<{ clientId: string; clientSecret: string; webhookId: string } | null> {
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  let clientId = ''
  let clientSecret = ''
  let webhookId = ''

  for (const cred of credentials) {
    if (cred.purpose === CREDENTIAL_PURPOSES.CLIENT_ID) {
      clientId = cred.secret_ref || ''
    } else if (cred.purpose === CREDENTIAL_PURPOSES.CLIENT_SECRET) {
      clientSecret = cred.secret_ref || ''
    } else if (cred.purpose === CREDENTIAL_PURPOSES.WEBHOOK_ID) {
      webhookId = cred.secret_ref || ''
    }
  }

  if (!clientId || !clientSecret || !webhookId) return null
  return { clientId, clientSecret, webhookId }
}

/**
 * Obtiene un access token de PayPal vía OAuth 2.0 Client Credentials.
 */
async function getAccessToken(
  clientId: string,
  clientSecret: string,
  isSandbox: boolean
): Promise<string | null> {
  try {
    const baseUrl = isSandbox ? PAYPAL_API_URLS.sandbox : PAYPAL_API_URLS.production
    const basicAuth = btoa(`${clientId}:${clientSecret}`)

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.access_token || null
  } catch {
    return null
  }
}

/**
 * Verifica la firma del webhook llamando a la API de PayPal.
 * PayPal usa firma basada en certificado, NO HMAC local.
 * Ref: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post
 */
async function verifyWebhookSignature(
  accessToken: string,
  webhookId: string,
  headers: {
    authAlgo: string
    certUrl: string
    transmissionId: string
    transmissionSig: string
    transmissionTime: string
  },
  webhookEvent: Record<string, any>,
  isSandbox: boolean
): Promise<boolean> {
  try {
    const baseUrl = isSandbox ? PAYPAL_API_URLS.sandbox : PAYPAL_API_URLS.production

    const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    })

    if (!response.ok) return false

    const data = await response.json()
    return data.verification_status === 'SUCCESS'
  } catch {
    return false
  }
}

/**
 * Extrae la referencia de orden (order_number) del evento de PayPal.
 * PayPal usa purchase_units[0].reference_id como referencia del comercio.
 */
function extractOrderReference(eventType: string, resource: Record<string, any>): string | null {
  // 1. purchase_units[0].reference_id (Orders)
  const purchaseUnits = resource.purchase_units || []
  if (purchaseUnits.length > 0 && purchaseUnits[0].reference_id) {
    return purchaseUnits[0].reference_id
  }

  // 2. custom_id en purchase_units (alternativa)
  if (purchaseUnits.length > 0 && purchaseUnits[0].custom_id) {
    return purchaseUnits[0].custom_id
  }

  // 3. invoice_id en purchase_units
  if (purchaseUnits.length > 0 && purchaseUnits[0].invoice_id) {
    return purchaseUnits[0].invoice_id
  }

  // 4. Para PAYMENT.CAPTURE.*, el resource es la captura, buscar custom_id
  if (resource.custom_id) {
    return resource.custom_id
  }

  // 5. invoice_id directo en resource
  if (resource.invoice_id) {
    return resource.invoice_id
  }

  // 6. Buscar en supplementary_data.related_ids
  if (resource.supplementary_data?.related_ids?.order_id) {
    // El order_id de PayPal, no es nuestro order_number, pero se puede usar como fallback
    return null
  }

  return null
}

/**
 * POST /api/webhooks/paypal
 *
 * Recibe webhooks de PayPal.
 * Flujo:
 *  1. Lee body JSON + headers de verificación de PayPal
 *  2. Itera conexiones activas de PayPal para verificar firma vía API
 *  3. Filtra solo eventos de pago relevantes
 *  4. Extrae order_number del reference_id/custom_id
 *  5. Actualiza web_order, crea payment, registra integration_event
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()

    // Headers de verificación de PayPal
    const authAlgo = request.headers.get('paypal-auth-algo') || ''
    const certUrl = request.headers.get('paypal-cert-url') || ''
    const transmissionId = request.headers.get('paypal-transmission-id') || ''
    const transmissionSig = request.headers.get('paypal-transmission-sig') || ''
    const transmissionTime = request.headers.get('paypal-transmission-time') || ''

    if (!transmissionId || !transmissionSig) {
      return NextResponse.json(
        { error: 'Missing PayPal verification headers' },
        { status: 400 }
      )
    }

    const eventType = body.event_type || ''
    const eventId = body.id || ''
    const resource = body.resource || {}
    const resourceType = body.resource_type || ''

    console.log(
      `[PayPal Webhook] type=${eventType} id=${eventId} resource_type=${resourceType}`
    )

    // 1. Buscar todas las conexiones activas de PayPal
    const { data: connections } = await (supabase as any)
      .from('integration_connections')
      .select('id, organization_id, environment, settings')
      .eq('connector_id', PAYPAL_CONNECTOR_ID)
      .eq('status', 'active')

    if (!connections || connections.length === 0) {
      console.warn('[PayPal Webhook] No hay conexiones activas de PayPal')
      return NextResponse.json({ received: true, processed: false })
    }

    // 2. Verificar firma iterando conexiones
    let matchedConnection: any = null
    let verified = false

    for (const conn of connections) {
      const creds = await getPayPalCredentials(supabase, conn.id)
      if (!creds) continue

      // Determinar ambiente (sandbox o producción)
      const isSandbox = conn.environment !== 'production'

      // Obtener access token vía OAuth 2.0
      const accessToken = await getAccessToken(creds.clientId, creds.clientSecret, isSandbox)
      if (!accessToken) continue

      // Verificar firma vía API de PayPal
      const isValid = await verifyWebhookSignature(
        accessToken,
        creds.webhookId,
        { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime },
        body,
        isSandbox
      )

      if (isValid) {
        matchedConnection = conn
        verified = true
        break
      }
    }

    if (!matchedConnection) {
      console.warn('[PayPal Webhook] Firma no verificada para evento:', eventId)

      // Registrar evento rechazado
      await (supabase as any).from('integration_events').insert({
        connection_id: null,
        source: 'paypal',
        direction: 'inbound',
        event_type: eventType,
        external_event_id: eventId,
        payload: { type: eventType, id: eventId },
        status: 'rejected',
        error_message: 'Firma de webhook inválida (verificación API PayPal)',
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
        source: 'paypal',
        direction: 'inbound',
        event_type: eventType,
        external_event_id: eventId,
        payload: {
          type: eventType,
          id: eventId,
          resource_type: resourceType,
          resource_id: resource.id,
          summary: body.summary,
        },
        status: 'processed',
        processed_at: new Date().toISOString(),
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, type: eventType, skipped: true })
    }

    // 4. Extraer referencia de orden
    const reference = extractOrderReference(eventType, resource)

    if (!reference) {
      console.warn('[PayPal Webhook] Evento sin reference_id/custom_id:', eventType, resource.id)

      await (supabase as any).from('integration_events').insert({
        connection_id: matchedConnection.id,
        organization_id: organizationId,
        source: 'paypal',
        direction: 'inbound',
        event_type: eventType,
        external_event_id: eventId,
        payload: {
          type: eventType,
          id: eventId,
          resource_id: resource.id,
          verified,
        },
        status: 'processed',
        processed_at: new Date().toISOString(),
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, processed: true, no_order: true })
    }

    // 5. Mapear estado y calcular monto (necesario para ambos flujos)
    const paymentStatus = mapPayPalStatus(eventType)
    const amountValue =
      resource.amount?.value ||
      resource.purchase_units?.[0]?.amount?.value ||
      '0'
    const amountDecimal = parseFloat(amountValue) || 0
    const currency = (
      resource.amount?.currency_code ||
      resource.purchase_units?.[0]?.amount?.currency_code ||
      'USD'
    ).toUpperCase()
    const paymentSource = resource.payment_source || body.resource?.payment_source || {}
    const paymentMethodType = Object.keys(paymentSource)[0] || 'paypal'
    const paypalResourceId = resource.id || ''

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId: paypalResourceId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: resource,
        gateway: 'paypal',
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
        transactionId: paypalResourceId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: resource,
        gateway: 'paypal',
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
        transactionId: paypalResourceId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: resource,
        gateway: 'paypal',
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
        transactionId: paypalResourceId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        processorResponse: resource,
        gateway: 'paypal',
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
        transactionId: paypalResourceId,
        amount: amountDecimal,
        currency,
        method: paymentMethodType,
        gateway: 'paypal',
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
      console.error('[PayPal Webhook] Orden no encontrada:', reference, orderError)
      return NextResponse.json(
        { error: 'Orden no encontrada', reference },
        { status: 404 }
      )
    }

    console.log(
      `[PayPal Webhook] ref=${reference} event=${eventType} status=${paymentStatus} amount=${amountDecimal} ${currency}`
    )

    // 9. Actualizar web_order
    const { error: updateError } = await (supabase as any)
      .from('web_orders')
      .update({
        payment_status: paymentStatus,
        payment_method: paymentMethodType,
        payment_reference: paypalResourceId,
        updated_at: new Date().toISOString(),
        ...(paymentStatus === 'paid' && {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }),
        ...(paymentStatus === 'failed' && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Pago rechazado por PayPal: ${eventType}`,
        }),
      })
      .eq('id', webOrder.id)

    if (updateError) {
      console.error('[PayPal Webhook] Error actualizando orden:', updateError)
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
      reference: paypalResourceId,
      processor_response: {
        event_type: eventType,
        resource_id: resource.id,
        resource_type: resourceType,
        status: resource.status,
        summary: body.summary,
        payer: resource.payer || null,
      },
      status: paymentStatus,
    })

    // 11. Registrar evento en integration_events
    await (supabase as any).from('integration_events').insert({
      connection_id: matchedConnection.id,
      organization_id: organizationId,
      source: 'paypal',
      direction: 'inbound',
      event_type: eventType,
      external_event_id: eventId,
      payload: {
        type: eventType,
        id: eventId,
        resource_id: resource.id,
        resource_type: resourceType,
        status: resource.status,
        amount: amountValue,
        currency,
        summary: body.summary,
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
      }).catch(err => console.error('[PayPal Webhook] Google Ads upload error:', err))

      // Meta CAPI — Purchase event server-side
      sendMetaCAPIEvent(supabase, organizationId, {
        eventName: 'Purchase',
        eventId: reference,
        value: amountDecimal || webOrder.total,
        currency: currency || 'USD',
      }).catch(err => console.error('[PayPal Webhook] Meta CAPI error:', err))

      // Notificar al ERP para crear venta, factura, cuenta por cobrar, stock y envío
      notifyErpAutoConfirm(webOrder.id).catch(err =>
        console.error('[PayPal Webhook] ERP auto-confirm error:', err)
      )
    }

    console.log(
      `[PayPal Webhook] Procesado OK: order=${reference} status=${paymentStatus}`
    )

    return NextResponse.json({
      received: true,
      verified,
      order: reference,
      payment_status: paymentStatus,
    })
  } catch (error) {
    console.error('[PayPal Webhook] Error inesperado:', error)
    // Retornar 200 para evitar reintentos excesivos de PayPal
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}

/**
 * GET /api/webhooks/paypal
 * Health check — para verificar que el endpoint existe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'paypal_webhook',
    timestamp: new Date().toISOString(),
  })
}
