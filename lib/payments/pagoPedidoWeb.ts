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
 * Desde el 2026-11-24 (decisión del dueño): un rechazo NO cancela el pedido ni libera el stock; el
 * pedido sigue «Pendiente» con el pago rechazado hasta que venza (`camposPedidoPorPago`). Cada
 * resultado deja además su renglón en el historial de intentos (`r.intento`, lib/payments/intentosPago.ts).
 *
 * El pedido llega ya resuelto POR ORGANIZACIÓN (el número de pedido no es único entre tiendas).
 */
import { uploadGoogleAdsConversion } from '@/lib/google-ads/upload-conversion'
import { sendMetaCAPIEvent } from '@/lib/meta/send-capi-event'
import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'
import { notifyErpRefund } from '@/lib/erp-refund'
import { enviarCorreoPedidoPagado } from '@/lib/orders/correoPedidoPagado'
import { montoCubreTotal, type EstadoPagoTienda } from '@/lib/payments/pasarelasTienda'
import { registrarIntentoPago, type DatosIntento } from '@/lib/payments/intentosPago'

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
  /**
   * El intento tal como se guarda en el historial del pedido (`web_order_payment_attempts`), ya
   * recortado: nunca la respuesta completa. Sin él (o null) no se registra intento.
   */
  intento?: DatosIntento | null
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
  // Un segundo rechazo (el cliente reintentó y volvió a fallar) también actualiza la referencia.
  failed: 'payment_status.is.null,payment_status.in.(pending,failed)',
  refunded: 'payment_status.eq.paid',
}

/**
 * Lo que un resultado de la pasarela le escribe al pedido además de `payment_status`, la pasarela
 * y la referencia. Lo usan esta pieza (Bold y Mercado Pago) y el webhook de Wompi: una sola regla.
 *
 * Decisión del dueño (2026-11-24, diseño «Pagos del pedido: método e intentos»): un RECHAZO ya no
 * cancela el pedido. Queda «Pendiente» con `payment_status = 'failed'` y su reserva de stock hasta
 * que venza el plazo (`expire_pending_web_orders`), para que el cliente reintente o se le reenvíe
 * el enlace. Antes se cancelaba y se liberaba el stock, y si el cliente pagaba después el pedido
 * volvía a «Confirmado» con el stock ya liberado.
 */
export function camposPedidoPorPago(estado: Exclude<EstadoPagoTienda, 'pending'>, ahora: string): Record<string, unknown> {
  if (estado === 'paid') {
    return { status: 'confirmed', confirmed_at: ahora }
  } else {
    // Rechazado: el pedido sigue «Pendiente» (sin cancelled_at ni motivo de cancelación).
    // Reembolsado: el estado lo lleva el ERP (notifyErpRefund), como siempre.
    return {}
  }
}

/** Un rechazo solo toca un pedido que sigue «Pendiente» (nunca uno confirmado a mano o cerrado). */
export const ESTADO_PEDIDO_QUE_ADMITE_RECHAZO = 'pending'

export async function aplicarPagoPedidoWeb(
  supabase: any,
  pedido: PedidoWebCobrable,
  r: ResultadoPasarela,
  origen: 'webhook' | 'resultado',
): Promise<{ desenlace: DesenlacePago; transicion: boolean }> {
  const etiqueta = `[${r.proveedor} ${origen}]`
  const organizationId = pedido.organization_id

  // Historial de intentos (también pendientes, rechazos tardíos y montos insuficientes): la
  // organización ya la verificó quien llama. Nunca bloquea ni cambia lo que sigue.
  if (r.intento) {
    await registrarIntentoPago(supabase, { organizationId, webOrderId: pedido.id, concepto: 'order' }, r.intento)
  } else {
    // Sin datos del intento: como antes.
  }

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
    ...camposPedidoPorPago(r.estado, ahora),
  }
  let consulta = supabase
    .from('web_orders')
    .update(campos)
    .eq('id', pedido.id)
    .eq('organization_id', organizationId)
    .or(CONDICION[r.estado])
  if (r.estado === 'failed') {
    // El rechazo no cancela: solo marca el pago de un pedido que sigue «Pendiente».
    consulta = consulta.eq('status', ESTADO_PEDIDO_QUE_ADMITE_RECHAZO)
  } else {
    // Pagado o reembolsado: la condición de siempre.
  }
  const actualizacion = await consulta.select('id')
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
    // El pedido sigue apartado hasta que venza (expire_pending_web_orders libera el stock): no se
    // libera aquí. `notifyErpReleaseStock` queda para quien sí cierra el pedido.
    console.log(`${etiqueta} Pedido ${pedido.order_number}: pago rechazado; sigue pendiente hasta vencer`)
  } else {
    notifyErpRefund(String(pedido.id), { reason: `Reembolso procesado por ${r.proveedor}` }).catch((err) =>
      console.error(`${etiqueta} ERP refund:`, err)
    )
  }

  console.log(`${etiqueta} Pedido ${pedido.order_number} → ${r.estado} (tx ${r.transaccionId})`)
  return { desenlace: 'actualizado', transicion: true }
}
