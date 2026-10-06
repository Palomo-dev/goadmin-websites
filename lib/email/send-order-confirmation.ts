/**
 * Envía email de confirmación de orden al cliente.
 * Usa Resend (https://resend.com) vía fetch directo — no requiere npm package.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 */

interface OrderEmailData {
  orderNumber: string
  customerEmail: string
  customerName: string
  items: { name: string; quantity: number; unitPrice: number; total: number }[]
  subtotal: number
  tax: number
  shipping: number
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
  /** «🛵 Domicilio», «🏪 Recoger en el local», «🍽️ Comer aquí · Mesa 4». */
  tipoEntrega?: string | null
  /** Hora programada ya formateada en la zona de la sede («Hoy · 7:30 p. m.»). */
  programadoPara?: string | null
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

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de confirmación omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'pedidos@goadmin.io'
  const pagado = data.paymentStatus === 'paid'
  const titulo = pagado ? '¡Pago confirmado!' : 'Recibimos tu pedido'
  const mensaje = pagado
    ? `Recibimos el pago de tu pedido <strong>${escapeHtml(data.orderNumber)}</strong>. Ya lo estamos preparando.`
    : `Tu pedido <strong>${escapeHtml(data.orderNumber)}</strong> llegó al restaurante. Te avisaremos cuando lo confirmen.`
  const negocio = data.organizationName ? escapeHtml(data.organizationName) : ''

  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toLocaleString('es-CO')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.total.toLocaleString('es-CO')}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#f8f9fa;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:#1a1a1a;font-size:24px;">${titulo}</h1>
        ${negocio ? `<p style="margin:8px 0 0;color:#666;font-size:14px;">${negocio}</p>` : ''}
      </div>
      
      <div style="padding:24px;">
        <p style="color:#333;font-size:16px;">
          Hola <strong>${escapeHtml(data.customerName)}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          ${mensaje}
        </p>
        ${data.tipoEntrega || data.programadoPara ? `
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
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:4px;">
            <span>Subtotal</span>
            <span>$${data.subtotal.toLocaleString('es-CO')}</span>
          </div>
          ${data.tax > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:4px;">
            <span>Impuestos</span>
            <span>$${data.tax.toLocaleString('es-CO')}</span>
          </div>
          ` : ''}
          ${data.shipping > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:4px;">
            <span>Envío</span>
            <span>$${data.shipping.toLocaleString('es-CO')}</span>
          </div>
          ` : ''}
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
        
        <div style="text-align:center;margin-top:24px;">
          <a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Seguir mi pedido
          </a>
        </div>
        
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          Si tienes alguna pregunta sobre tu pedido, contáctanos${negocio ? ` en ${negocio}` : ''}.
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
        subject: `${pagado ? 'Pago confirmado' : 'Recibimos tu pedido'} ${data.orderNumber}${data.organizationName ? ` — ${data.organizationName}` : ''}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Error enviando email:', err)
      return false
    }

    console.log(`[Email] Confirmación enviada a ${data.customerEmail} para orden ${data.orderNumber}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando email:', error)
    return false
  }
}
