import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ products: [] })
  }

  const ctx = await getOrgContext()
  if (!ctx) {
    return NextResponse.json({ products: [] })
  }

  const supabase = createAdminClient() || createPublicClient()

  const { data, error } = await (supabase as any)
    .from('products')
    .select(`
      id, uuid, name,
      product_prices (price),
      product_images (storage_path, is_primary, shared_image_id, shared_images (storage_path))
    `)
    .eq('organization_id', ctx.organization.id)
    .eq('status', 'active')
    .eq('is_parent', true)
    .ilike('name', `%${q}%`)
    .limit(10)

  if (error || !data) {
    return NextResponse.json({ products: [] })
  }

  const products = data.map((p: any) => {
    const price = p.product_prices?.[0]?.price
    let imageUrl: string | null = null
    if (p.product_images && p.product_images.length > 0) {
      const primary = p.product_images.find((img: any) => img.is_primary) || p.product_images[0]
      const path = primary.storage_path || primary.shared_images?.storage_path
      if (path) {
        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
      }
    }
    return {
      id: p.id,
      uuid: p.uuid,
      name: p.name,
      price: price ? Number(price) : null,
      imageUrl
    }
  })

  return NextResponse.json({ products })
}
