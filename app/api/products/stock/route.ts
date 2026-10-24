import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { getWebStockBranchIds } from '@/lib/supabase/queries'
import { getAvailableStock, type StockLevel } from '@/lib/stock'
import { SELECT_PADRE_ESTADO, esProductoVisibleEnWeb, type FilaProductoConPadre } from '@/lib/products/visibilidad-web'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ctx = await getOrgContext()
    if (!ctx) return NextResponse.json({ error: 'Sitio no encontrado' }, { status: 404 })
    const organizationId = searchParams.get('organizationId')
    const productIds = searchParams.get('productIds')

    if (organizationId !== null && Number(organizationId) !== ctx.organization.id) {
      return NextResponse.json({ error: 'Organización distinta al sitio' }, { status: 403 })
    }
    if (!productIds) return NextResponse.json({ error: 'Se requiere productIds' }, { status: 400 })
    const ids = [...new Set(productIds.split(',').map(Number))]
    if (ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return NextResponse.json({ error: 'Productos inválidos' }, { status: 400 })
    if (ids.length === 0) {
      return NextResponse.json({ data: {} })
    }

    const supabase = createAdminClient()
    if (!supabase) return NextResponse.json({ error: 'Inventario no disponible' }, { status: 503 })
    const branches = typeof ctx.branchId === 'number' ? [ctx.branchId] : await getWebStockBranchIds(ctx.organization.id)
    const { data, error } = await supabase.from('products')
      .select(`id,organization_id,status,parent_product_id,track_stock,stock_levels(branch_id,qty_on_hand,qty_reserved),${SELECT_PADRE_ESTADO}`)
      .eq('organization_id', ctx.organization.id)
      .eq('status', 'active')
      .in('id', ids)

    if (error) {
      console.error('Stock API error:', error)
      return NextResponse.json({ error: 'Inventario no disponible' }, { status: 503 })
    }

    const stockMap: Record<number, number | null> = {}
    for (const product of (data || []) as unknown as (FilaProductoConPadre & { id: number; track_stock: boolean; stock_levels: StockLevel[] })[]) {
      if (!esProductoVisibleEnWeb(product, ctx.organization.id)) continue
      const stock_levels = (product.stock_levels ?? []).filter((level) => branches === null || branches.includes(Number(level.branch_id)))
      stockMap[product.id] = getAvailableStock({ ...product, stock_levels })
    }

    return NextResponse.json({ data: stockMap }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Stock API error:', error)
    return NextResponse.json({ error: 'Inventario no disponible' }, { status: 503 })
  }
}
