/**
 * Envía email de confirmación de pase de parking al cliente.
 * Incluye datos del plan, vigencia, vehículos vinculados y beneficios.
 * Usa Resend vía fetch directo — no requiere npm package.
 */

interface ParkingPassEmailData {
  customerEmail: string
  customerName: string
  organizationName: string
  planName: string
  planDescription: string
  startDate: string
  endDate: string
  price: number
  currency: string
  includesCarWash: boolean
  includesValet: boolean
  maxEntriesPerDay?: number | null
  vehicles: Array<{
    plate: string
    brand?: string
    model?: string
    color?: string
    vehicle_type?: string
  }>
  passReference: string
}

export async function sendParkingPassConfirmationEmail(data: ParkingPassEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de pase omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'parking@goadmin.io'

  const formattedStart = new Date(data.startDate).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedEnd = new Date(data.endDate).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: data.currency || 'COP',
    minimumFractionDigits: 0,
  }).format(data.price)

  // Construir lista de beneficios
  const benefits: string[] = []
  if (data.includesCarWash) benefits.push('Lavado de vehículo incluido')
  if (data.includesValet) benefits.push('Servicio valet parking')
  if (data.maxEntriesPerDay) benefits.push(`Hasta ${data.maxEntriesPerDay} entradas por día`)

  const benefitsHtml = benefits.length > 0
    ? benefits.map(b => `<li style="padding:4px 0;color:#374151;">✓ ${b}</li>`).join('')
    : '<li style="padding:4px 0;color:#6B7280;">Plan estándar</li>'

  // Construir lista de vehículos
  const vehiclesHtml = data.vehicles.length > 0
    ? data.vehicles.map(v => {
        const desc = [v.brand, v.model, v.color].filter(Boolean).join(' ')
        return `<li style="padding:4px 0;color:#374151;"><strong>${v.plate}</strong>${desc ? ` — ${desc}` : ''}</li>`
      }).join('')
    : '<li style="padding:4px 0;color:#6B7280;">Sin vehículos registrados</li>'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#2196F3,#1565C0);padding:32px 24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;">🅿️ Pase Activado</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">${data.organizationName}</p>
      </div>

      <!-- Contenido -->
      <div style="padding:24px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
          Tu pase de estacionamiento ha sido activado exitosamente. Aquí están los detalles:
        </p>

        <!-- Detalles del pase -->
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Referencia</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;font-weight:600;">${data.passReference}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Plan</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;font-weight:600;">${data.planName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Vigencia</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${formattedStart} — ${formattedEnd}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Total pagado</td>
              <td style="padding:8px 0;color:#059669;font-size:16px;text-align:right;font-weight:700;">${formattedPrice}</td>
            </tr>
          </table>
        </div>

        <!-- Beneficios -->
        <div style="margin-bottom:20px;">
          <h3 style="color:#111827;font-size:14px;margin:0 0 8px;">Beneficios incluidos</h3>
          <ul style="margin:0;padding:0 0 0 20px;list-style:none;">
            ${benefitsHtml}
          </ul>
        </div>

        <!-- Vehículos -->
        <div style="margin-bottom:20px;">
          <h3 style="color:#111827;font-size:14px;margin:0 0 8px;">Vehículos registrados</h3>
          <ul style="margin:0;padding:0 0 0 20px;list-style:none;">
            ${vehiclesHtml}
          </ul>
        </div>

        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />

        <p style="color:#6B7280;font-size:12px;text-align:center;margin:0;">
          Presenta tu placa al ingresar al estacionamiento. El sistema reconocerá tu vehículo automáticamente.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#F9FAFB;padding:16px 24px;text-align:center;border-top:1px solid #E5E7EB;">
        <p style="color:#9CA3AF;font-size:11px;margin:0;">
          ${data.organizationName} — Pase de estacionamiento
        </p>
      </div>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [data.customerEmail],
        subject: `🅿️ Pase activado — ${data.planName} | ${data.organizationName}`,
        html,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[Email] Error enviando email de pase:', res.status, errBody)
      return false
    }

    console.log(`[Email] Confirmación de pase enviada a ${data.customerEmail}`)
    return true
  } catch (err) {
    console.error('[Email] Error enviando email de pase:', err)
    return false
  }
}
