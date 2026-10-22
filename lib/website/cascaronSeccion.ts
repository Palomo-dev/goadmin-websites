/**
 * Encabezado y fondo comunes de una sección (`section_header`, `section_background`).
 *
 * Sin el objeto, la sección sigue con su título y su fondo de hoy.
 * Puro: sin React ni alias.
 */

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const TAM_TITULO = ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] as const
const PESOS = ['normal', 'medium', 'semibold', 'bold'] as const
const TAM_TEXTO = ['sm', 'md', 'lg'] as const
const ALINEA = ['left', 'center', 'right'] as const
const DISPOSICION = ['stacked', 'inline', 'side'] as const
const LINEA = ['none', 'below', 'sides'] as const
const AJUSTE = ['cover', 'contain'] as const
const ANCHO = ['content', 'full'] as const
const SEPARADOR = ['none', 'line', 'wave', 'diagonal'] as const
const BOTON = ['solid', 'outline', 'ghost'] as const

export type TamTitulo = (typeof TAM_TITULO)[number]
export type Alineacion = (typeof ALINEA)[number]
export type DisposicionEncabezado = (typeof DISPOSICION)[number]

export interface EncabezadoSeccion {
  show_title?: boolean
  show_description?: boolean
  eyebrow?: string
  title?: string
  description?: string
  title_font?: string
  title_size?: TamTitulo
  title_weight?: (typeof PESOS)[number]
  title_color?: string
  title_color_2?: string
  title_uppercase?: boolean
  title_line?: (typeof LINEA)[number]
  line_color?: string
  description_size?: (typeof TAM_TEXTO)[number]
  description_color?: string
  description_max?: number
  align?: Alineacion
  layout?: DisposicionEncabezado
  view_all?: boolean
  view_all_label?: string
  view_all_url?: string
  view_all_style?: (typeof BOTON)[number]
}

export interface FondoSeccion {
  color?: string
  gradient_1?: string
  gradient_2?: string
  gradient_angle?: number
  image_url?: string
  image_url_mobile?: string
  image_fit?: (typeof AJUSTE)[number]
  image_position?: string
  overlay_opacity?: number
  parallax?: boolean
  padding_top?: number
  padding_bottom?: number
  width?: (typeof ANCHO)[number]
  separator?: (typeof SEPARADOR)[number]
  separator_color?: string
}

function enLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return typeof valor === 'string' && (lista as readonly string[]).includes(valor) ? (valor as T) : undefined
}

function entero(valor: unknown, min: number, max: number): number | undefined {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : NaN
  if (!Number.isFinite(n)) return undefined
  const r = Math.round(n)
  return r >= min && r <= max ? r : undefined
}

function color(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || !HEX.test(valor.trim())) return undefined
  return valor.trim()
}

function texto(valor: unknown, max = 200): string | undefined {
  if (typeof valor !== 'string') return undefined
  const t = valor.trim()
  return t ? t.slice(0, max) : undefined
}

function bandera(valor: unknown): boolean | undefined {
  return valor === true || valor === false ? valor : undefined
}

