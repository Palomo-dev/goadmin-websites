/**
 * Remitente de respaldo de los correos a compradores — el ÚNICO lugar donde se decide.
 *
 * Regla del dueño (2026-11-24): un comprador de una tienda NUNCA recibe un correo con la marca de
 * la plataforma ni desde una dirección de la plataforma. El nombre visible es siempre el de la
 * tienda; la dirección es la del dominio verificado de la tienda (`email_domains`, ver
 * `resolverRemitente`) y, si no tiene, la de respaldo que devuelve esta función.
 *
 * - `CORREO_RESPALDO_TIENDAS` (Vercel, proyecto de la tienda): dirección de un dominio neutro, sin
 *   marca, verificado en Resend (p. ej. `pedidos@<dominio-neutro>`). Admite `Nombre <correo>`: el
 *   nombre se descarta, el visible es el de la tienda.
 * - Mientras no exista: la dirección de siempre (`RESEND_FROM_EMAIL` o `pedidos@…` de la
 *   plataforma) para no dejar de enviar los correos de pedidos, con un `console.warn` una vez por
 *   arranque.
 *
 * Correos al equipo de la tienda (avisos de contacto o de reserva) no pasan por aquí.
 */

import { correoValido, resolverRemitente, RESPALDO_LEGADO, type DominioRemitente } from '@/lib/email/marcaCorreoPedido'

let avisado = false

/** `correo@x.co` o `Nombre <correo@x.co>` → `correo@x.co`; cualquier otra cosa, null. */
export function direccionDe(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const m = /<([^<>]+)>\s*$/.exec(valor.trim())
  return correoValido(m ? m[1] : valor)
}

/** Dirección de respaldo para tiendas sin dominio verificado. */
export function correoRespaldoTiendas(): string {
  const propia = direccionDe(process.env.CORREO_RESPALDO_TIENDAS)
  if (propia) return propia
  if (!avisado) {
    avisado = true
    console.warn(
      '[correo] Falta CORREO_RESPALDO_TIENDAS: las tiendas sin dominio verificado envían desde la dirección de respaldo de la plataforma (con el nombre de la tienda). Configúrala en Vercel con una dirección de un dominio neutro verificado en Resend.',
    )
  }
  return direccionDe(process.env.RESEND_FROM_EMAIL) ?? RESPALDO_LEGADO
}

/**
 * From y Reply-To de un correo a un comprador: dominio verificado de la tienda si lo tiene; si no,
 * el respaldo. Sin dominios conocidos (correos que no cargan la marca), siempre el respaldo. El
 * nombre visible es el de la tienda; vacío, «Tienda».
 */
export function remitenteTienda(entrada: {
  nombre: string | null | undefined
  correoTienda?: string | null
  dominios?: DominioRemitente[] | null
}): { from: string; replyTo: string | null } {
  const r = resolverRemitente({
    nombre: (entrada.nombre || '').trim(),
    correoTienda: entrada.correoTienda ?? null,
    dominios: entrada.dominios ?? [],
    respaldo: correoRespaldoTiendas(),
  })
  return { from: r.from, replyTo: r.replyTo }
}
