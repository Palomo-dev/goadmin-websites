/**
 * Colores del «Círculo acento» del encabezado (paquete 5-nov B1/B4).
 *
 * - `header_icons_circle_bg`: fondo del círculo. Vacío = el color de la marca (lo de hoy).
 * - `header_icons_circle_fg`: color del ícono. Vacío = automático: blanco sobre un fondo
 *   oscuro o saturado, oscuro sobre uno claro.
 *
 * El contraste automático acepta hex, `rgb()/rgba()` y `hsl()/hsla()`: antes solo medía hex y
 * con otro formato el ícono quedaba blanco aunque el fondo fuera claro.
 *
 * Código puro: sin React ni Next.
 */
import { hexARgb, type Rgb } from './v2/contrasteColor'
import { textoSobreAcento } from './v2/textoSobreAcento'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Color guardado válido (`#RGB`/`#RRGGBB`) o `null`. */
export function colorGuardado(valor: unknown): string | null {
  return typeof valor === 'string' && HEX.test(valor.trim()) ? valor.trim() : null
}

function hslARgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

/** Cualquier color CSS común (hex, rgb[a], hsl[a]) → RGB; `null` si no se reconoce. */
export function colorARgb(valor: unknown): Rgb | null {
  if (typeof valor !== 'string') return null
  const v = valor.trim().toLowerCase()
  const hex = hexARgb(v)
  if (hex) return hex
  const nums = (s: string) => s.split(/[\s,/]+/).filter(Boolean).map((x) => parseFloat(x))
  let m = v.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const partes = m[1].split(/[\s,/]+/).filter(Boolean)
    if (partes.length < 3) return null
    const canal = (p: string) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p))
    const [r, g, b] = partes.slice(0, 3).map(canal)
    return [r, g, b].every((n) => Number.isFinite(n)) ? { r, g, b } : null
  }
  m = v.match(/^hsla?\(([^)]+)\)$/)
  if (m) {
    const [h, s, l] = nums(m[1].replace(/deg|%/g, ''))
    if (![h, s, l].every((n) => Number.isFinite(n))) return null
    return hslARgb(((h % 360) + 360) % 360, s / 100, l / 100)
  }
  return null
}

/** Ícono legible sobre `fondo`: misma regla que el editor; sin color reconocible, blanco (lo de hoy). */
export function iconoSobreFondo(fondo: unknown): string {
  const rgb = colorARgb(fondo)
  if (!rgb) return '#FFFFFF'
  const hex = `#${[rgb.r, rgb.g, rgb.b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
  return textoSobreAcento(hex)
}

/** Fondo y color del ícono del círculo. Sin ajustes = el de hoy (marca + contraste). */
export function coloresCirculoIconos(
  settings: { header_icons_circle_bg?: unknown; header_icons_circle_fg?: unknown } | null | undefined,
  primaryColor: string,
): { fondo: string; icono: string } {
  const fondo = colorGuardado(settings?.header_icons_circle_bg) ?? primaryColor
  const icono = colorGuardado(settings?.header_icons_circle_fg) ?? iconoSobreFondo(fondo)
  return { fondo, icono }
}
