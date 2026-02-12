/**
 * Envía email de recordatorio de vencimiento de membresía.
 * Usa Resend vía fetch directo — silent no-op si RESEND_API_KEY no está configurada.
 *
 * Diseñado para ser llamado desde un cron job o edge function:
 *   - 7 días antes del vencimiento
 *   - 3 días antes del vencimiento
 *   - El día del vencimiento
 */

interface MembershipReminderData {
  customerEmail: string
  customerName: string
  planName: string
  endDate: string
  daysLeft: number
  renewUrl: string
  organizationName: string
}

export async function sendMembershipReminderEmail(data: MembershipReminderData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada, omitiendo recordatorio de membresía')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@goadmin.app'
  const endDateStr = new Date(data.endDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  const urgencyColor = data.daysLeft <= 1 ? '#EF4444' : data.daysLeft <= 3 ? '#F59E0B' : '#3B82F6'
  const urgencyBg = data.daysLeft <= 1 ? '#FEF2F2' : data.daysLeft <= 3 ? '#FFFBEB' : '#EFF6FF'
  const urgencyText = data.daysLeft <= 1 ? '#991B1B' : data.daysLeft <= 3 ? '#92400E' : '#1E40AF'

  const subject = data.daysLeft <= 0
    ? `Tu membresía ha expirado — ${data.organizationName}`
    : data.daysLeft === 1
    ? `Tu membresía vence mañana — ${data.organizationName}`
    : `Tu membresía vence en ${data.daysLeft} días — ${data.organizationName}`

  const mainMessage = data.daysLeft <= 0
    ? 'Tu membresía ha expirado. Renueva ahora para seguir disfrutando de todos los beneficios.'
    : data.daysLeft === 1
    ? 'Tu membresía vence <strong>mañana</strong>. Renueva ahora para no perder el acceso.'
    : `Tu membresía vence en <strong>${data.daysLeft} días</strong>. Te recomendamos renovar a tiempo para no perder el acceso.`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:${urgencyColor};padding:24px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">${data.daysLeft <= 0 ? 'Membresía Expirada' : 'Recordatorio de Membresía'}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">Hola <strong>${data.customerName}</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">${mainMessage}</p>

      <div style="background:${urgencyBg};border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px;">Plan</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${data.planName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Vencimiento</td>
            <td style="padding:6px 0;color:${urgencyText};font-size:14px;font-weight:600;">${endDateStr}</td>
          </tr>
          ${data.daysLeft > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Días restantes</td><td style="padding:6px 0;color:${urgencyText};font-size:14px;font-weight:600;">${data.daysLeft}</td></tr>` : ''}
        </table>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${data.renewUrl}" style="display:inline-block;background:${urgencyColor};color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">Renovar ahora</a>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:20px 0 0;">
        Si ya renovaste, puedes ignorar este mensaje.
      </p>
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
        subject,
        html,
      }),
    })

    if (!res.ok) {
      console.error('[Email] Error enviando recordatorio de membresía:', await res.text())
      return false
    }

    console.log(`[Email] Recordatorio membresía (${data.daysLeft}d) enviado a ${data.customerEmail}`)
    return true
  } catch (error) {
    console.error('[Email] Error:', error)
    return false
  }
}
