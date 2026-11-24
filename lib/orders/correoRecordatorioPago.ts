/**
 * Envía el correo «Termina tu pago» de UN pedido ya reclamado en `web_order_email_log`.
 *
 * Vuelve a leer el pedido (pudo pagarse o vencer entre la selección y el envío), arma el mismo
 * sobre que los demás correos del pedido (`sendOrderConfirmationEmail` con la marca de la tienda)
 * y cierra la fila reclamada. El botón «Pagar ahora» abre `/pedido/<n>?t=<token>` en el dominio
 * del sitio: esa página ya trae «Pagar», que va por `/api/checkout/init`.
 *
 * Nunca lanza: un fallo del correo no puede tumbar el cron.
 */

import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { cerrarCorreoPedido } from '@/lib/email/registrarCorreoPedido'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { origenSitio } from '@/lib/orders/cargarOrigenSitio'
import { apartadoHasta } from '@/lib/orders/consultaPedido'
import { lineasConFoto } from '@/lib/orders/fotosLinea'
import { MARGEN_RECORDATORIO_MS } from '@/lib/orders/recordatorioPago'
import { rutaSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { diaPedido, fechaHoraPedido, horaPedido } from '@/lib/restaurant/ventanaPedido'

type Cliente = { from: (tabla: string) => any }

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type ResultadoRecordatorio = 'enviado' | 'omitido' | 'error'

export async function enviarRecordatorioPago(
  supabase: Cliente,
  entrada: { webOrderId: string; plazoMinutos: number; reclamoId: string; apiKey: string },
): Promise<ResultadoRecordatorio> {
  const sb = supabase as any
  const cerrar = (estado: 'enviado' | 'omitido' | 'error', resendId: string | null, error: string | null) =>
    cerrarCorreoPedido(sb, entrada.reclamoId, { estado, resendId, error })
  try {
    const { data: pedido, error } = await sb
      .from('web_orders')
      .select('id, order_number, organization_id, branch_id, status, payment_status, stock_released_at, customer_email, customer_name, subtotal, tax_total, delivery_fee, discount_total, tip_amount, total, coupon_code, created_at, web_order_items ( product_id, product_name, quantity, unit_price, total )')
      .eq('id', entrada.webOrderId)
      .maybeSingle()
    if (error || !pedido?.customer_email) {
      if (error) console.error('[RecordatorioPago] No se pudo leer el pedido', { webOrderId: entrada.webOrderId, error: error.message })
      await cerrar('error', null, error ? 'no se pudo leer el pedido' : 'sin correo')
      return 'error'
    }
    const organizationId = Number(pedido.organization_id)
    const vivo = pedido.status === 'pending'
      && (pedido.payment_status === 'pending' || pedido.payment_status === 'failed')
      && !pedido.stock_released_at
    const vence = apartadoHasta(pedido.created_at, entrada.plazoMinutos)
    const venceT = vence ? Date.parse(vence) : NaN
    if (!vivo || !vence || !Number.isFinite(venceT) || venceT - Date.now() < MARGEN_RECORDATORIO_MS) {
      await cerrar('omitido', null, vivo ? 'vencido' : `ya no está pendiente (${pedido.status}/${pedido.payment_status})`)
      return 'omitido'
    }

    const [{ data: org }, { data: sede }] = await Promise.all([
      sb.from('organizations').select('name, type_id, timezone').eq('id', organizationId).maybeSingle(),
      pedido.branch_id
        ? sb.from('branches').select('timezone').eq('id', pedido.branch_id).eq('organization_id', organizationId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const origen = await origenSitio(sb, organizationId)
    if (!origen) {
      console.error('[RecordatorioPago] Sin dominio del sitio', { webOrderId: entrada.webOrderId, organizationId })
      await cerrar('error', null, 'sin dominio del sitio')
      return 'error'
    }
    const zona: string = sede?.timezone || org?.timezone || ZONA_POR_DEFECTO
    const mismoDia = diaPedido(vence, zona) === 'Hoy'
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
      trackingUrl: `${origen}${rutaSeguimiento(organizationId, pedido)}`,
      paymentStatus: 'pending',
      esRestaurante: Number(org?.type_id) === 1,
      recordatorioPago: {
        hasta: mismoDia ? horaPedido(vence, zona) : fechaHoraPedido(vence, zona),
        mismoDia,
      },
    }, { apiKey: entrada.apiKey })
    await cerrar(envio.ok ? 'enviado' : 'error', envio.id, envio.ok ? null : 'no se pudo enviar')
    return envio.ok ? 'enviado' : 'error'
  } catch (err) {
    console.error('[RecordatorioPago] Error enviando el correo', { webOrderId: entrada.webOrderId, err })
    await cerrar('error', null, 'error inesperado').catch(() => undefined)
    return 'error'
  }
}
