/**
 * Modelo de la carta completa (sección `menu_full`).
 *
 * Toma los productos y categorías que la página ya precarga para las secciones
 * de catálogo (`getOrganizationProducts` + `getOrganizationCategories` en
 * `app/[[...slug]]/page.tsx`, filtrados por organization_id del contexto y por
 * la sede de la página) y los agrupa por categoría. No hace consultas.
 *
 * Qué existe hoy en la base y qué no (verificado por MCP el 2026-10-05):
 *  - Precio: `product_prices` vigente (effective_to NULL); [0] ya viene
 *    normalizado por `normalizeProductPrices`.
 *  - Agotado: solo para productos con `track_stock = true`, con los
 *    `stock_levels` de la sede (o de las sedes que surten la web). Es la misma
 *    regla que usan las tarjetas (`isOutOfStock` de lib/stock).
 *  - "Carta" con horario (desayuno/almuerzo/bar): NO existe en la base. Se
 *    configura en el contenido de la sección (`menus`), no en una columna.
 *  - Destacado del chef y etiquetas dietéticas con tipo: NO existen
 *    (`product_tags` solo tiene name + color). No se pintan.
 */

import type { Category, Product, ProductImage, ProductPrice, SharedImage, StockLevelRow } from '@/types/database'
import { isOutOfStock } from '@/lib/stock'
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
  /** Padre con variantes: se elige en el detalle, no se agrega desde la carta. */
  hasVariants: boolean
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
}

const UNCATEGORIZED_ID = -1

export function toMenuItem(p: MenuSourceProduct): MenuItem {
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
): MenuCategoryGroup[] {
  const selected = Array.isArray(categoryIds) && categoryIds.length > 0 ? new Set(categoryIds.map(Number)) : null

  const byCategory = new Map<number, MenuItem[]>()
  for (const p of products) {
    const item = toMenuItem(p)
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
// ---------------------------------------------------------------------------

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** "HH:MM" → minutos desde medianoche, o null si no es una hora válida. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (!value) return null
  const m = TIME_RE.exec(value.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutos desde medianoche de `now` en la zona IANA indicada. */
export function minutesInTimeZone(now: Date, timeZone: string): number {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = fmt(timeZone).formatToParts(now)
  } catch {
    // Zona inválida en la base: fallback documentado en reglas-fechas-timezone.
    parts = fmt('America/Bogota').formatToParts(now)
  }
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/**
 * ¿La carta está en horario? Sin hora de inicio = siempre abierta.
 * Sin hora de fin = hasta medianoche. Fin menor que inicio = cruza medianoche.
 */
export function isScheduleOpen(schedule: MenuSchedule, nowMinutes: number): boolean {
  const start = parseTimeOfDay(schedule.start_time)
  if (start === null) return true
  const end = parseTimeOfDay(schedule.end_time)
  if (end === null) return nowMinutes >= start
  if (end > start) return nowMinutes >= start && nowMinutes < end
  if (end < start) return nowMinutes >= start || nowMinutes < end
  return true
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
export function pickMenuItems(products: MenuSourceProduct[], ids: number[]): MenuItem[] {
  const byId = new Map<number, MenuSourceProduct>()
  for (const p of products) byId.set(p.id, p)
  const out: MenuItem[] = []
  const seen = new Set<number>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const p = byId.get(id)
    if (!p) continue
    const item = toMenuItem(p)
    if (item.price === null) continue
    out.push(item)
  }
  return out
}
