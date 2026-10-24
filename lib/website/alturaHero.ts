/**
 * Altura del hero. Sin `mobile_height`, sin `height: 'image'` y sin punto focal,
 * las clases son las de hoy.
 *
 * `auto` en pantalla completa sigue siendo `min-h-[50vh] md:min-h-[70vh]`
 * (o el alto de la reserva, si aplica). `image` usa el aspect-ratio de la foto.
 */

export function proporcionImagen(ancho: unknown, alto: unknown): string | null {
  const w = typeof ancho === 'number' ? ancho : Number(ancho)
  const h = typeof alto === 'number' ? alto : Number(alto)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
  return `${w} / ${h}`
}

const FOCALES = new Set([
  'center', 'top', 'bottom', 'left', 'right',
  'top left', 'top center', 'top right',
  'center left', 'center right',
  'bottom left', 'bottom center', 'bottom right',
  'left center', 'right center',
])

/** `object-position`. Null = centro, que es lo que ya pinta `bg-center`. */
export function puntoFocal(valor: unknown): string | null {
  if (typeof valor === 'string') {
    const t = valor.trim()
    if (FOCALES.has(t)) return t
    if (/^\d{1,3}%\s+\d{1,3}%$/.test(t)) return t
  }
  if (valor && typeof valor === 'object' && 'x' in valor && 'y' in valor) {
    const x = Number((valor as { x: unknown }).x)
    const y = Number((valor as { y: unknown }).y)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const px = Math.min(100, Math.max(0, x))
      const py = Math.min(100, Math.max(0, y))
      return `${px}% ${py}%`
    }
  }
  return null
}

export function ajusteImagen(valor: unknown): 'cover' | 'contain' | 'fill' | null {
  if (valor === 'cover' || valor === 'contain' || valor === 'fill') return valor
  return null
}

function claseFija(altura: string): string {
  switch (altura) {
    case '50vh': return 'min-h-[50vh]'
    case '60vh': return 'min-h-[60vh]'
    case '70vh': return 'min-h-[70vh]'
    case '100vh': return 'min-h-[100dvh]'
    default: return ''
  }
}

export interface PlanAltura {
  /** Clases de alto. Vacío si el alto lo da solo el aspect-ratio. */
  clase: string
  /** aspect-ratio de escritorio, si `height` es `image` y hay medidas. */
  proporcion: string | null
  /** aspect-ratio de celular, si `mobile_height` es `image` y hay medidas. */
  proporcionMovil: string | null
}

/**
 * Alto de la portada a pantalla completa.
 * `movil` null = no hay clave: se conserva la clase única de hoy.
 */
export function planAlturaPortada(
  altura: unknown,
  movil: unknown,
  conReserva: boolean,
  proporcionEscritorio: string | null,
  proporcionCelular: string | null,
): PlanAltura {
  const height = typeof altura === 'string' && altura ? altura : 'auto'
  const mobile = typeof movil === 'string' && movil ? movil : null
  const auto = conReserva ? 'min-h-[auto] py-20 md:min-h-[720px] md:py-0' : 'min-h-[50vh] md:min-h-[70vh]'

  if (!mobile && height !== 'image') {
    const fija = claseFija(height)
    return { clase: fija || auto, proporcion: null, proporcionMovil: null }
  }

  if (!mobile && height === 'image') {
    return {
      clase: proporcionEscritorio ? '' : auto,
      proporcion: proporcionEscritorio,
      proporcionMovil: null,
    }
  }

  const claseMovil = mobile === 'image'
    ? ''
    : mobile === 'auto'
      ? 'min-h-[50vh]'
      : claseFija(mobile ?? '') || 'min-h-[50vh]'

  const md = height === '100vh' ? 'md:min-h-[100dvh]'
    : height === '70vh' ? 'md:min-h-[70vh]'
    : height === '60vh' ? 'md:min-h-[60vh]'
    : height === '50vh' ? 'md:min-h-[50vh]'
    : height === 'image' ? ''
    : conReserva ? 'md:min-h-[720px] md:py-0' : 'md:min-h-[70vh]'

  return {
    clase: [claseMovil, md].filter(Boolean).join(' '),
    proporcion: height === 'image' ? proporcionEscritorio : null,
    proporcionMovil: mobile === 'image' ? (proporcionCelular || proporcionEscritorio) : null,
  }
}

/** CSS solo cuando el aspect-ratio cambia entre celular y escritorio. Si no, ''. */
export function cssAltura(clase: string, plan: PlanAltura): string {
  if (!plan.proporcion && !plan.proporcionMovil) return ''
  const escritorio = plan.proporcion
  const celular = plan.proporcionMovil || plan.proporcion
  if (celular && escritorio && celular !== escritorio) {
    return `.${clase}{aspect-ratio:${celular}}@media (min-width:768px){.${clase}{aspect-ratio:${escritorio}}}`
  }
  const unica = escritorio || celular
  return unica ? `.${clase}{aspect-ratio:${unica}}` : ''
}
