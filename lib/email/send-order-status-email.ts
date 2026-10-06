/**
 * Envía email de notificación al cliente cuando cambia el estado de su pedido.
 * Usa Resend vía fetch directo. Si RESEND_API_KEY no está configurada, no-op.
 */

const STATUS_CONFIG: Record<string, { emoji: string; title: string; message: string; color: string }> = {
  confirmed: {
    emoji: '✅',
    title: 'Pedido confirmado',
    message: 'Tu pedido ha sido confirmado y pronto comenzaremos a prepararlo.',
    color: '#3B82F6',
  },
  preparing: {
    emoji: '👨‍🍳',
    title: 'Estamos preparando tu pedido',
    message: 'Nuestro equipo ya está trabajando en tu pedido.',
    color: '#8B5CF6',
  },
  ready: {
    emoji: '🔔',
    title: '¡Tu pedido está listo!',
    message: 'Tu pedido está listo para ser recogido o será despachado pronto.',
    color: '#10B981',
  },
  // `web_orders.status` no tiene `shipped`: el estado real es `in_delivery` (lib/orders/estados-pedido.ts).
  in_delivery: {
    emoji: '🛵',
    title: 'Tu pedido va en camino',
    message: 'Un repartidor está llevando tu pedido a la dirección indicada.',
    color: '#3B82F6',
  },
  delivered: {
    emoji: '🎉',
    title: '¡Pedido entregado!',
    message: 'Tu pedido ha sido entregado. ¡Esperamos que lo disfrutes!',
    color: '#059669',
  },
  cancelled: {
    emoji: '❌',
    title: 'Pedido cancelado',
    message: 'Lamentamos informarte que tu pedido ha sido cancelado.',
    color: '#EF4444',
  },
  rejected: {
    emoji: '⛔',
    title: 'No pudimos aceptar tu pedido',
    message: 'El restaurante no pudo aceptar tu pedido. Si ya pagaste, te devolveremos el dinero.',
    color: '#EF4444',
  },
}

interface OrderStatusEmailData {
  orderNumber: string
  customerEmail: string
  customerName: string
  newStatus: string
  organizationName: string
  trackingUrl: string
  estimatedTime?: string | null
  cancellationReason?: string | null
}

export async function sendOrderStatusEmail(data: OrderStatusEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const config = STATUS_CONFIG[data.newStatus]
  if (!config) return false

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'pedidos@goadmin.io'

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:${config.color}10;padding:32px;text-align:center;border-radius:8px 8px 0 0;">
        <div style="font-size:48px;margin-bottom:12px;">${config.emoji}</div>
        <h1 style="margin:0;color:${config.color};font-size:22px;">${config.title}</h1>
        <p style="margin:8px 0 0;color:#666;font-size:13px;">${data.organizationName}</p>
      </div>
      
      <div style="padding:24px;">
        <p style="color:#333;font-size:15px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          ${config.message}
        </p>
        
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Pedido</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${data.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Estado</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:${config.color};">${config.title}</td>
            </tr>
            ${data.estimatedTime ? `
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Tiempo estimado</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.estimatedTime}</td>
            </tr>
            ` : ''}
            ${data.cancellationReason ? `
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Motivo</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.cancellationReason}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="text-align:center;margin-top:24px;">
          <a href="${data.trackingUrl}" style="display:inline-block;background:${config.color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Ver estado de mi pedido
          </a>
        </div>
        
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          Si tienes alguna pregunta, responde a este correo.
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
        subject: `${config.emoji} ${config.title} — Pedido ${data.orderNumber}`,
        html,
      }),
    })

    if (!res.ok) {
      console.error('[Email] Error enviando status email:', await res.text())
      return false
    }

    console.log(`[Email] Status "${data.newStatus}" enviado a ${data.customerEmail} para pedido ${data.orderNumber}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando status email:', error)
    return false
  }
}
