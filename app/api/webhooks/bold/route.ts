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
import { notifyErpReleaseStock } from '@/lib/erp-release-stock'
import { notifyErpRefund } from '@/lib/erp-refund'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Connector ID de Bold API Link en integration_connectors
const BOLD_CONNECTOR_ID = '6d732ae3-e9ff-41be-9d75-aa29ba86d927'

/**
 * Mapea el tipo de evento de Bold al payment_status de web_orders
 */
function mapBoldStatus(eventType: string): string {
  const map: Record<string, string> = {
    SALE_APPROVED: 'paid',
    SALE_REJECTED: 'failed',
    VOID_APPROVED: 'refunded',
    VOID_REJECTED: 'failed',
  }
  return map[eventType] || 'pending'
}

/**
 * Valida la firma del webhook de Bold.
 * La firma es HMAC-SHA256 del body (raw) usando la llave secreta,
 * con el resultado expresado en hexadecimal.
 */
function validateBoldSignature(
  rawBody: string,
  signature: string,
  secretKey: string
): boolean {
  if (!secretKey || !signature) return false

  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(Buffer.from(rawBody))
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Obtiene el secret_key de Bold para una organización.
 */
async function getBoldSecretKey(
  supabase: any,
  organizationId: number
): Promise<string | null> {
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('connector_id', BOLD_CONNECTOR_ID)
    .in('status', ['active', 'connected'])
    .limit(1)
    .single()

  if (!connection) return null

  const { data: credential } = await supabase
    .from('integration_credentials')
    .select('secret_ref')
    .eq('connection_id', connection.id)
    .eq('purpose', 'secret_key')
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!credential?.secret_ref) return null

  // Intentar leer del Vault de Supabase
  try {
    const { data: secret } = await supabase
      .rpc('get_decrypted_secret', { secret_name: credential.secret_ref })
    if (secret) return secret
  } catch {
    // Vault no disponible — usar secret_ref directamente
  }

  return credential.secret_ref
}

