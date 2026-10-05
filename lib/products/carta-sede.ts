/**
 * Carta por sede (website builder V2, ADR-002 D3; tabla `website_branch_products` del ERP,
 * migración 20261005214525_v2_menus_y_carta_por_sede.sql).
 *
 * Regla única para el sitio público y para el cobro en el servidor:
 * - Sin sede (sitio principal): no se aplica nada. Comportamiento idéntico al de antes.
 * - Con sede y SIN fila para el producto: igual que en el sitio principal.
 * - `is_listed = false`: el producto no sale en esa sede (ni se puede pedir allí).
 * - `is_sold_out = true` y (`sold_out_until` nulo o futuro): se muestra agotado.
 * - `web_price` no nulo: es el precio que se muestra Y el que cobra `/api/orders`.
 *
 * Columnas verificadas por MCP el 2026-10-05: organization_id, branch_id, product_id,
 * is_listed, web_price (numeric, NULL-able), is_sold_out, sold_out_until (timestamptz, NULL-able).
 * La tabla no admite anon: se lee con el cliente del servidor (service role), siempre filtrando
 * por `organization_id` y `branch_id`.
 */

export const SELECT_CARTA_SEDE = 'product_id, is_listed, web_price, is_sold_out, sold_out_until'

export interface FilaCartaSede {
  product_id: number
  is_listed: boolean
  web_price: number | string | null
  is_sold_out: boolean
  sold_out_until: string | null
}

export interface CartaSede {
  branchId: number
  filas: Map<number, FilaCartaSede>
}

/** Máximo de ids por `.in()`/`.not in` para mantener acotada la URL de PostgREST. */
const IDS_POR_CONSULTA = 200
/** PostgREST corta en 1.000 filas por respuesta: se pagina. Tope de seguridad de páginas. */
const FILAS_POR_PAGINA = 1000
const PAGINAS_MAXIMAS = 20
/** Hasta cuántos productos ocultos se excluyen en SQL (el resto se filtra en memoria). */
export const MAX_EXCLUSION_SQL = 500

export function esSede(branchId: number | null | undefined): branchId is number {
  return typeof branchId === 'number' && Number.isInteger(branchId) && branchId > 0
}

/** Agotado en la sede ahora mismo. */
export function agotadoEnSede(fila: FilaCartaSede | undefined, ahora: Date = new Date()): boolean {
  if (!fila || fila.is_sold_out !== true) return false
  if (!fila.sold_out_until) return true
  const hasta = Date.parse(fila.sold_out_until)
  // Fecha ilegible: se respeta el «agotado» (mostrar de menos es mejor que vender sin existencias).
  return !Number.isFinite(hasta) || hasta > ahora.getTime()
}

/** Precio web de la sede, o `null` si la sede usa el precio vigente de `product_prices`. */
export function precioWebDeSede(fila: FilaCartaSede | undefined): number | null {
  if (!fila || fila.web_price === null || fila.web_price === undefined) return null
  const precio = Number(fila.web_price)
  return Number.isFinite(precio) && precio >= 0 ? precio : null
}

export function noListadoEnSede(fila: FilaCartaSede | undefined): boolean {
  return fila !== undefined && fila.is_listed === false
}

export type ResultadoLecturaCarta =
  | { ok: true; carta: CartaSede }
  | { ok: false; error: string }

/**
 * Lee la carta de una sede. Con `productIds`, solo esas filas (cobro); sin ellos, toda la sede
 * (listados; una sede tiene a lo sumo su catálogo, filas pequeñas).
 */
export async function leerCartaSede(
  supabase: any,
  organizationId: number,
  branchId: number,
  productIds?: number[],
): Promise<ResultadoLecturaCarta> {
  const filas = new Map<number, FilaCartaSede>()
  const base = () =>
    supabase
      .from('website_branch_products')
      .select(SELECT_CARTA_SEDE)
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)

  if (productIds) {
    const ids = Array.from(new Set(productIds.filter((id) => Number.isInteger(id))))
    for (let i = 0; i < ids.length; i += IDS_POR_CONSULTA) {
      const { data, error } = await base().in('product_id', ids.slice(i, i + IDS_POR_CONSULTA))
      if (error) return { ok: false, error: error.message || String(error) }
      for (const f of (data || []) as FilaCartaSede[]) filas.set(Number(f.product_id), f)
    }
    return { ok: true, carta: { branchId, filas } }
  }

  for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina += 1) {
    const desde = pagina * FILAS_POR_PAGINA
    const { data, error } = await base()
      .order('product_id', { ascending: true })
      .range(desde, desde + FILAS_POR_PAGINA - 1)
    if (error) return { ok: false, error: error.message || String(error) }
    const lote = (data || []) as FilaCartaSede[]
    for (const f of lote) filas.set(Number(f.product_id), f)
    if (lote.length < FILAS_POR_PAGINA) break
  }
  return { ok: true, carta: { branchId, filas } }
}

