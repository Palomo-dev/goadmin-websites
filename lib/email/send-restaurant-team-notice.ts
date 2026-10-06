/**
 * Aviso por correo al EQUIPO de una reserva de mesa hecha en el sitio.
 *
 * Destinatarios: `restaurant_booking_settings.notify_emails` de la sede (o de
 * la organización si la sede no tiene fila), que se configuran en POS ›
 * Reservas de mesa › Configuración. Sin destinatarios no se envía nada. El
 * aviso dentro del ERP (campana y tiempo real) lo crea la base (migración D3);
 * este correo es para quien no tiene el ERP abierto.
 *
 * Best-effort: nunca lanza. Mismo proveedor y remitente que el correo al
 * cliente (`send-restaurant-table-confirmation.ts`).
 */

export interface AvisoEquipoReserva {
  destinatarios: string[]
  organizacion: string
  sede: string | null
  codigo: string
  cliente: string
  telefono: string | null
  email: string | null
  personas: number
  /** Fecha ya legible («sábado 10 de octubre»). */
  fecha: string
  hora: string
  /** `confirmed` o `pending`. */
  estado: string
  notas: string | null
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function contenidoAvisoEquipo(a: AvisoEquipoReserva): { asunto: string; html: string; texto: string } {
  const pendiente = a.estado === 'pending'
  const lugar = a.sede ? ` · ${a.sede}` : ''
  const asunto = `${pendiente ? 'Reserva web por confirmar' : 'Nueva reserva web'}${lugar} · ${a.fecha} ${a.hora}`
  const filas: [string, string][] = [
    ['Código', a.codigo],
    ['Cliente', a.cliente],
    ...(a.telefono ? ([['Celular', a.telefono]] as [string, string][]) : []),
    ...(a.email ? ([['Correo', a.email]] as [string, string][]) : []),
    ['Día', a.fecha],
    ['Hora', a.hora],
    ['Personas', String(a.personas)],
    ...(a.sede ? ([['Sede', a.sede]] as [string, string][]) : []),
    ...(a.notas ? ([['Notas', a.notas]] as [string, string][]) : []),
  ]
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:${pendiente ? '#fffbeb' : '#eff6ff'};padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;color:#111;">${escaparHtml(asunto)}</h1>
        <p style="margin:6px 0 0;color:#555;font-size:14px;">${escaparHtml(a.organizacion)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${filas
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 0;color:#666;font-size:13px;">${escaparHtml(k)}</td><td style="padding:6px 0;text-align:right;color:#111;font-weight:600;">${escaparHtml(v)}</td></tr>`,
          )
          .join('')}
      </table>
      <p style="color:#555;font-size:13px;">${
        pendiente
          ? 'Confírmala o recházala en GO Admin › POS › Reservas de mesa.'
          : 'La encuentras en GO Admin › POS › Reservas de mesa.'
      }</p>
    </div>`
  const texto = [asunto, '', ...filas.map(([k, v]) => `${k}: ${v}`)].join('\n')
  return { asunto, html, texto }
}

export async function sendRestaurantTeamNotice(aviso: AvisoEquipoReserva): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || aviso.destinatarios.length === 0) return false
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'reservas@goadmin.io'
  const { asunto, html, texto } = contenidoAvisoEquipo(aviso)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromEmail,
        to: aviso.destinatarios,
        subject: asunto,
        html,
        text: texto,
        ...(aviso.email ? { reply_to: aviso.email } : {}),
      }),
    })
    if (!res.ok) {
      console.error('[Email] Aviso de reserva al equipo no enviado:', res.status)
      return false
    }
    return true
  } catch (error) {
    console.error('[Email] Aviso de reserva al equipo no enviado:', error instanceof Error ? error.message : 'error')
    return false
  }
}
