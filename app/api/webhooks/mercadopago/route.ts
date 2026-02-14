import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { isReservationReference, handleReservationPayment } from '@/lib/reservations/payment-handler'
import { isMembershipReference, handleMembershipPayment } from '@/lib/memberships/payment-handler'
import { isTicketReference, handleTicketPayment } from '@/lib/transport/payment-handler'

export const dynamic = 'force-dynamic'

// Connector ID de MercadoPago Checkout en integration_connectors
const MP_CONNECTOR_ID = 'b00cfe3f-efa6-4656-93da-f42bf3073ab4'

// API base de MercadoPago
const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com'

// Propósitos de credenciales en integration_credentials
const CREDENTIAL_PURPOSES = {
  ACCESS_TOKEN: 'access_token',
  WEBHOOK_SECRET: 'webhook_secret',
} as const

/**
 * Mapea el status de MercadoPago al payment_status de web_orders
 */
function mapMPStatus(mpStatus: string): string {
  const map: Record<string, string> = {
    approved: 'paid',
    authorized: 'paid',
    pending: 'pending',
    in_process: 'pending',
    in_mediation: 'pending',
    rejected: 'failed',
    cancelled: 'failed',
    refunded: 'refunded',
    charged_back: 'refunded',
  }
  return map[mpStatus] || 'pending'
}

/**
 * Verifica la firma HMAC-SHA256 del webhook de MercadoPago.
 * Header x-signature formato: "ts=XXXXX,v1=HASH"
 * Template: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
async function verifyWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const parts = xSignature.split(',')
    const tsEntry = parts.find((p) => p.trim().startsWith('ts='))
    const v1Entry = parts.find((p) => p.trim().startsWith('v1='))

    if (!tsEntry || !v1Entry) return false

    const ts = tsEntry.split('=')[1]
    const v1 = v1Entry.split('=')[1]

    // Template oficial de MercadoPago
    const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`

    // HMAC-SHA256
    const encoder = new TextEncoder()
    const keyData = encoder.encode(webhookSecret)
    const messageData = encoder.encode(template)

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

    return calculated === v1
  } catch (error) {
    console.error('[MercadoPago Webhook] Error validating signature:', error)
    return false
  }
}

/**
 * Obtiene las credenciales de MercadoPago para una conexión.
 * Retorna { accessToken, webhookSecret }
 */
async function getMPCredentials(
  supabase: any,
  connectionId: string
): Promise<{ accessToken: string; webhookSecret: string } | null> {
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  let accessToken = ''
  let webhookSecret = ''

  for (const cred of credentials) {
    if (cred.purpose === CREDENTIAL_PURPOSES.ACCESS_TOKEN) {
      accessToken = cred.secret_ref || ''
    } else if (cred.purpose === CREDENTIAL_PURPOSES.WEBHOOK_SECRET) {
      webhookSecret = cred.secret_ref || ''
    }
  }

  if (!accessToken) return null
  return { accessToken, webhookSecret }
}

/**
 * Consulta el pago completo en la API de MercadoPago.
 */
