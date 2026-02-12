/**
 * Envía email de confirmación de reserva de clase al cliente.
 * Usa Resend vía fetch directo — silent no-op si RESEND_API_KEY no está configurada.
 */

interface ClassReservationEmailData {
  customerEmail: string
  customerName: string
  classTitle: string
  classType?: string
  instructorName?: string
  startAt: string
  endAt: string
  room?: string
  organizationName: string
  portalUrl: string
}

export async function sendClassReservationEmail(data: ClassReservationEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada, omitiendo email de reserva de clase')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@goadmin.app'
  const startDate = new Date(data.startAt)
  const endDate = new Date(data.endAt)

  const dateStr = startDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const startTime = startDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const endTime = endDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#3B82F6;padding:24px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Clase Reservada</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${data.customerName}</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Tu reserva ha sido confirmada:</p>

      <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px;">Clase</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${data.classTitle}</td>
          </tr>
          ${data.classType ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Tipo</td><td style="padding:6px 0;color:#111827;font-size:14px;">${data.classType}</td></tr>` : ''}
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Fecha</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Horario</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${startTime} - ${endTime}</td>
          </tr>
          ${data.instructorName ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Instructor</td><td style="padding:6px 0;color:#111827;font-size:14px;">${data.instructorName}</td></tr>` : ''}
          ${data.room ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Sala</td><td style="padding:6px 0;color:#111827;font-size:14px;">${data.room}</td></tr>` : ''}
        </table>
      </div>

      <div style="background:#FEF3C7;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <p style="color:#92400E;font-size:13px;margin:0;">Puedes cancelar hasta <strong>2 horas antes</strong> del inicio de la clase desde tu portal.</p>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${data.portalUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver mis clases</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">${data.organizationName}</p>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${data.organizationName} <${fromEmail}>`,
        to: [data.customerEmail],
        subject: `Clase reservada: ${data.classTitle} — ${dateStr}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Error enviando confirmación de clase:', err)
      return false
    }

    console.log(`[Email] Confirmación de clase enviada a ${data.customerEmail}`)
    return true
  } catch (error) {
    console.error('[Email] Error:', error)
    return false
  }
}

/**
 * Envía email de cancelación de reserva de clase.
 */
export async function sendClassCancellationEmail(data: Omit<ClassReservationEmailData, 'room'>): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@goadmin.app'
  const startDate = new Date(data.startAt)

  const dateStr = startDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const startTime = startDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#EF4444;padding:24px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Reserva Cancelada</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${data.customerName}</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Tu reserva para la siguiente clase ha sido cancelada:</p>

      <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-weight:600;color:#111827;font-size:15px;">${data.classTitle}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">${dateStr} · ${startTime}</p>
        ${data.instructorName ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Instructor: ${data.instructorName}</p>` : ''}
      </div>

      <p style="color:#374151;font-size:14px;margin:0 0 24px;">El cupo ha sido liberado. Puedes reservar otra clase en cualquier momento.</p>

      <div style="text-align:center;">
        <a href="${data.portalUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver horario de clases</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">${data.organizationName}</p>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${data.organizationName} <${fromEmail}>`,
        to: [data.customerEmail],
        subject: `Reserva cancelada: ${data.classTitle}`,
        html,
      }),
    })

    if (!res.ok) {
      console.error('[Email] Error enviando cancelación de clase:', await res.text())
      return false
    }

    console.log(`[Email] Cancelación de clase enviada a ${data.customerEmail}`)
    return true
  } catch (error) {
    console.error('[Email] Error:', error)
    return false
  }
}
