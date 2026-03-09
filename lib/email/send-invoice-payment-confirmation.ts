/**
 * Envía email de confirmación de pago de factura al cliente.
 * Usa Resend vía fetch directo — no requiere npm package.
 */

interface InvoicePaymentEmailData {
  customerEmail: string
  customerName: string
  organizationName: string
  invoiceNumber: string
  invoiceTotal: number
  amountPaid: number
  newBalance: number
  currency: string
  transactionId: string
  gateway: string
}

export async function sendInvoicePaymentConfirmation(data: InvoicePaymentEmailData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY no configurada — email de pago factura omitido')
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'facturas@goadmin.io'

  const fmt = (amount: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: data.currency || 'COP',
    minimumFractionDigits: 0,
  }).format(amount)

  const isPaidInFull = data.newBalance <= 0

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#10B981,#059669);padding:32px 24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;">✅ Pago Recibido</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">${data.organizationName}</p>
      </div>

      <!-- Contenido -->
      <div style="padding:24px;">
        <p style="color:#374151;font-size:16px;margin:0 0 16px;">
          Hola <strong>${data.customerName}</strong>,
        </p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
          Hemos recibido tu pago${isPaidInFull ? '. Tu factura ha sido saldada completamente.' : ' parcial. A continuación los detalles:'}
        </p>

        <!-- Estado -->
        <div style="background:${isPaidInFull ? '#ECFDF5' : '#FEF3C7'};border:1px solid ${isPaidInFull ? '#A7F3D0' : '#FDE68A'};border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:center;">
          <span style="color:${isPaidInFull ? '#059669' : '#D97706'};font-weight:600;font-size:14px;">
            ${isPaidInFull ? '✅ Factura pagada en su totalidad' : '⚠️ Pago parcial — saldo pendiente'}
          </span>
        </div>

        <!-- Detalles -->
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Factura</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;font-weight:600;">${data.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Total factura</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${fmt(data.invoiceTotal)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Monto pagado</td>
              <td style="padding:8px 0;color:#059669;font-size:16px;text-align:right;font-weight:700;">${fmt(data.amountPaid)}</td>
            </tr>
            ${!isPaidInFull ? `
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Saldo pendiente</td>
              <td style="padding:8px 0;color:#D97706;font-size:14px;text-align:right;font-weight:600;">${fmt(data.newBalance)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Transacción</td>
              <td style="padding:8px 0;color:#111827;font-size:12px;text-align:right;font-family:monospace;">${data.transactionId}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6B7280;font-size:13px;">Pasarela</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;text-align:right;">${data.gateway}</td>
            </tr>
          </table>
        </div>

        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />

        <p style="color:#6B7280;font-size:12px;text-align:center;margin:0;">
          Este es un comprobante de pago electrónico. Conserva este correo para tu referencia.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#F9FAFB;padding:16px 24px;text-align:center;border-top:1px solid #E5E7EB;">
        <p style="color:#9CA3AF;font-size:11px;margin:0;">
          ${data.organizationName} — Comprobante de pago
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
        subject: `✅ Pago recibido — Factura ${data.invoiceNumber} | ${data.organizationName}`,
        html,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[Email] Error enviando email de pago factura:', res.status, errBody)
      return false
    }

    console.log(`[Email] Confirmación de pago factura enviada a ${data.customerEmail}`)
    return true
  } catch (err) {
    console.error('[Email] Error enviando email de pago factura:', err)
    return false
  }
}
