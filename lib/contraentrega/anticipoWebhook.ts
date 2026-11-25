/**
 * Anticipo de un pedido contraentrega (`ANT-<id del pedido>`) llegado por el webhook de una
 * pasarela. Fuera de las rutas protegidas: los webhooks solo añaden un ramal que llama aquí.
 *
 * - Wompi: firma OBLIGATORIA y falla cerrado, idempotente por transacción en
 *   `integration_events` (`procesarCobroFirmadoWompi`, el mismo esqueleto del depósito de mesa).
 * - Bold y Mercado Pago: la organización ya viene verificada por su webhook (la llave que firma o
 *   la conexión dueña del pago); aquí solo se exige que el pedido sea DE esa organización.
 *
 * El resultado lo aplica la base en una transacción (`fn_web_order_anticipo_resultado`,
 * ERP 20261124230000), idempotente por transacción y por estado: el pedido queda con
 * `advance_status='paid'` y `payment_status='partial'` (NO 'paid': falta lo que se cobra en la
 * puerta), y el pago entra a `payments` como cobro de pasarela.
 *
 * Solo la transición a pagado (`status === 'pagado'`; un reintento responde `ya_pagado`) hace dos
 * cosas, una vez:
 * - el correo «Recibimos tu pedido» con «Pagaste hoy / Pagas al recibir»;
 * - la confirmación automática del pedido en el ERP (pedido del dueño, 2026-11-24): el mismo
 *   `notifyErpAutoConfirm` de las pasarelas. El ERP la reconoce por el estado del pedido
 *   (contraentrega, `partial`, anticipo pagado) y la hace con la regla del botón «Confirmar
 *   pedido»: venta, stock y envío por el resto, sin factura ni pago nuevos. El aviso de WhatsApp
 *   «confirmado» lo manda el ERP una sola vez; el correo no se repite. Si falla, el pedido queda
 *   «Pendiente» con el anticipo pagado y el ERP anota el motivo para el equipo.
 *
 * Anticipo pagado con el pedido VENCIDO (2026-11-25, ERP 20261125121000): la base responde
 * `pagado_tarde_reactivable` (reactivado con stock, hasta 24 h) o `pagado_vencido_*` (decide una
 * persona). Va en el `else` de «pagado», que no cambia: `avisarAnticipoTardio` (avisoAnticipoTardio.ts).
 */

import { procesarCobroFirmadoWompi, type ResultadoCobroFirmado } from '@/lib/payments/wompi-cobro-firmado'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import { estadoDepositoWompi } from '@/lib/restaurant/deposito-modelo'
import { FUENTE_COBRO_ANTICIPO, idDeReferenciaAnticipo } from './contraentregaServidor'
import { enviarCorreoAnticipoPagado } from './correoAnticipo'
import { avisarAnticipoTardio } from './avisoAnticipoTardio'
import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'
import { registrarIntentoPago } from '@/lib/payments/intentosPago'
import { intentoDeWompi, type DatosIntento } from '@/lib/payments/intentosPagoReglas'

async function pedidoDelAnticipo(supabase: any, referencia: string, organizationId: number | null) {
  const id = idDeReferenciaAnticipo(referencia)
  if (!id) return null
  let consulta = supabase.from('web_orders').select('id, organization_id').eq('id', id)
  if (organizationId !== null) {
    consulta = consulta.eq('organization_id', organizationId)
  } else {
    // Wompi: la organización sale del propio pedido (uuid único) y luego se verifica su firma.
  }
  const { data, error } = await consulta.maybeSingle()
  if (error || !data) {
    if (error) console.error('[Anticipo] No se pudo leer el pedido', { referencia, code: error.code })
    return null
  }
  return { id: String(data.id), organizationId: Number(data.organization_id) }
}

