/**
 * Envía email de confirmación de membresía al cliente.
 * Usa Resend (https://resend.com) vía fetch directo — no requiere npm package.
 * Si RESEND_API_KEY no está configurada, no hace nada (silent no-op).
 */

interface MembershipEmailData {
  membershipId: number
  customerEmail: string
  customerName: string
  planName: string
  planPrice: number
  startDate: string
  endDate: string
  accessCode: string
  frequency: string
  organizationName: string
  portalUrl: string
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case 'monthly': return 'Mensual'
    case 'quarterly': return 'Trimestral'
    case 'semiannual': return 'Semestral'
    case 'annual': return 'Anual'
    case 'weekly': return 'Semanal'
    default: return frequency
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export async function sendMembershipConfirmationEmail(data: MembershipEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de membresía omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'membresias@goadmin.io'

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#EFF6FF;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:#1E40AF;font-size:24px;">💪 ¡Membresía Activada!</h1>
        <p style="margin:8px 0 0;color:#666;font-size:14px;">${data.organizationName}</p>
      </div>
      
      <div style="padding:24px;">
        <p style="color:#333;font-size:16px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#666;font-size:14px;">
          Tu membresía ha sido activada exitosamente. ¡Bienvenido!
        </p>
        
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Plan</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${data.planName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Frecuencia</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${formatFrequency(data.frequency)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Inicio</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${formatDate(data.startDate)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Vencimiento</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#333;">${formatDate(data.endDate)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;font-size:13px;">Total pagado</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#1E40AF;font-size:16px;">$${Number(data.planPrice).toLocaleString('es-CO')}</td>
            </tr>
          </table>
        </div>

        ${data.accessCode ? `
        <div style="background:#DBEAFE;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 8px;color:#666;font-size:13px;">Tu código de acceso</p>
          <p style="margin:0;font-size:28px;font-weight:bold;color:#1E40AF;letter-spacing:4px;">${data.accessCode}</p>
          <p style="margin:8px 0 0;color:#666;font-size:12px;">Presenta este código en la recepción del gimnasio</p>
        </div>
        ` : ''}
        
        <div style="text-align:center;margin:24px 0;">
          <a href="${data.portalUrl}" 
             style="display:inline-block;background:#1E40AF;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
            Ver mi membresía
          </a>
        </div>
        
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">
          Si tienes alguna pregunta, contacta directamente a ${data.organizationName}.
        </p>
      </div>
    </div>
  `

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
        subject: `💪 Membresía activada — ${data.planName} | ${data.organizationName}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Error enviando email de membresía:', err)
      return false
    }

    console.log(`[Email] Confirmación de membresía enviada a ${data.customerEmail}`)
    return true
  } catch (error) {
    console.error('[Email] Error enviando email de membresía:', error)
    return false
  }
}
