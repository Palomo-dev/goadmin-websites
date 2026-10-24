/**
 * Fuente, tope y presentación de `products_grid`.
 * Sin `product_source` ni claves de presentación, el listado sigue como hoy
 * (los 500 ya cargados, chips y paginación actuales).
 */

export const FUENTES = ['all', 'categories', 'manual', 'new', 'offers', 'best_sellers'] as const
export type FuenteProductos = (typeof FUENTES)[number]
export const MODOS = ['grid', 'list', 'carousel', 'masonry'] as const
export const PAGINACIONES = ['none', 'pages', 'load_more', 'infinite', 'full'] as const
export const CHIPS = ['pill', 'semi', 'square', 'underline'] as const
export const POS_FILTRO = ['top', 'side', 'drawer'] as const
export const FILTROS = ['category', 'price', 'offers', 'stock', 'brand', 'attributes', 'rating', 'shipping'] as const

export interface PedidoListado {
  source: FuenteProductos
  categoryIds: number[]
  includeSubcategories: boolean
  productIds: number[]
  excludeOutOfStock: boolean
  /** Tamaño de la página que pide `.range`. */
  limit: number
  /** Tope del universo (`products_limit`). null = sin tope distinto de la página. */
  max: number | null
  days: number
  sort: string
}

export interface PresentacionListado {
  displayMode?: (typeof MODOS)[number]
  pagination?: (typeof PAGINACIONES)[number]
  perPage?: number
  chipStyle?: (typeof CHIPS)[number]
  chipMobile?: 'scroll' | 'select'
  showAllChip?: boolean
  filterPosition?: (typeof POS_FILTRO)[number]
  filters?: (typeof FILTROS)[number][]
  showSort?: boolean
  showCount?: boolean
  columnsDesktop?: number
  columnsTablet?: number
  columnsMobile?: number
  /** Qué categorías pinta la barra. Ausente = las de hoy. */
  chipSource?: 'all' | 'selected' | 'manual'
  chipCategoryIds?: number[]
  /** Opciones del «Ordenar». Ausente = las de la barra nueva por defecto. */
  sortOptions?: string[]
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

function ids(valor: unknown, max = 100): number[] {
  const lista = typeof valor === 'string'
    ? valor.split(/[,\s]+/)
    : Array.isArray(valor) ? valor : []
  const out: number[] = []
  for (const v of lista) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
    if (Number.isInteger(n) && n > 0) out.push(n)
    if (out.length >= max) break
  }
  return out
}

/** `null` = no consultar aparte: el listado de 500 de la página. */
export function pedidoServidor(content: unknown): PedidoListado | null {
  if (!content || typeof content !== 'object') return null
  const c = content as Record<string, unknown>
  const source = enLista(FUENTES, c.product_source)
  const pag = enLista(PAGINACIONES, c.pagination)
  const pidePagina = pag === 'load_more' || pag === 'infinite' || pag === 'pages'
  if (!source || source === 'all') {
    if (!pidePagina && entero(c.products_limit, 4, 100) == null) return null
  }
  const fuente = source && source !== 'all' ? source : 'all'
  const tope = entero(c.products_limit, 4, 100) ?? null
  const porPagina = entero(c.per_page, 4, 48)
  const tamano = pidePagina ? (porPagina ?? tope ?? 12) : (tope ?? 12)
  return {
    source: fuente,
    categoryIds: ids(c.selected_category_ids),
    includeSubcategories: c.include_subcategories === true,
    productIds: ids(c.selected_product_ids, 100),
    excludeOutOfStock: c.exclude_out_of_stock === true,
    limit: tamano,
    max: tope,
    days: entero(c.new_days, 1, 365) ?? 30,
    sort: typeof c.sort_order === 'string' ? c.sort_order : 'default',
  }
}

