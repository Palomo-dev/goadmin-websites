/**
 * Tope, paginación y orden de Productos y Ofertas.
 * Lo que el editor guarda en `max_items`, `rows`, `columns`, `show_pagination`
 * y `sort_order` tiene que recortar la lista que ya cargó la página.
 *
 * Puro: sin React, Next ni Supabase.
 */

export function enteroPositivo(v: unknown): number | null {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(x)) return null
  const n = Math.round(x)
  return n > 0 ? n : null
}

/** Columnas de escritorio (1–8). Un número o `columns.desktop`. Si no hay, el fallback. */
export function columnasEscritorio(columns: unknown, fallback = 4): number {
  const dentro = (n: number | null) => (n && n <= 8 ? n : fallback)
  if (typeof columns === 'number' || (typeof columns === 'string' && columns.trim())) {
    return dentro(enteroPositivo(columns))
  }
  if (columns && typeof columns === 'object' && 'desktop' in columns) {
    return dentro(enteroPositivo((columns as Record<string, unknown>).desktop))
  }
  return fallback
}

export interface ContenidoListado {
  max_items?: unknown
  /** Tope alterno del editor (`Cantidad`). Si `max_items` existe, ese gana. */
  products_limit?: unknown
  rows?: unknown
  columns?: unknown
  show_pagination?: unknown
  sort_order?: unknown
  /** `long` muestra el tope de una vez. `pages` pagina. Ausente: el comportamiento de hoy. */
  list_mode?: unknown
  per_page?: unknown
}

/**
 * Cantidad máxima. `max_items` y filas × columnas de escritorio se combinan
 * con el menor. Sin ninguno, no hay tope (null) y la lista pagina como antes.
 */
export function topeProductos(content: ContenidoListado | null | undefined, columnasPorDefecto = 4): number | null {
  const max = enteroPositivo(content?.max_items) ?? enteroPositivo(content?.products_limit)
  const filas = enteroPositivo(content?.rows)
  const porFilas = filas ? filas * columnasEscritorio(content?.columns, columnasPorDefecto) : null
  if (max && porFilas) return Math.min(max, porFilas)
  return max ?? porFilas
}

export type ModoLista = 'long' | 'pages'

/** `null` si el editor no eligió lista larga ni paginación. */
export function modoLista(valor: unknown): ModoLista | null {
  return valor === 'long' || valor === 'pages' ? valor : null
}

/**
 * Recorta una lista ya cargada.
 * Sin tope y sin modo, devuelve la lista entera (la paginación de hoy sigue afuera).
 * Con tope, nunca pasa de ese número, tampoco en la variante lista.
 */
export function recortarPorModo<T>(items: T[], content: ContenidoListado | null | undefined, pagina = 1): {
  items: T[]
  paginas: number
  modo: ModoLista | null
  porPagina: number
} {
  const tope = topeProductos(content)
  const modo = modoLista(content?.list_mode)
  const universo = tope != null ? items.slice(0, tope) : items
  const porPagina = enteroPositivo(content?.per_page) ?? 12
  if (modo === 'pages') {
    const paginas = Math.max(1, Math.ceil(universo.length / porPagina) || 1)
    const p = Math.min(Math.max(1, Math.round(pagina) || 1), paginas)
    const desde = (p - 1) * porPagina
    return { items: universo.slice(desde, desde + porPagina), paginas, modo, porPagina }
  }
  if (modo === 'long' || tope != null) {
    return { items: universo, paginas: 1, modo, porPagina }
  }
  return { items, paginas: 1, modo: null, porPagina }
}

export function recorteListado(total: number, pagina: number, content: ContenidoListado | null | undefined, porPaginaForzado?: number) {
  const tope = topeProductos(content)
  const universo = tope ? Math.min(Math.max(0, total), tope) : Math.max(0, total)
  const paginar = content?.show_pagination !== false
  const forzado = porPaginaForzado && porPaginaForzado > 0 ? Math.round(porPaginaForzado) : null
  const porPagina = forzado ?? (paginar ? 12 : Math.max(universo, 1))
  const paginas = Math.max(1, Math.ceil(universo / porPagina) || 1)
  const p = Math.min(Math.max(1, Math.round(pagina) || 1), paginas)
  const desde = (p - 1) * porPagina
  const hasta = Math.min(desde + porPagina, universo)
  return { desde, hasta, paginas, universo }
}

function marcaTiempo(p: { created_at?: unknown }): number {
  const t = Date.parse(typeof p?.created_at === 'string' ? p.created_at : '')
  return Number.isFinite(t) ? t : 0
}

function precioDe(p: { product_prices?: Array<{ price?: unknown }> }): number {
  const n = Number(p?.product_prices?.[0]?.price)
  return Number.isFinite(n) ? n : 0
}

/** Orden de la sección. `default` y cualquier otro valor dejan el orden de carga. */
export function ordenarListado<T>(productos: T[], orden: unknown): T[] {
  const lista = [...productos]
  if (orden === 'price_asc') lista.sort((a, b) => precioDe(a as never) - precioDe(b as never))
  else if (orden === 'price_desc') lista.sort((a, b) => precioDe(b as never) - precioDe(a as never))
  else if (orden === 'name') lista.sort((a, b) => String((a as { name?: string }).name || '').localeCompare(String((b as { name?: string }).name || '')))
  else if (orden === 'sales') lista.sort((a, b) => (Number((b as { sales_count?: unknown }).sales_count) || 0) - (Number((a as { sales_count?: unknown }).sales_count) || 0))
  else if (orden === 'newest') lista.sort((a, b) => marcaTiempo(b as never) - marcaTiempo(a as never))
  return lista
}

export type OrdenOfertas = 'sales' | 'discount' | 'price_asc' | 'price_desc' | 'newest' | 'name'

/** Ofertas sin orden guardado siguen por más vendidos. */
export function ordenInicialOfertas(orden: unknown): OrdenOfertas {
  if (
    orden === 'price_asc' || orden === 'price_desc' || orden === 'newest'
    || orden === 'name' || orden === 'discount' || orden === 'sales'
  ) return orden
  return 'sales'
}
