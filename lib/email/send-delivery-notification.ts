/**
 * Envía email al cliente cuando el conductor recoge su pedido.
 * Usa Resend vía fetch directo — no requiere npm package.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 */

interface DeliveryNotificationData {
  customerEmail: string
  customerName: string
  orderNumber: string
  organizationName: string
  driverName?: string
  vehicleInfo?: string
  trackingUrl: string
  estimatedDelivery?: string
}

export async function sendDeliveryNotificationEmail(data: DeliveryNotificationData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[DeliveryNotification] RESEND_API_KEY no configurada — email omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'pedidos@goadmin.io'
  const {
    customerEmail,
    customerName,
    orderNumber,
    organizationName,
    driverName,
    vehicleInfo,
    trackingUrl,
    estimatedDelivery,
  } = data

  const subject = `Tu pedido #${orderNumber} esta en camino — ${organizationName}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#3B82F6,#2563EB);padding:32px 24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🛵</div>
        <h1 style="color:white;font-size:22px;margin:0;">¡Tu pedido está en camino!</h1>
      </div>
      <div style="padding:24px;">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
          Hola <strong>${customerName}</strong>,
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Tu pedido <strong>#${orderNumber}</strong> de <strong>${organizationName}</strong> ha sido recogido y está en camino a tu dirección.
        </p>
        ${driverName ? `
        <div style="background:#F0F9FF;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="color:#1E40AF;font-size:13px;font-weight:600;margin:0 0 8px;">👤 Tu conductor</p>
          <p style="color:#1E3A5F;font-size:15px;font-weight:600;margin:0;">${driverName}</p>
          ${vehicleInfo ? `<p style="color:#64748B;font-size:13px;margin:4px 0 0;">${vehicleInfo}</p>` : ''}
        </div>
        ` : ''}
        ${estimatedDelivery ? `
        <div style="background:#F0FDF4;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="color:#166534;font-size:13px;font-weight:600;margin:0 0 4px;">⏰ Llegada estimada</p>
          <p style="color:#15803D;font-size:18px;font-weight:700;margin:0;">${estimatedDelivery}</p>
        </div>
        ` : ''}
        <div style="text-align:center;margin:24px 0;">
          <a href="${trackingUrl}" style="display:inline-block;background:#3B82F6;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
            📍 Seguir mi pedido en vivo
          </a>
        </div>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:20px 0 0;">
          Recibirás una notificación cuando tu pedido sea entregado.
        </p>
      </div>
      <div style="background:#F9FAFB;padding:16px 24px;text-align:center;border-top:1px solid #E5E7EB;">
        <p style="color:#9CA3AF;font-size:12px;margin:0;">
          ${organizationName} · Enviado automáticamente
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${organizationName} <${fromEmail}>`,
        to: customerEmail,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[DeliveryNotification] Resend error:', res.status, errBody)
      return false
    }

    console.log(`[DeliveryNotification] Email enviado a ${customerEmail}`)
    return true
  } catch (error) {
    console.error('[DeliveryNotification] Error enviando email:', error)
    return false
  }
}
