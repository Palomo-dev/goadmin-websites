/**
 * Envía email de confirmación de reservación al huésped.
 * Usa Resend (https://resend.com) vía fetch directo — no requiere npm package.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 */

interface ReservationEmailData {
  reservationId: string
  customerEmail: string
  customerName: string
  spaceTypeName: string
  checkin: string
  checkout: string
  nights: number
  guests: number
  folioItems: { description: string; amount: number }[]
  total: number
  organizationName: string
  trackingUrl: string
}

export async function sendReservationConfirmationEmail(data: ReservationEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de reservación omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'reservas@goadmin.io'
  const shortId = data.reservationId.substring(0, 8).toUpperCase()

  const itemsHtml = data.folioItems.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#333;">$${Number(item.amount).toLocaleString()}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#f0fdf4;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:#166534;font-size:24px;">🏨 ¡Reserva confirmada!</h1>
        <p style="margin:8px 0 0;color:#666;font-size:14px;">${data.organizationName}</p>
      </div>
      
      <div style="padding:24px;">
        <p style="color:#333;font-size:16px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          Tu reservación <strong>${shortId}</strong> ha sido registrada exitosamente.
        </p>
        
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Habitación</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${data.spaceTypeName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Check-in</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.checkin}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Check-out</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.checkout}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Noches</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.nights}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Huéspedes</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.guests}</td>
            </tr>
          </table>
        </div>

        ${data.folioItems.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#666;">Concepto</th>
              <th style="padding:10px 12px;text-align:right;font-size:13px;color:#666;">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        ` : ''}
        
        <div style="border-top:2px solid #eee;padding-top:12px;margin-top:12px;">
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#1a1a1a;">
            <span>Total</span>
            <span>$${data.total.toLocaleString()}</span>
          </div>
        </div>
        
        <div style="text-align:center;margin-top:24px;">
          <a href="${data.trackingUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Ver mi reservación
          </a>
        </div>
        
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          Si tienes alguna pregunta sobre tu reservación, responde a este correo.
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
        subject: `Reserva ${shortId} confirmada — ${data.organizationName}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Error enviando email de reservación:', err)
      return false
    }

    console.log(`[Email] Confirmación enviada a ${data.customerEmail} para reservación ${shortId}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando email de reservación:', error)
    return false
  }
}
