/**
 * Modelo de la carta completa (sección `menu_full`).
 *
 * Toma los productos y categorías que la página ya precarga para la carta
 * (`getMenuCatalogProducts` —sin el corte de 500 del listado general— y
 * `getOrganizationCategories` en `app/[[...slug]]/page.tsx`, filtrados por
 * organization_id del contexto y por la sede de la página) y los agrupa por
 * categoría. No hace consultas.
 *
 * Qué existe hoy en la base y qué no (verificado por MCP el 2026-10-05):
 *  - Precio: `product_prices` vigente (effective_to NULL); [0] ya viene
 *    normalizado por `normalizeProductPrices`.
 *  - Agotado: solo para productos con `track_stock = true`, con los
 *    `stock_levels` de la sede (o de las sedes que surten la web). Es la misma
 *    regla que usan las tarjetas (`isOutOfStock` de lib/stock).
 *  - "Carta" con horario (desayuno/almuerzo/bar): NO existe en la base. Se
 *    configura en el contenido de la sección (`menus`), no en una columna.
 *  - Etiquetas: `product_tags` (name + color) por `products.tag_id` y por la
 *    tabla puente `product_tag_relations`. Se pintan con su nombre y color; no
 *    hay columna de tipo (picante, vegano…), así que no se infiere ningún icono.
 *  - Agotado por sede: `carta_sede.agotado_hasta` (website_branch_products
 *    .sold_out_until) para «Vuelve a las HH:MM» / «Vuelve mañana».
 *  - Grupo obligatorio (acompañante): `requires_choice` del listado → «Elegir».
 */

import type { Category, Product, ProductImage, ProductPrice, SharedImage, StockLevelRow } from '@/types/database'
import { isOutOfStock } from '@/lib/stock'
import type { CartaPlatos } from './cartaPlatos'
import { ahoraEnZona, horaDeMinutos, hoyEnZona, sumarDias, fechaCorta } from '@/lib/restaurant/horario'
import {
  getProductComparePrice,
  getProductImageUrl,
  getProductPrice,
  isParentProduct,
} from '@/components/sections/products/ProductCard'

// ---------------------------------------------------------------------------
// Entrada: forma de los productos que devuelve getOrganizationProducts
// ---------------------------------------------------------------------------

export type MenuSourceProduct = Pick<
  Product,
  'id' | 'uuid' | 'name' | 'description' | 'category_id' | 'sku' | 'track_stock' | 'is_parent' | 'organization_id'
> & {
  product_prices?: Pick<ProductPrice, 'id' | 'price' | 'compare_price' | 'effective_to'>[]
  product_images?: (Pick<ProductImage, 'id' | 'storage_path' | 'is_primary' | 'display_order' | 'shared_image_id'> & {
    shared_images: Pick<SharedImage, 'storage_path'> | null
  })[]
  stock_levels?: Pick<StockLevelRow, 'branch_id' | 'qty_on_hand' | 'qty_reserved'>[]
  /** Calculados por `enrichListing` en el listado. */
  has_variants?: boolean
  variant_count?: number
  requires_choice?: boolean
  tag_id?: number | null
  product_tag_relations?: { tag_id: number }[]
  /** Lo añade `aplicarCartaSede` (lib/products/carta-sede.ts). */
  carta_sede?: { agotado?: boolean; agotado_hasta?: string | null }
}

/** Etiqueta de `product_tags` tal como la devuelve `getOrganizationTags`. */
export interface MenuTagSource {
  id: number
  name: string
  color?: string | null
}

export interface MenuTag {
  id: number
  name: string
  color: string | null
}

export type MenuSourceCategory = Pick<Category, 'id' | 'name' | 'slug' | 'description' | 'parent_id' | 'display_order' | 'rank'>

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

