/**
 * Aplicar al pedido web lo que dice Bold o Mercado Pago (su webhook o la consulta de
 * /checkout/resultado). Un solo lugar para los dos proveedores y las dos entradas, con las mismas
 * reglas que ya cumple el webhook de Wompi (`app/api/webhooks/wompi_co/route.ts`, que no pasa por
 * aquí):
 *  - nunca se baja de «pagado»: un rechazo viejo o un aviso repetido no tocan un pedido pagado;
 *  - cada aviso hace UNA actualización condicionada; solo quien hace la transición inserta el
 *    pago, avisa al ERP y manda el correo, así que webhook y página de resultado no duplican nada;
 *  - el pago se registra una sola vez por transacción.
 *
 * Además, lo que el webhook de Wompi no revisa: un «aprobado» por menos del total no marca el
 * pedido como pagado (se registra y se deja pendiente para revisión humana).
 *
 * El pedido llega ya resuelto POR ORGANIZACIÓN (el número de pedido no es único entre tiendas).
 */
import { uploadGoogleAdsConversion } from '@/lib/google-ads/upload-conversion'
import { sendMetaCAPIEvent } from '@/lib/meta/send-capi-event'
import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'
import { notifyErpReleaseStock } from '@/lib/erp-release-stock'
import { notifyErpRefund } from '@/lib/erp-refund'
import { enviarCorreoPedidoPagado } from '@/lib/orders/correoPedidoPagado'
import { montoCubreTotal, type EstadoPagoTienda } from '@/lib/payments/pasarelasTienda'

export interface PedidoWebCobrable {
  id: number | string
  organization_id: number
  branch_id: number | null
  total: number | string
  payment_status: string | null
  order_number: string
}

export interface ResultadoPasarela {
  estado: EstadoPagoTienda
  /** Id de la transacción en el proveedor. */
  transaccionId: string
  /** Monto cobrado según el proveedor (`null` si no lo dijo). */
  monto: number | null
  moneda: string
  /** Código de `payments.method` (sale de `mapToPaymentMethodCode`). */
  metodoPago: string
  /** Lo que queda en `web_orders.payment_method`. */
  metodoPedido: string
  /** Respuesta del proveedor que se guarda en `payments.processor_response`. */
  respuesta: unknown
  /** Nombre visible del proveedor, para registros y motivos. */
  proveedor: 'Bold' | 'Mercado Pago'
  /** Detalle del rechazo, si lo hay. */
  detalle?: string | null
}

export type DesenlacePago =
  | 'sin_cambio' // el proveedor aún no decide (pendiente)
  | 'monto_insuficiente' // «aprobado» por menos del total: no se marca pagado
  | 'ya_pagado' // el pedido ya estaba pagado: no se repite nada
  | 'actualizado' // este aviso hizo la transición
  | 'carrera' // otro aviso hizo la transición entre la lectura y la escritura
  | 'error'

/** Desde qué estados puede llegar cada transición (`web_orders_payment_status_check`). */
const CONDICION: Record<Exclude<EstadoPagoTienda, 'pending'>, string> = {
  // Un rechazo previo no impide pagar después: el cliente reintenta con la misma referencia.
  paid: 'payment_status.is.null,payment_status.in.(pending,failed,partial)',
  failed: 'payment_status.is.null,payment_status.eq.pending',
  refunded: 'payment_status.eq.paid',
}

