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
