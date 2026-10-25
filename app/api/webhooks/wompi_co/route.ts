import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { isReservationReference, handleReservationPayment } from '@/lib/reservations/payment-handler'
import { isMembershipReference, handleMembershipPayment } from '@/lib/memberships/payment-handler'
import { enviarCorreoPedidoPagado } from '@/lib/orders/correoPedidoPagado'
import { isTicketReference, handleTicketPayment } from '@/lib/transport/payment-handler'
import { isParkingPassReference, handleParkingPassPayment } from '@/lib/parking/payment-handler'
import { isInvoiceReference, handleInvoicePayment, organizacionesCandidatasFactura } from '@/lib/services/payment-handler'
import { uploadGoogleAdsConversion } from '@/lib/google-ads/upload-conversion'
import { sendMetaCAPIEvent } from '@/lib/meta/send-capi-event'
import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'
import { notifyErpReleaseStock } from '@/lib/erp-release-stock'
import { notifyErpRefund } from '@/lib/erp-refund'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import {
  WOMPI_CONNECTOR_ID,
  SIGNATURE_ENFORCED,
  getEventsSecret,
  logSignatureCheck,
  mapWompiStatus,
  validateSignature,
  type SignatureVerdict,
} from '@/lib/payments/wompi-firma'
import { esReferenciaDeposito } from '@/lib/restaurant/deposito-modelo'
import { procesarDepositoWompi } from '@/lib/restaurant/deposito-webhook'
import { esReferenciaAbonoMesa } from '@/lib/restaurant/mesa-servidor'
import { procesarAbonoMesaWompi } from '@/lib/restaurant/abono-mesa-webhook'

export const dynamic = 'force-dynamic'

/**
 * Organización de un pago de factura (INV-): entre las organizaciones que tienen una
 * factura con esa referencia y una conexión de Wompi, la única cuyo secreto de eventos
 * verifica la firma. `null` si ninguna la verifica (o si falta la firma).
 */
