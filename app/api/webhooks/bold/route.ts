import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { isReservationReference, handleReservationPayment } from '@/lib/reservations/payment-handler'
import { isMembershipReference, handleMembershipPayment } from '@/lib/memberships/payment-handler'
import { isTicketReference, handleTicketPayment } from '@/lib/transport/payment-handler'
import { isParkingPassReference, handleParkingPassPayment } from '@/lib/parking/payment-handler'
import { isInvoiceReference, handleInvoicePayment } from '@/lib/services/payment-handler'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import { estadoEventoBold } from '@/lib/payments/pasarelasTienda'
import { firmanteBold } from '@/lib/payments/firmanteBold'
import { aplicarPagoPedidoWeb } from '@/lib/payments/pagoPedidoWeb'
import { esReferenciaAnticipo } from '@/lib/contraentrega/contraentregaServidor'
import { aplicarAnticipoPasarela } from '@/lib/contraentrega/anticipoWebhook'
import { METODO_PEDIDO_BOLD } from '@/lib/payments/consultaPasarelaTienda'
import { debeReenviarAlErp, reenviarBoldAlErp } from '@/lib/payments/wompi-reenvio-erp'

export const dynamic = 'force-dynamic'

const EVENTOS_DE_VENTA = ['SALE_APPROVED', 'SALE_REJECTED', 'VOID_APPROVED', 'VOID_REJECTED']

