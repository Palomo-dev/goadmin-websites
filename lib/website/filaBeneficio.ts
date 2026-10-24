/**
 * Disposición de la rejilla de características.
 *
 * Sin `item_layout` (o con `stacked`) la rejilla es la de hoy: dos columnas en el
 * celular, texto centrado, foto ancha con `object-cover`. `icon_left` e
 * `icon_top_small` solo aplican cuando la clave viene.
 */

export type DisposicionBeneficio = 'stacked' | 'icon_left' | 'icon_top_small'

/**
 * Misma regla que `columnasEscritorio` / `clasesGridCaracteristicas` de
 * presentacionTienda. Va copiada para que este módulo no importe alias y el
 * verificador pueda cargarlo solo. Si aquella clase cambia, el test lo nota.
 */
const COLUMNAS = [1, 2, 3, 4, 5, 6, 7, 8] as const
const CLASE_MD: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4',
  5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8',
}

function nCol(v: unknown, fallback: number): number {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  const n = Math.round(x)
  return (COLUMNAS as readonly number[]).includes(n) ? n : fallback
}

function columnasDeEscritorio(columns: unknown, fallback: number): number {
  if (columns && typeof columns === 'object' && !Array.isArray(columns)) {
    const o = columns as Record<string, unknown>
    if ('desktop' in o || 'tablet' in o || 'mobile' in o) return nCol(o.desktop, fallback)
  }
  return nCol(columns, fallback)
}

function clasesApiladas(columns: unknown): string {
  return `grid grid-cols-2 ${CLASE_MD[columnasDeEscritorio(columns, 3)]} gap-8 text-center`
}

export function disposicionBeneficio(valor: unknown): DisposicionBeneficio {
  if (valor === 'icon_left' || valor === 'icon_top_small') return valor
  return 'stacked'
}

const MOVIL: Record<1 | 2, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' }
const ESCRITORIO: Record<1 | 2 | 3 | 4, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

function entero(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : NaN
  return Number.isFinite(n) ? Math.round(n) : null
}

function columnasMovil(columns: unknown, layout: DisposicionBeneficio): 1 | 2 {
  if (columns && typeof columns === 'object' && !Array.isArray(columns)) {
    const n = entero((columns as { mobile?: unknown }).mobile)
    if (n === 1 || n === 2) return n
  }
  return layout === 'icon_left' ? 1 : 2
}

/** Rejilla. Apilado: la clase de hoy, sin leer columnas de celular. */
export function clasesRejillaBeneficios(columns: unknown, layout: DisposicionBeneficio): string {
  if (layout === 'stacked') return clasesApiladas(columns)
  const escritorio = Math.min(4, Math.max(1, columnasDeEscritorio(columns, layout === 'icon_left' ? 2 : 3))) as 1 | 2 | 3 | 4
  const movil = columnasMovil(columns, layout)
  const texto = layout === 'icon_left' ? 'text-left' : 'text-center'
  return `grid ${MOVIL[movil]} ${ESCRITORIO[escritorio]} gap-6 ${texto}`
}

export function tamanoIconoBeneficio(size: unknown, layout: DisposicionBeneficio): { caja: number; icono: number } {
  const pedido = size === 'sm' || size === 'md' || size === 'lg' ? size : layout === 'stacked' ? null : 'md'
  if (pedido === 'sm') return { caja: 40, icono: 24 }
  if (pedido === 'lg') return { caja: 56, icono: 48 }
  if (pedido === 'md') return { caja: 48, icono: 32 }
  return { caja: 48, icono: 24 }
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Marca, acento o un hex. Cualquier otra cosa (o vacío) es la marca. */
export function colorIconoBeneficio(valor: unknown, marca: string, acento: string): string {
  if (typeof valor === 'string' && HEX.test(valor.trim())) return valor.trim()
  if (valor === 'accent') return acento
  return marca
}

export function formaIconoBeneficio(valor: unknown): '' | 'rounded-full' | 'rounded-xl' {
  if (valor === 'circle') return 'rounded-full'
  if (valor === 'rounded') return 'rounded-xl'
  return ''
}

export interface EstiloTarjetaBeneficio {
  card_radius?: unknown
  card_shadow?: unknown
  card_bg?: unknown
  card_padding?: unknown
  card_border_width?: unknown
  card_border_color?: unknown
}

const SOMBRA: Record<string, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
}

export function hayTarjetaBeneficio(contenido: EstiloTarjetaBeneficio | null | undefined): boolean {
  if (!contenido) return false
  if (entero(contenido.card_radius) != null) return true
  if (typeof contenido.card_shadow === 'string' && contenido.card_shadow !== '') return true
  if (typeof contenido.card_bg === 'string' && contenido.card_bg.trim() !== '') return true
  if (entero(contenido.card_padding) != null) return true
  if ((entero(contenido.card_border_width) ?? 0) > 0) return true
  return false
}

export function claseSombraBeneficio(contenido: EstiloTarjetaBeneficio | null | undefined): string {
  if (!hayTarjetaBeneficio(contenido)) return ''
  const sombra = typeof contenido?.card_shadow === 'string' ? contenido.card_shadow : ''
  return SOMBRA[sombra] || ''
}

export function estiloTarjetaBeneficio(contenido: EstiloTarjetaBeneficio | null | undefined): Record<string, string | number> {
  if (!hayTarjetaBeneficio(contenido)) return {}
  const estilo: Record<string, string | number> = {}
  const radio = entero(contenido?.card_radius)
  if (radio != null) estilo.borderRadius = radio
  if (typeof contenido?.card_bg === 'string' && contenido.card_bg.trim()) estilo.backgroundColor = contenido.card_bg
  const padding = entero(contenido?.card_padding)
  if (padding != null) estilo.padding = padding
  const borde = entero(contenido?.card_border_width)
  if (borde != null && borde > 0) {
    const color = typeof contenido?.card_border_color === 'string' && contenido.card_border_color.trim()
      ? contenido.card_border_color
      : '#e5e7eb'
    estilo.border = `${borde}px solid ${color}`
  }
  return estilo
}

export function alineacionTexto(valor: unknown, layout: DisposicionBeneficio): 'left' | 'center' | 'right' {
  if (valor === 'left' || valor === 'center' || valor === 'right') return valor
  return layout === 'icon_left' ? 'left' : 'center'
}