export async function procesarAnticipoWompi(supabase: any, body: Record<string, any>): Promise<ResultadoCobroFirmado> {
  return procesarCobroFirmadoWompi<{ id: string }>(supabase, body, {
    fuente: FUENTE_COBRO_ANTICIPO,
    etiqueta: 'Anticipo de contraentrega',
    noEncontrado: 'Pedido no encontrado',
    buscar: (db, reference) => pedidoDelAnticipo(db, reference, null),
    aplicar: (db, pedido, transaction) =>
      db.rpc('fn_web_order_anticipo_resultado', {
        p_organization_id: pedido.organizationId,
        p_order_id: pedido.id,
        // APPROVED → paid, DECLINED/ERROR → failed, VOIDED → refunded (mismo mapeo del depósito).
        p_estado: estadoDepositoWompi(transaction.status),
        p_transaction_id: String(transaction.id ?? ''),
        p_monto: Number(transaction.amount_in_cents ?? 0) / 100,
        p_moneda: transaction.currency || 'COP',
        p_pasarela: 'wompi_co',
        p_metodo: mapToPaymentMethodCode(transaction.payment_method_type, 'wompi'),
        p_respuesta: transaction,
      }),
    despues: async (db, pedido, resultado, transaction) => {
      // Historial de intentos del ANTICIPO (firma ya verificada por procesarCobroFirmadoWompi).
      await registrarIntentoPago(db, { organizationId: pedido.organizationId, webOrderId: pedido.id, concepto: 'advance' }, intentoDeWompi(transaction))
      if (resultado?.status === 'pagado') {
        await enviarCorreoAnticipoPagado(pedido.id)
        await notifyErpAutoConfirm(pedido.id)
      } else {
        // Ya pagado, rechazado, pendiente o pedido cerrado: sin correo ni confirmación. Pedido
        // VENCIDO con el anticipo recién pagado (ERP 20261125121000): aviso al ERP y correo
        // «sigue en pie» / «lo estamos revisando»; con cualquier otro estado no hace nada.
        await avisarAnticipoTardio(pedido.id, resultado?.status)
      }
    },
    respuesta: (pedido, resultado, transaction) => ({
      received: true,
      source: FUENTE_COBRO_ANTICIPO,
      orderId: pedido.id,
      payment_status: estadoDepositoWompi(transaction.status),
      ...(resultado?.status ? { status: resultado.status } : {}),
      ...(resultado?.motivo ? { motivo: resultado.motivo } : {}),
    }),
  })
}

export interface AvisoAnticipo {
  /** Organización YA verificada por el webhook (firma o conexión dueña del pago). */
  organizationId: number
  referencia: string
  estado: 'paid' | 'failed' | 'refunded' | 'pending'
  transaccionId: string
  monto: number | null
  moneda: string
  /** Código de conector: 'bold_link', 'mp_checkout'. */
  pasarela: string
  metodo: string
  respuesta: unknown
  /** Intento para el historial del anticipo (recortado: nunca la respuesta completa). */
  intento?: DatosIntento | null
}

/** Bold y Mercado Pago. Devuelve status y cuerpo para el webhook (un no-200 hace que reintenten). */
export async function aplicarAnticipoPasarela(supabase: any, a: AvisoAnticipo): Promise<{ status: number; body: Record<string, unknown> }> {
  const pedido = await pedidoDelAnticipo(supabase, a.referencia, a.organizationId)
  if (!pedido) {
    console.error('[Anticipo] Pedido no encontrado en la organización que firmó', { referencia: a.referencia, organizationId: a.organizationId })
    return { status: 404, body: { error: 'Pedido no encontrado', reference: a.referencia } }
  }
  // Historial de intentos del ANTICIPO (organización ya verificada por el webhook).
  await registrarIntentoPago(supabase, { organizationId: pedido.organizationId, webOrderId: pedido.id, concepto: 'advance' }, a.intento)
  const { data, error } = await supabase.rpc('fn_web_order_anticipo_resultado', {
    p_organization_id: pedido.organizationId,
    p_order_id: pedido.id,
    p_estado: a.estado,
    p_transaction_id: a.transaccionId,
    p_monto: a.monto ?? 0,
    p_moneda: a.moneda || 'COP',
    p_pasarela: a.pasarela,
    p_metodo: a.metodo,
    p_respuesta: a.respuesta ?? null,
  })
  if (error) {
    console.error('[Anticipo] La RPC falló', { referencia: a.referencia, code: error.code })
    return { status: 500, body: { error: 'No se pudo aplicar el pago' } }
  }
  if (data?.status === 'pagado') {
    await enviarCorreoAnticipoPagado(pedido.id).catch((e) => console.error('[Anticipo] Correo', e))
    // notifyErpAutoConfirm nunca lanza (red y respuestas del ERP quedan en el log).
    await notifyErpAutoConfirm(pedido.id)
  } else {
    // Sin transición a pagado: sin correo ni confirmación. Pedido VENCIDO con el anticipo recién
    // pagado (ERP 20261125121000): aviso al ERP y correo «sigue en pie» / «lo estamos revisando».
    await avisarAnticipoTardio(pedido.id, data?.status)
  }
  return {
    status: 200,
    body: {
      received: true,
      source: FUENTE_COBRO_ANTICIPO,
      orderId: pedido.id,
      payment_status: a.estado,
      ...(data?.status ? { status: data.status } : {}),
      ...(data?.motivo ? { motivo: data.motivo } : {}),
    },
  }
}
