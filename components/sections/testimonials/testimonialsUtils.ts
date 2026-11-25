/**
 * Utilidades compartidas por las 4 variantes de testimonios (FASE 6).
 *
 * - `resolveTestimonialItems`: resuelve la fuente de datos (manual / database /
 *   featured) y normaliza cada item a `NormalizedTestimonial`.
 * - `useShuffledTestimonials`: hook que baraja los items en cliente cuando
 *   `randomize_order = true`, evitando mismatch SSR/CSR.
 * - Helpers de render: clases de grid, avatar, rating, quote marks, etc.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { TestimonialRow } from '@/lib/supabase/queries'
// Relativo (no `@/`): los verify con strip-types importan este módulo tal cual.
import { columnasTestimonios } from '../../../lib/website/v2/contrato/seccionesTienda'

export interface NormalizedTestimonial {
  id: string
  name: string
  role?: string
  company?: string
  content: string
  rating: number
  avatar?: string | null
  source?: string
  sourceUrl?: string | null
  date?: string | null
}

export interface TestimonialsContent extends Record<string, any> {
  title?: string
  items?: any[]
  data_source?: 'manual' | 'database' | 'featured'
  randomize_order?: boolean
  max_items?: number
}

export interface TestimonialsData {
  testimonials?: TestimonialRow[]
}

/**
 * Mapea una fila de la tabla `testimonials` al formato normalizado del sitio.
 */
function fromDbRow(row: TestimonialRow): NormalizedTestimonial {
  return {
    id: row.id,
    name: row.author_name,
    role: row.author_role ?? undefined,
    company: row.author_company ?? undefined,
    content: row.content,
    rating: row.rating,
    avatar: row.author_avatar,
    source: row.source,
    sourceUrl: row.source_url,
    date: row.created_at,
  }
}

/**
 * Mapea un item manual del JSON (content.items) al formato normalizado.
 * Soporta las claves legacy: `text`/`content`, `role`/`company`, `image_url`/`avatar_url`.
 */
function fromManualItem(item: any, index: number): NormalizedTestimonial {
  return {
    id: item.id ?? `manual-${index}`,
    name: item.name ?? 'Cliente',
    // F2.2: fallback item.company para secciones guardadas antes de la migración
    role: item.role ?? item.company,
    company: item.company ?? item.role,
    content: item.text || item.content || '',
    rating: Number(item.rating ?? 5),
    avatar: item.avatar_url ?? item.image_url ?? null,
    source: item.source,
    sourceUrl: item.source_url,
    date: item.date,
  }
}

/**
 * Resuelve la lista de testimonios a mostrar según `data_source`:
 * - `manual` (default si hay items en JSON): usa content.items.
 * - `database`: usa data.testimonials (tabla testimonials, is_active).
 * - `featured`: usa data.testimonials filtrando is_featured = true.
 *
 * Si data_source no está definido: usa content.items si existen, si no cae a BD.
 * Aplica `max_items` al final.
 */
export function resolveTestimonialItems(
  content: TestimonialsContent,
  data?: TestimonialsData
): NormalizedTestimonial[] {
  const ds = content.data_source
  const manualItems = Array.isArray(content.items) ? content.items : []
  const dbRows = data?.testimonials ?? []

  let items: NormalizedTestimonial[] = []

  if (ds === 'manual') {
    items = manualItems.map(fromManualItem)
  } else if (ds === 'database') {
    items = dbRows.map(fromDbRow)
  } else if (ds === 'featured') {
    items = dbRows.filter((r) => r.is_featured).map(fromDbRow)
  } else if (manualItems.length > 0) {
    // Sin data_source explícito: compatibilidad con secciones existentes.
    items = manualItems.map(fromManualItem)
  } else {
    items = dbRows.map(fromDbRow)
  }

  const max = Number(content.max_items)
  if (max && max > 0 && items.length > max) {
    items = items.slice(0, max)
  }

  return items
}

