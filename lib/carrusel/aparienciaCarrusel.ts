/**
 * Apariencia de flechas y puntos, velocidad de transición y elementos visibles de los carruseles
 * de sección (galería, aliados, marcas). Mismas claves que el editor (`sectionFieldGroups`,
 * grupo «carousel»). Con la clave ausente se devuelve `undefined` y cada carrusel conserva su
 * aspecto de hoy: ningún sitio publicado cambia hasta que se toca la opción.
 */
import type { CSSProperties } from 'react'

export type EstiloFlecha = 'circle' | 'square' | 'minimal' | 'chevron'
export type EstiloPuntos = 'dots' | 'bars' | 'numbers'

export interface AparienciaCarrusel {
  estiloFlecha?: EstiloFlecha
  tamanoFlecha?: number
  colorFlecha?: string
  fondoFlecha?: string
  estiloPuntos?: EstiloPuntos
  transicionMs?: number
  porVista?: { escritorio: number; tableta: number; movil: number }
}

const FLECHAS: EstiloFlecha[] = ['circle', 'square', 'minimal', 'chevron']
const PUNTOS: EstiloPuntos[] = ['dots', 'bars', 'numbers']
const color = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const numero = (v: unknown, min: number, max: number) => {
  const n = Number(v)
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return undefined
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function leerAparienciaCarrusel(c: Record<string, unknown> | null | undefined): AparienciaCarrusel {
  const content = c ?? {}
  const a: AparienciaCarrusel = {}
  if (FLECHAS.includes(content.arrow_style as EstiloFlecha)) a.estiloFlecha = content.arrow_style as EstiloFlecha
  const t = numero(content.arrow_size, 24, 72)
  if (t !== undefined) a.tamanoFlecha = t
  const cf = color(content.arrow_color)
  if (cf) a.colorFlecha = cf
  const bf = color(content.arrow_bg_color)
  if (bf) a.fondoFlecha = bf
  if (PUNTOS.includes(content.dot_style as EstiloPuntos)) a.estiloPuntos = content.dot_style as EstiloPuntos
  const ms = numero(content.transition_ms, 0, 3000)
  if (ms !== undefined) a.transicionMs = ms
  const spv = content.slides_per_view as unknown
  if (spv !== undefined && spv !== null && spv !== '') {
    const o = (typeof spv === 'object' ? spv : { desktop: spv }) as Record<string, unknown>
    const esc = numero(o.desktop, 1, 8)
    if (esc !== undefined) {
      const tab = numero(o.tablet, 1, 8) ?? Math.min(3, esc)
      const mov = numero(o.mobile, 1, 8) ?? Math.min(2, esc)
      a.porVista = { escritorio: esc, tableta: tab, movil: mov }
    }
  }
  return a
}

/** ¿El usuario tocó alguna opción visual de las flechas? */
export const flechaPersonalizada = (a?: AparienciaCarrusel) =>
  !!a && (a.estiloFlecha !== undefined || a.tamanoFlecha !== undefined || a.colorFlecha !== undefined || a.fondoFlecha !== undefined)

/** Clases y estilo del botón de flecha según la apariencia (solo cuando `flechaPersonalizada`). */
export function botonFlecha(a: AparienciaCarrusel, colorMarca?: string): { className: string; style: CSSProperties; icono: number } {
  const estilo = a.estiloFlecha ?? 'circle'
  const tam = a.tamanoFlecha ?? 40
  const sinFondo = estilo === 'minimal' || estilo === 'chevron'
  const forma = estilo === 'square' ? 'rounded-md' : 'rounded-full'
  const base = sinFondo ? '' : `shadow-lg border dark:border-gray-700 ${a.fondoFlecha ? '' : 'bg-white dark:bg-gray-800'}`
  return {
    className: `${forma} ${base} flex items-center justify-center`,
    style: {
      width: tam,
      height: tam,
      color: a.colorFlecha ?? colorMarca,
      backgroundColor: sinFondo ? (estilo === 'minimal' ? a.fondoFlecha ?? 'rgba(0,0,0,0.25)' : 'transparent') : a.fondoFlecha,
    },
    icono: Math.round(tam * (estilo === 'chevron' ? 0.7 : 0.5)),
  }
}

/** Fundido corto al cambiar de diapositiva, con la velocidad elegida (sin clave: nada). */
export function animarCambio(el: HTMLElement | null, ms?: number) {
  if (!el || !ms || typeof el.animate !== 'function') return
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  el.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' })
}

/** Cortes de ancho de «Elementos visibles» (los mismos de `.ancho-por-vista` en globals.css). */
export const CORTE_TABLETA = 640
export const CORTE_ESCRITORIO = 1024

/** Elementos visibles para un ancho de ventana dado (celular < 640 ≤ tableta < 1024 ≤ escritorio). */
export function porVistaParaAncho(pv: AparienciaCarrusel['porVista'], ancho: number): number | undefined {
  if (!pv) return undefined
  if (ancho >= CORTE_ESCRITORIO) return pv.escritorio
  if (ancho >= CORTE_TABLETA) return pv.tableta
  return pv.movil
}

/**
 * Desplazamiento horizontal con la velocidad elegida («Velocidad de transición»). Sin `ms` (clave
 * ausente) se usa el `smooth` del navegador, como hoy.
 */
export function desplazarConVelocidad(el: HTMLElement, destino: number, ms?: number) {
  const max = Math.max(0, el.scrollWidth - el.clientWidth)
  const fin = Math.min(max, Math.max(0, destino))
  const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (ms === undefined || typeof requestAnimationFrame !== 'function') {
    el.scrollTo({ left: fin, behavior: 'smooth' })
    return
  }
  if (ms === 0 || reducido) {
    el.scrollTo({ left: fin })
    return
  }
  const inicio = el.scrollLeft
  const t0 = performance.now()
  const paso = (t: number) => {
    const p = Math.min(1, (t - t0) / ms)
    const e = 1 - Math.pow(1 - p, 3)
    el.scrollLeft = inicio + (fin - inicio) * e
    if (p < 1) requestAnimationFrame(paso)
  }
  requestAnimationFrame(paso)
}