function urlSegura(valor: unknown): string | undefined {
  const t = texto(valor, 500)
  if (!t) return undefined
  if (t.startsWith('/') || t.startsWith('#') || /^https?:\/\//i.test(t)) return t
  return undefined
}

export function leerEncabezado(content: unknown): EncabezadoSeccion | null {
  const crudo = content && typeof content === 'object' ? (content as Record<string, unknown>).section_header : undefined
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null
  const o = crudo as Record<string, unknown>
  const e: EncabezadoSeccion = {}
  const st = bandera(o.show_title)
  if (st != null) e.show_title = st
  const sd = bandera(o.show_description)
  if (sd != null) e.show_description = sd
  const eye = texto(o.eyebrow, 80)
  if (eye) e.eyebrow = eye
  const title = texto(o.title, 200)
  if (title) e.title = title
  const desc = texto(o.description, 500)
  if (desc) e.description = desc
  const fuente = texto(o.title_font, 80)
  if (fuente && (fuente === 'site' || /^[A-Za-z0-9 ]+$/.test(fuente))) e.title_font = fuente
  const tam = enLista(TAM_TITULO, o.title_size)
  if (tam) e.title_size = tam
  const peso = enLista(PESOS, o.title_weight)
  if (peso) e.title_weight = peso
  const tc = color(o.title_color)
  if (tc) e.title_color = tc
  const tc2 = color(o.title_color_2)
  if (tc2) e.title_color_2 = tc2
  const may = bandera(o.title_uppercase)
  if (may != null) e.title_uppercase = may
  const linea = enLista(LINEA, o.title_line)
  if (linea) e.title_line = linea
  const lc = color(o.line_color)
  if (lc) e.line_color = lc
  const ds = enLista(TAM_TEXTO, o.description_size)
  if (ds) e.description_size = ds
  const dc = color(o.description_color)
  if (dc) e.description_color = dc
  const dm = entero(o.description_max, 20, 80)
  if (dm != null) e.description_max = dm
  const al = enLista(ALINEA, o.align)
  if (al) e.align = al
  const lay = enLista(DISPOSICION, o.layout)
  if (lay) e.layout = lay
  const ver = bandera(o.view_all)
  if (ver != null) e.view_all = ver
  const vl = texto(o.view_all_label, 40)
  if (vl) e.view_all_label = vl
  const vu = urlSegura(o.view_all_url)
  if (vu) e.view_all_url = vu
  const vs = enLista(BOTON, o.view_all_style)
  if (vs) e.view_all_style = vs
  return Object.keys(e).length > 0 ? e : null
}

export function leerFondo(content: unknown): FondoSeccion | null {
  const crudo = content && typeof content === 'object' ? (content as Record<string, unknown>).section_background : undefined
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null
  const o = crudo as Record<string, unknown>
  const f: FondoSeccion = {}
  const c = color(o.color)
  if (c) f.color = c
  const g1 = color(o.gradient_1)
  if (g1) f.gradient_1 = g1
  const g2 = color(o.gradient_2)
  if (g2) f.gradient_2 = g2
  const ang = entero(o.gradient_angle, 0, 360)
  if (ang != null) f.gradient_angle = ang
  const img = urlSegura(o.image_url)
  if (img) f.image_url = img
  const imgM = urlSegura(o.image_url_mobile)
  if (imgM) f.image_url_mobile = imgM
  const fit = enLista(AJUSTE, o.image_fit)
  if (fit) f.image_fit = fit
  const pos = enLista(['center', 'top', 'bottom', 'left', 'right'] as const, o.image_position)
  if (pos) f.image_position = pos
  const op = entero(o.overlay_opacity, 0, 100)
  if (op != null) f.overlay_opacity = op
  const par = bandera(o.parallax)
  if (par != null) f.parallax = par
  const pt = entero(o.padding_top, 0, 200)
  if (pt != null) f.padding_top = pt
  const pb = entero(o.padding_bottom, 0, 200)
  if (pb != null) f.padding_bottom = pb
  const w = enLista(ANCHO, o.width)
  if (w) f.width = w
  const sep = enLista(SEPARADOR, o.separator)
  if (sep && sep !== 'none') f.separator = sep
  const sc = color(o.separator_color)
  if (sc) f.separator_color = sc
  return Object.keys(f).length > 0 ? f : null
}

export const CLASE_TAM_TITULO: Record<TamTitulo, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl md:text-3xl',
  '3xl': 'text-3xl md:text-4xl',
  '4xl': 'text-4xl md:text-5xl',
}

export const CLASE_PESO: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

/** Estilos del fondo. Vacío si no hay fondo nuevo. */
export function estilosFondo(fondo: FondoSeccion | null): Record<string, string> {
  if (!fondo) return {}
  const style: Record<string, string> = {}
  if (fondo.color) style.backgroundColor = fondo.color
  if (fondo.image_url) {
    const fit = fondo.image_fit === 'contain' ? 'contain' : 'cover'
    const pos = fondo.image_position || 'center'
    style.backgroundImage = `url("${fondo.image_url.replace(/"/g, '')}")`
    style.backgroundSize = fit
    style.backgroundPosition = pos
    style.backgroundRepeat = 'no-repeat'
    if (fondo.parallax) style.backgroundAttachment = 'fixed'
  } else if (fondo.gradient_1 && fondo.gradient_2) {
    style.backgroundImage = `linear-gradient(${fondo.gradient_angle ?? 180}deg, ${fondo.gradient_1}, ${fondo.gradient_2})`
  }
  if (fondo.image_url_mobile) {
    style['--fondo-movil'] = `url("${fondo.image_url_mobile.replace(/"/g, '')}")`
  }
  if (fondo.padding_top != null) style.paddingTop = `${fondo.padding_top}px`
  if (fondo.padding_bottom != null) style.paddingBottom = `${fondo.padding_bottom}px`
  return style
}
