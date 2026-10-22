/**
 * Correo «Pago confirmado» de un pedido web pagado por pasarela.
 *
 * `/api/orders` ya no envía el correo cuando el pago va por Wompi (sería un «confirmado» de un pago
 * que aún puede fallar); lo envía el webhook cuando el pago pasa de `pending` a `paid`, con esta
 * función. Lee el pedido, sus líneas, la organización y la sede con el cliente de servidor, y
 * arma el enlace de seguimiento (con su token) en el dominio del sitio de la organización.
 *
 * Nunca lanza: un fallo del correo no puede tumbar el webhook.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { registrarCorreoPedido } from '@/lib/email/registrarCorreoPedido'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { origenSitio } from '@/lib/orders/cargarOrigenSitio'
import { lineasConFoto } from '@/lib/orders/fotosLinea'
import { rutaSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { momentoPedido } from '@/lib/restaurant/ventanaPedido'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function enviarCorreoPedidoPagado(webOrderId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[CorreoPedido] Falta SUPABASE_SERVICE_ROLE_KEY: correo de pago sin enviar', { webOrderId })
      return
    }
    const sb = supabase as any
    const { data: pedido, error } = await sb
      .from('web_orders')
      .select('id, order_number, organization_id, branch_id, customer_email, customer_name, subtotal, tax_total, delivery_fee, discount_total, tip_amount, total, delivery_type, internal_notes, is_scheduled, scheduled_at, coupon_code, web_order_items ( product_id, product_name, quantity, unit_price, total )')
      .eq('id', webOrderId)
      .maybeSingle()
    if (error || !pedido?.customer_email) {
      if (error) console.error('[CorreoPedido] No se pudo leer el pedido', { webOrderId, error: error.message })
      return
    }
    const [{ data: org }, { data: sede }] = await Promise.all([
      sb.from('organizations').select('name, type_id, timezone').eq('id', pedido.organization_id).maybeSingle(),
      sb.from('branches').select('timezone').eq('id', pedido.branch_id).eq('organization_id', pedido.organization_id).maybeSingle(),
    ])
    const zona = sede?.timezone || org?.timezone || null
    const esRestaurante = Number(org?.type_id) === 1
    const origen = await origenSitio(sb, pedido.organization_id)
    const marca = await cargarMarcaPedido(sb, pedido.organization_id, pedido.branch_id ?? null)

    const envio = await sendOrderConfirmationEmail({
      orderNumber: pedido.order_number,
      customerEmail: pedido.customer_email,
      customerName: pedido.customer_name || '',
      items: await lineasConFoto(sb, Number(pedido.organization_id), origen, pedido.web_order_items || []),
      subtotal: num(pedido.subtotal),
      tax: num(pedido.tax_total),
      shipping: num(pedido.delivery_fee),
      tip: num(pedido.tip_amount),
      discount: num(pedido.discount_total),
      ...(pedido.coupon_code ? { couponCode: pedido.coupon_code } : {}),
      total: num(pedido.total),
      organizationName: marca.nombre || org?.name || '',
      marca,
      trackingUrl: origen ? `${origen}${rutaSeguimiento(pedido.organization_id, pedido)}` : '',
      paymentStatus: 'paid',
      tipoEntrega: etiquetaTipoEntrega(pedido.delivery_type, esRestaurante, pedido.internal_notes),
      programadoPara: pedido.is_scheduled && pedido.scheduled_at ? momentoPedido(pedido.scheduled_at, zona) : null,
    })
    await registrarCorreoPedido(sb, {
      webOrderId,
      organizationId: Number(pedido.organization_id),
      email: String(pedido.customer_email),
      tipo: 'pedido_pagado',
      resendId: envio.id,
      estado: envio.ok ? 'enviado' : 'error',
      error: envio.ok ? null : 'no se pudo enviar',
    })
  } catch (err) {
    console.error('[CorreoPedido] Error enviando el correo de pago confirmado', { webOrderId, err })
  }
}
