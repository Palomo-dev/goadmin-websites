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

/**
 * Devuelve las clases Tailwind de grid según `columns` (responsive).
 * `columns` puede ser un número o `{ desktop, tablet, mobile }`.
 */
export function gridColumnsClass(columns: any): string {
  const resolve = (val: any, fallback: number) => {
    if (val == null) return fallback
    const n = Number(val)
    return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : fallback
  }
  // Si columns es un número, usar defaults responsivos: mobile=1, tablet=2, desktop=columns
  const isObj = typeof columns === 'object' && columns !== null
  const desktop = resolve(isObj ? columns?.desktop : columns, 3)
  const tablet = resolve(isObj ? columns?.tablet : undefined, 2)
  const mobile = resolve(isObj ? columns?.mobile : undefined, 1)
  const map: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }
  return `${map[mobile] ?? 'grid-cols-1'} ${map[tablet] ?? 'md:grid-cols-2'} ${map[desktop] ?? 'lg:grid-cols-3'}`
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
