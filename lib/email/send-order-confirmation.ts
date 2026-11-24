/**
 * Envía email de confirmación de orden al cliente.
 * Usa Resend (https://resend.com) vía fetch directo — no requiere npm package.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 *
 * Con `marca` (el correo de pago confirmado) el mensaje lleva el logo, el color
 * y el nombre de la tienda. El From es el correo de la tienda solo si su dominio
 * ya está autenticado; si no, Reply-To apunta a ese correo y el envío sale por
 * la dirección de respaldo (lib/email/remitenteRespaldo.ts), siempre con el
 * nombre de la tienda.
 */

import { sobreCorreoPedido, type MarcaCorreoPedido, type SobreCorreoPedido } from '@/lib/email/marcaCorreoPedido'
import { correoRespaldoTiendas, remitenteTienda } from '@/lib/email/remitenteRespaldo'
import {
  textosCorreoCompraPendiente,
  textosCorreoRecibido,
  textosCorreoRecordatorioPago,
  type FaltaAnticipo,
} from '@/lib/email/textosCorreoPedido'
import { impuestoVaIncluido } from '@/lib/email/totalesCorreo'

interface OrderEmailData {
  orderNumber: string
  customerEmail: string
  customerName: string
  items: { name: string; quantity: number; unitPrice: number; total: number; imageUrl?: string | null }[]
  subtotal: number
  tax: number
  shipping: number
  /** Propina. Entra en el total guardado; si falta, se trata como cero. */
  tip?: number
  /** Descuento total (cupón + promociones). */
  discount?: number
  promotions?: { name: string; discount: number }[]
  couponCode?: string
  couponDiscount?: number
  total: number
  organizationName: string
  trackingUrl: string
  /**
   * `pending`: el pedido se recibió y el pago está pendiente (efectivo, contraentrega, transferencia)
   * → «Recibimos tu pedido». `paid`: lo envía el webhook de la pasarela al confirmarse el pago →
   * «Pago confirmado». Sin valor se trata como `pending`: nunca se anuncia «confirmado» antes de
   * que nadie lo confirme.
   */
  paymentStatus?: 'pending' | 'paid'
  /**
   * Compra que no se pagó (cancelada o expirada). Mismo sobre que el pago
   * confirmado; el botón dice «Retomar mi compra» y abre el enlace de retoma.
   */
  compraPendiente?: boolean
  /**
   * «Termina tu pago»: pedido por pasarela que sigue sin pagar y aún no vence. Mismo sobre; el
   * botón dice «Pagar ahora» y abre la página del pedido con su token. `hasta` ya viene
   * formateado en la zona de la sede. Con `anticipo` (contraentrega con el anticipo pendiente):
   * el valor del anticipo en vez del total y el botón «Pagar anticipo».
   */
  recordatorioPago?: { hasta: string; mismoDia: boolean; anticipo?: number | null } | null
  /** `organizations.type_id = 1`. Sin valor, el «Recibimos tu pedido» no habla de restaurante. */
  esRestaurante?: boolean
  /** Pago por pasarela aún sin completar: «Recibimos tu pedido» dice que falta el pago. */
  faltaPagoEnLinea?: boolean
  /**
   * Contraentrega con el anticipo aún sin pagar: «Recibimos tu pedido» dice «Falta el anticipo de
   * $ X para confirmarlo», la hora límite y el botón «Pagar anticipo». Sin él, como siempre.
   */
  faltaAnticipo?: FaltaAnticipo | null
  /** «🛵 Domicilio», «🏪 Recoger en el local», «🍽️ Comer aquí · Mesa 4». */
  tipoEntrega?: string | null
  /** Hora programada ya formateada en la zona de la sede («Hoy · 7:30 p. m.»). */
  programadoPara?: string | null
  /** Marca de la tienda. Sin ella el correo sale como antes: remitente de la plataforma y azul fijo. */
  marca?: MarcaCorreoPedido | null
  /**
   * Contraentrega con condiciones (Figma 3019:76125 › 13): bloque «Pagaste hoy / Pagas al recibir» y
   * asunto «… · pagas $ X al recibir». Sin él (o sin condiciones en la tienda), el correo de siempre.
   */
  contraentrega?: {
    anticipoPagado: number
    pasarela: string | null
    alRecibir: number
    medios: string
    /** El anticipo fue el envío: «Pagaste hoy (el envío)», «Envío (pagado)». */
    delEnvio?: boolean
  } | null
}

// Los nombres de promoción/cupón los escribe el comercio en el ERP; se escapan
// antes de interpolarlos en el HTML del correo.
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface ResultadoEnvioCorreo {
  ok: boolean
  id: string | null
}

