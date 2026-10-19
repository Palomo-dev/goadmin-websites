/**
 * Presentación que el editor guarda y el sitio público tiene que respetar:
 * enlaces del menú, columnas y proporción de banners, colores de etiquetas,
 * precio, filtros y el logo claro sobre fondo oscuro.
 *
 * Puro: sin React, Next ni Supabase.
 */

export function hrefDeSlug(slug: string | null | undefined): string {
  const s = (slug ?? '').trim()
  if (!s || s === 'home' || s === '/') return '/'
  if (s.startsWith('#') || s.startsWith('?')) return s
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s
  const path = s.replace(/^\/+/, '')
  return path ? `/${path}` : '/'
}

const COLUMNAS = [1, 2, 3, 4, 5, 6, 7, 8] as const

function nCol(v: unknown, fallback: number): number {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  const n = Math.round(x)
  return (COLUMNAS as readonly number[]).includes(n) ? n : fallback
}

const CLASE_MOVIL: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2', 4: 'grid-cols-2',
  5: 'grid-cols-2', 6: 'grid-cols-2', 7: 'grid-cols-2', 8: 'grid-cols-2',
}
const CLASE_TABLET: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4',
  5: 'md:grid-cols-3', 6: 'md:grid-cols-3', 7: 'md:grid-cols-4', 8: 'md:grid-cols-4',
}
const CLASE_ESCRITORIO: Record<number, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7', 8: 'lg:grid-cols-8',
}

/** Rejilla de banners. Sin columnas guardadas se queda en 2, como antes. */
export function clasesColumnasBanner(
  columns: unknown,
  layout: string | undefined,
  columnsMobile?: unknown,
): string {
  if (layout === 'stack') return 'grid grid-cols-1 gap-6'
  let mobile = 1
  let tablet = 2
  let desktop = 2
  if (typeof columns === 'number' || (typeof columns === 'string' && columns.trim())) {
    desktop = nCol(columns, 2)
    tablet = Math.min(desktop, 2)
  } else if (columns && typeof columns === 'object') {
    const o = columns as Record<string, unknown>
    if ('desktop' in o || 'tablet' in o || 'mobile' in o) {
      desktop = nCol(o.desktop, 2)
      tablet = nCol(o.tablet ?? o.desktop, Math.min(desktop, 2))
      mobile = nCol(o.mobile, 1)
    }
  }
  const forzado = nCol(columnsMobile, 0)
  if (forzado === 1 || forzado === 2) mobile = forzado
  return `grid ${CLASE_MOVIL[mobile]} ${CLASE_TABLET[tablet]} ${CLASE_ESCRITORIO[desktop]} gap-6`
}

function claseAspectoUna(ratio: unknown): string {
  if (ratio === '1/1') return 'aspect-square'
  if (ratio === '4/3') return 'aspect-[4/3]'
  if (ratio === '3/4') return 'aspect-[3/4]'
  if (ratio === '16/9') return 'aspect-video'
  if (ratio === '3/1') return 'aspect-[3/1]'
  return 'min-h-[200px]'
}

function claseAspectoMd(ratio: unknown): string {
  if (ratio === '1/1') return 'md:aspect-square'
  if (ratio === '4/3') return 'md:aspect-[4/3]'
  if (ratio === '3/4') return 'md:aspect-[3/4]'
  if (ratio === '16/9') return 'md:aspect-video'
  if (ratio === '3/1') return 'md:aspect-[3/1]'
  return 'md:aspect-auto md:min-h-[200px]'
}

/**
 * `auto` y ausente conservan la tarjeta de siempre.
 * Con proporción de celular distinta, el prefijo sin breakpoint es el móvil
 * y `md:` recupera la de escritorio.
 */
export function claseAspectoBanner(ratio: unknown, ratioMovil?: unknown): string {
  const movil = typeof ratioMovil === 'string' ? ratioMovil : ''
  if (!movil || movil === 'auto' || movil === ratio) return claseAspectoUna(ratio)
  return `${claseAspectoUna(movil)} ${claseAspectoMd(ratio)}`
}

/** Recorte y anclaje de la foto del banner. Ausente = cubrir, centrada. */
export function claseImagenBanner(fit: unknown, position: unknown): string {
  const ajuste = fit === 'contain' ? 'object-contain' : 'object-cover'
  const pos = position === 'left' ? 'object-left'
    : position === 'right' ? 'object-right'
    : position === 'top' ? 'object-top'
    : position === 'bottom' ? 'object-bottom'
    : 'object-center'
  return `absolute inset-0 w-full h-full ${ajuste} ${pos}`
}

const REJILLA_PRODUCTOS = 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6'
const P_BASE: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2', 4: 'grid-cols-2',
  5: 'grid-cols-2', 6: 'grid-cols-2', 7: 'grid-cols-2', 8: 'grid-cols-2',
}
const P_SM: Record<number, string> = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2', 4: 'sm:grid-cols-2',
  5: 'sm:grid-cols-2', 6: 'sm:grid-cols-2', 7: 'sm:grid-cols-2', 8: 'sm:grid-cols-2',
}
const P_LG: Record<number, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7', 8: 'lg:grid-cols-8',
}
const P_XL: Record<number, string> = {
  1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 7: 'xl:grid-cols-7', 8: 'xl:grid-cols-8',
}

