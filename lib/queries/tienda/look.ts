/**
 * «Completa el look» (`complete_the_look · default`, plantillas de tienda Atelier y Marea):
 * productos que se llevan con el de la ficha.
 *
 * Rendimiento (incidente 2026-09-14): solo se consulta cuando la plantilla de ficha trae el bloque
 * visible (lo decide `app/productos/[id]/page.tsx`), una vez por render (`react.cache`) y con la
 * caché del catálogo por organización (`cacheCatalog`: TTL corto y etiqueta `catalogo-<org>`).
 *
 * Multi-tenant: `organization_id` sale del contexto de la página, nunca del contenido del bloque.
 * Los `product_ids` del bloque (fuente `manual`) se filtran por la organización igual que el resto.
 *
 * Columnas verificadas por MCP (proyecto taqjemqjtumhwptchcxk, 2026-11-07):
 * - `product_tag_relations(product_id, tag_id)` con FK a `products` y `product_tags`.
 * - `product_tags(id, organization_id, name, kind)`; `products.tag_id` con FK a `product_tags`.
 * - Las columnas del select de productos son las de los relacionados de la ficha.
 * `scripts/verify-ficha-plantilla.mjs` lee estos `select` y los compara con el esquema.
 */

import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog } from '@/lib/supabase/cache'
import { countVariantsByParent, getCartaSedeParaListado, getWebStockBranchIds, normalizeProductPrices } from '@/lib/supabase/queries'
import { getAllowedCategoryIds } from '@/lib/outlet/catalog-helpers'
import { filterStockByBranches } from '@/lib/stock'
import { aplicarCartaSede } from '@/lib/products/carta-sede'
import { etiquetaCombinable } from '@/components/sections/product-detail/fichaTienda'

/** Lo mismo que piden los relacionados de la ficha (ProductCard), más `sku` («Agregar todo»). */
export const SELECT_PRODUCTOS_LOOK = `
    id, uuid, name, sku, is_parent, track_stock,
    product_prices (id, price, compare_price, effective_to),
    product_images (
      id, storage_path, is_primary, display_order,
      shared_image_id,
      shared_images ( storage_path )
    ),
    stock_levels ( branch_id, qty_on_hand, qty_reserved )
  `

export const SELECT_ETIQUETAS_LOOK = 'tag_id, product_tags ( kind )'
export const SELECT_RELACIONES_LOOK = 'product_id'

/** Tope de relaciones que se leen por etiqueta (luego se recorta al `limit` del bloque). */
const MAX_RELACIONES = 200

export interface PedidoLook {
  /** `tag` = comparten etiqueta con el producto; `manual` = `productIds`. */
  source: 'tag' | 'manual'
  productIds: number[]
  limit: number
}

async function getCompletaElLookUncached(
  organizationId: number,
  productId: number,
  tagIdProducto: number | null,
  pedido: PedidoLook,
  branchId: number | null | undefined,
): Promise<any[]> {
  const supabase = createAdminClient() || createPublicClient()
  const limit = Math.max(1, Math.min(8, pedido.limit))

  // Categorías del outlet (F3-R3): la misma regla que los relacionados.
  const allowedCategoryIds = Number.isFinite(branchId) ? await getAllowedCategoryIds(organizationId, branchId) : null
  if (allowedCategoryIds !== null && allowedCategoryIds.length === 0) return []

  let base = (supabase as any)
    .from('products')
    .select(SELECT_PRODUCTOS_LOOK)
    .eq('product_images.archivo_disponible', true)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('parent_product_id', null)
    .neq('id', productId)
  if (allowedCategoryIds) base = base.in('category_id', allowedCategoryIds)

  let filas: any[] = []
  if (pedido.source === 'manual') {
    if (pedido.productIds.length === 0) return []
    const { data, error } = await base.in('id', pedido.productIds).limit(pedido.productIds.length)
    if (error) throw new Error(error.message || 'products')
    // El orden lo eligió el dueño.
    const porId = new Map<number, any>((data || []).map((p: any) => [Number(p.id), p]))
    filas = pedido.productIds.map((id) => porId.get(id)).filter(Boolean)
  } else {
    // Etiquetas del producto: `products.tag_id` (la de los relacionados) y las combinables de
    // `product_tag_relations` (sin dieta, alérgeno ni picante: describen, no combinan).
    const { data: propias, error: errorPropias } = await (supabase as any)
      .from('product_tag_relations')
      .select(SELECT_ETIQUETAS_LOOK)
      .eq('product_id', productId)
    if (errorPropias) throw new Error(errorPropias.message || 'product_tag_relations')
    const etiquetas = new Set<number>()
    if (Number.isInteger(tagIdProducto) && (tagIdProducto as number) > 0) etiquetas.add(tagIdProducto as number)
    for (const r of (propias || []) as { tag_id: number; product_tags?: { kind?: string | null } | null }[]) {
      if (etiquetaCombinable(r.product_tags?.kind)) etiquetas.add(Number(r.tag_id))
    }
    if (etiquetas.size === 0) return []
    const listaEtiquetas = [...etiquetas]

    const { data: relaciones, error: errorRel } = await (supabase as any)
      .from('product_tag_relations')
      .select(SELECT_RELACIONES_LOOK)
      .in('tag_id', listaEtiquetas)
      .neq('product_id', productId)
      .limit(MAX_RELACIONES)
    if (errorRel) throw new Error(errorRel.message || 'product_tag_relations')
    const idsRelacion = [...new Set(((relaciones || []) as { product_id: number }[]).map((r) => Number(r.product_id)))]

    const filtro = idsRelacion.length > 0
      ? `tag_id.in.(${listaEtiquetas.join(',')}),id.in.(${idsRelacion.join(',')})`
      : `tag_id.in.(${listaEtiquetas.join(',')})`
    const { data, error } = await base.or(filtro).order('id', { ascending: true }).limit(limit)
    if (error) throw new Error(error.message || 'products')
    filas = data || []
  }
  if (filas.length === 0) return []

  const stockBranchIds = branchId !== undefined && branchId !== null ? [branchId] : await getWebStockBranchIds(organizationId)
  const productos = aplicarCartaSede(
    filterStockByBranches(normalizeProductPrices(filas), stockBranchIds),
    await getCartaSedeParaListado(organizationId, branchId),
  ).slice(0, limit)

  // ProductCard muestra «Elegir» en los padres con variantes.
  const padres = productos.filter((p: any) => p.is_parent).map((p: any) => p.id)
  if (padres.length > 0) {
    const conteo = await countVariantsByParent(supabase as any, padres)
    productos.forEach((p: any) => {
      if (p.is_parent) p.variant_count = conteo[p.id] || 0
    })
  }
  return productos
}

const getCompletaElLookCacheado = cacheCatalog('getCompletaElLook', getCompletaElLookUncached, (...args) => args[0])

/**
 * Productos de «Completa el look». Nunca lanza: con error, `[]` y el bloque no se pinta.
 */
export const getCompletaElLook = cache(async (
  organizationId: number,
  productId: number,
  tagIdProducto: number | null,
  source: PedidoLook['source'],
  productIds: number[],
  limit: number,
  branchId: number | null | undefined,
): Promise<any[]> => {
  try {
    return await getCompletaElLookCacheado(organizationId, productId, tagIdProducto, { source, productIds, limit }, branchId)
  } catch (error) {
    console.error('[tienda/look] getCompletaElLook', {
      organizationId,
      productId,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
})
