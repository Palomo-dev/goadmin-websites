/**
 * Lectura de la base para `precio-servidor.ts`: productos, precios vigentes y modificadores de las
 * líneas de un pedido, siempre acotada a la organización del host.
 *
 * Columnas verificadas por MCP el 2026-10-05:
 * - products: id, organization_id, name, sku, status, parent_product_id, track_stock, sale_mode
 *   ('unit' | 'weight' | 'measure'), qty_decimals (0..3), min_sale_qty (NULL-able).
 * - product_prices: id, product_id, price, effective_from (NOT NULL), effective_to (NULL-able).
 *   No tiene organization_id: se filtra por ids de productos que ya son de la organización.
 * - product_modifier_groups: id, organization_id, product_id, name, selection_mode, max_selections,
 *   required (NOT NULL), min_selections (NOT NULL) — verificadas el 2026-10-06.
 * - product_modifiers: id, group_id, name, extra_price (NOT NULL, default 0), is_active.
 * - fn_precios_vigentes_lote(p_organization_id, p_branch_id, p_product_ids, p_at, p_heredar_padre)
 *   → (product_id, precio, precio_comparacion, origen, origen_product_id, origen_id). STABLE,
 *   SECURITY INVOKER, filtra por p_organization_id (MCP, 2026-10-06).
 *
 * Tres consultas por pedido (cuatro con sede de carta), independientes del tamaño del catálogo.
 * El cliente es el del servidor (service role, sin RLS): cada consulta filtra por organización o
 * por ids ya filtrados.
 */

import { SELECT_PADRE_ESTADO } from '@/lib/products/visibilidad-web'
import type { DatosPrecio, FilaPrecio, FilaProductoPrecio, GrupoModificadores, PrecioSede } from '@/lib/products/precio-servidor'

export const SELECT_PRODUCTO_PRECIO =
  `id, organization_id, name, sku, status, parent_product_id, track_stock, sale_mode, qty_decimals, min_sale_qty, ${SELECT_PADRE_ESTADO}`
export const SELECT_PRECIO_VIGENTE = 'id, product_id, price, effective_from, effective_to'
export const SELECT_GRUPOS_MODIFICADORES =
  'id, product_id, name, selection_mode, max_selections, required, min_selections, product_modifiers ( id, name, extra_price, is_active )'

/** Orígenes de `fn_precios_vigentes_lote` que son precio de la sede (el resto es la regla general). */
export const ORIGENES_PRECIO_SEDE = ['sede', 'padre_sede'] as const

export interface FilaPrecioLote {
  product_id: number
  precio: number | string | null
  precio_comparacion: number | string | null
  origen: string | null
}

/** Filas de la RPC → mapa solo con los precios de sede (puro: lo comparte el listado). */
export function preciosSedeDeLote(filas: FilaPrecioLote[] | null | undefined): Map<number, PrecioSede> {
  const mapa = new Map<number, PrecioSede>()
  for (const f of filas || []) {
    if (!f || !(ORIGENES_PRECIO_SEDE as readonly string[]).includes(String(f.origen))) continue
    const precio = Number(f.precio)
    if (f.precio === null || !Number.isFinite(precio) || precio < 0) continue
    const comp = f.precio_comparacion === null || f.precio_comparacion === undefined ? null : Number(f.precio_comparacion)
    mapa.set(Number(f.product_id), { precio, comparacion: comp !== null && Number.isFinite(comp) ? comp : null })
  }
  return mapa
}

/**
 * Precios de sede de una lista de productos con la RPC del ERP (una llamada por lote de ids).
 * Falla abierto a «sin precio de sede» (`ok: false`): quien llama sigue con la regla general y,
 * si el cliente vio el precio de la sede, el 409 PRECIOS_CAMBIARON se lo muestra antes de cobrar.
 */
