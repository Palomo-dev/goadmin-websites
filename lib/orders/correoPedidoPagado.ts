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
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { rutaSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { momentoPedido } from '@/lib/restaurant/ventanaPedido'

function origenSitio(org: { custom_domain?: string | null; subdomain?: string | null }): string {
  if (org.custom_domain) return `https://${org.custom_domain}`
  if (org.subdomain) return `https://${org.subdomain}.goadmin.io`
  return ''
}

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
      .select('id, order_number, organization_id, branch_id, customer_email, customer_name, subtotal, tax_total, delivery_fee, discount_total, total, delivery_type, internal_notes, is_scheduled, scheduled_at, coupon_code, web_order_items ( product_name, quantity, unit_price, total )')
      .eq('id', webOrderId)
      .maybeSingle()
    if (error || !pedido?.customer_email) {
      if (error) console.error('[CorreoPedido] No se pudo leer el pedido', { webOrderId, error: error.message })
      return
    }
    const [{ data: org }, { data: sede }] = await Promise.all([
      sb.from('organizations').select('name, type_id, timezone, custom_domain, subdomain').eq('id', pedido.organization_id).maybeSingle(),
      sb.from('branches').select('timezone').eq('id', pedido.branch_id).eq('organization_id', pedido.organization_id).maybeSingle(),
    ])
    const zona = sede?.timezone || org?.timezone || null
    const esRestaurante = Number(org?.type_id) === 1
    const origen = org ? origenSitio(org) : ''

    await sendOrderConfirmationEmail({
      orderNumber: pedido.order_number,
      customerEmail: pedido.customer_email,
      customerName: pedido.customer_name || '',
      items: (pedido.web_order_items || []).map((i: any) => ({
        name: String(i.product_name || ''),
        quantity: num(i.quantity),
        unitPrice: num(i.unit_price),
        total: num(i.total),
      })),
      subtotal: num(pedido.subtotal),
      tax: num(pedido.tax_total),
      shipping: num(pedido.delivery_fee),
      discount: num(pedido.discount_total),
      ...(pedido.coupon_code ? { couponCode: pedido.coupon_code } : {}),
      total: num(pedido.total),
      organizationName: org?.name || '',
      trackingUrl: `${origen}${rutaSeguimiento(pedido.organization_id, pedido)}`,
      paymentStatus: 'paid',
      tipoEntrega: etiquetaTipoEntrega(pedido.delivery_type, esRestaurante, pedido.internal_notes),
      programadoPara: pedido.is_scheduled && pedido.scheduled_at ? momentoPedido(pedido.scheduled_at, zona) : null,
    })
  } catch (err) {
    console.error('[CorreoPedido] Error enviando el correo de pago confirmado', { webOrderId, err })
  }
}