/**
 * POST /api/webhooks/bold
 *
 * Eventos de Bold (CloudEvents) para la tienda. Es la URL que el ERP le muestra al comercio
 * cuando su organización tiene dominio principal verificado (como la de Wompi).
 *
 *  1. FIRMA OBLIGATORIA: la conexión que firmó (`x-bold-signature`, HMAC de la llave secreta) da
 *     la organización. Sin firma válida de ninguna conexión: 401. Antes, una tienda sin Bold (o
 *     un aviso sin firma) dejaba pasar cualquier JSON y marcaba pagado el pedido que nombrara.
 *  2. Reservas, membresías, boletos, pases y facturas: sus manejadores de siempre.
 *  3. Pedido web DE ESA organización (`aplicarPagoPedidoWeb`: monto, idempotencia, ERP, correo).
 *  4. Ni pedido ni lo anterior: es del ERP (cobros QR del POS, links de pago) y se le reenvía con
 *     el cuerpo crudo y la firma intactos; el ERP vuelve a identificar la conexión por la firma.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const cuerpoCrudo = new Uint8Array(await request.arrayBuffer())
    let body: any
    try {
      body = JSON.parse(new TextDecoder().decode(cuerpoCrudo))
    } catch {
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }
    const { type, data } = body ?? {}
    if (!type || !data) {
      return NextResponse.json({ error: 'Payload inválido: falta type o data' }, { status: 400 })
    }
    if (!EVENTOS_DE_VENTA.includes(type)) {
      return NextResponse.json({ received: true, skipped: true })
    }

    // 1. Firma
    const firma = request.headers.get('x-bold-signature')
    const firmante = await firmanteBold(supabase, cuerpoCrudo, firma)
    if (!firmante) {
      console.error(`[Bold Webhook] ${firma ? 'Firma de ninguna conexión de Bold' : 'Evento sin firma'}: rechazado`)
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }
    const organizationId = firmante.organizationId

    const reference: string | null = data.metadata?.reference ?? null
    const transactionId = String(data.payment_id ?? body.subject ?? '')
    const amountTotal = Number(data.amount?.total)
    const monto = Number.isFinite(amountTotal) ? amountTotal : null
    const currency = data.amount?.currency || 'COP'
    const metodoCrudo = typeof data.payment_method === 'string' ? data.payment_method.toLowerCase() : null
    const metodoPago = mapToPaymentMethodCode(metodoCrudo, 'bold')
    const paymentStatus = estadoEventoBold(type)

    console.log(`[Bold Webhook] type=${type} ref=${reference ?? '(sin referencia)'} tx=${transactionId} org=${organizationId}`)

    if (!reference) {
      // Link de pago sin referencia: puede ser del ERP.
      return reenviar(cuerpoCrudo, request, reference)
    }

    const datosPago = {
      transactionId,
      amount: monto ?? 0,
      currency,
      method: metodoPago,
      processorResponse: body,
      gateway: 'bold_link',
    }

    // 2a. Anticipo de un pedido contraentrega (ANT-<id>) de la organización que firmó: pago
    //     parcial, idempotente en la base (lib/contraentrega/anticipoWebhook.ts).
    if (esReferenciaAnticipo(reference)) {
      const r = await aplicarAnticipoPasarela(supabase, {
        organizationId,
        referencia: reference,
        estado: paymentStatus,
        transaccionId: transactionId,
        monto,
        moneda: currency,
        pasarela: 'bold_link',
        metodo: metodoPago,
        respuesta: body,
      })
      await registrarEvento(supabase, firmante, type, transactionId, body)
      return NextResponse.json(r.body, { status: r.status })
    } else {
      // Cualquier otra referencia: el flujo de siempre.
    }

    // 2. Otras fuentes de cobro de la tienda
    if (isReservationReference(reference)) {
      const result = await handleReservationPayment(supabase, reference, paymentStatus, datosPago)
      return NextResponse.json({ received: true, source: 'reservation', reservationId: result.reservationId, payment_status: paymentStatus })
    }
    if (isMembershipReference(reference)) {
      const result = await handleMembershipPayment(supabase, reference, paymentStatus, datosPago)
      return NextResponse.json({ received: true, source: 'membership', membershipId: result.membershipId, payment_status: paymentStatus })
    }
    if (isTicketReference(reference)) {
      const result = await handleTicketPayment(supabase, reference, paymentStatus, datosPago)
      return NextResponse.json({ received: true, source: 'trip_ticket', ticketId: result.ticketId, payment_status: paymentStatus })
    }
    if (isParkingPassReference(reference)) {
      const result = await handleParkingPassPayment(supabase, reference, paymentStatus, datosPago)
      return NextResponse.json({ received: true, source: 'parking_pass', passId: result.passId, payment_status: paymentStatus })
    }
    if (isInvoiceReference(reference)) {
      // La factura se busca SOLO en la organización que firmó.
      const result = await handleInvoicePayment(
        supabase,
        reference,
        paymentStatus,
        { transactionId, amount: monto ?? 0, currency, method: metodoPago, gateway: 'bold_link' },
        organizationId
      )
      return NextResponse.json({ received: true, source: 'invoice', invoiceId: result.invoiceId, payment_status: paymentStatus })
    }

    // 3. Pedido web de la organización que firmó
    const { data: webOrder, error: orderError } = await (supabase as any)
      .from('web_orders')
      .select('id, organization_id, branch_id, total, payment_status, order_number')
      .eq('organization_id', organizationId)
      .eq('order_number', reference)
      .limit(1)
      .single()

    // 4. No es de la tienda: al ERP (salvo error real de la base o evento ya reenviado).
    if (debeReenviarAlErp({ pedido: webOrder, error: orderError, cabeceras: request.headers })) {
      return reenviar(cuerpoCrudo, request, reference)
    }
    if (orderError || !webOrder) {
      console.error('[Bold Webhook] Pedido no encontrado:', reference, orderError?.code)
      return NextResponse.json({ error: 'Orden no encontrada', reference }, { status: orderError && orderError.code !== 'PGRST116' ? 500 : 404 })
    }

    const { desenlace } = await aplicarPagoPedidoWeb(
      supabase,
      webOrder,
      {
        estado: paymentStatus,
        transaccionId: transactionId,
        monto,
        moneda: currency,
        metodoPago,
        // El pedido guarda la pasarela, no el submétodo («card», «nequi»): el ERP factura con ese
        // código (payment_methods) y traducía cualquier «card»/«nequi» a Wompi (2026-11-21).
        metodoPedido: METODO_PEDIDO_BOLD,
        respuesta: body,
        proveedor: 'Bold',
        detalle: type,
      },
      'webhook'
    )

    await registrarEvento(supabase, firmante, type, transactionId, body)

    if (desenlace === 'error') {
      // Bold reintenta ante un no-200.
      return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 })
    }
    return NextResponse.json({ received: true, order: reference, payment_status: paymentStatus, result: desenlace })
  } catch (error) {
    console.error('[Bold Webhook] Error inesperado:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function reenviar(cuerpo: Uint8Array, request: NextRequest, referencia: string | null) {
  const r = await reenviarBoldAlErp({
    cuerpo: cuerpo as Uint8Array<ArrayBuffer>,
    cabeceras: request.headers,
    hostEntrante: request.headers.get('host'),
    referencia,
  })
  return new NextResponse(r.cuerpo, { status: r.status, headers: { 'content-type': r.contentType } })
}

async function registrarEvento(
  supabase: any,
  firmante: { organizationId: number; connectionId: string },
  tipo: string,
  transaccionId: string,
  body: unknown
) {
  try {
    await supabase.from('integration_events').insert({
      connection_id: firmante.connectionId,
      organization_id: firmante.organizationId,
      source: 'webhook',
      direction: 'inbound',
      event_type: tipo,
      external_event_id: transaccionId,
      payload: { provider: 'bold', ...(body as Record<string, unknown>) },
      status: 'processed',
      processed_at: new Date().toISOString(),
      // event_time es GENERATED ALWAYS AS (created_at), no se puede insertar.
    })
    await supabase
      .from('integration_webhooks')
      .update({ last_received_at: new Date().toISOString() })
      .eq('connection_id', firmante.connectionId)
      .eq('direction', 'inbound')
  } catch (err) {
    console.error('[Bold Webhook] No se pudo registrar el evento:', err)
  }
}

/** GET /api/webhooks/bold — comprobación de que el receptor existe. */
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'bold_webhook', timestamp: new Date().toISOString() })
}
