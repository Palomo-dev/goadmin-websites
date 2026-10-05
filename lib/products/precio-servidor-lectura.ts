/**
 * Lectura de la base para `precio-servidor.ts`: productos, precios vigentes y modificadores de las
 * líneas de un pedido, siempre acotada a la organización del host.
 *
 * Columnas verificadas por MCP el 2026-10-05:
 * - products: id, organization_id, name, sku, status, parent_product_id, track_stock, sale_mode
 *   ('unit' | 'weight' | 'measure'), qty_decimals (0..3), min_sale_qty (NULL-able).
 * - product_prices: id, product_id, price, effective_from (NOT NULL), effective_to (NULL-able).
 *   No tiene organization_id: se filtra por ids de productos que ya son de la organización.
 * - product_modifier_groups: id, organization_id, product_id, name, selection_mode, max_selections.
 * - product_modifiers: id, group_id, name, extra_price (NOT NULL, default 0), is_active.
 *
 * Tres consultas por pedido, independientes del tamaño del catálogo. El cliente es el del
 * servidor (service role, sin RLS): cada consulta filtra por organización o por ids ya filtrados.
 */

import { SELECT_PADRE_ESTADO } from '@/lib/products/visibilidad-web'
import type { DatosPrecio, FilaPrecio, FilaProductoPrecio, GrupoModificadores } from '@/lib/products/precio-servidor'

export const SELECT_PRODUCTO_PRECIO =
  `id, organization_id, name, sku, status, parent_product_id, track_stock, sale_mode, qty_decimals, min_sale_qty, ${SELECT_PADRE_ESTADO}`
export const SELECT_PRECIO_VIGENTE = 'id, product_id, price, effective_from, effective_to'
export const SELECT_GRUPOS_MODIFICADORES =
  'id, product_id, name, selection_mode, max_selections, product_modifiers ( id, name, extra_price, is_active )'

/** Máximo de ids por `.in()` (misma cota que la carta por sede). */
const IDS_POR_CONSULTA = 200

function trozos<T>(lista: T[], n: number): T[][] {
  const r: T[][] = []
  for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n))
  return r
}

export type ResultadoLecturaPrecio = { ok: true; datos: DatosPrecio } | { ok: false; error: string }

export async function leerDatosPrecio(
  supabase: any,
  organizationId: number,
  productIds: number[],
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

  for (const lote of trozos(Array.from(datos.productos.keys()), IDS_POR_CONSULTA)) {
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

  return { ok: true, datos }
}
