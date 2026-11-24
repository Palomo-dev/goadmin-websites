/**
 * Envía el código de 6 dígitos de la tienda al comprador, con Resend y la marca de la tienda.
 *
 * Reutiliza lo del correo de pedidos: la marca (`cargarMarcaPedido`), el sobre
 * (`sobreCorreoPedido`: dominio verificado de la tienda o el respaldo de
 * lib/email/remitenteRespaldo.ts, siempre con el nombre de la tienda) y la clave (`claveResend`).
 * Nada de Supabase Auth ni de la marca de la plataforma (regla del dueño 2026-11-24).
 *
 * Nunca escribe el código en el log. Devuelve `true` si Resend lo aceptó.
 */

import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { sobreCorreoPedido } from '@/lib/email/marcaCorreoPedido'
import { correoRespaldoTiendas } from '@/lib/email/remitenteRespaldo'
import { correoCodigoAcceso, type PropositoCorreoCodigo } from '@/lib/email/correoCodigoAcceso'
import { claveResend } from '@/lib/orders/claveResend'
import { MINUTOS_VIGENCIA_CODIGO } from '@/lib/cuenta/reglasCuenta'

type ClienteDb = { from: (tabla: string) => any; rpc: (...args: any[]) => any }

export async function enviarCodigoAcceso(
  db: ClienteDb,
  entrada: { organizationId: number; correo: string; codigo: string; proposito: PropositoCorreoCodigo },
): Promise<boolean> {
  const { organizationId, correo, codigo, proposito } = entrada
  try {
    const [apiKey, marca] = await Promise.all([claveResend(db), cargarMarcaPedido(db, organizationId, null)])
    if (!apiKey) {
      console.error('[codigo] Falta la clave de envío: código sin enviar', { organizationId })
      return false
    }
    const sobre = sobreCorreoPedido({
      nombre: marca.nombre,
      correoTienda: marca.correo,
      logoUrl: marca.logoUrl,
      color: marca.color,
      dominios: marca.dominios,
      respaldo: correoRespaldoTiendas(),
    })
    const { asunto, html, texto } = correoCodigoAcceso({ sobre, codigo, proposito, minutos: MINUTOS_VIGENCIA_CODIGO })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: sobre.from,
        to: [correo],
        ...(sobre.replyTo ? { reply_to: sobre.replyTo } : {}),
        subject: asunto,
        html,
        text: texto,
      }),
    })
    if (!res.ok) {
      console.error('[codigo] Resend no aceptó el correo del código', { organizationId, proposito, status: res.status })
      return false
    }
    return true
  } catch (err) {
    console.error('[codigo] Error enviando el código', { organizationId, proposito, err: err instanceof Error ? err.message : err })
    return false
  }
}