/**
 * Hook que baraja los testimonios en cliente cuando `randomize_order = true`.
 *
 * El barajado se hace tras el montaje (useEffect) para no romper la hidratación
 * de React: el primer render (SSR) mantiene el orden original y, una vez
 * montado en cliente, se mezcla aleatoriamente. En cada carga de página el
 * orden resultante será distinto.
 */
export function useShuffledTestimonials(
  items: NormalizedTestimonial[],
  randomize?: boolean
): NormalizedTestimonial[] {
  const [shuffled, setShuffled] = useState<NormalizedTestimonial[]>(items)

  useEffect(() => {
    if (!randomize) {
      setShuffled(items)
      return
    }
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    setShuffled(copy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [randomize])

  // Si no hay randomize, devolver items directamente (sin estado).
  if (!randomize) return items
  return shuffled
}

// ─── Helpers de render ───────────────────────────────────────────────────────

// Clases literales (Tailwind solo emite las que encuentra escritas tal cual en el código).
const COLS_CELULAR: Record<'1' | '2', string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' }
const COLS_TABLETA: Record<1 | 2 | 3, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }
const COLS_ESCRITORIO: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

export interface ClasesColumnasTestimonios {
  /** Contenedor de las tarjetas. */
  lista: string
  /** Cada tarjeta (ancho y encaje del carrusel del celular). */
  tarjeta: string
  /** En el celular las tarjetas van en un carrusel que se desliza con el dedo. */
  carruselCelular: boolean
}

/**
 * Columnas por dispositivo de «Grid» y «Carrusel» (`columns` = computador, `columns_tablet`,
 * `columns_mobile`; contrato en `seccionesTienda.ts`). Celular por debajo de 768 px, tableta
 * desde 768 y computador desde 1024.
 *
 * Antes las tres clases salían sin prefijo («grid-cols-1 grid-cols-2 grid-cols-3») y ganaba la
 * última: 3 columnas de ~90 px en el celular (QA 2026-11-25, org 338).
 */
export function clasesColumnasTestimonios(content: TestimonialsContent | null | undefined, variante: string): ClasesColumnasTestimonios {
  const col = columnasTestimonios(content ?? {}, variante)
  const tableta = `${COLS_TABLETA[col.tableta]} ${COLS_ESCRITORIO[col.escritorio]}`
  if (col.celular === 'carousel') {
    return {
      lista: `flex overflow-x-auto snap-x snap-mandatory scroll-px-4 scrollbar-hide -mx-4 px-4 pb-2 md:grid md:overflow-visible md:snap-none md:scroll-px-0 md:mx-0 md:px-0 md:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${tableta}`,
      tarjeta: 'w-[85%] shrink-0 snap-start md:w-auto md:shrink',
      carruselCelular: true,
    }
  }
  return { lista: `grid ${COLS_CELULAR[col.celular]} ${tableta}`, tarjeta: '', carruselCelular: false }
}

/**
 * El carrusel del celular se desliza con el dedo (scroll nativo con encaje) y con el teclado: la
 * lista recibe foco (Tab) y las flechas la desplazan. El lector de pantalla la anuncia por su título.
 */
export function atributosCarruselCelular(titulo?: unknown): { role: 'region'; 'aria-label': string; tabIndex: number } {
  const t = typeof titulo === 'string' && titulo.trim() ? titulo.trim() : 'Testimonios'
  return { role: 'region', 'aria-label': t, tabIndex: 0 }
}

/** Fila de estrellas: si la tarjeta es angosta, bajan de línea en vez de salirse. */
export const CLASE_ESTRELLAS = 'flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 mb-3'

/**
 * Clases de rejilla según `columns` (número o `{ desktop, tablet, mobile }`): celular, tableta
 * (`md:`) y computador (`lg:`). Equivale a `clasesColumnasTestimonios` de «Grid».
 */
export function gridColumnsClass(columns: any): string {
  return clasesColumnasTestimonios({ columns }, 'grid').lista.replace(/^grid /, '')
}

/** Clases de radio de tarjeta. */
export function cardRadiusClass(radius: any): string {
  const r = Number(radius)
  if (!Number.isFinite(r)) return 'rounded-xl'
  if (r === 0) return 'rounded-none'
  if (r <= 8) return 'rounded-lg'
  if (r <= 16) return 'rounded-xl'
  if (r <= 24) return 'rounded-2xl'
  return 'rounded-3xl'
}

/** Clases de sombra de tarjeta. */
export function cardShadowClass(shadow: any): string {
  switch (shadow) {
    case 'none': return 'shadow-none'
    case 'sm': return 'shadow-sm'
    case 'md': return 'shadow-md'
    case 'lg': return 'shadow-lg'
    case 'xl': return 'shadow-xl'
    default: return 'shadow-sm'
  }
}

/** Clases de hover de tarjeta. */
export function cardHoverClass(hover: any): string {
  switch (hover) {
    case 'zoom': return 'transition-transform hover:scale-105'
    case 'lift': return 'transition-all hover:-translate-y-1 hover:shadow-lg'
    case 'glow': return 'transition-shadow hover:shadow-xl'
    default: return ''
  }
}

/** Clases de forma de avatar. */
export function avatarShapeClass(shape: any): string {
  switch (shape) {
    case 'square': return 'rounded-none'
    case 'rounded': return 'rounded-lg'
    case 'circle':
    default: return 'rounded-full'
  }
}

/** Tamaño de avatar en píxeels (devuelve estilo inline). */
export function avatarSizeStyle(size: any): CSSProperties {
  const s = Number(size)
  const px = Number.isFinite(s) && s > 0 ? s : 40
  return { width: `${px}px`, height: `${px}px` }
}

/** Inicial del nombre para fallback de avatar. */
export function avatarInitial(name: string): string {
  return (name?.trim()?.[0] || '?').toUpperCase()
}

/** Devuelve las estrellas como array para renderizar. */
export function ratingStars(rating: number, max = 5): { filled: boolean; index: number }[] {
  const r = Math.max(0, Math.min(max, Math.round(Number(rating) || 0)))
  return Array.from({ length: max }, (_, i) => ({ filled: i < r, index: i }))
}

/** Etiqueta legible de la fuente. */
export function sourceLabel(source?: string): string | null {
  switch (source) {
    case 'google': return 'Reseña de Google'
    case 'facebook': return 'Reseña de Facebook'
    case 'tripadvisor': return 'Reseña de TripAdvisor'
    case 'manual': return null
    default: return null
  }
}

/** TESTIM-20: estilo del badge de origen. «plain» = texto sin fondo; cualquier otro valor, la píldora de siempre. */
export function clasesBadgeOrigen(estilo?: unknown): string {
  return estilo === 'plain'
    ? 'text-[10px] font-medium text-gray-500 dark:text-gray-400'
    : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
}

/** Trunca texto a N líneas vía CSS line-clamp. */
export function lineClampClass(maxLines: any): string {
  const n = Number(maxLines)
  if (!Number.isFinite(n) || n <= 0) return ''
  const map: Record<number, string> = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    5: 'line-clamp-5',
    6: 'line-clamp-6',
  }
  return map[n] ?? ''
}

/** Clases de tamaño de texto. */
export function textSizeClass(size: any): string {
  switch (size) {
    case 'xs': return 'text-xs'
    case 'sm': return 'text-sm'
    case 'lg': return 'text-lg'
    case 'xl': return 'text-xl'
    case '2xl': return 'text-2xl'
    case 'md':
    default: return 'text-base'
  }
}

/** Clases de alineación de texto. */
export function textAlignClass(align: any): string {
  switch (align) {
    case 'center': return 'text-center'
    case 'right': return 'text-right'
    case 'left':
    default: return 'text-left'
  }
}