export async function sendOrderConfirmationEmail(
  data: OrderEmailData,
  opciones?: { apiKey?: string | null },
): Promise<ResultadoEnvioCorreo> {
  const apiKey = (opciones?.apiKey && opciones.apiKey.startsWith('re_') ? opciones.apiKey : null) || process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de confirmación omitido')
    return { ok: false, id: null }
  }

  const sobre: SobreCorreoPedido | null = data.marca
    ? sobreCorreoPedido({
        nombre: data.marca.nombre || data.organizationName,
        correoTienda: data.marca.correo,
        logoUrl: data.marca.logoUrl,
        color: data.marca.color,
        dominios: data.marca.dominios,
        respaldo: correoRespaldoTiendas(),
      })
    : null
  const fromEmail = sobre?.from ?? remitenteTienda({ nombre: data.organizationName }).from
  const colorBoton = sobre?.color ?? '#3B82F6'
  const textoBoton = sobre?.texto ?? '#ffffff'
  const pagado = data.paymentStatus === 'paid'
  const pendiente = textosCorreoCompraPendiente({
    orderNumber: data.orderNumber,
    nombreTienda: sobre?.nombre || data.organizationName || '',
  })
  const recordatorio = data.recordatorioPago && !data.compraPendiente
    ? textosCorreoRecordatorioPago({
        orderNumber: data.orderNumber,
        nombreTienda: sobre?.nombre || data.organizationName || '',
        total: data.total,
        hasta: data.recordatorioPago.hasta,
        mismoDia: data.recordatorioPago.mismoDia,
        esRestaurante: data.esRestaurante,
        anticipo: data.recordatorioPago.anticipo ?? null,
      })
    : null
  const especial = data.compraPendiente ? pendiente : recordatorio
  const recibido = textosCorreoRecibido({
    orderNumber: data.orderNumber,
    esRestaurante: data.esRestaurante,
    faltaPagoEnLinea: data.faltaPagoEnLinea,
    faltaAnticipo: data.faltaAnticipo ?? null,
  })
  const titulo = especial ? especial.titulo : pagado ? '¡Pago confirmado!' : 'Recibimos tu pedido'
  const mensaje = especial
    ? especial.mensajeHtml
    : pagado
      ? `Recibimos el pago de tu pedido <strong>${escapeHtml(data.orderNumber)}</strong>. Ya lo estamos preparando.`
      : recibido.mensajeHtml
  const textoEnlace = especial ? especial.boton : pagado ? 'Seguir mi pedido' : recibido.boton
  const negocio = escapeHtml(sobre?.nombre || data.organizationName || '')
  const logo = sobre?.logoUrl
    ? `<img src="${escapeHtml(sobre.logoUrl)}" alt="${negocio}" height="48" style="height:48px;max-width:220px;width:auto;margin:0 auto 12px;display:block;border:0;">`
    : ''
  const encabezado = sobre
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${sobre.color};border-radius:8px 8px 0 0;">
        <tr><td style="padding:28px 24px;text-align:center;">
          ${logo}
          ${negocio ? `<p style="margin:0;color:${sobre.texto};font-size:15px;font-weight:700;">${negocio}</p>` : ''}
        </td></tr>
      </table>`
    : `<div style="background:#f8f9fa;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:#1a1a1a;font-size:24px;">${titulo}</h1>
        ${negocio ? `<p style="margin:8px 0 0;color:#666;font-size:14px;">${negocio}</p>` : ''}
      </div>`
  const pie = sobre?.correo
    ? `Si tienes alguna pregunta sobre tu pedido, escribe a <a href="mailto:${escapeHtml(sobre.correo)}" style="color:${sobre.color};">${escapeHtml(sobre.correo)}</a>.`
    : `Si tienes alguna pregunta sobre tu pedido, contáctanos${negocio ? ` en ${negocio}` : ''}.`

  const incluido = impuestoVaIncluido({
    subtotal: data.subtotal,
    tax: data.tax,
    shipping: data.shipping,
    tip: data.tip,
    discount: data.discount,
    total: data.total,
  })
  // Contraentrega con el anticipo del envío ya pagado (13): «Envío (pagado)». Si no, «Envío» como siempre.
  const envioPagadoContraentrega = !especial && !pagado && !!data.contraentrega?.delEnvio && (data.contraentrega?.anticipoPagado ?? 0) > 0
  const filaTotal = (etiqueta: string, valor: number) =>
    `<div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:4px;"><span>${etiqueta}</span><span>$${valor.toLocaleString('es-CO')}</span></div>`
  const totalesHtml = [
    filaTotal(incluido ? 'Subtotal (IVA incluido)' : 'Subtotal', data.subtotal),
    incluido && data.tax > 0 ? filaTotal('de los cuales IVA:', data.tax) : '',
    !incluido && data.tax > 0 ? filaTotal('Impuestos', data.tax) : '',
    data.shipping > 0 ? filaTotal(envioPagadoContraentrega ? 'Envío (pagado)' : 'Envío', data.shipping) : '',
    (data.tip || 0) > 0 ? filaTotal('Propina', data.tip || 0) : '',
  ].join('')

  const fotoDe = (item: { name: string; imageUrl?: string | null }) => {
    const url = (item.imageUrl || '').trim()
    if (!url.startsWith('https://')) return ''
    const alt = escapeHtml(item.name || 'Producto')
    return `<td style="padding:0 12px 0 0;vertical-align:middle;"><img src="${escapeHtml(url)}" alt="${alt}" width="64" height="64" style="display:block;width:64px;height:64px;border:0;border-radius:6px;object-fit:cover;"></td>`
  }
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          ${fotoDe(item)}
          <td style="vertical-align:middle;font-size:14px;color:#1a1a1a;">${escapeHtml(item.name)}</td>
        </tr></table>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toLocaleString('es-CO')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.total.toLocaleString('es-CO')}</td>
    </tr>
  `).join('')

  const ce = !especial && !pagado ? data.contraentrega ?? null : null
  const bloqueContraentrega = ce
    ? `${ce.anticipoPagado > 0 ? `<p style="color:#666;font-size:14px;margin:0;">Ya pagaste ${ce.delEnvio ? 'el envío' : 'el anticipo'}; el resto lo pagas cuando te llegue.</p>` : ''}
      <div style="margin:16px 0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
        ${ce.anticipoPagado > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#15803d;margin-bottom:6px;"><span>Pagaste hoy${ce.delEnvio ? ' (el envío)' : ''}${ce.pasarela ? ` · ${escapeHtml(ce.pasarela)}` : ''}</span><span>$${ce.anticipoPagado.toLocaleString('es-CO')}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:bold;color:#1a1a1a;"><span>Pagas al recibir</span><span>$${ce.alRecibir.toLocaleString('es-CO')}</span></div>
        <p style="margin:6px 0 0;font-size:13px;color:#666;">${escapeHtml(ce.medios)}</p>
      </div>`
    : ''
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      ${encabezado}
      
      <div style="padding:24px;">
        ${sobre ? `<h1 style="margin:0 0 16px;color:#1a1a1a;font-size:24px;">${titulo}</h1>` : ''}
        <p style="color:#333;font-size:16px;">
          Hola <strong>${escapeHtml(data.customerName)}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          ${mensaje}
        </p>
        ${bloqueContraentrega}
        ${!data.compraPendiente && (data.tipoEntrega || data.programadoPara) ? `
        <p style="color:#333;font-size:14px;margin:12px 0;padding:10px 12px;background:#f8f9fa;border-radius:6px;">
          ${data.tipoEntrega ? escapeHtml(data.tipoEntrega) : ''}${data.tipoEntrega && data.programadoPara ? ' · ' : ''}${data.programadoPara ? `Para: ${escapeHtml(data.programadoPara)}` : ''}
        </p>` : ''}
        
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;">Producto</th>
              <th style="padding:10px 12px;text-align:center;font-size:13px;color:#666;">Cant.</th>
              <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;">Precio</th>
              <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="border-top:2px solid #eee;padding-top:12px;margin-top:12px;">
          ${totalesHtml}
          ${(data.promotions || []).filter(p => p.discount > 0).map(p => `
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#16a34a;margin-bottom:4px;">
            <span>🏷️ ${escapeHtml(p.name)}</span>
            <span>-$${p.discount.toLocaleString('es-CO')}</span>
          </div>
          `).join('')}
          ${data.couponCode && (data.couponDiscount || 0) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#16a34a;margin-bottom:4px;">
            <span>🎟️ Cupón ${escapeHtml(data.couponCode)}</span>
            <span>-$${(data.couponDiscount || 0).toLocaleString('es-CO')}</span>
          </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#1a1a1a;margin-top:8px;padding-top:8px;border-top:1px solid #eee;">
            <span>Total</span>
            <span>$${data.total.toLocaleString('es-CO')}</span>
          </div>
        </div>
        
        ${data.trackingUrl.startsWith('https://') ? `<div style="text-align:center;margin-top:24px;">
          <a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;background:${colorBoton};color:${textoBoton};padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            ${escapeHtml(textoEnlace)}
          </a>
        </div>` : ''}
        
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          ${pie}
        </p>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [data.customerEmail],
        ...(sobre?.replyTo ? { reply_to: sobre.replyTo } : {}),
        subject: especial
          ? especial.asunto
          : ce
            ? `Recibimos tu pedido ${data.orderNumber} · pagas $${ce.alRecibir.toLocaleString('es-CO')} al recibir`
            : `${pagado ? 'Pago confirmado' : 'Recibimos tu pedido'} ${data.orderNumber}${negocio ? ` — ${sobre?.nombre || data.organizationName}` : ''}`,
        html,
      }),
    })

    if (!res.ok) {
      console.error('[Email] Error enviando email', { orden: data.orderNumber, status: res.status })
      return { ok: false, id: null }
    }

    const cuerpo = await res.json().catch(() => null) as { id?: unknown } | null
    const id = typeof cuerpo?.id === 'string' ? cuerpo.id : null
    console.log(`[Email] ${data.compraPendiente ? 'Compra pendiente enviada' : recordatorio ? 'Recordatorio de pago enviado' : 'Confirmación enviada'} para orden ${data.orderNumber}`)
    return { ok: true, id }
  } catch {
    console.error('[Email] Error enviando email', { orden: data.orderNumber })
    return { ok: false, id: null }
  }
}