/**
 * POST /api/webhooks/bold
 *
 * Recibe notificaciones de eventos de Bold (CloudEvents).
 * Actualiza el estado de pago de web_orders y registra el pago en payments.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    // Bold envía el body como texto (CloudEvents JSON)
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    const { type, data } = body

    // Solo procesar eventos de venta
    if (!type || !data) {
      return NextResponse.json(
        { error: 'Payload inválido: falta type o data' },
        { status: 400 }
      )
    }

    // Ignorar eventos que no son de venta
    if (!['SALE_APPROVED', 'SALE_REJECTED', 'VOID_APPROVED', 'VOID_REJECTED'].includes(type)) {
      console.log(`[Bold Webhook] Evento ${type} ignorado`)
      return NextResponse.json({ received: true, skipped: true })
    }

    const reference = data.metadata?.reference
    const transactionId = data.payment_id
    const amountTotal = data.amount?.total
    const currency = data.amount?.currency || 'COP'
    const paymentMethod = data.payment_method?.toLowerCase() || 'card'

    if (!reference) {
      console.error('[Bold Webhook] Webhook sin reference en metadata')
      return NextResponse.json(
        { error: 'Webhook sin reference en metadata' },
        { status: 400 }
      )
    }

    console.log(
      `[Bold Webhook] type=${type} ref=${reference} tx=${transactionId} amount=${amountTotal} ${currency}`
    )

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const paymentStatus = mapBoldStatus(type)
      const amountDecimal = Number(amountTotal || 0)

      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency,
        method: paymentMethod,
        processorResponse: body,
        gateway: 'bold_link',
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
      const paymentStatus = mapBoldStatus(type)
      const amountDecimal = Number(amountTotal || 0)

      const result = await handleMembershipPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency,
        method: paymentMethod,
        processorResponse: body,
        gateway: 'bold_link',
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
      const paymentStatus = mapBoldStatus(type)
      const amountDecimal = Number(amountTotal || 0)

      const result = await handleTicketPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency,
        method: paymentMethod,
        processorResponse: body,
        gateway: 'bold_link',
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
      const paymentStatus = mapBoldStatus(type)
      const amountDecimal = Number(amountTotal || 0)

      const result = await handleParkingPassPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency,
        method: paymentMethod,
        processorResponse: body,
        gateway: 'bold_link',
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
      const paymentStatus = mapBoldStatus(type)
      const amountDecimal = Number(amountTotal || 0)

      const result = await handleInvoicePayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency,
        method: paymentMethod,
        gateway: 'bold_link',
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
      console.error('[Bold Webhook] Orden no encontrada:', reference, orderError)
      return NextResponse.json(
        { error: 'Orden no encontrada', reference },
        { status: 404 }
      )
    }

    const organizationId = (webOrder as any).organization_id

    // 2. Validar firma usando el secret_key de Bold
    const boldSignature = request.headers.get('x-bold-signature') || ''
    const secretKey = await getBoldSecretKey(supabase, organizationId)

    if (secretKey && boldSignature) {
      const isValid = validateBoldSignature(rawBody, boldSignature, secretKey)

      if (!isValid) {
        console.error('[Bold Webhook] Firma inválida para org:', organizationId)

        await supabase.from('integration_events').insert({
          connection_id: null,
          organization_id: organizationId,
          source: 'bold',
          direction: 'inbound',
          event_type: type,
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

    // 3. Mapear estado de Bold → payment_status
    const paymentStatus = mapBoldStatus(type)

    // 4. Actualizar web_order
    const { error: updateError } = await (supabase as any)
      .from('web_orders')
      .update({
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        payment_reference: transactionId,
        updated_at: new Date().toISOString(),
        ...(paymentStatus === 'paid' && {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }),
        ...(paymentStatus === 'failed' && {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Pago rechazado por Bold: ${type}`,
        }),
      } as any)
      .eq('id', (webOrder as any).id)

    if (updateError) {
      console.error('[Bold Webhook] Error actualizando orden:', updateError)
    }

    // 5. Crear registro en payments
    const amountDecimal = Number(amountTotal || (webOrder as any).total)
    await (supabase as any).from('payments').insert({
      organization_id: organizationId,
      branch_id: (webOrder as any).branch_id,
      source: 'web_order',
      source_id: String((webOrder as any).id),
      method: paymentMethod,
      amount: amountDecimal,
      currency,
      reference: transactionId,
      processor_response: body,
      status: paymentStatus,
    } as any)

    // 6. Registrar evento en integration_events
    const { data: conn } = await supabase
      .from('integration_connections')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('connector_id', BOLD_CONNECTOR_ID)
      .limit(1)
      .single()

    await (supabase as any).from('integration_events').insert({
      connection_id: (conn as any)?.id || null,
      organization_id: organizationId,
      source: 'bold',
      direction: 'inbound',
      event_type: type,
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

    // 8. Google Ads + Meta CAPI + ERP auto-confirm si pago exitoso
    if (paymentStatus === 'paid') {
      uploadGoogleAdsConversion(supabase, organizationId, {
        orderId: reference,
        value: amountDecimal,
        currency,
        category: 'purchase',
      }).catch(err => console.error('[Bold Webhook] Google Ads upload error:', err))

      sendMetaCAPIEvent(supabase, organizationId, {
        eventName: 'Purchase',
        eventId: reference,
        value: amountDecimal,
        currency,
      }).catch(err => console.error('[Bold Webhook] Meta CAPI error:', err))

      notifyErpAutoConfirm((webOrder as any).id).catch(err =>
        console.error('[Bold Webhook] ERP auto-confirm error:', err)
      )
    }

    // Liberar stock reservado si el pago falló
    if (paymentStatus === 'failed') {
      notifyErpReleaseStock((webOrder as any).id).catch(err =>
        console.error('[Bold Webhook] ERP release-stock error:', err)
      )
    }

    // Procesar reembolso (nota crédito + devolución de stock + asiento reversión)
    if (paymentStatus === 'refunded') {
      notifyErpRefund((webOrder as any).id, {
        reason: `Reembolso procesado por Bold: ${type}`,
      }).catch(err =>
        console.error('[Bold Webhook] ERP refund error:', err)
      )
    }

    console.log(
      `[Bold Webhook] Procesado OK: order=${reference} status=${paymentStatus}`
    )

    return NextResponse.json({
      received: true,
      order: reference,
      payment_status: paymentStatus,
    })
  } catch (error) {
    console.error('[Bold Webhook] Error inesperado:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/bold
 * Health check — Bold puede verificar que el endpoint existe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'bold_webhook',
    timestamp: new Date().toISOString(),
  })
}
