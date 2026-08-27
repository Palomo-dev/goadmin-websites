/**
 * Envía email de confirmación de reserva de MESA de restaurante.
 * Usa Resend (https://resend.com) vía fetch directo.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 */

interface RestaurantTableEmailData {
  reservationId: string
  customerEmail: string
  customerName: string
  date: string
  time: string
  partySize: number
  organizationName: string
}

export async function sendRestaurantTableConfirmationEmail(
  data: RestaurantTableEmailData
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de reserva de mesa omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'reservas@goadmin.io'
  const shortId = data.reservationId.substring(0, 8).toUpperCase()

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#f0fdf4;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:#166534;font-size:24px;">🍽️ ¡Reserva confirmada!</h1>
        <p style="margin:8px 0 0;color:#666;font-size:14px;">${data.organizationName}</p>
      </div>

      <div style="padding:24px;">
        <p style="color:#333;font-size:16px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          Tu reserva de mesa <strong>${shortId}</strong> ha sido confirmada exitosamente.
        </p>

        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Fecha</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${data.date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Hora</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.time}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Personas</td>
              <td style="padding:6px 0;text-align:right;color:#333;">${data.partySize} ${data.partySize === 1 ? 'persona' : 'personas'}</td>
            </tr>
          </table>
        </div>

        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          Si necesitas cancelar o modificar tu reserva, responde a este correo.
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
      console.error('[Email] Error enviando email de reserva de mesa:', err)
      return false
    }

    console.log(`[Email] Confirmación de mesa enviada a ${data.customerEmail} para reserva ${shortId}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando email de reserva de mesa:', error)
    return false
  }
}