async function fetchMPPayment(
  accessToken: string,
  paymentId: string
): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(`${MERCADOPAGO_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

/**
 * POST /api/webhooks/mercadopago
 *
 * Recibe notificaciones de MercadoPago (tipo IPN/webhooks v2).
 * Flujo:
 *  1. Parsea notificación → solo procesa type=payment
 *  2. Itera conexiones activas de MP para encontrar la correcta
 *  3. Verifica firma HMAC-SHA256 con webhook_secret
 *  4. Consulta pago completo vía API de MP (con access_token)
 *  5. Usa external_reference para encontrar web_order
 *  6. Actualiza web_order, crea payment, registra integration_event
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()
    const xSignature = request.headers.get('x-signature') || ''
    const xRequestId = request.headers.get('x-request-id') || ''

    // Parsear notificación
    const { type, action, data: notifData } = body

    // Solo procesar eventos de tipo payment
    if (type !== 'payment') {
      return NextResponse.json({ received: true, skipped: true })
    }

    const paymentId = String(notifData?.id || '')
    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payload inválido: falta data.id' },
        { status: 400 }
      )
    }

    console.log(
      `[MercadoPago Webhook] type=${type} action=${action} paymentId=${paymentId}`
    )

    // 1. Buscar todas las conexiones activas de MercadoPago
    const { data: connections } = await (supabase as any)
      .from('integration_connections')
      .select('id, organization_id, settings')
      .eq('connector_id', MP_CONNECTOR_ID)
      .eq('status', 'active')

    if (!connections || connections.length === 0) {
      console.warn('[MercadoPago Webhook] No hay conexiones activas de MercadoPago')
      return NextResponse.json({ received: true, processed: false })
    }

    // 2. Iterar conexiones para encontrar la correcta
    let paymentData: Record<string, any> | null = null
    let matchedConnection: any = null
    let verified = false

    for (const conn of connections) {
      const creds = await getMPCredentials(supabase, conn.id)
      if (!creds) continue

      // Verificar firma si hay webhook_secret y x-signature
      if (xSignature && creds.webhookSecret) {
        const isValid = await verifyWebhookSignature(
          xSignature,
          xRequestId,
          paymentId,
          creds.webhookSecret
        )
        if (!isValid) continue
        verified = true
      }

      // Consultar pago completo en la API de MercadoPago
      const payment = await fetchMPPayment(creds.accessToken, paymentId)
      if (payment) {
        paymentData = payment
        matchedConnection = conn
        break
      }
    }

    if (!paymentData || !matchedConnection) {
      console.warn(`[MercadoPago Webhook] No se pudo obtener pago ${paymentId}`)

      // Registrar evento sin procesar
      await (supabase as any).from('integration_events').insert({
        connection_id: null,
        source: 'mercadopago',
        direction: 'inbound',
        event_type: action || 'payment.updated',
        external_event_id: paymentId,
        payload: body,
        status: 'failed',
        error_message: 'No se pudo obtener el pago o verificar la firma',
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, processed: false })
    }

    const organizationId = matchedConnection.organization_id
    const {
      id: mpPaymentId,
      status: mpStatus,
      status_detail: statusDetail,
      external_reference: reference,
      transaction_amount: amount,
      currency_id: currency,
      payment_method_id: paymentMethodId,
      payment_type_id: paymentTypeId,
    } = paymentData

    console.log(
      `[MercadoPago Webhook] payment=${mpPaymentId} ref=${reference} status=${mpStatus} amount=${amount} org=${organizationId}`
    )

    // 3. Mapear estado (necesario para ambos flujos)
    const paymentStatus = mapMPStatus(mpStatus)

    if (!reference) {
      console.warn('[MercadoPago Webhook] Pago sin external_reference, no se puede vincular a orden')

      await (supabase as any).from('integration_events').insert({
        connection_id: matchedConnection.id,
        organization_id: organizationId,
        source: 'mercadopago',
        direction: 'inbound',
        event_type: action || 'payment.updated',
        external_event_id: String(mpPaymentId),
        payload: body,
        status: 'processed',
        processed_at: new Date().toISOString(),
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, processed: true, no_order: true })
    }

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId: String(mpPaymentId),
        amount: amount || 0,
        currency: currency || 'COP',
        method: paymentMethodId || paymentTypeId || 'mercadopago',
        processorResponse: paymentData,
        gateway: 'mercadopago',
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
        transactionId: String(mpPaymentId),
        amount: amount || 0,
        currency: currency || 'COP',
        method: paymentMethodId || paymentTypeId || 'mercadopago',
        processorResponse: paymentData,
        gateway: 'mercadopago',
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
        transactionId: String(mpPaymentId),
        amount: amount || 0,
        currency: currency || 'COP',
        method: paymentMethodId || paymentTypeId || 'mercadopago',
        processorResponse: paymentData,
        gateway: 'mercadopago',
      })

      return NextResponse.json({
        received: true,
        source: 'trip_ticket',
        ticketId: result.ticketId,
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
      console.error('[MercadoPago Webhook] Orden no encontrada:', reference, orderError)
      return NextResponse.json(
        { error: 'Orden no encontrada', reference },
        { status: 404 }
      )
    }

    // 5. Actualizar web_order
    const { error: updateError } = await (supabase as any)
      .from('web_orders')
      .update({
        payment_status: paymentStatus,
        payment_method: paymentMethodId || paymentTypeId || 'mercadopago',
        payment_reference: String(mpPaymentId),
        updated_at: new Date().toISOString(),
        ...(paymentStatus === 'paid' && {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }),
        ...(paymentStatus === 'failed' && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Pago rechazado por MercadoPago: ${mpStatus} (${statusDetail || ''})`,
        }),
      })
      .eq('id', webOrder.id)

    if (updateError) {
      console.error('[MercadoPago Webhook] Error actualizando orden:', updateError)
    }

    // 6. Crear registro en payments
    await (supabase as any).from('payments').insert({
      organization_id: organizationId,
      branch_id: webOrder.branch_id,
      source: 'web_order',
      source_id: String(webOrder.id),
      method: paymentMethodId || paymentTypeId || 'mercadopago',
      amount: amount || webOrder.total,
      currency: currency || 'COP',
      reference: String(mpPaymentId),
      processor_response: paymentData,
      status: paymentStatus,
    })

    // 7. Registrar evento en integration_events
    await (supabase as any).from('integration_events').insert({
      connection_id: matchedConnection.id,
      organization_id: organizationId,
      source: 'mercadopago',
      direction: 'inbound',
      event_type: action || 'payment.updated',
      external_event_id: String(mpPaymentId),
      payload: { ...body, payment_status: mpStatus, verified },
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    })

    // 8. Actualizar last_received_at en integration_webhooks
    await (supabase as any)
      .from('integration_webhooks')
      .update({ last_received_at: new Date().toISOString() })
      .eq('connection_id', matchedConnection.id)
      .eq('direction', 'inbound')

    console.log(
      `[MercadoPago Webhook] Procesado OK: order=${reference} status=${paymentStatus}`
    )

    return NextResponse.json({
      received: true,
      order: reference,
      payment_status: paymentStatus,
    })
  } catch (error) {
    console.error('[MercadoPago Webhook] Error inesperado:', error)
    // Retornar 200 para evitar reintentos innecesarios de MercadoPago
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}

/**
 * GET /api/webhooks/mercadopago
 * Health check — para verificar que el endpoint existe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'mercadopago_webhook',
    timestamp: new Date().toISOString(),
  })
}
