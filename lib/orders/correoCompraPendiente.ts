/**
 * Correo «Tu compra quedó pendiente» de un pedido del sitio que no se pagó.
 *
 * Mismo sobre que el de pago confirmado: marca de la tienda, tabla de productos
 * y el total guardado en el pedido. El botón abre `/retomar/<id>`, que vuelve a
 * armar el carrito. Nunca lanza: un fallo del correo no puede tumbar el cron.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { origenSitio } from '@/lib/orders/correoPedidoPagado'
import { rutaRetomar } from '@/lib/orders/tokenSeguimiento'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function enviarCorreoCompraPendiente(webOrderId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[CorreoPendiente] Falta SUPABASE_SERVICE_ROLE_KEY', { webOrderId })
      return false
    }
    const sb = supabase as any
    const { data: pedido, error } = await sb
      .from('web_orders')
      .select('id, order_number, organization_id, branch_id, payment_status, customer_email, customer_name, subtotal, tax_total, delivery_fee, discount_total, total, coupon_code, web_order_items ( product_name, quantity, unit_price, total )')
      .eq('id', webOrderId)
      .maybeSingle()
    if (error || !pedido?.customer_email) {
      if (error) console.error('[CorreoPendiente] No se pudo leer el pedido', { webOrderId, error: error.message })
      return false
    }
    // Pagó entre el sello y el envío: no se escribe, y el sello se queda.
    if (pedido.payment_status === 'paid') return true
    const { data: org } = await sb
      .from('organizations')
      .select('name, custom_domain, subdomain')
      .eq('id', pedido.organization_id)
      .maybeSingle()
    const origen = org ? origenSitio(org) : ''
    const ruta = rutaRetomar(pedido.organization_id, pedido.id)
    if (!origen || !ruta) {
      console.error('[CorreoPendiente] Sin sitio o sin token de retoma', { webOrderId })
      return false
    }
    const marca = await cargarMarcaPedido(sb, pedido.organization_id, pedido.branch_id ?? null)
    return await sendOrderConfirmationEmail({
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
      organizationName: marca.nombre || org?.name || '',
      marca,
      trackingUrl: `${origen}${ruta}`,
      compraPendiente: true,
    })
  } catch (err) {
    console.error('[CorreoPendiente] Error enviando el correo', { webOrderId, err })
    return false
  }
}
