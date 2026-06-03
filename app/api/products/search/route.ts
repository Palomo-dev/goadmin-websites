import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

const SELECT_FIELDS = `
  id, uuid, name, category_id, tag_id,
  product_prices (price, compare_price),
  product_images (storage_path, is_primary, shared_image_id, shared_images (storage_path)),
  categories (name),
  product_tags (name)
`

function formatProduct(p: any) {
  const price = p.product_prices?.[0]?.price
  const comparePrice = p.product_prices?.[0]?.compare_price
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
    comparePrice: comparePrice ? Number(comparePrice) : null,
    imageUrl,
    category: p.categories?.name || null,
    tag: p.product_tags?.name || null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ products: [] })
  }

  // Intentar obtener orgId de getOrgContext (headers) o del query param (fallback)
  const orgIdParam = searchParams.get('organizationId')
  let orgId: number | null = null

  const ctx = await getOrgContext()
  if (ctx) {
    orgId = ctx.organization.id
  } else if (orgIdParam) {
    orgId = parseInt(orgIdParam)
  }

  if (!orgId) {
    return NextResponse.json({ products: [] })
  }
  const supabase = createAdminClient() || createPublicClient()
  if (!supabase) {
    return NextResponse.json({ products: [], error: 'No supabase client' })
  }
  const collected = new Map<number, any>()
  const errors: string[] = []

  // Detectar si es búsqueda por precio (ej: "menos de 50000", "hasta 100000", números)
  const priceMatch = q.match(/(\d[\d.,]*)/)?.[1]?.replace(/[.,]/g, '')
  const maxPrice = priceMatch ? parseInt(priceMatch) : null

  // 1. Búsqueda por nombre del producto
  try {
    const { data: byName, error: err1 } = await (supabase as any)
      .from('products')
      .select(SELECT_FIELDS)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .eq('is_parent', true)
      .ilike('name', `%${q}%`)
      .limit(10)
    if (err1) errors.push(`name: ${err1.message}`)
    if (byName) byName.forEach((p: any) => collected.set(p.id, p))
  } catch (e: any) { errors.push(`name_catch: ${e.message}`) }

  // 2. Búsqueda por categoría
  try {
    if (collected.size < 12) {
      const { data: cats } = await (supabase as any)
        .from('categories')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', `%${q}%`)
        .limit(5)
      if (cats && cats.length > 0) {
        const catIds = cats.map((c: any) => c.id)
        const { data: byCat } = await (supabase as any)
          .from('products')
          .select(SELECT_FIELDS)
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .eq('is_parent', true)
          .in('category_id', catIds)
          .limit(10)
        if (byCat) byCat.forEach((p: any) => collected.set(p.id, p))
      }
    }
  } catch (e) { /* silent */ }

  // 3. Búsqueda por etiqueta (product_tags)
  try {
    if (collected.size < 12) {
      const { data: tags } = await (supabase as any)
        .from('product_tags')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', `%${q}%`)
        .limit(5)
      if (tags && tags.length > 0) {
        const tagIds = tags.map((t: any) => t.id)
        const { data: byTag } = await (supabase as any)
          .from('products')
          .select(SELECT_FIELDS)
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .eq('is_parent', true)
          .in('tag_id', tagIds)
          .limit(10)
        if (byTag) byTag.forEach((p: any) => collected.set(p.id, p))
      }
    }
  } catch (e) { /* silent */ }

  // 4. Búsqueda por proveedor (suppliers → product_suppliers → products)
  try {
    if (collected.size < 12) {
      const { data: suppliers } = await (supabase as any)
        .from('suppliers')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', `%${q}%`)
        .limit(5)
      if (suppliers && suppliers.length > 0) {
        const supplierIds = suppliers.map((s: any) => s.id)
        const { data: productSuppliers } = await (supabase as any)
          .from('product_suppliers')
          .select('product_id')
          .in('supplier_id', supplierIds)
          .limit(20)
        if (productSuppliers && productSuppliers.length > 0) {
          const productIds = productSuppliers.map((ps: any) => ps.product_id)
          const { data: bySupplier } = await (supabase as any)
            .from('products')
            .select(SELECT_FIELDS)
            .eq('organization_id', orgId)
            .eq('status', 'active')
            .eq('is_parent', true)
            .in('id', productIds)
            .limit(10)
          if (bySupplier) bySupplier.forEach((p: any) => collected.set(p.id, p))
        }
      }
    }
  } catch (e) { /* silent */ }

  // 5. Búsqueda por descripción o SKU
  try {
    if (collected.size < 12) {
      const { data: byDesc } = await (supabase as any)
        .from('products')
        .select(SELECT_FIELDS)
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('is_parent', true)
        .or(`description.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(8)
      if (byDesc) byDesc.forEach((p: any) => collected.set(p.id, p))
    }
  } catch (e) { /* silent */ }

  // 6. Filtrar por precio máximo si se detectó número
  let results = Array.from(collected.values())
  if (maxPrice && maxPrice > 100) {
    // Si hay texto numérico significativo, filtrar productos dentro de ese rango
    results = results.filter(p => {
      const price = p.product_prices?.[0]?.price
      return price && Number(price) <= maxPrice
    })
    // Si no encontró nada con nombre+precio, buscar solo por precio
    if (results.length === 0) {
      const { data: byPrice } = await (supabase as any)
        .from('products')
        .select(SELECT_FIELDS)
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('is_parent', true)
        .limit(15)
      if (byPrice) {
        results = byPrice.filter((p: any) => {
          const price = p.product_prices?.[0]?.price
          return price && Number(price) <= maxPrice
        })
      }
    }
  }

  const products = results.slice(0, 12).map(formatProduct)

  return NextResponse.json({ products, debug: { orgId, queryLen: q.length, errors, totalCollected: collected.size } })
}
