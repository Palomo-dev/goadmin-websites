import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getCurrentPrice } from '@/lib/get-current-price'
import { getCartaSedeParaListado } from '@/lib/supabase/queries'
import { aplicarCartaSede, excluirNoListados } from '@/lib/products/carta-sede'
import { getAllowedCategoryIds } from '@/lib/outlet/catalog-helpers'
import { resolverOrganizacionBusqueda } from '@/lib/products/organizacionBusqueda'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

const SELECT_FIELDS = `
  id, uuid, name, category_id, tag_id,
  product_prices (id, price, compare_price, effective_from, effective_to),
  product_images (storage_path, is_primary, shared_image_id, shared_images (storage_path)),
  categories (name),
  product_tags!products_tag_id_fkey (name)
`

function formatProduct(p: any) {
  const currentPrice = getCurrentPrice(p)
  const price = currentPrice?.price
  const comparePrice = currentPrice?.compare_price
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

  // La organización sale del contexto del host (middleware → getOrgContext), nunca de la query.
  // `organizationId` en la query solo se tolera si es la misma (JS anterior en caché); otra → 403.
  const ctx = await getOrgContext()
  const resolucion = resolverOrganizacionBusqueda(ctx?.organization.id ?? null, searchParams.get('organizationId'))
  if (resolucion.tipo === 'prohibido') {
    console.warn('[products/search] organizationId de la query rechazado', JSON.stringify({
      motivo: resolucion.motivo,
      organizacionContexto: ctx?.organization.id ?? null,
      organizacionQuery: searchParams.get('organizationId')?.slice(0, 32) ?? null,
      host: request.headers.get('host'),
    }))
    return NextResponse.json({ error: 'Organización no permitida' }, { status: 403 })
  }
  if (resolucion.tipo === 'sin_organizacion') {
    return NextResponse.json({ products: [] })
  }
  const orgId = resolucion.organizationId
  const branchId = ctx?.branchId ?? null

  const supabase = createAdminClient() || createPublicClient()
  if (!supabase) {
    return NextResponse.json({ products: [] })
  }

  // Misma regla de visibilidad que el catálogo público (getOrganizationProducts): activo, sin
  // variantes sueltas, categoría visible para la sede (sin sede: sin filtro) y no oculto en la
  // carta de la sede. `products` no tiene columna de publicación web propia.
  const [categoriasPermitidas, carta] = await Promise.all([
    getAllowedCategoryIds(orgId, ctx?.branchId),
    getCartaSedeParaListado(orgId, branchId),
  ])
  if (categoriasPermitidas !== null && categoriasPermitidas.length === 0) {
    return NextResponse.json({ products: [] })
  }
  const productosVisibles = () => {
    let consulta = (supabase as any)
      .from('products')
      .select(SELECT_FIELDS)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .is('parent_product_id', null)
    if (categoriasPermitidas) consulta = consulta.in('category_id', categoriasPermitidas)
    return excluirNoListados(consulta, carta)
  }
  const collected = new Map<number, any>()

  // Detectar si es búsqueda por precio (ej: "menos de 50000", "hasta 100000", números)
  const priceMatch = q.match(/(\d[\d.,]*)/)?.[1]?.replace(/[.,]/g, '')
  const maxPrice = priceMatch ? parseInt(priceMatch) : null

  // 1. Búsqueda por nombre del producto
  try {
    const { data: byName } = await productosVisibles()
      .ilike('name', `%${q}%`)
      .limit(10)
    if (byName) byName.forEach((p: any) => collected.set(p.id, p))
  } catch (e) { /* silent */ }

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
        const { data: byCat } = await productosVisibles()
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
        const { data: byTag } = await productosVisibles()
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
          const { data: bySupplier } = await productosVisibles()
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
      const { data: byDesc } = await productosVisibles()
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
      const currentPrice = getCurrentPrice(p)
      const price = currentPrice?.price
      return price && Number(price) <= maxPrice
    })
    // Si no encontró nada con nombre+precio, buscar solo por precio
    if (results.length === 0) {
      const { data: byPrice } = await productosVisibles()
        .limit(15)
      if (byPrice) {
        results = byPrice.filter((p: any) => {
          const currentPrice = getCurrentPrice(p)
          const price = currentPrice?.price
          return price && Number(price) <= maxPrice
        })
      }
    }
  }

  // Carta de la sede (oculto, precio web y precio de sede): el buscador muestra el mismo precio
  // que la carta y que cobra /api/orders. `aplicarCartaSede` espera el vigente en [0].
  const vigentes = results.map((p) => {
    const actual = getCurrentPrice(p)
    return { ...p, product_prices: actual ? [actual] : [] }
  })
  const conCarta = aplicarCartaSede(vigentes, carta)
  const products = conCarta.slice(0, 12).map(formatProduct)

  return NextResponse.json({ products })
}
