/**
 * CONTAC-03: aviso por correo del formulario de contacto al «Email de destino» (`email_to`) de la
 * sección. El mensaje SIEMPRE se guarda primero en el CRM (/api/contact → web_capture_lead); este
 * correo es adicional y best-effort: nunca lanza. Mismo proveedor (Resend) que los demás avisos.
 */

export interface AvisoContacto {
  destinatarios: string[]
  organizacion: string
  nombre: string
  email: string
  telefono?: string | null
  asunto?: string | null
  empresa?: string | null
  mensaje: string
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CORREO = /^[^@\s,;<>]+@[^@\s.,;<>]+(\.[^@\s.,;<>]+)+$/

/** `email_to` admite uno o varios correos separados por coma o punto y coma (máx. 5). */
export function destinatariosDe(valor: unknown): string[] {
  if (typeof valor !== 'string') return []
  const lista = valor.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter((s) => s.length <= 160 && CORREO.test(s))
  return Array.from(new Set(lista)).slice(0, 5)
}

export function contenidoAvisoContacto(a: AvisoContacto): { asunto: string; html: string; texto: string } {
  const asunto = `Nuevo mensaje del sitio web${a.asunto ? ` · ${a.asunto}` : ''}`.slice(0, 200)
  const filas: [string, string][] = [
    ['Nombre', a.nombre],
    ['Correo', a.email],
    ...(a.telefono ? ([['Teléfono', a.telefono]] as [string, string][]) : []),
    ...(a.empresa ? ([['Empresa', a.empresa]] as [string, string][]) : []),
    ...(a.asunto ? ([['Asunto', a.asunto]] as [string, string][]) : []),
  ]
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#eff6ff;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;color:#111;">${escaparHtml(asunto)}</h1>
        <p style="margin:6px 0 0;color:#555;font-size:14px;">${escaparHtml(a.organizacion)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${filas.map(([k, v]) => `<tr><td style="padding:6px 0;color:#666;font-size:13px;">${escaparHtml(k)}</td><td style="padding:6px 0;text-align:right;color:#111;font-weight:600;">${escaparHtml(v)}</td></tr>`).join('')}
      </table>
      <p style="white-space:pre-wrap;color:#111;font-size:14px;">${escaparHtml(a.mensaje)}</p>
      <p style="color:#555;font-size:13px;">También quedó en GO Admin › CRM. Responde este correo para escribirle a ${escaparHtml(a.nombre)}.</p>
    </div>`
  const texto = [asunto, '', ...filas.map(([k, v]) => `${k}: ${v}`), '', a.mensaje].join('\n')
  return { asunto, html, texto }
}

export async function sendContactNotice(aviso: AvisoContacto): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || aviso.destinatarios.length === 0) return false
  // Remitente propio de contacto; RESEND_FROM_EMAIL ya no se usa aquí (es el de reservas).
  const fromEmail = process.env.RESEND_CONTACT_FROM_EMAIL || 'GO Admin <contacto@goadmin.io>'
  const { asunto, html, texto } = contenidoAvisoContacto(aviso)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromEmail, to: aviso.destinatarios, subject: asunto, html, text: texto, reply_to: aviso.email }),
      // Un Resend lento no debe colgar la respuesta al visitante.
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error('[Email] Aviso de contacto no enviado:', res.status)
      return false
    }
    return true
  } catch (error) {
    console.error('[Email] Aviso de contacto no enviado:', error instanceof Error ? error.message : 'error')
    return false
  }
}
