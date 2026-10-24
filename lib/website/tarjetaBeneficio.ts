/**
 * Tarjeta de beneficios. Sin `card_*` y sin el preset, no hay estilo: el bloque
 * sigue siendo el div centrado de hoy y el ícono suave de 48 px.
 */

const SOMBRA: Record<string, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
}

export interface ContenidoBeneficio {
  card_preset?: unknown
  card_radius?: unknown
  card_shadow?: unknown
  card_bg?: unknown
  card_padding?: unknown
  card_border_width?: unknown
  card_border_color?: unknown
  icon_style?: unknown
  icon_color?: unknown
  icon_size?: unknown
  icon_shape?: unknown
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim() !== '' && Number.isFinite(Number(valor))) return Number(valor)
  return null
}

export function esTarjeta(contenido: ContenidoBeneficio | null | undefined): boolean {
  if (!contenido) return false
  if (contenido.card_preset === 'tarjetas') return true
  if (numero(contenido.card_radius) != null) return true
  if (typeof contenido.card_shadow === 'string' && contenido.card_shadow !== '') return true
  if (typeof contenido.card_bg === 'string' && contenido.card_bg !== '') return true
  if (numero(contenido.card_padding) != null) return true
  if (numero(contenido.card_border_width) != null && numero(contenido.card_border_width)! > 0) return true
  return false
}

export function claseTarjetaBeneficio(contenido: ContenidoBeneficio | null | undefined): string {
  const base = 'flex flex-col items-center text-center'
  if (!esTarjeta(contenido)) return base
  const sombra = typeof contenido?.card_shadow === 'string' ? contenido.card_shadow : contenido?.card_preset === 'tarjetas' ? 'sm' : ''
  const claseSombra = SOMBRA[sombra] || ''
  return claseSombra ? `${base} ${claseSombra}` : base
}

export function estiloTarjetaBeneficio(contenido: ContenidoBeneficio | null | undefined): Record<string, string | number> {
  if (!esTarjeta(contenido)) return {}
  const preset = contenido?.card_preset === 'tarjetas'
  const estilo: Record<string, string | number> = {}
  const radio = numero(contenido?.card_radius) ?? (preset ? 16 : null)
  if (radio != null) estilo.borderRadius = radio
  const fondo = typeof contenido?.card_bg === 'string' && contenido.card_bg ? contenido.card_bg : preset ? '#ffffff' : ''
  if (fondo) estilo.backgroundColor = fondo
  const padding = numero(contenido?.card_padding) ?? (preset ? 24 : null)
  if (padding != null) estilo.padding = padding
  const borde = numero(contenido?.card_border_width)
  if (borde != null && borde > 0) {
    const color = typeof contenido?.card_border_color === 'string' && contenido.card_border_color ? contenido.card_border_color : '#e5e7eb'
    estilo.border = `${borde}px solid ${color}`
  }
  return estilo
}

const TAMANO: Record<string, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
}

const FORMA: Record<string, string> = {
  rounded: 'rounded-xl',
  circle: 'rounded-full',
  square: 'rounded-none',
}

/** Clase e inline del ícono. Sin claves: el suave de 48 px en el color de la marca. */
export function iconoBeneficio(contenido: ContenidoBeneficio | null | undefined, colorMarca: string): { clase: string; estilo: { backgroundColor: string; color: string } } {
  const tamano = typeof contenido?.icon_size === 'string' && TAMANO[contenido.icon_size] ? TAMANO[contenido.icon_size] : 'h-12 w-12'
  const forma = typeof contenido?.icon_shape === 'string' && FORMA[contenido.icon_shape] ? FORMA[contenido.icon_shape] : 'rounded-xl'
  const estiloIcono = contenido?.icon_style === 'plain' || contenido?.icon_style === 'solid' ? contenido.icon_style : 'soft'
  const color = typeof contenido?.icon_color === 'string' && contenido.icon_color && contenido.icon_color !== 'primary'
    ? contenido.icon_color
    : colorMarca
  const clase = `mb-4 inline-flex ${tamano} items-center justify-center ${forma} text-xl`
  if (estiloIcono === 'plain') return { clase, estilo: { backgroundColor: 'transparent', color } }
  if (estiloIcono === 'solid') return { clase, estilo: { backgroundColor: color, color: '#ffffff' } }
  return { clase, estilo: { backgroundColor: `${color}15`, color } }
}
