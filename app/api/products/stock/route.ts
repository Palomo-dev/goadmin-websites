import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Disponible (en mano − reservado) de los productos del carrito.
 * La organización sale del host. Los ids vienen de la query y se cruzan con esa organización.
 */
export async function GET(request: NextRequest) {
  const orgId = await getOrgIdDelHost()
  if (!orgId) return NextResponse.json({ stock: {} })

  const crudo = new URL(request.url).searchParams.get('ids') ?? ''
  const ids = [...new Set(
    crudo.split(',').map((parte) => Number(parte)).filter((n) => Number.isInteger(n) && n > 0),
  )].slice(0, 40)
  if (ids.length === 0) return NextResponse.json({ stock: {} })

  const supabase = createAdminClient() || createPublicClient()
  if (!supabase) return NextResponse.json({ stock: {} })

  const { data: propios } = await supabase.from('products').select('id').eq('organization_id', orgId).in('id', ids)
  const idsOk = ((propios ?? []) as { id: number }[]).map((fila) => fila.id)
  if (idsOk.length === 0) return NextResponse.json({ stock: {} })

  const { data } = await supabase
    .from('stock_levels')
    .select('product_id, qty_on_hand, qty_reserved')
    .in('product_id', idsOk)

  const stock: Record<string, number> = {}
  for (const fila of (data ?? []) as { product_id: number; qty_on_hand: number | null; qty_reserved: number | null }[]) {
    const id = String(fila.product_id)
    const disponible = Number(fila.qty_on_hand ?? 0) - Number(fila.qty_reserved ?? 0)
    stock[id] = (stock[id] ?? 0) + (Number.isFinite(disponible) ? disponible : 0)
  }
  return NextResponse.json({ stock }, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
