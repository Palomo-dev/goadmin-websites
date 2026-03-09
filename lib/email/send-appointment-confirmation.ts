/**
 * Envía email de confirmación de cita al cliente.
 * Usa Resend vía fetch directo — no requiere npm package.
 */

interface AppointmentEmailData {
  customerEmail: string
  customerName: string
  appointmentId: string
  serviceName: string
  date: Date
  durationMinutes: number
  status: 'pending' | 'confirmed' | 'cancelled'
  notes?: string
  organizationName?: string
}

export async function sendAppointmentConfirmation(data: AppointmentEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de cita omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'citas@goadmin.io'
  const orgName = data.organizationName || 'GoAdmin'

  const formattedDate = data.date.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedTime = data.date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const endTime = new Date(data.date.getTime() + data.durationMinutes * 60 * 1000)
  const formattedEndTime = endTime.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: 'Pendiente de confirmación', color: '#F59E0B', icon: '⏳' },
    confirmed: { label: 'Confirmada', color: '#10B981', icon: '✅' },
    cancelled: { label: 'Cancelada', color: '#EF4444', icon: '❌' },
  }

  const st = statusLabels[data.status] || statusLabels.pending

  const subjectMap: Record<string, string> = {
    pending: `${st.icon} Solicitud de cita recibida — ${data.serviceName}`,
    confirmed: `${st.icon} Cita confirmada — ${data.serviceName}`,
    cancelled: `${st.icon} Cita cancelada — ${data.serviceName}`,
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#6366F1,#4F46E5);padding:32px 24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;">${st.icon} Cita de Servicio</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">${orgName}</p>
      </div>

      <!-- Contenido -->
      <div style="padding:24px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
          ${data.status === 'pending'
            ? 'Hemos recibido tu solicitud de cita. Te confirmaremos a la brevedad.'
            : data.status === 'confirmed'
            ? 'Tu cita ha sido confirmada. Te esperamos.'
            : 'Tu cita ha sido cancelada.'}
        </p>

        <!-- Estado -->
        <div style="background:${st.color}15;border:1px solid ${st.color}40;border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:center;">
          <span style="color:${st.color};font-weight:600;font-size:14px;">${st.icon} ${st.label}</span>
        </div>

        <!-- Detalles -->
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Servicio</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;font-weight:600;">${data.serviceName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Fecha</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Horario</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${formattedTime} — ${formattedEndTime}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Duración</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${data.durationMinutes} min</td>
            </tr>
            ${data.notes ? `
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Notas</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${data.notes}</td>
            </tr>` : ''}
          </table>
        </div>

        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />

        <p style="color:#6B7280;font-size:12px;text-align:center;margin:0;">
          ${data.status === 'pending'
            ? 'Recibirás otro correo cuando tu cita sea confirmada.'
            : data.status === 'confirmed'
            ? 'Si necesitas cancelar, hazlo con al menos 24 horas de anticipación.'
            : 'Si deseas reagendar, visita nuestra página web.'}
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#F9FAFB;padding:16px 24px;text-align:center;border-top:1px solid #E5E7EB;">
        <p style="color:#9CA3AF;font-size:11px;margin:0;">
          ${orgName} — Citas de servicio
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
        subject: subjectMap[data.status] || subjectMap.pending,
        html,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[Email] Error enviando email de cita:', res.status, errBody)
      return false
    }

    console.log(`[Email] Confirmación de cita (${data.status}) enviada a ${data.customerEmail}`)
    return true
  } catch (err) {
    console.error('[Email] Error enviando email de cita:', err)
    return false
  }
}