/** Ids que la sede oculta (`is_listed = false`). */
export function idsNoListados(carta: CartaSede | null): number[] {
  if (!carta) return []
  const ids: number[] = []
  carta.filas.forEach((f, id) => {
    if (f.is_listed === false) ids.push(id)
  })
  return ids
}

/**
 * Añade a una consulta de `products` la exclusión SQL de los ocultos en la sede, para que
 * `limit`, `range` y `count` sigan siendo correctos. Si hay demasiados, no toca la consulta y
 * el filtro en memoria de {@link aplicarCartaSede} hace el trabajo.
 */
export function excluirNoListados<Q extends { not: (...args: any[]) => Q }>(query: Q, carta: CartaSede | null): Q {
  const ids = idsNoListados(carta)
  if (ids.length === 0 || ids.length > MAX_EXCLUSION_SQL) return query
  return query.not('id', 'in', `(${ids.join(',')})`)
}

/**
 * Aplica la carta a productos ya normalizados (`product_prices[0]` = vigente, ver
 * `normalizeProductPrices`). Sin carta o sin filas devuelve el mismo array.
 */
export function aplicarCartaSede<T>(productos: T[], carta: CartaSede | null, ahora: Date = new Date()): T[] {
  if (!carta || carta.filas.size === 0) return productos
  const resultado: T[] = []
  for (const original of productos) {
    const p = original as any
    const fila = carta.filas.get(Number(p?.id))
    if (!fila) {
      resultado.push(original)
      continue
    }
    if (noListadoEnSede(fila)) continue

    let copia: any = p
    const precioWeb = precioWebDeSede(fila)
    if (precioWeb !== null) {
      const precios: any[] = Array.isArray(p.product_prices) ? p.product_prices : []
      const vigente = precios[0]
      const comparar = vigente?.compare_price !== null && vigente?.compare_price !== undefined
        ? Number(vigente.compare_price)
        : null
      const nuevoVigente = {
        ...(vigente ?? { id: 0, effective_to: null }),
        price: precioWeb,
        // Un «antes» menor o igual al precio de la sede mostraría una oferta falsa.
        compare_price: comparar !== null && Number.isFinite(comparar) && comparar > precioWeb ? comparar : null,
      }
      copia = { ...copia, product_prices: [nuevoVigente, ...precios.slice(1)] }
    }
    if (agotadoEnSede(fila, ahora)) {
      // Mismo contrato que `isOutOfStock` (lib/stock.ts): rastrea inventario y sin existencias.
      copia = { ...copia, track_stock: true, stock_levels: [] }
    }
    copia = {
      ...copia,
      carta_sede: { precio_web: precioWeb !== null, agotado: agotadoEnSede(fila, ahora) },
    }
    resultado.push(copia as T)
  }
  return resultado
}

// ─── Cobro en el servidor (/api/orders) ─────────────────────────────────────────────────────

export interface LineaPedido {
  price: number
  quantity: number
  newModifiers?: { extraPrice?: number }[]
  [clave: string]: unknown
}

export interface ResultadoPreciosSede<T> {
  items: T[]
  /** Productos ocultos o agotados en la sede (el pedido se rechaza). */
  noDisponibles: number[]
  /** Líneas cuyo precio del cliente no coincidía con el de la sede (solo para registro). */
  desfases: { productId: number; cliente: number; sede: number }[]
}

/**
 * Precio que cobra el servidor para cada línea de un pedido de sede.
 *
 * - Sin fila: la línea queda EXACTAMENTE como la mandó el cliente (comportamiento de siempre).
 * - Con `web_price`: `price = web_price + extras de modificadores nuevos`, la misma fórmula con la
 *   que el carrito arma la línea (MenuView: precio base + `newModifiers[].extraPrice`). Nunca se
 *   usa el `price` que manda el cliente.
 * - Oculta o agotada en la sede: se informa en `noDisponibles` para rechazar el pedido.
 */
export function preciosDeSede<T extends LineaPedido>(
  items: T[],
  carta: CartaSede,
  productIdDe: (item: T) => number,
  ahora: Date = new Date(),
): ResultadoPreciosSede<T> {
  const noDisponibles = new Set<number>()
  const desfases: ResultadoPreciosSede<T>['desfases'] = []
  const resultado = items.map((item) => {
    const productId = productIdDe(item)
    const fila = carta.filas.get(productId)
    if (!fila) return item
    if (noListadoEnSede(fila) || agotadoEnSede(fila, ahora)) {
      noDisponibles.add(productId)
      return item
    }
    const precioWeb = precioWebDeSede(fila)
    if (precioWeb === null) return item
    const extras = (item.newModifiers || []).reduce((s, m) => s + (Number(m?.extraPrice) || 0), 0)
    const precio = precioWeb + extras
    if (Number(item.price) !== precio) {
      desfases.push({ productId, cliente: Number(item.price), sede: precio })
    }
    return { ...item, price: precio }
  })
  return { items: resultado, noDisponibles: Array.from(noDisponibles), desfases }
}
