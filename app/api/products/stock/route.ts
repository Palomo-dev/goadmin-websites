import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')
    const productIds = searchParams.get('productIds')

    if (!organizationId || !productIds) {
      return NextResponse.json({ error: 'Se requiere organizationId y productIds' }, { status: 400 })
    }

    const ids = productIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))
    if (ids.length === 0) {
      return NextResponse.json({ data: {} })
    }

    const supabase = createAdminClient() || createPublicClient()
    const { data, error } = await (supabase as any)
      .from('stock_levels')
      .select('product_id, qty_on_hand')
      .eq('branch_id', (await (supabase as any)
        .from('branches')
        .select('id')
        .eq('organization_id', parseInt(organizationId))
        .eq('is_main', true)
        .single()
      ).data?.id)
      .in('product_id', ids)

    if (error) {
      console.error('Stock API error:', error)
      return NextResponse.json({ data: {} })
    }

    const stockMap: Record<number, number> = {}
    for (const row of (data || [])) {
      const pid = row.product_id
      stockMap[pid] = (stockMap[pid] || 0) + Number(row.qty_on_hand || 0)
    }

    return NextResponse.json({ data: stockMap })
  } catch (error) {
    console.error('Stock API error:', error)
    return NextResponse.json({ data: {} })
  }
}
