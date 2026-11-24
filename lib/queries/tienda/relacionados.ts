/**
 * Productos relacionados de la ficha: «Elegidos a mano» y «Comprados juntos» (Figma «16 Sitio
 * web» 2988:73769, aprobado por el dueño el 2026-11-24).
 *
 * - Elegidos a mano: `product_relations` (`kind` `related` o `bought_together`, en su `position`).
 *   Se eligen en el ERP, Inventario › Producto › Tienda.
 * - Comprados juntos calculado: RPC `fn_comprados_juntos(org, producto, días, límite)`, que cuenta
 *   los productos vendidos en la misma venta en los últimos 90 días (variantes = su padre), acotada
 *   en la base a 500 ventas y 24 filas.
 *
 * Rendimiento (incidente 2026-09-14): la página solo llama aquí si la sección `related_products`
 * los pide (fuente «Elegidos a mano» o «Comprados juntos», o estilo «Comprados juntos») o en el
 * lienzo del editor. Una vez por render (`react.cache`) y con la caché del catálogo por
 * organización (`cacheCatalog`, TTL corto y etiqueta `catalogo-<org>`). Tres consultas como
 * máximo: relaciones, RPC y UNA lectura de productos para todos los ids.
 *
 * Multi-tenant: `organization_id` sale del contexto de la página, nunca del contenido.
 *
 * Columnas verificadas por MCP (proyecto taqjemqjtumhwptchcxk, 2026-11-24):
 * `product_relations(organization_id, product_id, related_product_id, kind, position)` y
 * `fn_comprados_juntos` → `(product_id integer, veces integer)`.
 */

import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog } from '@/lib/supabase/cache'
import { countVariantsByParent, getCartaSedeParaListado, getWebStockBranchIds, normalizeProductPrices } from '@/lib/supabase/queries'
import { getAllowedCategoryIds } from '@/lib/outlet/catalog-helpers'
import { filterStockByBranches } from '@/lib/stock'
import { aplicarCartaSede } from '@/lib/products/carta-sede'
import { SELECT_PRODUCTOS_LOOK } from '@/lib/queries/tienda/look'

export const SELECT_RELACIONES_FICHA = 'related_product_id, kind, position'
/** Días de ventas que cuenta «Comprados juntos» (Figma: «los pedidos de los últimos 90 días»). */
export const DIAS_COMPRADOS_JUNTOS = 90
const MAX_POR_LISTA = 12

export interface RelacionadosFicha {
  manuales: any[]
  juntosManuales: any[]
  juntosCalculados: any[]
}

const VACIO: RelacionadosFicha = { manuales: [], juntosManuales: [], juntosCalculados: [] }

async function getRelacionadosFichaUncached(
  organizationId: number,
  productId: number,
  conJuntos: boolean,
  branchId: number | null | undefined,
): Promise<RelacionadosFicha> {
  const supabase = createAdminClient() || createPublicClient()

  const [{ data: relaciones, error: errorRel }, calculo] = await Promise.all([
    (supabase as any)
      .from('product_relations')
      .select(SELECT_RELACIONES_FICHA)
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
      .order('position', { ascending: true })
      .limit(MAX_POR_LISTA * 2),
    conJuntos
      ? (supabase as any).rpc('fn_comprados_juntos', {
          p_organization_id: organizationId,
          p_product_id: productId,
          p_dias: DIAS_COMPRADOS_JUNTOS,
          p_limite: MAX_POR_LISTA,
        })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (errorRel) throw new Error(errorRel.message || 'product_relations')
  if (calculo.error) throw new Error(calculo.error.message || 'fn_comprados_juntos')

  const filas = (relaciones || []) as { related_product_id: number; kind: string }[]
  const idsManuales = filas.filter((r) => r.kind === 'related').map((r) => Number(r.related_product_id))
  const idsJuntosManuales = filas.filter((r) => r.kind === 'bought_together').map((r) => Number(r.related_product_id))
  const idsCalculados = ((calculo.data || []) as { product_id: number }[]).map((r) => Number(r.product_id))
  const todos = [...new Set([...idsManuales, ...idsJuntosManuales, ...idsCalculados])].filter((id) => id !== productId)
  if (todos.length === 0) return VACIO

  // Categorías del outlet (F3-R3): la misma regla que los relacionados de siempre.
  const allowedCategoryIds = Number.isFinite(branchId) ? await getAllowedCategoryIds(organizationId, branchId) : null
  if (allowedCategoryIds !== null && allowedCategoryIds.length === 0) return VACIO

  let consulta = (supabase as any)
    .from('products')
    .select(SELECT_PRODUCTOS_LOOK)
    .eq('product_images.archivo_disponible', true)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('parent_product_id', null)
    .in('id', todos)
    .limit(todos.length)
  if (allowedCategoryIds) consulta = consulta.in('category_id', allowedCategoryIds)
  const { data, error } = await consulta
  if (error) throw new Error(error.message || 'products')

  const stockBranchIds = branchId !== undefined && branchId !== null ? [branchId] : await getWebStockBranchIds(organizationId)
  const productos = aplicarCartaSede(
    filterStockByBranches(normalizeProductPrices((data || []) as any[]), stockBranchIds),
    await getCartaSedeParaListado(organizationId, branchId),
  )
  const padres = productos.filter((p: any) => p.is_parent).map((p: any) => p.id)
  if (padres.length > 0) {
    const conteo = await countVariantsByParent(supabase as any, padres)
    productos.forEach((p: any) => {
      if (p.is_parent) p.variant_count = conteo[p.id] || 0
    })
  }
  const porId = new Map<number, any>(productos.map((p: any) => [Number(p.id), p]))
  const enOrden = (ids: number[]) => ids.map((id) => porId.get(id)).filter(Boolean).slice(0, MAX_POR_LISTA)
  return {
    manuales: enOrden(idsManuales),
    juntosManuales: enOrden(idsJuntosManuales),
    juntosCalculados: enOrden(idsCalculados),
  }
}

const getRelacionadosFichaCacheado = cacheCatalog('getRelacionadosFicha', getRelacionadosFichaUncached, (...args) => args[0])

/** Elegidos a mano y comprados juntos de la ficha. Nunca lanza: con error, listas vacías. */
export const getRelacionadosFicha = cache(async (
  organizationId: number,
  productId: number,
  conJuntos: boolean,
  branchId: number | null | undefined,
): Promise<RelacionadosFicha> => {
  try {
    return await getRelacionadosFichaCacheado(organizationId, productId, conJuntos, branchId)
  } catch (error) {
    console.error('[tienda/relacionados] getRelacionadosFicha', {
      organizationId,
      productId,
      error: error instanceof Error ? error.message : String(error),
    })
    return VACIO
  }
})
