import { isOutOfStock } from '@/lib/stock'

/**
 * Filtros y buscador de las listas de productos de las secciones (`show_filters`, `show_search`).
 *
 * Trabajan sobre los productos que la página YA cargó (`data.products` / `data.offerProducts`):
 * ni una consulta por tecla ni por filtro. La lógica de categoría, «Ofertas» y orden es la que
 * tenía `ProductsGrid` (sale de allí, sin cambios), y ahora la comparten el carrusel, la lista,
 * los destacados y las ofertas.
 *
 * Pura y sin DOM: la prueba `scripts/verify-interruptores.mjs`.
 */

export type OrdenFiltro = 'default' | 'price_asc' | 'price_desc' | 'name' | 'newest' | 'sales'

export interface EstadoFiltros {
  categoria: number | null
  soloOfertas: boolean
  orden: OrdenFiltro
  busqueda: string
  /** Solo si el visitante eligió marca, rango, stock, nota o atributo. Ausentes = el filtro de hoy. */
  marca?: string
  precioMin?: number | null
  precioMax?: number | null
  soloDisponibles?: boolean
  calificacionMin?: number | null
  atributo?: string
}

export const FILTROS_INICIALES: EstadoFiltros = { categoria: null, soloOfertas: false, orden: 'default', busqueda: '' }

function precio(p: any): number | null {
  return p?.product_prices && p.product_prices.length > 0 ? Number(p.product_prices[0].price) : null
}

