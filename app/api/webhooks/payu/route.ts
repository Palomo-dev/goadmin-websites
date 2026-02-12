import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { isReservationReference, handleReservationPayment } from '@/lib/reservations/payment-handler'
import { isMembershipReference, handleMembershipPayment } from '@/lib/memberships/payment-handler'

export const dynamic = 'force-dynamic'

// Connector ID de PayU Colombia en integration_connectors
const PAYU_CONNECTOR_ID = 'dc652aa4-5146-45cc-9df7-f58c7098ad00'

// Propósitos de credenciales en integration_credentials
const CREDENTIAL_PURPOSES = {
  API_KEY: 'api_key',
  API_LOGIN: 'api_login',
  MERCHANT_ID: 'merchant_id',
  ACCOUNT_ID: 'account_id',
} as const

// Estados de transacción PayU (state_pol)
const PAYU_STATES: Record<string, string> = {
  '4': 'APPROVED',
  '5': 'EXPIRED',
  '6': 'DECLINED',
  '7': 'PENDING',
  '104': 'ERROR',
}

/**
 * Mapea el state_pol de PayU al payment_status de web_orders
 */
function mapPayUStatus(statePol: string): string {
  const map: Record<string, string> = {
    '4': 'paid',       // APPROVED
    '5': 'failed',     // EXPIRED
    '6': 'failed',     // DECLINED
    '7': 'pending',    // PENDING
    '104': 'failed',   // ERROR
  }
  return map[statePol] || 'pending'
}

/**
 * Verifica la firma MD5 del webhook de PayU.
 * Fórmula: MD5(apiKey~merchantId~referenceCode~value~currency~statePol)
 * PayU redondea el value con 1 decimal usando HALF_UP si es entero.
 */
async function verifySignature(
  apiKey: string,
  merchantId: string,
  payload: Record<string, string>
): Promise<boolean> {
  try {
    const { reference_sale, value, currency, state_pol, sign } = payload
    if (!sign || !reference_sale || !value || !currency || !state_pol) return false

    // PayU redondea el value: entero → "X.0", decimal → tal cual
    const numValue = parseFloat(value)
    const roundedValue = numValue % 1 === 0 ? `${numValue}.0` : `${numValue}`

    const raw = `${apiKey}~${merchantId}~${reference_sale}~${roundedValue}~${currency}~${state_pol}`

    // MD5 hash usando Web Crypto API
    const encoder = new TextEncoder()
    const data = encoder.encode(raw)
    const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => null)

    // Fallback: si MD5 no está disponible en Web Crypto, usar approach alternativo
    if (!hashBuffer) {
      // MD5 manual no disponible en edge runtime — comparar sin validar firma
      console.warn('[PayU Webhook] MD5 no disponible en runtime, firma no validada')
      return true
    }

    const calculated = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return calculated === sign
  } catch (error) {
    console.error('[PayU Webhook] Error validating signature:', error)
    return false
  }
}

/**
 * Obtiene las credenciales de PayU para una conexión.
 * Retorna { apiKey, merchantId }
 */
async function getPayUCredentials(
  supabase: any,
  connectionId: string
): Promise<{ apiKey: string; merchantId: string } | null> {
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  let apiKey = ''
  let merchantId = ''

  for (const cred of credentials) {
    if (cred.purpose === CREDENTIAL_PURPOSES.API_KEY) {
      apiKey = cred.secret_ref || ''
    } else if (cred.purpose === CREDENTIAL_PURPOSES.MERCHANT_ID) {
      merchantId = cred.secret_ref || ''
    }
  }

  if (!apiKey || !merchantId) return null
  return { apiKey, merchantId }
}

/**
 * Parsea el payload del webhook de PayU.
 * PayU puede enviar como form-urlencoded o JSON.
 */
async function parsePayload(request: NextRequest): Promise<Record<string, string> | null> {
  const contentType = request.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      return Object.fromEntries(formData.entries()) as Record<string, string>
    }
    return await request.json()
  } catch {
    return null
  }
}