export interface MenuItem {
  id: number
  uuid: string
  name: string
  description: string | null
  sku: string | null
  price: number | null
  comparePrice: number | null
  imageUrl: string | null
  /** Rastrea inventario y no hay existencias en la sede. */
  soldOut: boolean
  /** Padre con variantes: se elige en la hoja del plato, no se agrega directo. */
  hasVariants: boolean
  /** Tiene un grupo de modificadores obligatorio: se elige en la hoja del plato. */
  requiresChoice: boolean
  /** Agotado en la sede hasta (timestamptz ISO). `null` = sin fecha o no agotado por sede. */
  soldOutUntil: string | null
  /** Etiquetas del plato (máx. 3), con su color del ERP. */
  tags: MenuTag[]
  /** Destacado en el constructor de la carta (`content.carta_platos.destacados`). */
  featured?: boolean
}

/** Máximo de etiquetas por plato en la carta (el diseño muestra 2-3 chips). */
export const MAX_TAGS_POR_PLATO = 3

/** Etiquetas del plato: `tag_id` + tabla puente, sin repetir, en el orden del mapa. */
export function tagsDePlato(p: Pick<MenuSourceProduct, 'tag_id' | 'product_tag_relations'>, tagsPorId?: Map<number, MenuTag> | null): MenuTag[] {
  if (!tagsPorId || tagsPorId.size === 0) return []
  const ids: number[] = []
  if (p.tag_id != null) ids.push(Number(p.tag_id))
  for (const r of p.product_tag_relations || []) ids.push(Number(r.tag_id))
  const out: MenuTag[] = []
  const vistos = new Set<number>()
  for (const id of ids) {
    if (vistos.has(id)) continue
    vistos.add(id)
    const t = tagsPorId.get(id)
    if (t) out.push(t)
    if (out.length >= MAX_TAGS_POR_PLATO) break
  }
  return out
}

export function mapaDeTags(tags: MenuTagSource[] | null | undefined): Map<number, MenuTag> {
  const m = new Map<number, MenuTag>()
  for (const t of tags || []) {
    if (!t || !Number.isInteger(Number(t.id)) || typeof t.name !== 'string') continue
    m.set(Number(t.id), { id: Number(t.id), name: t.name, color: typeof t.color === 'string' && t.color ? t.color : null })
  }
  return m
}

export interface MenuCategoryGroup {
  id: number
  name: string
  slug: string
  description: string | null
  items: MenuItem[]
}

/** Carta configurada en el contenido de la sección (no existe en la base). */
export interface MenuSchedule {
  name: string
  /** "HH:MM" en la zona horaria de la organización. */
  start_time?: string | null
  /** "HH:MM". Vacío = hasta medianoche. Menor que start_time = cruza medianoche. */
  end_time?: string | null
  /** Categorías de esta carta. Vacío = todas. */
  category_ids?: number[] | null
  /**
   * Solo cartas del ERP (lib/menu/cartasPublicas.ts): franjas de HOY «HH:MM» (incluida la de
   * ayer que cruza la medianoche). Presente = manda sobre start/end; vacía = hoy no abre.
   */
  franjas?: { from: string; to: string }[]
  /** Primer inicio de mañana («Disponible mañana desde…»). */
  inicioManana?: string | null
  /** Orden, ocultos y destacados propios de esta carta (pestañas con excepciones distintas). */
  carta?: CartaPlatos
}

const UNCATEGORIZED_ID = -1

export function toMenuItem(p: MenuSourceProduct, tagsPorId?: Map<number, MenuTag> | null): MenuItem {
  const soldOut = isOutOfStock({
    track_stock: p.track_stock,
    stock_levels: (p.stock_levels || []).map((sl) => ({
      branch_id: sl.branch_id,
      qty_on_hand: Number(sl.qty_on_hand ?? 0),
      qty_reserved: Number(sl.qty_reserved ?? 0),
    })),
  })
  return {
    id: p.id,
    uuid: p.uuid,
    name: p.name,
    description: p.description,
    sku: p.sku,
    price: getProductPrice(p),
    comparePrice: getProductComparePrice(p),
    imageUrl: getProductImageUrl(p),
    soldOut,
    hasVariants: isParentProduct(p),
    requiresChoice: p.requires_choice === true,
    soldOutUntil: soldOut && p.carta_sede?.agotado ? (p.carta_sede.agotado_hasta ?? null) : null,
    tags: tagsDePlato(p, tagsPorId),
  }
}

