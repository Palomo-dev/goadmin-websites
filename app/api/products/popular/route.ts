import { NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { terminosOCategorias, type FilaPopular } from '@/lib/products/populares'

export const dynamic = 'force-dynamic'

/**
 * Sugerencias del buscador. La organización sale del host, nunca de la query.
 */
export async function GET() {
  const orgId = await getOrgIdDelHost()
  if (!orgId) return NextResponse.json({ terms: [] })

  const supabase = createAdminClient() || createPublicClient()
  if (!supabase) return NextResponse.json({ terms: [] })

  // El tipo escrito a mano no declara la relación con web_orders. El filtro de
  // organización va en el join, igual que el conteo de ventas del catálogo.
  const { data: ventas } = await (supabase as any)
    .from('web_order_items')
    .select('product_name, quantity, status, web_orders!inner(status, organization_id)')
    .eq('web_orders.organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(400)

  const filas: FilaPopular[] = ((ventas ?? []) as { product_name?: string | null; quantity?: number | null; status?: string | null; web_orders?: { status?: string | null } | { status?: string | null }[] | null }[]).map((fila) => {
    const pedido = fila.web_orders as { status?: string | null } | { status?: string | null }[] | null
    const orden = Array.isArray(pedido) ? pedido[0] : pedido
    return {
      product_name: fila.product_name,
      quantity: fila.quantity,
      status: fila.status,
      order_status: orden?.status ?? null,
    }
  })

  let categorias: string[] = []
  if (terminosOCategorias(filas, []).length === 0) {
    const { data } = await supabase
      .from('categories')
      .select('name')
      .eq('organization_id', orgId)
      .order('name')
      .limit(12)
    categorias = ((data ?? []) as { name?: string | null }[])
      .map((fila) => fila.name)
      .filter((nombre): nombre is string => typeof nombre === 'string')
  }

  const terms = terminosOCategorias(filas, categorias)
  return NextResponse.json(
    { terms },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' } },
  )
}