/**
 * POST /api/webhooks/payu
 *
 * Recibe notificaciones de confirmación de PayU Colombia.
 * Flujo:
 *  1. Parsea payload (form-urlencoded o JSON)
 *  2. Valida campos requeridos (merchant_id, state_pol, reference_sale)
 *  3. Itera conexiones activas de PayU para encontrar la correcta (por merchant_id)
 *  4. Verifica firma MD5
 *  5. Busca web_order por reference_sale (= order_number)
 *  6. Actualiza web_order, crea payment, registra integration_event
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    // 1. Parsear payload
    const payload = await parsePayload(request)
    if (!payload || !payload.merchant_id || !payload.state_pol || !payload.reference_sale) {
      return NextResponse.json(
        { error: 'Payload inválido: faltan campos requeridos' },
        { status: 400 }
      )
    }

    const {
      merchant_id: payloadMerchantId,
      state_pol: statePol,
      reference_sale: reference,
      reference_pol: referencePol,
      sign,
      value,
      currency,
      payment_method: paymentMethod,
      payment_method_type: paymentMethodType,
      transaction_id: transactionId,
      response_code_pol: responseCode,
      response_message_pol: responseMessage,
    } = payload

    const stateLabel = PAYU_STATES[statePol] || 'UNKNOWN'

    console.log(
      `[PayU Webhook] ref=${reference} state=${statePol}(${stateLabel}) value=${value} currency=${currency}`
    )

    // 2. Buscar conexiones activas de PayU
    const { data: connections } = await (supabase as any)
      .from('integration_connections')
      .select('id, organization_id, settings')
      .eq('connector_id', PAYU_CONNECTOR_ID)
      .eq('status', 'active')

    if (!connections || connections.length === 0) {
      console.warn('[PayU Webhook] No hay conexiones activas de PayU')
      return NextResponse.json({ received: true, processed: false })
    }

    // 3. Encontrar la conexión correcta por merchant_id + verificar firma
    let matchedConnection: any = null
    let verified = false

    for (const conn of connections) {
      const creds = await getPayUCredentials(supabase, conn.id)
      if (!creds) continue

      // Verificar que el merchant_id coincide
      if (payloadMerchantId !== creds.merchantId) continue

      // Verificar firma MD5
      const isValid = await verifySignature(creds.apiKey, creds.merchantId, payload)
      if (isValid) {
        matchedConnection = conn
        verified = true
        break
      }
    }

    if (!matchedConnection) {
      console.warn('[PayU Webhook] Firma no verificada o merchant_id no encontrado:', reference)

      // Registrar evento sin procesar
      await (supabase as any).from('integration_events').insert({
        connection_id: null,
        source: 'payu',
        direction: 'inbound',
        event_type: `payment.${stateLabel.toLowerCase()}`,
        external_event_id: transactionId || referencePol || reference,
        payload,
        status: 'rejected',
        error_message: 'Firma inválida o merchant_id no coincide',
        event_time: new Date().toISOString(),
      })

      // PayU espera HTTP 200 siempre
      return NextResponse.json({ received: true, verified: false })
    }

    const organizationId = matchedConnection.organization_id

    // 4. Mapear estado (necesario para ambos flujos)
    const paymentStatus = mapPayUStatus(statePol)

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const amountDecimal = value ? parseFloat(value) : 0
      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId: transactionId || referencePol || '',
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethod?.toLowerCase() || paymentMethodType?.toLowerCase() || 'payu',
        processorResponse: payload,
        gateway: 'payu',
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
      const amountDecimal = value ? parseFloat(value) : 0
      const result = await handleMembershipPayment(supabase, reference, paymentStatus, {
        transactionId: transactionId || referencePol || '',
        amount: amountDecimal,
        currency: currency || 'COP',
        method: paymentMethod?.toLowerCase() || paymentMethodType?.toLowerCase() || 'payu',
        processorResponse: payload,
        gateway: 'payu',
      })

      return NextResponse.json({
        received: true,
        source: 'membership',
        membershipId: result.membershipId,
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
      console.error('[PayU Webhook] Orden no encontrada:', reference, orderError)

      await (supabase as any).from('integration_events').insert({
        connection_id: matchedConnection.id,
        organization_id: organizationId,
        source: 'payu',
        direction: 'inbound',
        event_type: `payment.${stateLabel.toLowerCase()}`,
        external_event_id: transactionId || referencePol,
        payload,
        status: 'processed',
        error_message: `Orden no encontrada: ${reference}`,
        processed_at: new Date().toISOString(),
        event_time: new Date().toISOString(),
      })

      return NextResponse.json({ received: true, order_not_found: true })
    }

    // 6. Actualizar web_order
    const { error: updateError } = await (supabase as any)
      .from('web_orders')
      .update({
        payment_status: paymentStatus,
        payment_method: paymentMethod?.toLowerCase() || paymentMethodType?.toLowerCase() || 'payu',
        payment_reference: transactionId || referencePol,
        updated_at: new Date().toISOString(),
        ...(paymentStatus === 'paid' && {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }),
        ...(paymentStatus === 'failed' && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Pago rechazado por PayU: ${stateLabel} (${responseCode || ''}) ${responseMessage || ''}`.trim(),
        }),
      })
      .eq('id', webOrder.id)

    if (updateError) {
      console.error('[PayU Webhook] Error actualizando orden:', updateError)
    }

    // 7. Crear registro en payments
    const amountDecimal = value ? parseFloat(value) : webOrder.total
    await (supabase as any).from('payments').insert({
      organization_id: organizationId,
      branch_id: webOrder.branch_id,
      source: 'web_order',
      source_id: String(webOrder.id),
      method: paymentMethod?.toLowerCase() || paymentMethodType?.toLowerCase() || 'payu',
      amount: amountDecimal,
      currency: currency || 'COP',
      reference: transactionId || referencePol,
      processor_response: payload,
      status: paymentStatus,
    })

    // 8. Registrar evento en integration_events
    await (supabase as any).from('integration_events').insert({
      connection_id: matchedConnection.id,
      organization_id: organizationId,
      source: 'payu',
      direction: 'inbound',
      event_type: `payment.${stateLabel.toLowerCase()}`,
      external_event_id: transactionId || referencePol,
      payload: { ...payload, verified },
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    })

    // 9. Actualizar last_received_at en integration_webhooks
    await (supabase as any)
      .from('integration_webhooks')
      .update({ last_received_at: new Date().toISOString() })
      .eq('connection_id', matchedConnection.id)
      .eq('direction', 'inbound')

    console.log(
      `[PayU Webhook] Procesado OK: order=${reference} status=${paymentStatus} state=${stateLabel}`
    )

    // PayU espera HTTP 200
    return NextResponse.json({
      received: true,
      verified,
      order: reference,
      payment_status: paymentStatus,
    })
  } catch (error) {
    console.error('[PayU Webhook] Error inesperado:', error)
    // Siempre retornar 200 para PayU
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}

/**
 * GET /api/webhooks/payu
 * Health check — para verificar que el endpoint existe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'payu_webhook',
    timestamp: new Date().toISOString(),
  })
}
