/**
 * Carta por sede (website builder V2, ADR-002 D3; tabla `website_branch_products` del ERP,
 * migración 20261005214525_v2_menus_y_carta_por_sede.sql).
 *
 * Regla única para el sitio público y para el cobro en el servidor:
 * - La sede de la carta la decide `resolverSedeCarta`: la de la página o, en el sitio principal,
 *   la sede principal (`is_main`). Sin sede principal: no se aplica nada, como antes.
 * - Con sede y SIN fila para el producto: igual que en el sitio principal.
 * - `is_listed = false`: el producto no sale en esa sede (ni se puede pedir allí).
 * - `is_sold_out = true` y (`sold_out_until` nulo o futuro): se muestra agotado.
 * - `web_price` no nulo: es el precio que se muestra Y el que cobra `/api/orders`.
 * - Sin `web_price`, el precio de la sede del ERP (`product_branch_prices`, RPC
 *   `fn_precios_vigentes_lote`, origen 'sede') si lo hay: el mismo que cobra el POS.
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

/** Precio de la sede del ERP ya resuelto por `fn_precios_vigentes_lote` (solo origen sede). */
export interface PrecioSedeCarta {
  precio: number
  comparacion: number | null
}

export interface CartaSede {
  branchId: number
  filas: Map<number, FilaCartaSede>
  /** Precios de `product_branch_prices` de la sede. Ausente o vacío = sin precios de sede. */
  precios?: Map<number, PrecioSedeCarta>
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

// ─── Sede efectiva de la carta ──────────────────────────────────────────────────────────────
//
// Regla única para los dos repos (la misma que abre el panel «Carta por sede» del ERP): con sede
// explícita, la carta es la de esa sede; en el sitio principal, la de la sede activa marcada
// `is_main`. Sin sede principal → `null` (sin carta por sede, como siempre).
//
// No confundir con la sede de inventario de `/api/orders` (`resolvedBranchId`), que prioriza
// `is_web_stock_source` y puede ser otra: la carta es la que editó el negocio para la principal.

export interface SedeParaCarta {
  id: number
  is_main?: boolean | null
  is_active?: boolean | null
}

/** Parte pura de {@link resolverSedeCarta}: elige la sede de la carta entre las de la organización. */
export function sedeCartaDe(sedes: SedeParaCarta[] | null | undefined, branchId?: number | null): number | null {
  if (esSede(branchId)) return branchId
  const principal = (sedes || []).find((s) => s.is_main === true && s.is_active !== false)
  return principal && esSede(Number(principal.id)) ? Number(principal.id) : null
}

/**
 * Sede cuya carta aplica a una petición (contrato publicado para el checkout y `/api/orders`).
 *
 * `organizationId` sale SIEMPRE del contexto del host. Con `branchId` válido (ya comprobado contra
 * la organización por quien llama) lo devuelve tal cual, sin consultar. Sin él, busca la sede
 * principal con la lista de sedes cacheada (`getOrganizationBranches`, SETTINGS_TTL): no suma
 * consultas por render. Si la lectura falla, `null`: se cobra y se muestra sin carta, igual que
 * un sitio que nunca la configuró.
 *
 * Importación dinámica a propósito: este módulo es puro (lo carga `scripts/verify-precios-pedido.mjs`
 * sin Next) y `queries.ts` ya lo importa a él.
 */
export async function resolverSedeCarta(organizationId: number, branchId?: number | null): Promise<number | null> {
  if (esSede(branchId)) return branchId
  try {
    const { getOrganizationBranches } = await import('@/lib/supabase/queries')
    const sedes = (await getOrganizationBranches(organizationId)) as SedeParaCarta[]
    return sedeCartaDe(sedes, null)
  } catch (error) {
    console.error('[carta-sede] No se pudo resolver la sede principal de la carta', { organizationId, error })
    return null
  }
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
  const precios = carta?.precios
  if (!carta || (carta.filas.size === 0 && (!precios || precios.size === 0))) return productos
  const resultado: T[] = []
  for (const original of productos) {
    const p = original as any
    const fila = carta.filas.get(Number(p?.id))
    const precioSede = precios?.get(Number(p?.id))
    if (!fila && !precioSede) {
      resultado.push(original)
      continue
    }
    if (noListadoEnSede(fila)) continue

    let copia: any = p
    // Mismo orden que el cobro (precioBaseProducto): web_price de la carta → precio de la sede.
    const precioWeb = precioWebDeSede(fila) ?? (precioSede ? precioSede.precio : null)
    if (precioWeb !== null) {
      const precios: any[] = Array.isArray(p.product_prices) ? p.product_prices : []
      const vigente = precios[0]
      const compararBase = precioWebDeSede(fila) === null && precioSede
        ? precioSede.comparacion
        : vigente?.compare_price
      const comparar = compararBase !== null && compararBase !== undefined ? Number(compararBase) : null
      const nuevoVigente = {
        ...(vigente ?? { id: 0, effective_to: null }),
        price: precioWeb,
        // Un «antes» menor o igual al precio de la sede mostraría una oferta falsa.
        compare_price: comparar !== null && Number.isFinite(comparar) && comparar > precioWeb ? comparar : null,
      }
      copia = { ...copia, product_prices: [nuevoVigente, ...precios.slice(1)] }
    }
    const agotado = agotadoEnSede(fila, ahora)
    if (agotado) {
      // Mismo contrato que `isOutOfStock` (lib/stock.ts): rastrea inventario y sin existencias.
      copia = { ...copia, track_stock: true, stock_levels: [] }
    }
    copia = {
      ...copia,
      carta_sede: {
        precio_web: precioWeb !== null,
        agotado,
        // Hasta cuándo (timestamptz tal cual; se formatea en la zona de la organización al pintar).
        agotado_hasta: agotado ? (fila?.sold_out_until ?? null) : null,
      },
    }
    resultado.push(copia as T)
  }
  return resultado
}

// ─── Cobro en el servidor (/api/orders) ─────────────────────────────────────────────────────
//
// El cobro usa `precioWebDeSede`, `noListadoEnSede` y `agotadoEnSede` desde
// lib/products/precio-servidor.ts, donde se arma el precio completo de la línea (web_price de la
// sede + extras de modificadores leídos de la base, nunca los del cliente).
