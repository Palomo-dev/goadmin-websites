/**
 * Correo «Recibimos tu pedido» de un pedido contraentrega cuando su anticipo YA se pagó (Figma
 * 3019:76125 › 13): «Pagaste hoy (el envío) · Wompi $ 9.000» y «Pagas al recibir $ 142.000». Lo
 * envía el webhook del anticipo solo en la transición a pagado. Mismo armado que el correo de pago
 * confirmado (`lib/orders/correoPedidoPagado.ts`): marca de la tienda, enlace con token, clave de
 * envío del vault. Nunca lanza.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { registrarCorreoPedido } from '@/lib/email/registrarCorreoPedido'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { claveResend } from '@/lib/orders/claveResend'
import { origenSitio } from '@/lib/orders/cargarOrigenSitio'
import { lineasConFoto } from '@/lib/orders/fotosLinea'
import { rutaSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { cobroEnPuerta, CONDICIONES_POR_DEFECTO } from './reglaContraentrega'
import { leerCondicionesContraentrega } from './contraentregaServidor'
import { fraseMedios, nombrePasarela } from './textosContraentrega'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function enviarCorreoAnticipoPagado(webOrderId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    if (!supabase) return
    const sb = supabase as any
    const { data: pedido, error } = await sb
      .from('web_orders')
      .select('id, order_number, organization_id, branch_id, customer_email, customer_name, subtotal, tax_total, delivery_fee, discount_total, tip_amount, total, delivery_type, internal_notes, coupon_code, advance_amount, advance_status, advance_gateway, web_order_items ( product_id, product_name, quantity, unit_price, total )')
      .eq('id', webOrderId)
      .maybeSingle()
    if (error || !pedido?.customer_email || pedido.advance_status !== 'paid') return
    const apiKey = await claveResend(sb)
    if (!apiKey) {
      console.error('[Anticipo] Falta la clave de envío: correo sin enviar', { webOrderId })
      return
    }
    const [{ data: org }, condiciones] = await Promise.all([
      sb.from('organizations').select('name, type_id').eq('id', pedido.organization_id).maybeSingle(),
      leerCondicionesContraentrega(sb, Number(pedido.organization_id), pedido.branch_id ?? null),
    ])
    const origen = await origenSitio(sb, pedido.organization_id)
    const marca = await cargarMarcaPedido(sb, pedido.organization_id, pedido.branch_id ?? null)
    const esRestaurante = Number(org?.type_id) === 1
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
      paymentStatus: 'pending',
      esRestaurante,
      tipoEntrega: etiquetaTipoEntrega(pedido.delivery_type, esRestaurante, pedido.internal_notes),
      contraentrega: {
        anticipoPagado: num(pedido.advance_amount),
        pasarela: pedido.advance_gateway ? nombrePasarela(pedido.advance_gateway) : null,
        alRecibir: cobroEnPuerta(pedido.total, { monto: pedido.advance_amount, estado: pedido.advance_status }),
        medios: `${fraseMedios((condiciones ?? CONDICIONES_POR_DEFECTO).medios)}.`,
        // El pedido no guarda la base del anticipo: si coincide con el envío, fue el envío (como la página del pedido).
        delEnvio: num(pedido.delivery_fee) > 0 && Math.abs(num(pedido.delivery_fee) - num(pedido.advance_amount)) < 0.5,
      },
    }, { apiKey })
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
    console.error('[Anticipo] Error enviando el correo', { webOrderId, err })
  }
}
