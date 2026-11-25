/**
 * Enlaces firmados de reseñas (HMAC sin estado, solo servidor).
 *
 * - Enlace para opinar (correo «¿Qué te pareció tu compra?» y verificación por correo + número de
 *   pedido): firma `organization_id` + `id` del pedido + vencimiento. Quien lo trae demuestra que
 *   recibió el correo de ESE pedido: la opinión sale con «Compra verificada». Vence a los 30 días.
 * - Baja: firma `organization_id` + `id` de la solicitud. No vence.
 *
 * Secreto: `REVIEW_LINK_SECRET`; si no está, se deriva de la service role key con un prefijo propio
 * (distinto del token de seguimiento). Sin ninguno de los dos no se firma nada (falla cerrado: la
 * opinión se guarda sin verificar).
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto'

export const VIGENCIA_ENLACE_RESENA_MS = 30 * 24 * 60 * 60 * 1000

function secreto(): Buffer | null {
  const propio = process.env.REVIEW_LINK_SECRET
  if (propio && propio.length >= 16) return Buffer.from(propio)
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRole) return createHash('sha256').update(`enlace-resena:${serviceRole}`).digest()
  return null
}

function firma(texto: string): string | null {
  const s = secreto()
  if (!s) return null
  return createHmac('sha256', s).update(texto).digest('base64url').slice(0, 32)
}

function iguales(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** `<vence en base36>.<firma>`; `null` sin secreto. */
export function firmarEnlaceResena(organizationId: number, orderId: string, ahora: number = Date.now()): string | null {
  const vence = Math.floor((ahora + VIGENCIA_ENLACE_RESENA_MS) / 1000).toString(36)
  const f = firma(`resena:${organizationId}:${orderId}:${vence}`)
  return f ? `${vence}.${f}` : null
}

export function enlaceResenaValido(organizationId: number, orderId: string, token: unknown, ahora: number = Date.now()): boolean {
  if (typeof token !== 'string' || !/^[0-9a-z]{1,10}\.[A-Za-z0-9_-]{32}$/.test(token)) return false
  const [vence, recibida] = token.split('.')
  const venceMs = parseInt(vence, 36) * 1000
  if (!Number.isFinite(venceMs) || venceMs < ahora) return false
  const esperada = firma(`resena:${organizationId}:${orderId}:${vence}`)
  return !!esperada && iguales(esperada, recibida)
}

export function firmarBajaResenas(organizationId: number, solicitudId: string): string | null {
  return firma(`baja-resenas:${organizationId}:${solicitudId}`)
}

export function bajaResenasValida(organizationId: number, solicitudId: string, token: unknown): boolean {
  if (typeof token !== 'string' || token.length !== 32) return false
  const esperada = firmarBajaResenas(organizationId, solicitudId)
  return !!esperada && iguales(esperada, token)
}
