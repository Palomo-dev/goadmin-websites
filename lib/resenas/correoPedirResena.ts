/**
 * Correo «¿Qué te pareció tu compra?» (Figma 3A, 3131-92123).
 *
 * Regla del dueño: el comprador NUNCA recibe un correo con la marca de la plataforma. Marca,
 * colores, logo y remitente son los de la tienda (`cargarMarcaPedido` + `sobreCorreoPedido`, con el
 * respaldo único de `remitenteRespaldo.ts`). Cada estrella es un enlace firmado que abre el
 * formulario con esas estrellas marcadas (`/opinar/<pedido>`); la baja va en el pie y en
 * `List-Unsubscribe` (un clic, RFC 8058).
 *
 * `armarCorreoPedirResena` es puro (lo prueba `scripts/verify-resenas.mjs`).
 */

import type { SobreCorreoPedido } from '@/lib/email/marcaCorreoPedido'

function escapar(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export interface ProductoCorreo {
  nombre: string
  foto: string | null
  /** Cinco enlaces: estrella 1 a 5. */
  estrellas: string[]
}

export interface DatosCorreoPedirResena {
  sobre: Pick<SobreCorreoPedido, 'nombre' | 'logoUrl' | 'color' | 'texto'>
  nombreCliente: string
  numeroPedido: string
  /** «14 de noviembre» en la zona de la tienda; vacío si no se sabe. */
  entregado: string
  productos: ProductoCorreo[]
  enlaceEscribir: string
  enlaceBaja: string
  /** Dominio de la tienda para el pie («compraste en tienda.co»). */
  host: string
  recordatorio: boolean
}

const ESTRELLA_VACIA = '&#9734;'

export function armarCorreoPedirResena(d: DatosCorreoPedirResena): { asunto: string; html: string } {
  const tienda = escapar(d.sobre.nombre || 'Tienda')
  const saludo = d.nombreCliente ? `Hola, ${escapar(d.nombreCliente)}` : 'Hola'
  const numero = escapar(d.numeroPedido)
  const asunto = d.recordatorio
    ? `${d.nombreCliente ? `${d.nombreCliente}, ¿` : '¿'}nos cuentas qué te pareció tu pedido ${d.numeroPedido}?`
    : `${d.nombreCliente ? `${d.nombreCliente}, ¿` : '¿'}qué te pareció tu pedido ${d.numeroPedido}?`
  const color = d.sobre.color
  const logo = d.sobre.logoUrl
    ? `<img src="${escapar(d.sobre.logoUrl)}" alt="${tienda}" height="32" style="height:32px;max-width:160px;display:block;border:0;" />`
    : `<span style="font-size:18px;font-weight:700;color:${d.sobre.texto};">${tienda}</span>`

  const tarjetas = d.productos
    .map((p) => {
      const foto = p.foto
        ? `<img src="${escapar(p.foto)}" alt="" width="48" height="48" style="width:48px;height:48px;border-radius:8px;object-fit:cover;display:block;border:0;" />`
        : `<span style="display:block;width:48px;height:48px;border-radius:8px;background:#F3F4F6;"></span>`
      const estrellas = p.estrellas
        .map((url, i) => `<a href="${escapar(url)}" title="${i + 1} de 5" style="text-decoration:none;font-size:30px;line-height:30px;color:#D1D5DB;padding-right:4px;">${ESTRELLA_VACIA}</a>`)
        .join('')
      return `
        <tr><td style="padding:0 0 12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;">
            <tr><td style="padding:16px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;">${foto}</td>
                <td style="font-size:15px;font-weight:600;color:#111827;">${escapar(p.nombre)}</td>
              </tr></table>
              <div style="margin-top:12px;">${estrellas}<span style="font-size:12px;color:#6B7280;vertical-align:middle;padding-left:6px;">Toca una estrella</span></div>
            </td></tr>
          </table>
        </td></tr>`
    })
    .join('')

  const llego = d.entregado ? `Tu pedido ${numero} llegó el ${escapar(d.entregado)}.` : `Tu pedido ${numero} ya llegó.`
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${color};padding:18px 24px;">${logo}</td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 12px 0;font-size:24px;color:#111827;">${saludo}</h1>
          <p style="margin:0 0 20px 0;font-size:15px;line-height:22px;color:#374151;">${llego} ¿Qué te pareció? Tu opinión ayuda a otros clientes y a nosotros a mejorar.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tarjetas}</table>
          <p style="margin:8px 0 12px 0;">
            <a href="${escapar(d.enlaceEscribir)}" style="display:inline-block;background:${color};color:${d.sobre.texto};padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Escribir mi opinión</a>
          </p>
          <p style="margin:0 0 20px 0;font-size:13px;color:#15803D;">&#10003; Tu opinión saldrá con «Compra verificada».</p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:16px 24px;font-size:12px;line-height:18px;color:#6B7280;">
          ${tienda}<br />
          Te escribimos porque compraste en ${escapar(d.host)}. <a href="${escapar(d.enlaceBaja)}" style="color:#6B7280;">No quiero recibir más solicitudes de opinión</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { asunto, html }
}

/** Envía por Resend. Nunca lanza. */
export async function enviarPorResend(
  apiKey: string,
  sobre: { from: string; replyTo: string | null },
  para: string,
  correo: { asunto: string; html: string },
  enlaceBaja: string,
): Promise<{ ok: boolean; id: string | null }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: sobre.from,
        to: [para],
        ...(sobre.replyTo ? { reply_to: sobre.replyTo } : {}),
        subject: correo.asunto,
        html: correo.html,
        headers: { 'List-Unsubscribe': `<${enlaceBaja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    })
    if (!res.ok) {
      console.error('[pedir-resena] Resend respondió con error', { status: res.status })
      return { ok: false, id: null }
    }
    const cuerpo = (await res.json().catch(() => null)) as { id?: unknown } | null
    return { ok: true, id: typeof cuerpo?.id === 'string' ? cuerpo.id : null }
  } catch {
    console.error('[pedir-resena] No se pudo enviar el correo')
    return { ok: false, id: null }
  }
}