/** Sin columnas guardadas, la rejilla de productos no cambia. */
export function clasesColumnasProductos(columns: unknown): string {
  if (columns == null || columns === '') return REJILLA_PRODUCTOS
  let mobile = 2
  let tablet = 3
  let desktop = 4
  let explicito = false
  if (typeof columns === 'number' || (typeof columns === 'string' && String(columns).trim())) {
    desktop = nCol(columns, 4)
    tablet = Math.min(desktop, 3)
    mobile = Math.min(desktop, 2)
    explicito = true
  } else if (columns && typeof columns === 'object') {
    const o = columns as Record<string, unknown>
    if ('desktop' in o || 'tablet' in o || 'mobile' in o) {
      desktop = nCol(o.desktop, 4)
      tablet = nCol(o.tablet ?? Math.min(desktop, 3), Math.min(desktop, 3))
      mobile = nCol(o.mobile, Math.min(desktop, 2))
      explicito = true
    }
  }
  if (!explicito) return REJILLA_PRODUCTOS
  return `grid ${P_BASE[mobile]} ${P_SM[mobile]} ${P_LG[tablet]} ${P_XL[desktop]} gap-3 sm:gap-6`
}

/**
 * Enlace de toda la imagen de la portada.
 * Con el botón visible no se reutiliza su URL: el botón ya la usa.
 * Apagado el botón, la URL del botón sirve de enlace de la imagen.
 */
export function enlaceDeImagen(
  slide: { link_url?: unknown; cta_url?: unknown } | null | undefined,
  content: { link_url?: unknown; cta_url?: unknown } | null | undefined,
  mostrarBoton: boolean,
): string {
  const propio = textoGuardado(slide?.link_url) || textoGuardado(content?.link_url)
  const bruto = propio || (mostrarBoton ? '' : textoGuardado(slide?.cta_url) || textoGuardado(content?.cta_url))
  return bruto ? hrefDeSlug(bruto) : ''
}

export function mismoId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined || a === '' || b === '') return false
  return String(a) === String(b)
}

function colorGuardado(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

const ETIQUETAS: Record<string, { bg: string; text: string; fondo: string; texto: string }> = {
  discount: { bg: '#EF4444', text: '#FFFFFF', fondo: 'badge_discount_bg', texto: 'badge_discount_text' },
  new: { bg: '#10B981', text: '#FFFFFF', fondo: 'badge_new_bg', texto: 'badge_new_text' },
  free_shipping: { bg: '#3B82F6', text: '#FFFFFF', fondo: 'badge_shipping_bg', texto: 'badge_shipping_text' },
}

export function coloresEtiqueta(
  tipo: string | null | undefined,
  badge: { bg_color?: string | null; text_color?: string | null } | null | undefined,
  content: Record<string, unknown> | null | undefined,
  fallbackBg: string,
  fallbackText: string,
): { bg: string; text: string } {
  const propio = tipo ? ETIQUETAS[tipo] : undefined
  const bg = colorGuardado(badge?.bg_color)
    || (propio ? colorGuardado(content?.[propio.fondo]) : undefined)
    || (propio ? propio.bg : fallbackBg)
  const text = colorGuardado(badge?.text_color)
    || (propio ? colorGuardado(content?.[propio.texto]) : undefined)
    || (propio ? propio.text : fallbackText)
  return { bg, text }
}

export function textoGuardado(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function estiloPrecio(
  content: Record<string, unknown> | null | undefined,
  acento: string,
): { color: string; fontWeight: number } {
  const color = colorGuardado(content?.price_color) || acento
  const n = Number(content?.price_weight)
  const fontWeight = [400, 500, 600, 700, 800].includes(n) ? n : 700
  return { color, fontWeight }
}

export function colorPrecioAnterior(content: Record<string, unknown> | null | undefined): string | undefined {
  return colorGuardado(content?.compare_price_color)
}

export interface ColoresFiltro {
  filter_active_bg?: unknown
  filter_active_text?: unknown
  filter_inactive_bg?: unknown
  filter_inactive_text?: unknown
  [key: string]: unknown
}

export function estiloChipFiltro(
  activo: boolean,
  acento: string | undefined,
  content: ColoresFiltro | null | undefined,
): { className: string; style: Record<string, string> } {
  if (activo) {
    return {
      className: 'border-transparent',
      style: {
        backgroundColor: colorGuardado(content?.filter_active_bg) || acento || '#111827',
        color: colorGuardado(content?.filter_active_text) || '#ffffff',
      },
    }
  }
  const fondo = colorGuardado(content?.filter_inactive_bg)
  const texto = colorGuardado(content?.filter_inactive_text)
  if (!fondo && !texto) {
    return {
      className: 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400',
      style: {},
    }
  }
  return {
    className: 'border-gray-200 dark:border-gray-700',
    style: {
      ...(fondo ? { backgroundColor: fondo } : {}),
      ...(texto ? { color: texto } : {}),
    },
  }
}

export function elegirLogo(
  normal: string | null | undefined,
  claro: string | null | undefined,
  fondoOscuro: boolean,
): string | null {
  if (fondoOscuro && claro) return claro
  return normal || null
}

function esOscuro(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.62
}

export function pieUsaLogoClaro(
  fondo: string | null | undefined,
  color: string | null | undefined,
  primario: string | null | undefined,
  fondoTemaOscuro: boolean,
): boolean {
  const modo = fondo || 'dark'
  if (modo === 'light') return false
  if (modo === 'dark') return true
  if (modo === 'primary') return !primario || esOscuro(primario)
  if (modo === 'custom') return !color || esOscuro(color)
  if (modo === 'tema') return fondoTemaOscuro
  return false
}

export function encabezadoUsaLogoClaro(color: string | null | undefined, transparenteSobre: boolean): boolean {
  if (transparenteSobre) return true
  return typeof color === 'string' && color.trim() !== '' && esOscuro(color)
}