export function leerPresentacion(content: unknown): PresentacionListado | null {
  if (!content || typeof content !== 'object') return null
  const c = content as Record<string, unknown>
  const p: PresentacionListado = {}
  const modo = enLista(MODOS, c.display_mode)
  if (modo && modo !== 'grid') p.displayMode = modo
  const pag = enLista(PAGINACIONES, c.pagination)
  if (pag) p.pagination = pag
  const por = entero(c.per_page, 4, 48)
  if (por != null) p.perPage = por
  const chip = enLista(CHIPS, c.chip_style)
  if (chip && chip !== 'pill') p.chipStyle = chip
  if (c.chip_mobile === 'select' || c.chip_mobile === 'scroll') p.chipMobile = c.chip_mobile
  if (c.show_all_chip === false) p.showAllChip = false
  const pos = enLista(POS_FILTRO, c.filter_position)
  if (pos && pos !== 'top') p.filterPosition = pos
  if (Array.isArray(c.filters)) {
    const lista = c.filters.map((f) => enLista(FILTROS, f)).filter((f): f is (typeof FILTROS)[number] => !!f)
    if (lista.length) p.filters = lista
  }
  if (c.show_sort === false) p.showSort = false
  if (c.show_count === false) p.showCount = false
  if (c.chip_source === 'all' || c.chip_source === 'selected' || c.chip_source === 'manual') p.chipSource = c.chip_source
  const chips = ids(c.chip_category_ids)
  if (p.chipSource === 'manual' && chips.length) p.chipCategoryIds = chips
  if (Array.isArray(c.sort_options)) {
    const lista = c.sort_options.filter((s): s is string => typeof s === 'string' && ['newest', 'price_asc', 'price_desc', 'sales', 'name'].includes(s))
    if (lista.length) p.sortOptions = lista
  }
  const cd = entero(c.columns_desktop, 1, 6)
  if (cd != null) p.columnsDesktop = cd
  const ct = entero(c.columns_tablet, 1, 4)
  if (ct != null) p.columnsTablet = ct
  const cm = entero(c.columns_mobile, 1, 2)
  if (cm != null) p.columnsMobile = cm
  return Object.keys(p).length > 0 ? p : null
}

export interface CategoriaArbol {
  id: number
  parent_id: number | null
}

/** Incluye los hijos cuando `incluirHijos` es true. Si no, devuelve los ids tal cual. */
export function expandirCategorias(ids: number[], categorias: CategoriaArbol[], incluirHijos: boolean): number[] {
  const base = ids.filter((n) => Number.isInteger(n) && n > 0)
  const set = new Set(base)
  if (!incluirHijos || set.size === 0) return [...set]
  const porPadre = new Map<number, number[]>()
  for (const c of categorias) {
    if (c.parent_id == null) continue
    const lista = porPadre.get(c.parent_id) ?? []
    lista.push(c.id)
    porPadre.set(c.parent_id, lista)
  }
  const pila = [...set]
  while (pila.length) {
    const id = pila.pop() as number
    for (const hijo of porPadre.get(id) ?? []) {
      if (!set.has(hijo)) {
        set.add(hijo)
        pila.push(hijo)
      }
    }
  }
  return [...set]
}

const COL: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
}

const MD: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

const LG: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

/**
 * Recorte del listado ya cargado. null = seguir con la paginación de hoy (12).
 * `none` muestra el universo sin páginas. `pages` usa `per_page` o 12.
 */
export function recortePresentacion(
  total: number,
  pagina: number,
  p: PresentacionListado | null,
): { desde: number; hasta: number; paginas: number; universo: number } | null {
  if (!p?.pagination) return null
  const universo = Math.max(0, total)
  if (p.pagination === 'none' || p.pagination === 'full') return { desde: 0, hasta: universo, paginas: 1, universo }
  if (p.pagination === 'load_more' || p.pagination === 'infinite') {
    const primero = p.perPage ?? Math.min(universo, 12)
    return { desde: 0, hasta: Math.min(universo, primero), paginas: 1, universo }
  }
  const por = p.perPage ?? 12
  const paginas = Math.max(1, Math.ceil(universo / por) || 1)
  const actual = Math.min(Math.max(1, Math.round(pagina) || 1), paginas)
  const desde = (actual - 1) * por
  return { desde, hasta: Math.min(desde + por, universo), paginas, universo }
}

/** Clases de la rejilla solo cuando la sección fijó columnas. Si no, null. */
export function clasesColumnasListado(p: PresentacionListado | null): string | null {
  if (!p || (p.columnsDesktop == null && p.columnsTablet == null && p.columnsMobile == null)) return null
  const movil = COL[p.columnsMobile ?? 2] ?? COL[2]
  const tablet = MD[p.columnsTablet ?? Math.min(p.columnsDesktop ?? 3, 3)] ?? MD[3]
  const escritorio = LG[p.columnsDesktop ?? 4] ?? LG[4]
  return `grid ${movil} ${tablet} ${escritorio} gap-3 sm:gap-6`
}
