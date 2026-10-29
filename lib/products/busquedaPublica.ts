/**
 * Búsqueda pública de productos por texto y categoría (página /search y filtro opcional de
 * /api/products/search). Recibe el cliente de Supabase para poder probarse sin red.
 *
 * Visibilidad: la misma del listado de categorías (getOrdenListadoCategoria): producto activo,
 * sin variantes sueltas, categoría activa visible para la sede (`branch_id` nulo o el de la sede),
 * sin los ocultos de la carta de la sede y con precio vigente.
 */
import { excluirNoListados, idsNoListados, type CartaSede } from './carta-sede'

/** Tope de ids por búsqueda (una sola página de PostgREST). */
export const TOPE_IDS_BUSQUEDA = 1000
/** Profundidad máxima de subcategorías que se incluyen bajo la categoría filtrada. */
const PROFUNDIDAD_SUBCATEGORIAS = 4

/** Texto apto para `ilike` dentro de un `.or()` de PostgREST (sin comas, paréntesis ni comodines). */
export function limpiarTextoBusqueda(q: string | null | undefined): string {
  return (q ?? '').replace(/[%_*,()\\"'.:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** Slug de categoría válido o null. */
export function limpiarSlugCategoria(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim()
  return s && s.length <= 120 && /^[\p{L}\p{N}_-]+$/u.test(s) ? s : null
}

function filtroSede<Q extends { is: (...a: any[]) => Q; or: (...a: any[]) => Q }>(query: Q, branchId: number | null | undefined): Q {
  if (branchId === null) return query.is('branch_id', null)
  if (typeof branchId === 'number') return query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  return query
}

/**
 * Ids de la categoría `slug` y de todas sus subcategorías activas visibles para la sede.
 * `null` si la categoría no existe o no es visible (quien llama responde sin resultados).
 */
export async function idsCategoriaConSubcategorias(
  supabase: any,
  organizationId: number,
  slug: string,
  branchId: number | null | undefined,
): Promise<number[] | null> {
  const { data: cat, error } = await filtroSede(
    supabase.from('categories').select('id').eq('organization_id', organizationId).eq('slug', slug).eq('is_active', true),
    branchId,
  ).limit(1).maybeSingle()
  if (error || !cat) return null
  const ids = [Number(cat.id)]
  let nivel = [Number(cat.id)]
  for (let i = 0; i < PROFUNDIDAD_SUBCATEGORIAS && nivel.length > 0; i += 1) {
    const { data: hijos, error: errorHijos } = await filtroSede(
      supabase.from('categories').select('id').eq('organization_id', organizationId).in('parent_id', nivel).eq('is_active', true),
      branchId,
    )
    if (errorHijos) break
    nivel = ((hijos || []) as { id: number }[]).map((h) => Number(h.id)).filter((id) => !ids.includes(id))
    ids.push(...nivel)
  }
  return ids
}

/** Intersección de la lista de la categoría con las permitidas para la sede (`null` = sin filtro). */
export function intersectarCategorias(permitidas: number[] | null, filtro: number[] | null): number[] | null {
  if (filtro === null) return permitidas
  if (permitidas === null) return filtro
  const set = new Set(permitidas)
  return filtro.filter((id) => set.has(id))
}

/** Ids con un precio vigente (`effective_to` nulo), por lotes. */
async function idsConPrecio(supabase: any, ids: number[]): Promise<Set<number>> {
  const vigentes = new Set<number>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('product_prices')
      .select('product_id')
      .in('product_id', ids.slice(i, i + 150))
      .is('effective_to', null)
      .limit(TOPE_IDS_BUSQUEDA)
    if (error) throw new Error(error.message || 'product_prices')
    for (const fila of data || []) vigentes.add(Number((fila as { product_id: number }).product_id))
  }
  return vigentes
}

export type OrdenBusqueda = 'best_selling' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest'

/**
 * Ids de productos visibles que coinciden con `q` (nombre, descripción o SKU), opcionalmente
 * dentro de `categoryIds`. Sin `q` y con categorías, lista la categoría entera. Sin ambos, [].
 */
export async function buscarIdsProductos(
  supabase: any,
  organizationId: number,
  opciones: {
    q: string
    categoryIds: number[] | null
    carta: CartaSede | null
    sort?: OrdenBusqueda
  },
): Promise<number[]> {
  const q = limpiarTextoBusqueda(opciones.q)
  const { categoryIds, carta } = opciones
  if (!q && !categoryIds) return []
  if (categoryIds && categoryIds.length === 0) return []
  let consulta = supabase
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('parent_product_id', null)
  if (categoryIds) consulta = consulta.in('category_id', categoryIds)
  if (q) consulta = consulta.or(`name.ilike.%${q}%,description.ilike.%${q}%,sku.ilike.%${q}%`)
  consulta = excluirNoListados(consulta, carta)
  const sort = opciones.sort ?? 'best_selling'
  consulta = sort === 'name_desc'
    ? consulta.order('name', { ascending: false }).order('id', { ascending: false })
    : sort === 'newest'
      ? consulta.order('created_at', { ascending: false }).order('id', { ascending: false })
      : consulta.order('name', { ascending: true }).order('id', { ascending: true })
  const { data, error } = await consulta.limit(TOPE_IDS_BUSQUEDA)
  if (error) throw new Error(error.message || 'products')
  const ocultos = new Set(idsNoListados(carta))
  const ids: number[] = []
  const vistos = new Set<number>()
  for (const fila of (data || []) as { id: number }[]) {
    const id = Number(fila.id)
    if (!ocultos.has(id) && !vistos.has(id)) { vistos.add(id); ids.push(id) }
  }
  if (ids.length === 0) return []
  const conPrecio = await idsConPrecio(supabase, ids)
  return ids.filter((id) => conPrecio.has(id))
}
