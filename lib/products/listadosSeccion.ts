import { getListadoSeccion, getOrganizationCategories } from '@/lib/supabase/queries'
import { pedidoServidor, type PedidoListado } from '@/lib/products/fuenteListado'

/**
 * Listados aparte de las secciones `products_grid` que piden fuente o tope.
 * Si ninguna lo pide, no hay consulta nueva.
 */
export async function listadosDeSecciones(
  organizationId: number,
  branchId: number | null | undefined,
  secciones: { id: string; section_type: string; content: unknown }[],
  categorias: { id: number; parent_id?: number | null }[] | undefined,
): Promise<Record<string, { products: any[]; total: number }> | undefined> {
  const pedidos: { id: string; pedido: PedidoListado }[] = []
  for (const s of secciones) {
    if (s.section_type !== 'products_grid') continue
    const pedido = pedidoServidor(s.content)
    if (pedido) pedidos.push({ id: s.id, pedido })
  }
  if (pedidos.length === 0) return undefined
  const cats = categorias ?? await getOrganizationCategories(organizationId, branchId)
  const arbol = (cats || []).map((c: { id: number; parent_id?: number | null }) => ({
    id: c.id,
    parent_id: c.parent_id ?? null,
  }))
  const out: Record<string, { products: any[]; total: number }> = {}
  for (const item of pedidos) {
    out[item.id] = await getListadoSeccion(organizationId, branchId, item.pedido, arbol, 0)
  }
  return out
}
