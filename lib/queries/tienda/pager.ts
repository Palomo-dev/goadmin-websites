/**
 * «Anterior y siguiente» de la ficha (`product_pager · default`, plantilla de tienda Hogar).
 *
 * El orden es el de la página de la categoría del producto con su orden por defecto
 * (`getOrdenListadoCategoria(org, categoría, 'best_selling', null, sede)`, ya cacheado y el mismo
 * que ve el cliente en `/categorias/<slug>`). Sin vuelta: el primero no tiene anterior.
 *
 * Rendimiento: solo se consulta si la plantilla de ficha trae el bloque visible (lo decide
 * `app/productos/[id]/page.tsx`), una vez por render (`react.cache`) y con la caché del catálogo
 * por organización. Además del orden (cacheado), una sola lectura de 2 filas (nombre y uuid).
 *
 * Columnas verificadas por MCP (proyecto taqjemqjtumhwptchcxk, 2026-11-07): `products.id`,
 * `uuid`, `name`, `organization_id`, `status`. `scripts/verify-ficha-plantilla.mjs` lee el select.
 */

import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog } from '@/lib/supabase/cache'
import { getOrdenListadoCategoria } from '@/lib/supabase/queries'
import { vecinosEnOrden, type PaginadorFichaDatos, type VecinoFicha } from '@/components/sections/product-detail/fichaTienda'

export const SELECT_VECINOS_FICHA = 'id, uuid, name'

async function getPaginadorFichaUncached(
  organizationId: number,
  categoryId: number,
  productId: number,
  branchId: number | null,
): Promise<PaginadorFichaDatos | null> {
  const ids = await getOrdenListadoCategoria(organizationId, categoryId, 'best_selling', null, branchId)
  const { anteriorId, siguienteId } = vecinosEnOrden(ids, productId)
  const buscados = [anteriorId, siguienteId].filter((id): id is number => id !== null)
  if (buscados.length === 0) return null

  const supabase = createAdminClient() || createPublicClient()
  const { data, error } = await (supabase as any)
    .from('products')
    .select(SELECT_VECINOS_FICHA)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('id', buscados)
  if (error) throw new Error(error.message || 'products')
  const porId = new Map<number, VecinoFicha>(
    ((data || []) as { id: number; uuid: string | null; name: string | null }[])
      .filter((p) => p.uuid && p.name)
      .map((p) => [Number(p.id), { uuid: String(p.uuid), name: String(p.name) }]),
  )
  const anterior = anteriorId !== null ? porId.get(anteriorId) ?? null : null
  const siguiente = siguienteId !== null ? porId.get(siguienteId) ?? null : null
  return anterior || siguiente ? { anterior, siguiente } : null
}

const getPaginadorFichaCacheado = cacheCatalog('getPaginadorFicha', getPaginadorFichaUncached, (...args) => args[0])

/** Vecinos del producto en su categoría. Nunca lanza: con error o sin vecinos, `null`. */
export const getPaginadorFicha = cache(async (
  organizationId: number,
  categoryId: number | null | undefined,
  productId: number,
  branchId: number | null | undefined,
): Promise<PaginadorFichaDatos | null> => {
  if (!Number.isInteger(categoryId) || (categoryId as number) <= 0) return null
  try {
    return await getPaginadorFichaCacheado(organizationId, categoryId as number, productId, branchId ?? null)
  } catch (error) {
    console.error('[tienda/pager] getPaginadorFicha', {
      organizationId,
      productId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
})