/**
 * Agrupa los productos por categoría respetando el orden de categorías del
 * ERP (display_order, rank). Dentro de cada categoría, orden alfabético: hoy
 * no hay orden manual de platos en la base.
 *
 * - `categoryIds` no vacío: solo esas categorías (selección del editor).
 * - Categorías sin productos con precio: se omiten.
 * - Productos sin categoría: grupo "Otros" al final (solo sin selección).
 */
export function buildMenuGroups(
  products: MenuSourceProduct[],
  categories: MenuSourceCategory[],
  categoryIds?: number[] | null,
  tagsPorId?: Map<number, MenuTag> | null,
): MenuCategoryGroup[] {
  const selected = Array.isArray(categoryIds) && categoryIds.length > 0 ? new Set(categoryIds.map(Number)) : null

  const byCategory = new Map<number, MenuItem[]>()
  for (const p of products) {
    const item = toMenuItem(p, tagsPorId)
    // Sin precio vigente no se puede pedir ni mostrar en una carta.
    if (item.price === null) continue
    const key = p.category_id ?? UNCATEGORIZED_ID
    const list = byCategory.get(key)
    if (list) list.push(item)
    else byCategory.set(key, [item])
  }

  const collator = new Intl.Collator('es-CO', { sensitivity: 'base' })
  const groups: MenuCategoryGroup[] = []
  for (const cat of categories) {
    if (selected && !selected.has(cat.id)) continue
    const items = byCategory.get(cat.id)
    if (!items || items.length === 0) continue
    groups.push({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      items: [...items].sort((a, b) => collator.compare(a.name, b.name)),
    })
  }

  const loose = byCategory.get(UNCATEGORIZED_ID)
  if (!selected && loose && loose.length > 0) {
    groups.push({
      id: UNCATEGORIZED_ID,
      name: 'Otros',
      slug: 'otros',
      description: null,
      items: [...loose].sort((a, b) => collator.compare(a.name, b.name)),
    })
  }
  return groups
}

