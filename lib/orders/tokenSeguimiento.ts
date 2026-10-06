/**
 * Token de seguimiento de un pedido web (HMAC sin estado, solo servidor).
 *
 * `/pedido/<n>` es público: con el número del pedido cualquiera ve el estado, la línea de tiempo y
 * los totales. Los datos personales (dirección, notas, ubicación del destino, conductor, GPS y
 * prueba de entrega) solo se entregan si la petición trae `?t=<token>`, que se incluye en:
 * - la respuesta de `POST /api/orders` (confirmación del checkout),
 * - el enlace del correo,
 * - `/checkout/resultado` (pago por pasarela) y `/mi-cuenta/pedidos/<id>` (cliente con sesión).
 *
 * El token firma `organization_id` + `id` del pedido: no sirve en otra organización ni en otro
 * pedido. Secreto: `ORDER_TRACKING_SECRET`; si no está, se deriva de la service role key (que
 * nunca sale del servidor) para no dejar sin seguimiento a los sitios mientras se configura.
 * Sin ninguno de los dos no se emite token y los datos personales no se muestran (falla cerrado).
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto'

function secreto(): Buffer | null {
  const propio = process.env.ORDER_TRACKING_SECRET
  if (propio && propio.length >= 16) return Buffer.from(propio)
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRole) return createHash('sha256').update(`seguimiento-pedido:${serviceRole}`).digest()
  return null
}

export function tokenSeguimiento(organizationId: number, orderId: string): string | null {
  const s = secreto()
  if (!s) return null
  return createHmac('sha256', s).update(`${organizationId}:${orderId}`).digest('base64url').slice(0, 32)
}

export function tokenSeguimientoValido(organizationId: number, orderId: string, token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false
  const esperado = tokenSeguimiento(organizationId, orderId)
  if (!esperado || esperado.length !== token.length) return false
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(token))
}

/** `/pedido/<n>` con el token, si se pudo emitir. */
export function rutaSeguimiento(organizationId: number, order: { id: string; order_number: string }): string {
  const t = tokenSeguimiento(organizationId, order.id)
  return `/pedido/${encodeURIComponent(order.order_number)}${t ? `?t=${t}` : ''}`
}