/** Minúsculas y sin tildes: «Café» encuentra «cafe» y al revés. */
export function normalizarBusqueda(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cada palabra de la consulta debe aparecer en el nombre, la referencia o la categoría. */
export function coincideBusqueda(producto: any, consulta: string): boolean {
  const q = normalizarBusqueda(consulta)
  if (!q) return true
  const texto = normalizarBusqueda([producto?.name, producto?.sku, producto?.categories?.name].filter(Boolean).join(' '))
  return q.split(' ').every((palabra) => texto.includes(palabra))
}

export function esOferta(p: any): boolean {
  const cp = p?.product_prices?.[0]?.compare_price
  const pr = p?.product_prices?.[0]?.price
  return Boolean(cp && pr && Number(cp) > Number(pr))
}

/** Aplica búsqueda, categoría, «Ofertas» y orden. Con el estado inicial devuelve la lista igual. */
export function filtrarProductos<T>(productos: T[], estado: EstadoFiltros): T[] {
  let result = [...productos]
  if (estado.busqueda.trim()) result = result.filter((p) => coincideBusqueda(p, estado.busqueda))
  if (estado.categoria) result = result.filter((p: any) => p.category_id === estado.categoria)
  if (estado.soloOfertas) result = result.filter(esOferta)
  if (estado.marca) result = result.filter((p: any) => p.brand === estado.marca)
  if (estado.precioMin != null) result = result.filter((p) => (precio(p) ?? 0) >= (estado.precioMin as number))
  if (estado.precioMax != null) result = result.filter((p) => (precio(p) ?? 0) <= (estado.precioMax as number))
  if (estado.soloDisponibles) result = result.filter((p) => !isOutOfStock(p as never))
  if (estado.calificacionMin != null) {
    const minimo = estado.calificacionMin
    result = result.filter((p: any) => Number(p?.rating_avg) >= minimo)
  }
  if (estado.atributo) {
    const corte = estado.atributo.indexOf('::')
    const nombre = corte >= 0 ? estado.atributo.slice(0, corte) : ''
    const valor = corte >= 0 ? estado.atributo.slice(corte + 2) : ''
    if (nombre && valor) result = result.filter((p) => coincideAtributo(p, nombre, valor))
  }
  if (estado.orden === 'price_asc') result.sort((a, b) => (precio(a) ?? 0) - (precio(b) ?? 0))
  else if (estado.orden === 'price_desc') result.sort((a, b) => (precio(b) ?? 0) - (precio(a) ?? 0))
  else if (estado.orden === 'name') result.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  else if (estado.orden === 'newest') {
    const marca = (p: any) => {
      const t = Date.parse(typeof p?.created_at === 'string' ? p.created_at : '')
      return Number.isFinite(t) ? t : 0
    }
    result.sort((a, b) => marca(b) - marca(a))
  } else if (estado.orden === 'sales') {
    result.sort((a: any, b: any) => (Number(b?.sales_count) || 0) - (Number(a?.sales_count) || 0))
  }
  return result
}

/** Talla o color: `atributos` del listado (mapa nombre → valores) o `variant_data` del producto. */
function coincideAtributo(p: any, nombre: string, valor: string): boolean {
  const grupos = p?.atributos
  if (grupos && typeof grupos === 'object' && !Array.isArray(grupos)) {
    const lista = grupos[nombre]
    if (Array.isArray(lista)) return lista.includes(valor)
    if (typeof lista === 'string') return lista === valor
  }
  const datos = p?.variant_data
  return !!datos && typeof datos === 'object' && !Array.isArray(datos) && datos[nombre] === valor
}

export function hayFiltrosActivos(estado: EstadoFiltros): boolean {
  return Boolean(
    estado.categoria || estado.soloOfertas || estado.busqueda.trim() || estado.orden !== 'default'
    || estado.marca || estado.precioMin != null || estado.precioMax != null
    || estado.soloDisponibles || estado.calificacionMin != null || estado.atributo,
  )
}

/**
 * Categorías a ofrecer en los chips: las de `data.categories` (o, si no vinieron, las que traen
 * los productos), limitadas a las elegidas en la sección y en ese orden.
 */
export interface NodoCategoria {
  id: number
  parent_id?: number | null
}

/** Ids numéricos positivos, sin repetir y en el orden en que llegaron. */
export function normalizarIdsCategoria(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  const vistos = new Set<number>()
  const salida: number[] = []
  for (const id of ids) {
    const n = Number(id)
    if (!Number.isInteger(n) || n <= 0 || vistos.has(n)) continue
    vistos.add(n)
    salida.push(n)
  }
  return salida
}

/**
 * Ids elegidos más sus descendientes (`parent_id`). El orden es el de la selección
 * y, dentro de cada una, el de `categories`. Sin selección, lista vacía.
 */
export function expandirCategorias(ids: readonly number[] | unknown, categories: readonly NodoCategoria[] | null | undefined): number[] {
  const semillas = normalizarIdsCategoria(ids)
  if (semillas.length === 0) return []
  const hijos = new Map<number, number[]>()
  for (const c of categories || []) {
    const id = Number(c?.id)
    const padre = c?.parent_id == null ? null : Number(c.parent_id)
    if (!Number.isInteger(id) || id <= 0 || padre == null || !Number.isInteger(padre)) continue
    const lista = hijos.get(padre) ?? []
    lista.push(id)
    hijos.set(padre, lista)
  }
  const vistos = new Set<number>()
  const salida: number[] = []
  const cola = [...semillas]
  while (cola.length > 0) {
    const id = cola.shift()!
    if (vistos.has(id)) continue
    vistos.add(id)
    salida.push(id)
    for (const hijo of hijos.get(id) || []) cola.push(hijo)
  }
  return salida
}

export type SeccionConCategorias = 'featured_products' | 'products_grid' | 'products_carousel' | 'products_list' | 'offers'

/**
 * `include_subcategories` ausente: en destacados entran las hijas; en grilla,
 * carrusel, lista y ofertas no, para no cambiar lo que ya filtraban por id exacto.
 */
export function incluirSubcategorias(valor: unknown, seccion: SeccionConCategorias): boolean {
  if (valor === true) return true
  if (valor === false) return false
  return seccion === 'featured_products'
}

/** Ids que de verdad limitan el listado. Vacío = no hay límite de categoría. */
export function idsDeSeleccion(
  ids: unknown,
  categories: readonly NodoCategoria[] | null | undefined,
  incluirHijas: boolean,
): number[] {
  const limpios = normalizarIdsCategoria(ids)
  if (limpios.length === 0) return []
  return incluirHijas ? expandirCategorias(limpios, categories) : limpios
}

/**
 * Productos de las categorías de la sección. Sin selección devuelve la lista igual
 * (la clave ausente no cambia el render).
 */
export function filtrarProductosPorCategorias<T extends { category_id?: number | null }>(
  productos: T[],
  ids: unknown,
  categories: readonly NodoCategoria[] | null | undefined,
  incluirHijas: boolean,
): T[] {
  const efectivos = idsDeSeleccion(ids, categories, incluirHijas)
  if (efectivos.length === 0) return productos
  const set = new Set(efectivos)
  return productos.filter((p) => p.category_id != null && set.has(Number(p.category_id)))
}

/**
 * Une el listado general (tope 500) con los productos pedidos por categoría.
 * Sin selección no se unen: las demás secciones siguen viendo solo los 500.
 */
export function unirProductosDeCategoria<T extends { id?: number }>(
  generales: T[] | undefined,
  deCategoria: T[] | undefined,
  seleccion: unknown,
): T[] {
  const base = generales || []
  if (normalizarIdsCategoria(seleccion).length === 0 || !deCategoria || deCategoria.length === 0) return base
  const vistos = new Set(base.map((p) => p.id))
  return base.concat(deCategoria.filter((p) => p.id != null && !vistos.has(p.id)))
}

const SECCIONES_CON_SELECCION = new Set(['featured_products', 'products_grid'])

/**
 * Categorías cuyos productos hay que pedir aparte del tope de 500.
 * Ofertas no entra: esa sección lee `offerProducts`, no este listado.
 */
export function idsParaCargarProductos(
  secciones: readonly { section_type?: string; content?: unknown }[],
  categories: readonly NodoCategoria[] | null | undefined,
): number[] {
  const set = new Set<number>()
  for (const s of secciones) {
    const tipo = s.section_type
    if (!tipo || !SECCIONES_CON_SELECCION.has(tipo)) continue
    const content = (s.content ?? {}) as { selected_category_ids?: unknown; include_subcategories?: unknown }
    const seccion: SeccionConCategorias = tipo === 'featured_products' ? 'featured_products' : 'products_grid'
    const incluir = incluirSubcategorias(content.include_subcategories, seccion)
    for (const id of idsDeSeleccion(content.selected_category_ids, categories, incluir)) set.add(id)
  }
  return [...set].sort((a, b) => a - b)
}

export function categoriasDisponibles(productos: any[], categorias: any[] | undefined, seleccionadas: number[] | undefined) {
  const todas = categorias && categorias.length > 0
    ? categorias
    : (() => {
        const catMap = new Map<number, string>()
        productos.forEach((p: any) => {
          if (p.category_id && p.categories?.name) catMap.set(p.category_id, p.categories.name)
        })
        return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }))
      })()
  const ids = seleccionadas || []
  if (ids.length === 0) return todas
  return ids.map((id: number) => todas.find((c: any) => c.id === id)).filter(Boolean)
}
