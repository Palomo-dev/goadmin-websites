/**
 * Precarga de la portada de las plantillas de tienda (paquete W5). La llama
 * `app/[[...slug]]/page.tsx` con las secciones de la página y el `data` que ya armó.
 *
 * Sin secciones nuevas (toda página de hoy) no hace NADA: `necesidadesPortadaTienda` sale vacío
 * y se devuelve sin consultar. Con ellas, solo lo que la página pide y todo cacheado:
 * - `data.resumenResenas[fuente]`: `getResumenResenas` (una lectura cacheada por organización y
 *   fuente).
 * - `data.categories`: solo si la página aún no las cargó (la misma `getOrganizationCategories`
 *   cacheada de siempre).
 * - `data.productosPortada`: los productos que nombra la portada, por id
 *   (`getProductsByIdsCatalog`, caché del catálogo), y solo los que no vinieron ya en
 *   `data.products`. Sin ids (`split_products` vacío) y sin listado general, los primeros 12 del
 *   listado (`getOrganizationProducts`, la misma consulta cacheada del grid, con tope corto).
 *
 * Nada de esto toca carrito, precios del checkout ni pedidos: son lecturas para pintar.
 */

import { getOrganizationCategories, getOrganizationProducts, getProductsByIdsCatalog } from '@/lib/supabase/queries'
import { necesidadesPortadaTienda, pidePortadaTienda, type ResumenesPorFuente, type SeccionParaPortada } from '@/lib/website/portadaTienda'
import { getResumenResenas } from './resenas'

/** Tope del listado de respaldo de `split_products` (pinta 3; el resto da margen a las sin foto). */
const PRIMEROS_PORTADA = 12

export async function precargarPortadaTienda(
  organizationId: number,
  branchId: number | null | undefined,
  secciones: readonly SeccionParaPortada[] | null | undefined,
  data: Record<string, any>,
): Promise<void> {
  const n = necesidadesPortadaTienda(secciones)
  if (!pidePortadaTienda(n)) return

  const cargados = new Set<number>(
    Array.isArray(data.products) ? (data.products as { id?: unknown }[]).map((p) => Number(p?.id)).filter(Number.isInteger) : [],
  )
  const faltan = n.idsProductos.filter((id) => !cargados.has(id)).sort((a, b) => a - b)

  const [resumenes, categorias, porId, primeros] = await Promise.all([
    Promise.all(n.resumenes.map(async (f) => [f, await getResumenResenas(organizationId, f)] as const)),
    n.categorias && !data.categories ? getOrganizationCategories(organizationId, branchId) : Promise.resolve(null),
    faltan.length > 0 ? getProductsByIdsCatalog(faltan, organizationId, branchId) : Promise.resolve(null),
    n.primerosProductos && !Array.isArray(data.products) ? getOrganizationProducts(organizationId, PRIMEROS_PORTADA, branchId) : Promise.resolve(null),
  ])

  if (resumenes.length > 0) {
    const mapa: ResumenesPorFuente = {}
    for (const [f, r] of resumenes) mapa[f] = r
    data.resumenResenas = mapa
  }
  if (categorias) data.categories = categorias
  const extra = [...(Array.isArray(porId) ? porId : []), ...(Array.isArray(primeros) ? primeros : [])]
  if (extra.length > 0) data.productosPortada = extra
}
