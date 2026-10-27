import { NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { sedeDeLaPeticion } from '@/lib/catalogo/sedeDeLaPeticion'
import { getListadoSeccion, getOrganizationCategories } from '@/lib/supabase/queries'
import { pedidoServidor } from '@/lib/products/fuenteListado'

/**
 * Página siguiente del listado de una sección. La organización sale del host.
 */
export async function POST(request: Request) {
  const orgId = await getOrgIdDelHost()
  if (!orgId) return NextResponse.json({ error: 'sitio no encontrado' }, { status: 404 })
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'json' }, { status: 400 })
  }
  if ('organization_id' in body && Number(body.organization_id) !== orgId) {
    return NextResponse.json({ error: 'organización distinta' }, { status: 403 })
  }
  const pedido = pedidoServidor(body)
  if (!pedido) return NextResponse.json({ products: [], total: 0 })
  if (typeof body.orden === 'string' && ['newest', 'price_asc', 'price_desc', 'name', 'sales', 'manual', 'default'].includes(body.orden)) {
    pedido.sort = body.orden
  }
  const categoria = Math.round(Number(body.categoria))
  const desde = Math.max(0, Math.round(Number(body.desde) || 0))
  const sede = await sedeDeLaPeticion(orgId)
  const categorias = await getOrganizationCategories(orgId, sede)
  const arbol = (categorias || []).map((c: { id: number; parent_id?: number | null }) => ({
    id: c.id,
    parent_id: c.parent_id ?? null,
  }))
  const lista = await getListadoSeccion(orgId, sede, pedido, arbol, desde, Number.isInteger(categoria) && categoria > 0 ? categoria : null)
  return NextResponse.json(lista)
}