export async function leerPreciosSede(
  supabase: any,
  organizationId: number,
  branchId: number,
  productIds: number[],
): Promise<{ ok: true; precios: Map<number, PrecioSede> } | { ok: false; error: string }> {
  const ids = Array.from(new Set(productIds.filter((id) => Number.isInteger(id) && id > 0)))
  const precios = new Map<number, PrecioSede>()
  for (const lote of trozos(ids, 500)) {
    const { data, error } = await supabase.rpc('fn_precios_vigentes_lote', {
      p_organization_id: organizationId,
      p_branch_id: branchId,
      p_product_ids: lote,
      p_heredar_padre: true,
    })
    if (error) return { ok: false, error: error.message || String(error) }
    preciosSedeDeLote(data as FilaPrecioLote[]).forEach((v, k) => precios.set(k, v))
  }
  return { ok: true, precios }
}

/** Máximo de ids por `.in()` (misma cota que la carta por sede). */
const IDS_POR_CONSULTA = 200

function trozos<T>(lista: T[], n: number): T[][] {
  const r: T[][] = []
  for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n))
  return r
}

export type ResultadoLecturaPrecio = { ok: true; datos: DatosPrecio } | { ok: false; error: string }

/**
 * `sedeCarta`: sede cuya carta y precios aplican al pedido (`resolverSedeCarta` de
 * lib/products/carta-sede.ts, con la organización del host). Sin ella, sin precios de sede:
 * exactamente el comportamiento anterior.
 */
export async function leerDatosPrecio(
  supabase: any,
  organizationId: number,
  productIds: number[],
  sedeCarta?: number | null,
): Promise<ResultadoLecturaPrecio> {
  const ids = Array.from(new Set(productIds.filter((id) => Number.isInteger(id) && id > 0)))
  const datos: DatosPrecio = { productos: new Map(), precios: new Map(), grupos: new Map() }
  if (ids.length === 0) return { ok: true, datos }

  for (const lote of trozos(ids, IDS_POR_CONSULTA)) {
    const { data, error } = await supabase
      .from('products')
      .select(SELECT_PRODUCTO_PRECIO)
      .eq('organization_id', organizationId)
      .in('id', lote)
    if (error) return { ok: false, error: `products: ${error.message || String(error)}` }
    for (const p of (data || []) as FilaProductoPrecio[]) datos.productos.set(Number(p.id), p)
  }

  // Precios de los productos y de los padres de las variantes (precio de respaldo del padre).
  const idsPrecio = new Set<number>(datos.productos.keys())
  datos.productos.forEach((p) => {
    if (p.parent_product_id != null) idsPrecio.add(Number(p.parent_product_id))
  })
  for (const lote of trozos(Array.from(idsPrecio), IDS_POR_CONSULTA)) {
    const { data, error } = await supabase
      .from('product_prices')
      .select(SELECT_PRECIO_VIGENTE)
      .in('product_id', lote)
      .is('effective_to', null)
    if (error) return { ok: false, error: `product_prices: ${error.message || String(error)}` }
    for (const f of (data || []) as FilaPrecio[]) {
      const pid = Number(f.product_id)
      const lista = datos.precios.get(pid) || []
      lista.push(f)
      datos.precios.set(pid, lista)
    }
  }

  // Grupos de los productos y de los padres de las variantes (herencia, ver modificadores.ts).
  for (const lote of trozos(Array.from(idsPrecio), IDS_POR_CONSULTA)) {
    const { data, error } = await supabase
      .from('product_modifier_groups')
      .select(SELECT_GRUPOS_MODIFICADORES)
      .eq('organization_id', organizationId)
      .in('product_id', lote)
    if (error) return { ok: false, error: `product_modifier_groups: ${error.message || String(error)}` }
    for (const g of (data || []) as GrupoModificadores[]) {
      const pid = Number(g.product_id)
      const lista = datos.grupos.get(pid) || []
      lista.push(g)
      datos.grupos.set(pid, lista)
    }
  }

  if (typeof sedeCarta === 'number' && Number.isInteger(sedeCarta) && sedeCarta > 0 && datos.productos.size > 0) {
    const r = await leerPreciosSede(supabase, organizationId, sedeCarta, Array.from(datos.productos.keys()))
    if (r.ok) {
      datos.preciosSede = r.precios
    } else {
      console.error('[precio-servidor] fn_precios_vigentes_lote falló; se cobra sin precio de sede', {
        organizationId, sedeCarta, error: r.error,
      })
    }
  }

  return { ok: true, datos }
}
