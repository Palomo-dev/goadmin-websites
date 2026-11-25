/**
 * Validación del cuerpo de `POST /api/reviews` (pura, sin red). La usan la ruta y el formulario
 * de la ficha con los mismos límites (Figma 2B / 2D):
 * - Calificación 1–5 (obligatoria).
 * - Opinión: opcional (desde Consultar pedido se califica solo con estrellas), pero si viene, de 10
 *   a 1.000 letras.
 * - Título hasta 120, nombre obligatorio hasta 80, ciudad hasta 80, correo válido si viene.
 * - Fotos: hasta 3, y solo URLs del bucket `review-images` de ESTA organización (las sube
 *   `/api/reviews/fotos`); cualquier otra URL se rechaza.
 */

import { MAX_FOTOS_RESENA } from '@/lib/resenas/ajustesResenas'

export const MIN_LETRAS_OPINION = 10
export const MAX_LETRAS_OPINION = 1000
export const ORIGENES_ENVIO = ['ficha', 'correo', 'pedido', 'cuenta'] as const
export type OrigenEnvio = (typeof ORIGENES_ENVIO)[number]

export type CampoResena = 'rating' | 'content' | 'title' | 'authorName' | 'authorCity' | 'email' | 'images' | 'productId'

export interface ResenaValida {
  productId: number
  rating: number
  title: string | null
  content: string | null
  authorName: string
  authorCity: string | null
  email: string | null
  images: string[]
  origen: OrigenEnvio
}

export type Validacion = { ok: true; datos: ResenaValida } | { ok: false; campo: CampoResena; mensaje: string }

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

export function correoNormalizado(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  return t.length <= 200 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(t) ? t : null
}

/** Prefijo público de las fotos de reseñas de una organización. */
export function prefijoFotosResena(supabaseUrl: string, organizationId: number): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/review-images/${organizationId}/`
}

export function validarResena(body: Record<string, unknown>, ctx: { organizationId: number; supabaseUrl: string }): Validacion {
  const productId = Number(body.productId)
  if (!Number.isInteger(productId) || productId <= 0) return { ok: false, campo: 'productId', mensaje: 'Falta el producto.' }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, campo: 'rating', mensaje: 'Elige de 1 a 5 estrellas.' }

  const contenidoCrudo = typeof body.content === 'string' ? body.content.trim() : ''
  if (contenidoCrudo && contenidoCrudo.length < MIN_LETRAS_OPINION) {
    return { ok: false, campo: 'content', mensaje: `Cuéntanos un poco más (mínimo ${MIN_LETRAS_OPINION} letras).` }
  }
  if (contenidoCrudo.length > MAX_LETRAS_OPINION) {
    return { ok: false, campo: 'content', mensaje: `Tu opinión admite hasta ${MAX_LETRAS_OPINION.toLocaleString('es-CO')} letras.` }
  }

  const authorName = texto(body.authorName, 80)
  if (!authorName) return { ok: false, campo: 'authorName', mensaje: 'Escribe tu nombre.' }

  let email: string | null = null
  if (typeof body.email === 'string' && body.email.trim()) {
    email = correoNormalizado(body.email)
    if (!email) return { ok: false, campo: 'email', mensaje: 'Revisa el correo.' }
  }

  const prefijo = prefijoFotosResena(ctx.supabaseUrl, ctx.organizationId)
  const crudas = Array.isArray(body.images) ? body.images : []
  if (crudas.length > MAX_FOTOS_RESENA) return { ok: false, campo: 'images', mensaje: `Hasta ${MAX_FOTOS_RESENA} fotos.` }
  const images: string[] = []
  for (const u of crudas) {
    if (typeof u !== 'string' || !u.startsWith(prefijo) || u.length > 500 || /[\s"'<>]/.test(u)) {
      return { ok: false, campo: 'images', mensaje: 'Una de las fotos no es válida. Vuelve a subirla.' }
    }
    images.push(u)
  }

  const origen = (ORIGENES_ENVIO as readonly string[]).includes(String(body.origen)) ? (body.origen as OrigenEnvio) : 'ficha'

  return {
    ok: true,
    datos: {
      productId,
      rating,
      title: texto(body.title, 120),
      content: contenidoCrudo ? contenidoCrudo.slice(0, MAX_LETRAS_OPINION) : null,
      authorName,
      authorCity: texto(body.authorCity, 80),
      email,
      images,
      origen,
    },
  }
}

/**
 * La organización sale del host. Si el cuerpo trae una (`organizationId`, como mandaba el cliente
 * antes) y es distinta, se rechaza: es una petición armada a mano contra otra tienda.
 */
export function organizacionDelCuerpoDistinta(body: Record<string, unknown>, organizacionHost: number): boolean {
  const v = body.organizationId ?? body.organization_id
  if (v === undefined || v === null || v === '') return false
  return Number(v) !== organizacionHost
}
