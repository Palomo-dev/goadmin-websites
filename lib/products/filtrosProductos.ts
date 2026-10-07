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

export type OrdenFiltro = 'default' | 'price_asc' | 'price_desc' | 'name'

export interface EstadoFiltros {
  categoria: number | null
  soloOfertas: boolean
  orden: OrdenFiltro
  busqueda: string
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
  if (estado.orden === 'price_asc') result.sort((a, b) => (precio(a) ?? 0) - (precio(b) ?? 0))
  else if (estado.orden === 'price_desc') result.sort((a, b) => (precio(b) ?? 0) - (precio(a) ?? 0))
  else if (estado.orden === 'name') result.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
  return result
}

export function hayFiltrosActivos(estado: EstadoFiltros): boolean {
  return Boolean(estado.categoria || estado.soloOfertas || estado.busqueda.trim() || estado.orden !== 'default')
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
