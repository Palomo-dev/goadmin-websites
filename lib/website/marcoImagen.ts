/**
 * Recuadro de imagen de categorías y beneficios.
 *
 * Con la clave ausente el resultado es el de hoy: cubrir, sin proporción forzada,
 * sin margen y sin fondo propio. La proporción solo sustituye al aspect de la forma
 * cuando viene en el contenido.
 */

const AJUSTE: Record<string, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
}

const PROPORCION: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
  '16:9': 'aspect-video',
}

/** `object-cover` si `image_fit` no viene o no se reconoce. */
export function claseAjusteImagen(valor: unknown): string {
  return typeof valor === 'string' && AJUSTE[valor] ? AJUSTE[valor] : 'object-cover'
}

/** Clase de aspect-ratio, o '' si no hay `image_ratio` conocido. */
export function claseProporcionImagen(valor: unknown): string {
  return typeof valor === 'string' && PROPORCION[valor] ? PROPORCION[valor] : ''
}

export interface MarcoImagen {
  image_fit?: unknown
  image_ratio?: unknown
  image_padding?: unknown
  image_bg?: unknown
  image_max_size?: unknown
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim() !== '' && Number.isFinite(Number(valor))) return Number(valor)
  return null
}

/** Estilo inline solo con las claves presentes. Vacío = no pisar el estilo actual. */
export function estiloMarcoImagen(marco: MarcoImagen | null | undefined): Record<string, string | number> {
  const estilo: Record<string, string | number> = {}
  const fondo = marco?.image_bg
  if (typeof fondo === 'string' && fondo.trim() !== '') estilo.backgroundColor = fondo
  const margen = numero(marco?.image_padding)
  if (margen != null && margen > 0) estilo.padding = margen
  const tope = numero(marco?.image_max_size)
  if (tope != null && tope > 0) {
    estilo.maxHeight = tope
    estilo.maxWidth = tope
  }
  return estilo
}

/**
 * Clases de la foto de beneficios. Sin ninguna clave nueva: el string de hoy
 * (`w-full max-h-48 rounded-xl object-cover`).
 */
export function clasesImagenBeneficio(marco: MarcoImagen | null | undefined): string {
  const fit = marco?.image_fit
  const ratio = claseProporcionImagen(marco?.image_ratio)
  const tope = numero(marco?.image_max_size)
  const margen = numero(marco?.image_padding)
  const hayClave = (typeof fit === 'string' && fit !== '') || ratio !== '' || tope != null || (margen != null && margen > 0)
  if (!hayClave) return 'mb-4 w-full max-h-48 rounded-xl object-cover'
  const ajuste = claseAjusteImagen(fit)
  const alto = tope == null && ratio === '' ? 'max-h-48' : 'h-full'
  return ['mb-4 w-full rounded-xl', alto, ratio, ajuste].filter(Boolean).join(' ')
}