// ---------------------------------------------------------------------------
// Horario de cartas (zona horaria de la organización)
// Los minutos «ahora» en la zona salen de `ahoraEnZona` (lib/restaurant/horario.ts).
// ---------------------------------------------------------------------------

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** "HH:MM" → minutos desde medianoche, o null si no es una hora válida. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (!value) return null
  const m = TIME_RE.exec(value.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * ¿La carta está en horario? Sin hora de inicio = siempre abierta.
 * Sin hora de fin = hasta medianoche. Fin menor que inicio = cruza medianoche.
 */
export function isScheduleOpen(schedule: MenuSchedule, nowMinutes: number): boolean {
  if (schedule.franjas) {
    // Misma regla que fn_carta_vigente: from <= h < to; to <= from cruza la medianoche.
    return schedule.franjas.some((f) => {
      const desde = parseTimeOfDay(f.from)
      const hasta = parseTimeOfDay(f.to)
      if (desde === null || hasta === null) return false
      return hasta > desde ? nowMinutes >= desde && nowMinutes < hasta : nowMinutes >= desde
    })
  } else {
    // Carta del contenido de la sección: lógica de siempre (abajo).
  }
  const start = parseTimeOfDay(schedule.start_time)
  if (start === null) return true
  const end = parseTimeOfDay(schedule.end_time)
  if (end === null) return nowMinutes >= start
  if (end > start) return nowMinutes >= start && nowMinutes < end
  if (end < start) return nowMinutes >= start || nowMinutes < end
  return true
}

/**
 * «Ver como» del editor (paquete F): `?preview=1&hora=HH:MM` simula la hora de la carta. Solo
 * se acepta en la vista previa (lo decide la página) y solo una hora válida; devuelve minutos.
 */
export function horaSimuladaDeVistaPrevia(valor: unknown): number | null {
  return typeof valor === 'string' ? parseTimeOfDay(valor) : null
}

/** Minutos que faltan para que abra la carta desde `nowMinutes` (0..1439), o null sin inicio. */
export function scheduleOpensIn(schedule: MenuSchedule, nowMinutes: number): number | null {
  const start = parseTimeOfDay(schedule.start_time)
  if (start === null) return null
  return (start - nowMinutes + 1440) % 1440
}

/**
 * Texto de una carta cerrada: «Disponible desde las 12:00» si abre más tarde hoy, o
 * «Disponible mañana desde las 7:00» si su horario de hoy ya pasó.
 */
export function unavailableLabel(schedule: MenuSchedule, nowMinutes: number): string | null {
  if (schedule.franjas) {
    const siguiente = schedule.franjas
      .map((f) => f.from)
      .filter((h) => (parseTimeOfDay(h) ?? -1) > nowMinutes)
      .sort()[0]
    if (siguiente) return `Disponible desde las ${siguiente}`
    return schedule.inicioManana ? `Disponible mañana desde las ${schedule.inicioManana}` : 'Hoy no está disponible'
  } else {
    // Carta del contenido de la sección: lógica de siempre (abajo).
  }
  const start = parseTimeOfDay(schedule.start_time)
  if (start === null) return null
  const hora = schedule.start_time!.trim()
  return nowMinutes < start ? `Disponible desde las ${hora}` : `Disponible mañana desde las ${hora}`
}

/** Etiqueta de la pestaña: «Almuerzo · 12:00–16:00» / «Bar · desde las 17:00». */
export function scheduleLabel(schedule: MenuSchedule): string {
  const start = parseTimeOfDay(schedule.start_time) !== null ? schedule.start_time!.trim() : null
  const end = parseTimeOfDay(schedule.end_time) !== null ? schedule.end_time!.trim() : null
  if (start && end) return `${schedule.name} · ${start}–${end}`
  if (start) return `${schedule.name} · desde las ${start}`
  return schedule.name
}

/** Normaliza el repeater `menus` del contenido (viene como JSON libre del editor). */
export function parseSchedules(raw: unknown): MenuSchedule[] {
  if (!Array.isArray(raw)) return []
  const out: MenuSchedule[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    if (!name) continue
    const ids = Array.isArray(e.category_ids)
      ? e.category_ids.map(Number).filter((n) => Number.isFinite(n))
      : []
    out.push({
      name,
      start_time: typeof e.start_time === 'string' ? e.start_time : null,
      end_time: typeof e.end_time === 'string' ? e.end_time : null,
      category_ids: ids,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Platos elegidos por id (sección `signature_dishes`)
// ---------------------------------------------------------------------------

/**
 * Devuelve los platos con esos ids en el orden pedido. Misma regla que la
 * carta: solo productos que la página precargó para la sede (activos, de la
 * carta de la sede) y con precio vigente; los demás se omiten en silencio.
 */
export function pickMenuItems(products: MenuSourceProduct[], ids: number[], tagsPorId?: Map<number, MenuTag> | null): MenuItem[] {
  const byId = new Map<number, MenuSourceProduct>()
  for (const p of products) byId.set(p.id, p)
  const out: MenuItem[] = []
  const seen = new Set<number>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const p = byId.get(id)
    if (!p) continue
    const item = toMenuItem(p, tagsPorId)
    if (item.price === null) continue
    out.push(item)
  }
  return out
}

// ---------------------------------------------------------------------------
// Agotado con contexto («Agotado · Vuelve a las 18:00»)
// ---------------------------------------------------------------------------

/**
 * Cuándo vuelve un plato agotado en la sede, en la zona de la organización: «Vuelve a las 18:00»
 * (hoy), «Vuelve mañana» o «Vuelve el Sáb 17 oct». `null` sin fecha (solo «Agotado»).
 * El valor es un timestamptz de la base: se convierte en la zona, nunca con split('T').
 */
export function soldOutReturnLabel(soldOutUntil: string | null | undefined, timeZone: string, ahora: Date = new Date()): string | null {
  if (!soldOutUntil) return null
  const t = Date.parse(soldOutUntil)
  if (!Number.isFinite(t) || t <= ahora.getTime()) return null
  const instante = new Date(t)
  const dia = hoyEnZona(timeZone, instante)
  const hoy = hoyEnZona(timeZone, ahora)
  if (dia === hoy) return `Vuelve a las ${horaDeMinutos(ahoraEnZona(timeZone, instante).minutos)}`
  if (dia === sumarDias(hoy, 1)) return 'Vuelve mañana'
  return `Vuelve el ${fechaCorta(dia)}`
}
