/**
 * Envía email de confirmación de boleto de transporte al pasajero.
 * Incluye datos del viaje, asiento, QR code (como texto para generar en cliente) y checkin code.
 * Usa Resend vía fetch directo — no requiere npm package.
 */

interface TicketEmailData {
  ticketNumber: string
  passengerEmail: string
  passengerName: string
  tripCode: string
  routeName: string
  originCity: string
  destinationCity: string
  tripDate: string
  departureTime: string
  seatNumber: string | null
  fare: number
  currency: string
  qrCode: string
  checkinCode: string
  organizationName: string
  ticketUrl: string
}

export async function sendTicketConfirmationEmail(data: TicketEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de ticket omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'boletos@goadmin.io'

  const formattedDate = new Date(data.tripDate).toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:24px;">🎫 Boleto Confirmado</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${data.organizationName}</p>
      </div>
      
      <div style="padding:24px;">
        <p style="color:#333;font-size:16px;">
          Hola <strong>${data.passengerName}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          Tu boleto <strong>${data.ticketNumber}</strong> ha sido confirmado exitosamente.
        </p>
        
        <!-- Datos del viaje -->
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:20px 0;">
          <h3 style="margin:0 0 12px;color:#0369a1;font-size:16px;">Detalles del Viaje</h3>
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="text-align:center;flex:1;">
              <div style="font-size:18px;font-weight:bold;color:#1e40af;">${data.originCity}</div>
              <div style="font-size:12px;color:#666;">Origen</div>
            </div>
            <div style="flex:0;padding:0 12px;font-size:24px;color:#3b82f6;">→</div>
            <div style="text-align:center;flex:1;">
              <div style="font-size:18px;font-weight:bold;color:#1e40af;">${data.destinationCity}</div>
              <div style="font-size:12px;color:#666;">Destino</div>
            </div>
          </div>
          
          <table style="width:100%;font-size:14px;">
            <tr>
              <td style="padding:4px 0;color:#666;">📅 Fecha:</td>
              <td style="padding:4px 0;color:#333;font-weight:600;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#666;">🕐 Salida:</td>
              <td style="padding:4px 0;color:#333;font-weight:600;">${data.departureTime}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#666;">🚌 Viaje:</td>
              <td style="padding:4px 0;color:#333;font-weight:600;">${data.tripCode} — ${data.routeName}</td>
            </tr>
            ${data.seatNumber ? `
            <tr>
              <td style="padding:4px 0;color:#666;">💺 Asiento:</td>
              <td style="padding:4px 0;color:#333;font-weight:600;">${data.seatNumber}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding:4px 0;color:#666;">💰 Tarifa:</td>
              <td style="padding:4px 0;color:#333;font-weight:600;">$${data.fare.toLocaleString('es-CO')} ${data.currency}</td>
            </tr>
          </table>
        </div>
        
        <!-- Código de check-in -->
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <h3 style="margin:0 0 8px;color:#166534;font-size:14px;">Código de Check-in</h3>
          <div style="font-size:32px;font-weight:bold;color:#166534;letter-spacing:4px;font-family:monospace;">
            ${data.checkinCode}
          </div>
          <p style="margin:8px 0 0;color:#666;font-size:12px;">
            Presenta este código al abordar el vehículo
          </p>
        </div>
        
        <div style="text-align:center;margin-top:24px;">
          <a href="${data.ticketUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Ver mi boleto digital
          </a>
        </div>
        
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          Guarda este correo como comprobante de viaje. Si tienes preguntas, responde a este correo.
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
        to: [data.passengerEmail],
        subject: `🎫 Boleto ${data.ticketNumber} confirmado — ${data.originCity} → ${data.destinationCity}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Error enviando email de ticket:', err)
      return false
    }

    console.log(`[Email] Ticket confirmación enviada a ${data.passengerEmail} para ${data.ticketNumber}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando email de ticket:', error)
    return false
  }
}