export async function aplicarPagoPedidoWeb(
  supabase: any,
  pedido: PedidoWebCobrable,
  r: ResultadoPasarela,
  origen: 'webhook' | 'resultado',
): Promise<{ desenlace: DesenlacePago; transicion: boolean }> {
  const etiqueta = `[${r.proveedor} ${origen}]`
  const organizationId = pedido.organization_id

  if (r.estado === 'pending') return { desenlace: 'sin_cambio', transicion: false }

  if (r.estado === 'paid' && !montoCubreTotal(r.monto, pedido.total)) {
    console.error(
      `${etiqueta} Pedido ${pedido.order_number}: aprobado por ${r.monto ?? 'monto desconocido'} y el total es ${pedido.total}; NO se marca pagado (tx ${r.transaccionId})`
    )
    return { desenlace: 'monto_insuficiente', transicion: false }
  }

  // ¿Ya pagado (por el webhook, por /checkout/resultado o por el POS)? Solo un reembolso sigue.
  const { data: pagosPrevios } = await supabase
    .from('payments')
    .select('id, reference, status, processor_response')
    .eq('organization_id', organizationId)
    .eq('source', 'web_order')
    .eq('source_id', String(pedido.id))
    .in('status', ['completed', 'paid'])
    .order('created_at', { ascending: true })
    .limit(1)
  const pagoPrevio = Array.isArray(pagosPrevios) && pagosPrevios.length > 0 ? pagosPrevios[0] : null
  const yaPagado = pedido.payment_status === 'paid' || !!pagoPrevio
  if (yaPagado && r.estado !== 'refunded') {
    if (r.estado === 'paid' && pagoPrevio) {
      const adjuntos: Record<string, unknown> = {}
      if (!pagoPrevio.reference && r.transaccionId) adjuntos.reference = r.transaccionId
      if (!pagoPrevio.processor_response) adjuntos.processor_response = r.respuesta
      if (Object.keys(adjuntos).length > 0) await supabase.from('payments').update(adjuntos).eq('id', pagoPrevio.id)
    }
    return { desenlace: 'ya_pagado', transicion: false }
  }

  const ahora = new Date().toISOString()
  const campos: Record<string, unknown> = {
    payment_status: r.estado,
    payment_method: r.metodoPedido,
    payment_reference: r.transaccionId,
    updated_at: ahora,
    ...(r.estado === 'paid' && { status: 'confirmed', confirmed_at: ahora }),
    ...(r.estado === 'failed' && {
      status: 'cancelled',
      cancelled_at: ahora,
      cancellation_reason: `Pago rechazado por ${r.proveedor}${r.detalle ? `: ${r.detalle}` : ''}`,
    }),
  }
  const actualizacion = await supabase
    .from('web_orders')
    .update(campos)
    .eq('id', pedido.id)
    .eq('organization_id', organizationId)
    .or(CONDICION[r.estado])
    .select('id')
  if (actualizacion.error) {
    console.error(`${etiqueta} Error actualizando el pedido ${pedido.order_number}:`, actualizacion.error)
    return { desenlace: 'error', transicion: false }
  }
  const transicion = Array.isArray(actualizacion.data) && actualizacion.data.length > 0
  if (!transicion) return { desenlace: 'carrera', transicion: false }

  const monto = r.monto ?? Number(pedido.total)
  const { data: mismoPago } = await supabase
    .from('payments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('source', 'web_order')
    .eq('source_id', String(pedido.id))
    .eq('reference', r.transaccionId)
    .in('status', r.estado === 'paid' ? ['paid', 'completed'] : [r.estado])
    .limit(1)
  if (!(Array.isArray(mismoPago) && mismoPago.length > 0)) {
    await supabase.from('payments').insert({
      organization_id: organizationId,
      branch_id: pedido.branch_id,
      source: 'web_order',
      source_id: String(pedido.id),
      method: r.metodoPago,
      amount: monto,
      currency: r.moneda || 'COP',
      reference: r.transaccionId,
      processor_response: r.respuesta,
      status: r.estado,
    })
  }

  if (r.estado === 'paid') {
    uploadGoogleAdsConversion(supabase, organizationId, {
      orderId: pedido.order_number,
      value: monto,
      currency: r.moneda || 'COP',
      category: 'purchase',
    }).catch((err) => console.error(`${etiqueta} Google Ads:`, err))
    sendMetaCAPIEvent(supabase, organizationId, {
      eventName: 'Purchase',
      eventId: pedido.order_number,
      value: monto,
      currency: r.moneda || 'COP',
    }).catch((err) => console.error(`${etiqueta} Meta CAPI:`, err))
    // Venta, factura, cuenta por cobrar, stock y envío en el ERP; correo «Pago confirmado».
    notifyErpAutoConfirm(String(pedido.id)).catch((err) => console.error(`${etiqueta} ERP auto-confirm:`, err))
    enviarCorreoPedidoPagado(String(pedido.id)).catch((err) => console.error(`${etiqueta} Correo de pago confirmado:`, err))
  } else if (r.estado === 'failed') {
    notifyErpReleaseStock(String(pedido.id)).catch((err) => console.error(`${etiqueta} ERP release-stock:`, err))
  } else {
    notifyErpRefund(String(pedido.id), { reason: `Reembolso procesado por ${r.proveedor}` }).catch((err) =>
      console.error(`${etiqueta} ERP refund:`, err)
    )
  }

  console.log(`${etiqueta} Pedido ${pedido.order_number} → ${r.estado} (tx ${r.transaccionId})`)
  return { desenlace: 'actualizado', transicion: true }
}
