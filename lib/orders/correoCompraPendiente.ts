/**
 * Correo «Tu compra quedó pendiente» de un pedido del sitio que no se pagó.
 *
 * Mismo sobre que el de pago confirmado: marca de la tienda, tabla de productos
 * y el total guardado en el pedido. El botón abre `/retomar/<id>` en el dominio
 * propio de la tienda. Nunca lanza: un fallo del correo no puede tumbar el cron.
 *
 * `reintentar` pide quitar el sello. `omitido` lo deja: ese pedido no se vuelve
 * a evaluar (ya se pagó, o alguien lo canceló a mano entre el reclamo y el envío).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { registrarCorreoPedido } from '@/lib/email/registrarCorreoPedido'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { esCancelacionManual } from '@/lib/orders/compraPendiente'
import { claveResend } from '@/lib/orders/claveResend'
import { origenSitio } from '@/lib/orders/cargarOrigenSitio'
import { lineasConFoto } from '@/lib/orders/fotosLinea'
import { rutaRetomar } from '@/lib/orders/tokenSeguimiento'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type ResultadoEnvioPendiente =
  | { accion: 'enviado' }
  | { accion: 'omitido' }
  | { accion: 'reintentar' }

export async function enviarCorreoCompraPendiente(webOrderId: string): Promise<ResultadoEnvioPendiente> {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[CorreoPendiente] Falta SUPABASE_SERVICE_ROLE_KEY', { webOrderId })
      return { accion: 'reintentar' }
    }
    const sb = supabase as any
    const apiKey = await claveResend(sb)
    if (!apiKey) {
      console.error('[CorreoPendiente] Falta la clave de envío', { webOrderId })
      return { accion: 'reintentar' }
    }
    const { data: pedido, error } = await sb
      .from('web_orders')
      .select('id, order_number, organization_id, branch_id, status, payment_status, cancelled_by, cancellation_reason, customer_email, customer_name, subtotal, tax_total, delivery_fee, discount_total, tip_amount, total, coupon_code, web_order_items ( product_id, product_name, quantity, unit_price, total )')
      .eq('id', webOrderId)
      .maybeSingle()
    if (error || !pedido?.customer_email) {
      if (error) console.error('[CorreoPendiente] No se pudo leer el pedido', { webOrderId, error: error.message })
      return { accion: 'reintentar' }
    }
    const organizationId = Number(pedido.organization_id)
    if (pedido.payment_status === 'paid') {
      await registrarCorreoPedido(sb, {
        webOrderId,
        organizationId,
        email: String(pedido.customer_email),
        tipo: 'compra_pendiente',
        resendId: null,
        estado: 'omitido',
        error: 'ya pagado',
      })
      return { accion: 'omitido' }
    }
    if (esCancelacionManual({
      status: String(pedido.status || ''),
      cancelledBy: pedido.cancelled_by ?? null,
      cancellationReason: pedido.cancellation_reason ?? null,
    })) {
      await registrarCorreoPedido(sb, {
        webOrderId,
        organizationId,
        email: String(pedido.customer_email),
        tipo: 'compra_pendiente',
        resendId: null,
        estado: 'omitido',
        error: 'cancelacion manual',
      })
      return { accion: 'omitido' }
    }
    const { data: org } = await sb.from('organizations').select('name').eq('id', organizationId).maybeSingle()
    const origen = await origenSitio(sb, organizationId)
    const ruta = rutaRetomar(organizationId, pedido.id)
    if (!origen || !ruta) {
      console.error('[CorreoPendiente] Sin sitio o sin token de retoma', { webOrderId })
      return { accion: 'reintentar' }
    }
    const marca = await cargarMarcaPedido(sb, organizationId, pedido.branch_id ?? null)
    const envio = await sendOrderConfirmationEmail({
      orderNumber: pedido.order_number,
      customerEmail: pedido.customer_email,
      customerName: pedido.customer_name || '',
      items: await lineasConFoto(sb, organizationId, origen, pedido.web_order_items || []),
      subtotal: num(pedido.subtotal),
      tax: num(pedido.tax_total),
      shipping: num(pedido.delivery_fee),
      tip: num(pedido.tip_amount),
      discount: num(pedido.discount_total),
      ...(pedido.coupon_code ? { couponCode: pedido.coupon_code } : {}),
      total: num(pedido.total),
      organizationName: marca.nombre || org?.name || '',
      marca,
      trackingUrl: `${origen}${ruta}`,
      compraPendiente: true,
    }, { apiKey })
    await registrarCorreoPedido(sb, {
      webOrderId,
      organizationId,
      email: String(pedido.customer_email),
      tipo: 'compra_pendiente',
      resendId: envio.id,
      estado: envio.ok ? 'enviado' : 'error',
      error: envio.ok ? null : 'no se pudo enviar',
    })
    return envio.ok ? { accion: 'enviado' } : { accion: 'reintentar' }
  } catch (err) {
    console.error('[CorreoPendiente] Error enviando el correo', { webOrderId, err })
    return { accion: 'reintentar' }
  }
}
