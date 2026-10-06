/**
 * Envía el correo de la reserva de MESA de restaurante.
 * Usa Resend (https://resend.com) vía fetch directo.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 *
 * El texto sigue el ESTADO REAL que devolvió `create_restaurant_reservation`:
 * con `require_confirmation` la reserva nace `pending` y el correo no puede
 * decir «confirmada»: el equipo aún no la ha aceptado.
 */

interface RestaurantTableEmailData {
  reservationId: string
  customerEmail: string
  customerName: string
  date: string
  time: string
  partySize: number
  organizationName: string
  /** Estado devuelto por la RPC: `confirmed`, `pending`, … */
  status: string
}

interface TextosCorreo {
  titulo: string
  colorFondo: string
  colorTitulo: string
  frase: (codigo: string) => string
  asunto: (codigo: string, organizacion: string) => string
  pie: string
}

/** Textos por estado. Todo lo que no sea `confirmed` se trata como solicitud. */
export function textosCorreoReservaMesa(status: string): TextosCorreo {
  if (status === 'confirmed') {
    return {
      titulo: '¡Reserva confirmada!',
      colorFondo: '#f0fdf4',
      colorTitulo: '#166534',
      frase: (codigo) => `Tu reserva de mesa <strong>${codigo}</strong> ha sido confirmada exitosamente.`,
      asunto: (codigo, organizacion) => `Reserva ${codigo} confirmada — ${organizacion}`,
      pie: 'Si necesitas cancelar o modificar tu reserva, responde a este correo.',
    }
  }
  return {
    titulo: 'Recibimos tu solicitud de reserva',
    colorFondo: '#fffbeb',
    colorTitulo: '#92400e',
    frase: (codigo) =>
      `Recibimos tu solicitud de reserva de mesa <strong>${codigo}</strong>. ` +
      'Todavía <strong>no está confirmada</strong>: el restaurante la revisará y te avisará cuando la confirme.',
    asunto: (codigo, organizacion) => `Solicitud de reserva ${codigo} recibida — ${organizacion}`,
    pie: 'Si necesitas cancelar o cambiar tu solicitud, responde a este correo.',
  }
}

/** El nombre lo escribe el visitante: no puede inyectar HTML en el correo. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
  const textos = textosCorreoReservaMesa(data.status)
  const nombre = escaparHtml(data.customerName)
  const organizacion = escaparHtml(data.organizationName)

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:${textos.colorFondo};padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:${textos.colorTitulo};font-size:24px;">🍽️ ${textos.titulo}</h1>
        <p style="margin:8px 0 0;color:#666;font-size:14px;">${organizacion}</p>
      </div>

      <div style="padding:24px;">
        <p style="color:#333;font-size:16px;">
          Hola <strong>${nombre}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          ${textos.frase(shortId)}
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
          ${textos.pie}
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
        subject: textos.asunto(shortId, data.organizationName),
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Error enviando email de reserva de mesa:', err)
      return false
    }

    console.log(`[Email] Correo de reserva de mesa (${data.status}) enviado para reserva ${shortId}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando email de reserva de mesa:', error)
    return false
  }
}