async function resolverOrganizacionFacturaWompi(
  supabase: any,
  reference: string,
  transaction: Record<string, any>,
  signature: { properties: string[]; checksum: string } | undefined,
  timestamp: number
): Promise<number | null> {
  if (!signature?.checksum || !Array.isArray(signature.properties)) return null
  const candidatas = await organizacionesCandidatasFactura(supabase, reference)
  if (candidatas.length === 0) return null

  const { data: conWompi } = await supabase
    .from('integration_connections')
    .select('organization_id')
    .in('organization_id', candidatas)
    .eq('connector_id', WOMPI_CONNECTOR_ID)
    .in('status', ['active', 'connected'])
  const orgs = Array.from(new Set<number>((conWompi || []).map((c: any) => c.organization_id)))

  for (const orgId of orgs) {
    const { secret } = await getEventsSecret(supabase, orgId)
    if (secret && (await validateSignature(transaction, signature, timestamp, secret))) return orgId
  }
  return null
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

    // ── Depósito de una reserva de mesa (MESA-…): firma obligatoria, idempotente ──
    if (esReferenciaDeposito(reference)) {
      const r = await procesarDepositoWompi(supabase, body)
      return NextResponse.json(r.body, { status: r.status })
    } else {
      // Cualquier otra referencia: el flujo de siempre (reservación, membresía, …, pedido web).
    }

    // ── Abono en línea a la cuenta de una mesa desde la Carta QR (CQR-…): firma obligatoria ──
    if (esReferenciaAbonoMesa(reference)) {
      const r = await procesarAbonoMesaWompi(supabase, body)
      return NextResponse.json(r.body, { status: r.status })
    } else {
      // Cualquier otra referencia: el flujo de siempre.
    }

    // ── Verificar si es pago de reservación ──
    if (isReservationReference(reference)) {
      const paymentStatus = mapWompiStatus(wompiStatus)
      const amountDecimal = amountInCents ? amountInCents / 100 : 0

      const result = await handleReservationPayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: mapToPaymentMethodCode(paymentMethodType, 'wompi'),
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
        method: mapToPaymentMethodCode(paymentMethodType, 'wompi'),
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
        method: mapToPaymentMethodCode(paymentMethodType, 'wompi'),
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
        method: mapToPaymentMethodCode(paymentMethodType, 'wompi'),
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

      // La organización de la factura es la única cuya firma verifica. Los números de
      // factura se repiten entre organizaciones: sin esto, cualquiera marcaba pagada la
      // factura de otra. Falla cerrado siempre (no depende de SIGNATURE_ENFORCED): este
      // flujo no tiene tráfico que proteger y la firma de Wompi ya verifica en producción.
      const invoiceOrgId = await resolverOrganizacionFacturaWompi(supabase, reference, transaction, signature, timestamp)
      if (!invoiceOrgId) {
        console.error(`[Wompi Webhook] Pago de factura ${reference} sin firma válida de ninguna organización: rechazado`)
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
      }

      const result = await handleInvoicePayment(supabase, reference, paymentStatus, {
        transactionId,
        amount: amountDecimal,
        currency: currency || 'COP',
        method: mapToPaymentMethodCode(paymentMethodType, 'wompi'),
        gateway: 'wompi_co',
      }, invoiceOrgId)

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

    // 2. Verificar la firma. Ausencia de secreto o de firma NO es un pase libre:
    //    es un veredicto que se registra y, con SIGNATURE_ENFORCED, bloquea.
    const { secret: eventsSecret, connectionId } = await getEventsSecret(supabase, organizationId)

    let verdict: SignatureVerdict
    if (!eventsSecret) {
      verdict = 'no_secret'
    } else if (!signature) {
      verdict = 'no_signature'
    } else {
      verdict = (await validateSignature(transaction, signature, timestamp, eventsSecret))
        ? 'match'
        : 'mismatch'
    }

    if (verdict !== 'match') {
      console.error(
        `[Wompi Webhook] Firma no verificada (${verdict}) para org: ${organizationId}` +
          (SIGNATURE_ENFORCED ? ' — rechazado' : ' — MODO OBSERVACIÓN, se procesa igual')
      )
      await logSignatureCheck(supabase, {
        connectionId,
        organizationId,
        transactionId,
        body,
        verdict,
        blocked: SIGNATURE_ENFORCED,
      })

      if (SIGNATURE_ENFORCED) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
      }
    } else if (!SIGNATURE_ENFORCED) {
      // En observación registramos también los aciertos: son la evidencia que
      // hace falta para poder activar SIGNATURE_ENFORCED con confianza.
      await logSignatureCheck(supabase, {
        connectionId,
        organizationId,
        transactionId,
        body,
        verdict,
        blocked: false,
      })
    }

    // 3. Mapear estado de Wompi → payment_status
    const paymentStatus = mapWompiStatus(wompiStatus)

    // Evento de integración + fecha del último webhook: se registra SIEMPRE, también cuando el
    // pedido ya estaba pagado y el evento no cambia nada.
    const registrarEventoIntegracion = async () => {
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
        source: 'webhook',
        direction: 'inbound',
        event_type: event,
        external_event_id: transactionId,
        payload: { provider: 'wompi', ...body },
        status: 'processed',
        processed_at: new Date().toISOString(),
        // event_time es GENERATED ALWAYS AS (created_at), no se puede insertar.
      } as any)
      if ((conn as any)?.id) {
        await (supabase as any)
          .from('integration_webhooks')
          .update({ last_received_at: new Date().toISOString() })
          .eq('connection_id', (conn as any).id)
          .eq('direction', 'inbound')
      }
    }

    // 3b. Idempotencia / nunca bajar de estado: si el pedido ya está pagado (por este webhook, por
    //     /checkout/resultado o por el pago manual del POS) o ya tiene un pago completado, un
    //     APPROVED repetido o un DECLINED/ERROR/PENDING viejo NO cambia el pedido ni crea pagos.
    //     EXCEPCIÓN: VOIDED (→ 'refunded') sí sigue: es el reembolso real y debe llegar a
    //     notifyErpRefund (NC, devolución de stock y reverso del asiento).
    const { data: pagosPrevios } = await (supabase as any)
      .from('payments')
      .select('id, reference, status, processor_response')
      .eq('organization_id', organizationId)
      .eq('source', 'web_order')
      .eq('source_id', String((webOrder as any).id))
      .in('status', ['completed', 'paid'])
      .order('created_at', { ascending: true })
      .limit(1)
    const pagoPrevio = Array.isArray(pagosPrevios) && pagosPrevios.length > 0 ? pagosPrevios[0] : null
    const yaPagado = (webOrder as any).payment_status === 'paid' || !!pagoPrevio
    if (yaPagado && paymentStatus !== 'refunded') {
      console.log(
        `[Wompi Webhook] Pedido ${reference} ya pagado; evento status=${paymentStatus} tx=${transactionId} sin cambios en el pedido`
      )
      // Adjuntar referencia y respuesta de Wompi al pago existente (sin crear otro pago ni pisar
      // lo que ya tenga), solo con un APPROVED.
      if (paymentStatus === 'paid' && pagoPrevio) {
        const adjuntos: Record<string, unknown> = {}
        if (!pagoPrevio.reference && transactionId) adjuntos.reference = transactionId
        if (!pagoPrevio.processor_response) adjuntos.processor_response = transaction
        if (Object.keys(adjuntos).length > 0) {
          await (supabase as any).from('payments').update(adjuntos).eq('id', pagoPrevio.id)
        }
      }
      if (paymentStatus === 'paid' && transactionId) {
        await (supabase as any)
          .from('web_orders')
          .update({ payment_reference: transactionId })
          .eq('id', (webOrder as any).id)
          .is('payment_reference', null)
      }
      await registrarEventoIntegracion()
      return NextResponse.json({
        received: true,
        ignored: 'already_paid',
        reference,
        payment_status: 'paid',
      })
    }

    // 4. Actualizar web_order
    const camposPago = {
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
    }
    // Pago aprobado: la MISMA actualización, condicionada a que el pedido aún no esté pagado. Si
    // afecta la fila, este webhook es quien hizo la transición a «pagado» y solo él envía el
    // correo; /checkout/resultado hace lo mismo con `.eq('payment_status','pending')`, así que entre
    // los dos sale un solo «Pago confirmado» aunque lleguen a la vez. Siempre es UNA sola
    // actualización por evento (el trigger contable de web_orders corre una vez, como antes).
    // Cada evento hace UNA actualización condicionada y solo si ESTE webhook hizo la transición
    // actualiza e inserta el pago (BAJO: carrera entre la lectura de arriba y la escritura).
    //   - paid: solo si aún no estaba pagado.
    //   - refunded (VOIDED): desde cualquier estado salvo ya reembolsado.
    //   - failed/pending: solo si no está pagado (nunca se baja de «pagado»).
    const condicion =
      paymentStatus === 'refunded'
        ? 'payment_status.is.null,payment_status.neq.refunded'
        : 'payment_status.is.null,payment_status.neq.paid'
    const actualizacion = await (supabase as any)
      .from('web_orders')
      .update(camposPago as any)
      .eq('id', (webOrder as any).id)
      .or(condicion)
      .select('id')
    const updateError: unknown = actualizacion.error
    const hizoTransicion =
      !actualizacion.error && Array.isArray(actualizacion.data) && actualizacion.data.length > 0
    const transicionAPagado = paymentStatus === 'paid' && hizoTransicion

    if (updateError) {
      console.error('[Wompi Webhook] Error actualizando orden:', updateError)
    } else if (!hizoTransicion) {
      console.log(
        `[Wompi Webhook] Pedido ${reference} ya estaba en ${paymentStatus === 'refunded' ? 'refunded' : 'paid'} (carrera); no se actualiza ni se inserta pago`
      )
    }

    // 5. Crear registro en payments, solo si este webhook hizo la transición y sin duplicar si
    //    Wompi reenvía el mismo evento (el trigger pasa 'paid' → 'completed').
    const amountDecimal = amountInCents ? amountInCents / 100 : (webOrder as any).total
    if (hizoTransicion) {
      const { data: mismoPago } = await (supabase as any)
        .from('payments')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('source', 'web_order')
        .eq('source_id', String((webOrder as any).id))
        .eq('reference', transactionId)
        .in('status', paymentStatus === 'paid' ? ['paid', 'completed'] : [paymentStatus])
        .limit(1)
      if (!(Array.isArray(mismoPago) && mismoPago.length > 0)) {
        await (supabase as any).from('payments').insert({
          organization_id: organizationId,
          branch_id: (webOrder as any).branch_id,
          source: 'web_order',
          source_id: String((webOrder as any).id),
          method: mapToPaymentMethodCode(paymentMethodType, 'wompi'),
          amount: amountDecimal,
          currency: currency || 'COP',
          reference: transactionId,
          processor_response: transaction,
          status: paymentStatus,
        } as any)
      }
    }

    // 6-7. Evento de integración y last_received_at
    await registrarEventoIntegracion()

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

      // Correo «Pago confirmado» al cliente, solo si ESTE webhook hizo la transición a pagado
      // (update condicionado de arriba): ni un reintento ni una carrera con /checkout/resultado lo
      // repiten. /api/orders ya no lo envía para Wompi.
      if (transicionAPagado) {
        enviarCorreoPedidoPagado((webOrder as any).id).catch(err =>
          console.error('[Wompi Webhook] Correo de pago confirmado:', err)
        )
      } else {
        // Ya estaba pagado (reintento) o no se pudo actualizar: sin correo.
      }
    }

    // Liberar stock reservado si el pago falló
    if (paymentStatus === 'failed' && hizoTransicion) {
      notifyErpReleaseStock((webOrder as any).id).catch(err =>
        console.error('[Wompi Webhook] ERP release-stock error:', err)
      )
    }

    // Procesar reembolso (nota crédito + devolución de stock + asiento reversión)
    if (paymentStatus === 'refunded' && hizoTransicion) {
      notifyErpRefund((webOrder as any).id, {
        reason: `Reembolso procesado por Wompi: ${wompiStatus}`,
      }).catch(err =>
        console.error('[Wompi Webhook] ERP refund error:', err)
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
