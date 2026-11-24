/**
 * Correo con el código de 6 dígitos de la tienda (entrar, confirmar el correo, cambiar la contraseña).
 *
 * Solo la marca de la tienda: su nombre, su logo y su color. Ninguna mención de la plataforma
 * (regla del dueño 2026-11-24). El sobre (From, Reply-To) lo arma `sobreCorreoPedido` con la
 * dirección de respaldo de lib/email/remitenteRespaldo.ts.
 *
 * Código puro: sin React, Next ni Supabase (lo carga scripts/verify-cuenta-cliente.mjs).
 */

import type { SobreCorreoPedido } from '@/lib/email/marcaCorreoPedido'

export type PropositoCorreoCodigo = 'login' | 'verify' | 'reset'

function escapar(valor: string): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sin saltos de línea: el nombre va en el asunto (cabecera). */
function enLinea(valor: string): string {
  return String(valor || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function textosCorreoCodigo(proposito: PropositoCorreoCodigo, tienda: string): { asunto: string; titulo: string; intro: string } {
  const t = enLinea(tienda) || 'la tienda'
  if (proposito === 'verify') {
    return {
      asunto: `Confirma tu correo en ${t}`,
      titulo: 'Confirma tu correo',
      intro: `Escribe este código para terminar de crear tu cuenta en ${t}.`,
    }
  }
  if (proposito === 'reset') {
    return {
      asunto: `Tu código para cambiar la contraseña en ${t}`,
      titulo: 'Cambia tu contraseña',
      intro: `Escribe este código para crear una nueva contraseña en ${t}.`,
    }
  }
  return {
    asunto: `Tu código para entrar a ${t}`,
    titulo: 'Tu código para entrar',
    intro: `Escribe este código para entrar a tu cuenta en ${t}.`,
  }
}

export function correoCodigoAcceso(entrada: {
  sobre: Pick<SobreCorreoPedido, 'nombre' | 'logoUrl' | 'color' | 'texto' | 'correo'>
  codigo: string
  proposito: PropositoCorreoCodigo
  minutos: number
}): { asunto: string; html: string; texto: string } {
  const { sobre, codigo, proposito, minutos } = entrada
  const tienda = enLinea(sobre.nombre)
  const t = textosCorreoCodigo(proposito, tienda)
  const nombre = escapar(tienda)
  const digitos = escapar(String(codigo).replace(/\D/g, ''))
  const logo = sobre.logoUrl
    ? `<img src="${escapar(sobre.logoUrl)}" alt="${nombre}" height="48" style="height:48px;max-width:220px;width:auto;margin:0 auto 12px;display:block;border:0;">`
    : ''
  const contacto = sobre.correo
    ? `¿Necesitas ayuda? Escribe a <a href="mailto:${escapar(sobre.correo)}" style="color:${sobre.color};">${escapar(sobre.correo)}</a>.`
    : ''
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${sobre.color};border-radius:8px 8px 0 0;">
        <tr><td style="padding:28px 24px;text-align:center;">
          ${logo}
          ${nombre ? `<p style="margin:0;color:${sobre.texto};font-size:15px;font-weight:700;">${nombre}</p>` : ''}
        </td></tr>
      </table>
      <div style="padding:24px;">
        <h1 style="margin:0 0 16px;color:#1a1a1a;font-size:24px;">${escapar(t.titulo)}</h1>
        <p style="color:#333;font-size:15px;margin:0 0 20px;">${escapar(t.intro)}</p>
        <p style="margin:0 0 20px;text-align:center;">
          <span style="display:inline-block;padding:14px 22px;border-radius:10px;background:#f3f4f6;color:#111827;font-size:34px;font-weight:700;letter-spacing:10px;font-family:'Courier New',monospace;">${digitos}</span>
        </p>
        <p style="color:#666;font-size:14px;margin:0 0 8px;text-align:center;">Vence en ${minutos} minutos y sirve una sola vez.</p>
        <p style="color:#666;font-size:13px;margin:16px 0 0;">Si no lo pediste, ignora este correo: nadie puede entrar sin el código.</p>
        ${contacto ? `<p style="color:#999;font-size:12px;text-align:center;margin-top:24px;">${contacto}</p>` : ''}
      </div>
    </div>
  `
  const texto = [
    tienda,
    '',
    t.intro,
    '',
    `Código: ${String(codigo).replace(/\D/g, '')}`,
    `Vence en ${minutos} minutos y sirve una sola vez.`,
    '',
    'Si no lo pediste, ignora este correo: nadie puede entrar sin el código.',
    ...(sobre.correo ? ['', `¿Necesitas ayuda? Escribe a ${sobre.correo}.`] : []),
  ].join('\n')
  return { asunto: t.asunto, html, texto }
}
