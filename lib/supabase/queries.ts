import { createAdminClient, createPublicClient } from './server'
import type { Organization, WebsiteSettings, OrganizationWithDetails, WebsitePage, WebsitePageWithSections, WebsitePageWithChildren, WebsiteMenu, WebsiteMenuItem, WebsiteMenuItemWithChildren, WebsiteMenuWithItems } from '@/types/database'
import { filterStockByBranches } from '@/lib/stock'

function getSupabaseForPublicRead() {
  return createAdminClient() || createPublicClient()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

/**
 * Normaliza el array product_prices de un producto para que [0] sea el precio vigente.
 *
 * Problema: Supabase devuelve product_prices ordenado por id ASC (el más antiguo primero).
 * Cuando se actualiza el precio, se crea un nuevo registro, pero [0] sigue apuntando al viejo.
 *
 * Solución: reordenar para que el registro con effective_to IS NULL y mayor id quede primero.
 */
export function normalizeProductPrices<T extends { product_prices?: any[] }>(products: T[]): T[] {
  return products.map((p) => {
    if (!p.product_prices || !Array.isArray(p.product_prices) || p.product_prices.length <= 1) {
      return p
    }
    const sorted = [...p.product_prices].sort((a, b) => {
      // Primero los que tienen effective_to IS NULL (vigentes)
      const aActive = a.effective_to === null || a.effective_to === undefined ? 1 : 0
      const bActive = b.effective_to === null || b.effective_to === undefined ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
      // Entre los vigentes, el de mayor id primero (más reciente)
      return b.id - a.id
    })
    return { ...p, product_prices: sorted }
  })
}

/**
 * Para categorías sin image_url, obtiene la imagen del primer producto
 * activo de esa categoría y la usa como fallback.
 */
async function enrichCategoriesWithFallbackImage(
  supabase: any,
  categories: any[]
): Promise<any[]> {
  // --- Contar productos activos por categoría (para show_count) ---
  const allCategoryIds = categories.map(c => c.id)
  const countMap: Record<number, number> = {}
  if (allCategoryIds.length > 0) {
    const { data: countData } = await supabase
      .from('products')
      .select('category_id')
      .in('category_id', allCategoryIds)
      .eq('status', 'active')
      .is('parent_product_id', null)
    for (const row of (countData || [])) {
      countMap[row.category_id] = (countMap[row.category_id] || 0) + 1
    }
  }

  const withoutImage = categories.filter(c => !c.image_url)

  // Si todas tienen imagen (o no hay categorías), solo agregar product_count
  if (withoutImage.length === 0 || allCategoryIds.length === 0) {
    return categories.map(c => ({ ...c, product_count: countMap[c.id] || 0 }))
  }

  const categoryIds = withoutImage.map(c => c.id)

  // Buscar productos activos en esas categorías, con sus imágenes
  const { data: products } = await supabase
    .from('products')
    .select(`
      id, category_id,
      product_images (
        id, storage_path, is_primary, display_order,
        shared_image_id,
        shared_images ( storage_path )
      )
    `)
    .in('category_id', categoryIds)
    .eq('status', 'active')
    .is('parent_product_id', null)
    .order('name', { ascending: true })

  // Construir mapa: category_id → primera imagen disponible
  const fallbackMap: Record<number, string> = {}
  for (const product of (products || [])) {
    if (fallbackMap[product.category_id]) continue

    const images = product.product_images || []
    const primary = images.find((img: any) => img.is_primary) || images[0]
    if (!primary) continue

    const path = primary.storage_path || primary.shared_images?.storage_path
    if (!path) continue

    fallbackMap[product.category_id] = `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
  }

  return categories.map(c =>
    !c.image_url && fallbackMap[c.id]
      ? { ...c, image_url: fallbackMap[c.id], product_count: countMap[c.id] || 0 }
      : { ...c, product_count: countMap[c.id] || 0 }
  )
}

/**
 * Obtiene una organización por su subdominio (busca en organization_domains)
 */
export async function getOrganizationBySubdomain(subdomain: string): Promise<OrganizationWithDetails | null> {
  const supabase = getSupabaseForPublicRead()
  const subdomainLower = subdomain.toLowerCase().trim()
  
  // PRIMERO: Buscar directamente en organizations.subdomain
  const { data: orgDirect } = await supabase
    .from('organizations')
    .select(`
      *,
      organization_types (*),
      website_settings (*)
    `)
    .ilike('subdomain', subdomainLower)
    .limit(1)
  
  if (orgDirect && orgDirect.length > 0) {
    return orgDirect[0] as OrganizationWithDetails
  }
  
  // SEGUNDO: Buscar en organization_domains
  const host = `${subdomainLower}.goadmin.io`
  
  const { data: domainData } = await supabase
    .from('organization_domains')
    .select('organization_id')
    .ilike('host', host)
    .eq('is_active', true)
    .limit(1)
  
  if (!domainData || domainData.length === 0) {
    return null
  }
  
  const orgId = (domainData[0] as { organization_id: number }).organization_id
  
  // Obtener la organización completa
  const { data, error } = await supabase
    .from('organizations')
    .select(`
      *,
      organization_types (*),
      website_settings (*)
    `)
    .eq('id', orgId)
    .limit(1)
  
  if (error || !data || data.length === 0) return null
  return data[0] as OrganizationWithDetails
}

/**
 * Obtiene una organización por dominio personalizado
 */
export async function getOrganizationByCustomDomain(domain: string): Promise<OrganizationWithDetails | null> {
  const supabase = getSupabaseForPublicRead()
  
  // Primero buscar en organization_domains
  const { data: domainData, error: domainError } = await supabase
    .from('organization_domains')
    .select('organization_id')
    .eq('host', domain)
    .eq('is_active', true)
    .eq('status', 'verified')
    .single()
  
  if (domainError || !domainData) return null
  
  const orgId = (domainData as { organization_id: number }).organization_id
  
  // Luego obtener la organización completa
  const { data, error } = await supabase
    .from('organizations')
    .select(`
      *,
      organization_types (*),
      website_settings (*)
    `)
    .eq('id', orgId)
    .limit(1)
  
  if (error || !data || data.length === 0) return null
  return data[0] as OrganizationWithDetails
}

/**
 * Obtiene una organización por host (subdominio o dominio personalizado)
 * El host puede ser:
 * - Un subdominio simple: "miempresa"
 * - Un host completo: "miempresa.goadmin.io"
 * - Un dominio personalizado: "www.miempresa.com"
 */
export async function getOrganizationByHost(identifier: string): Promise<OrganizationWithDetails | null> {
  if (!identifier) return null
  
  // Si el identificador no contiene punto, es un subdominio simple
  if (!identifier.includes('.')) {
    return getOrganizationBySubdomain(identifier)
  }
  
  // Verificar si es un subdominio del sistema (*.goadmin.io)
  const systemDomains = ['goadmin.io', 'localhost']
  const isSystemSubdomain = systemDomains.some(d => identifier.includes(d))
  
  if (isSystemSubdomain) {
    // Extraer el subdominio del host completo
    const subdomain = identifier.split('.')[0]
    if (subdomain === 'localhost' || subdomain === 'www') {
      return null
    }
    return getOrganizationBySubdomain(subdomain)
  }
  
  // Es un dominio personalizado
  return getOrganizationByCustomDomain(identifier)
}

/**
 * Obtiene los ids de las sucursales cuyo inventario surte la tienda web.
 *
 * Devuelve `null` si la organización no tiene ninguna sucursal marcada, para que
 * el sitio siga usando el inventario de todas las sucursales (comportamiento previo).
 */
export async function getWebStockBranchIds(organizationId: number): Promise<number[] | null> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_web_stock_source', true)

  if (error || !data || data.length === 0) return null
  return data.map((b: any) => b.id as number)
}

/**
 * Obtiene los productos de una organización para mostrar en el sitio
 */
export async function getOrganizationProducts(organizationId: number, limit = 12) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (
        id,
        storage_path,
        is_primary,
        display_order,
        shared_image_id,
        shared_images (
          storage_path
        )
      ),
      stock_levels (
        branch_id,
        qty_on_hand,
        qty_reserved
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('parent_product_id', null)
    .limit(limit)
  
  if (error) return []

  // Contar variantes para productos padre
  const parentIds = (data || []).filter((p: any) => p.is_parent).map((p: any) => p.id)
  let variantCountMap: Record<number, number> = {}
  if (parentIds.length > 0) {
    const { data: children } = await supabase
      .from('products')
      .select('parent_product_id')
      .in('parent_product_id', parentIds)
      .eq('status', 'active')
    if (children) {
      children.forEach((c: any) => {
        variantCountMap[c.parent_product_id] = (variantCountMap[c.parent_product_id] || 0) + 1
      })
    }
  }

  const webBranchIds = await getWebStockBranchIds(organizationId)

  return filterStockByBranches(
    normalizeProductPrices((data || []).map((p: any) => ({
      ...p,
      has_variants: p.is_parent === true,
      variant_count: variantCountMap[p.id] || 0,
    }))),
    webBranchIds
  )
}

/**
 * Obtiene productos en oferta (compare_price > price), ordenados por ventas
 */
export async function getOfferProducts(organizationId: number, limit = 500) {
  const supabase = getSupabaseForPublicRead()

  // 1. Traer todos los productos activos con precios
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      *,
      categories ( id, name, slug ),
      product_prices (*),
      product_images (
        id, storage_path, is_primary, display_order, shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('parent_product_id', null)
    .limit(500)

  if (error || !products) return []

  // Normalizar precios para que [0] sea el vigente
  const normalized = normalizeProductPrices(products)

  // 2. Filtrar solo los que tienen compare_price > price
  const offers = normalized.filter((p: any) => {
    const pp = p.product_prices?.[0]
    if (!pp) return false
    return pp.compare_price && Number(pp.compare_price) > Number(pp.price)
  })

  if (offers.length === 0) return []

  // 3. Obtener conteo de ventas por producto desde web_order_items
  const offerIds = offers.map((p: any) => p.id)
  const { data: salesData } = await supabase
    .from('web_order_items')
    .select('product_id, quantity')
    .in('product_id', offerIds)

  const salesMap: Record<number, number> = {}
  if (salesData) {
    salesData.forEach((item: any) => {
      salesMap[item.product_id] = (salesMap[item.product_id] || 0) + Number(item.quantity || 1)
    })
  }

  // 4. Contar variantes para productos padre
  const parentIds = offers.filter((p: any) => p.is_parent).map((p: any) => p.id)
  let variantCountMap: Record<number, number> = {}
  if (parentIds.length > 0) {
    const { data: children } = await supabase
      .from('products')
      .select('parent_product_id')
      .in('parent_product_id', parentIds)
      .eq('status', 'active')
    if (children) {
      children.forEach((c: any) => {
        variantCountMap[c.parent_product_id] = (variantCountMap[c.parent_product_id] || 0) + 1
      })
    }
  }

  const webBranchIds = await getWebStockBranchIds(organizationId)

  // 5. Ordenar por ventas (descendente) y limitar
  return filterStockByBranches(
    offers.map((p: any) => ({
      ...p,
      has_variants: p.is_parent === true,
      variant_count: variantCountMap[p.id] || 0,
      sales_count: salesMap[p.id] || 0,
    })),
    webBranchIds
  )
    .sort((a: any, b: any) => b.sales_count - a.sales_count)
    .slice(0, limit)
}

/**
 * Obtiene los servicios de una organización (usando productos tipo servicio)
 */
export async function getOrganizationServices(organizationId: number, limit = 12) {
  const supabase = getSupabaseForPublicRead()
  
  // Los servicios se manejan como productos con unit_code 'SV' (Servicio)
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*)
    `)
    .eq('organization_id', organizationId)
    .eq('unit_code', 'SV  ')
    .eq('status', 'active')
    .limit(limit)

  if (error) return []
  return normalizeProductPrices(data || [])
}

// getOrganizationSpaces movida más abajo con soporte de imágenes y servicios

/**
 * Obtiene las sucursales de una organización
 */
export async function getOrganizationBranches(organizationId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
  
  if (error) return []
  return data || []
}

/**
 * Obtiene las categorías de productos de una organización
 */
export async function getOrganizationCategories(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('rank', { ascending: true })

  if (error) return []
  return enrichCategoriesWithFallbackImage(supabase, data || [])
}

/**
 * Obtiene productos por categoría
 */
export async function getProductsByCategory(organizationId: number, categoryId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('products')
    .select(`*, product_prices (*)`)
    .eq('organization_id', organizationId)
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .is('parent_product_id', null)
  
  if (error) return []
  return normalizeProductPrices(data || [])
}

/**
 * Obtiene productos con imagen para varias categorías a la vez.
 * Devuelve un mapa `categoryId -> products[]` (F7.2 preview de banners).
 * Incluye `product_images` para resolver la miniatura en el preview.
 */
export async function getProductsByCategoryIds(
  organizationId: number,
  categoryIds: number[],
  limitPerCategory = 12,
): Promise<Record<number, any[]>> {
  if (categoryIds.length === 0) return {}
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (
        id,
        storage_path,
        is_primary,
        shared_images ( storage_path )
      )
    `)
    .eq('organization_id', organizationId)
    .in('category_id', categoryIds)
    .eq('status', 'active')
    .is('parent_product_id', null)

  if (error || !data) return {}

  const map: Record<number, any[]> = {}
  data.forEach((p: any) => {
    if (!map[p.category_id]) map[p.category_id] = []
    if (map[p.category_id].length < limitPerCategory) {
      map[p.category_id].push(p)
    }
  })
  return map
}

/**
 * Obtiene páginas del sitio por ids (F7.1 enlace tipado a página).
 * Devuelve un mapa `pageId -> { slug, title }` para resolver `/{slug}`.
 */
export async function getWebsitePagesByIds(
  organizationId: number,
  pageIds: string[],
): Promise<Record<string, { slug: string; title: string }>> {
  if (pageIds.length === 0) return {}
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select('id, slug, title')
    .eq('organization_id', organizationId)
    .in('id', pageIds)
    .eq('is_published', true)

  if (error || !data) return {}
  const map: Record<string, { slug: string; title: string }> = {}
  data.forEach((p: any) => {
    map[p.id] = { slug: p.slug, title: p.title }
  })
  return map
}
export async function getCategoryBySlug(organizationId: number, slug: string) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  const [enriched] = await enrichCategoriesWithFallbackImage(supabase, [data])
  return enriched as any
}

/**
 * Obtiene subcategorías de una categoría padre
 */
export async function getSubcategories(organizationId: number, parentId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('parent_id', parentId)
    .order('rank', { ascending: true })

  if (error) return []
  return enrichCategoriesWithFallbackImage(supabase, data || [])
}

/**
 * Obtiene productos por categoría con paginación y ordenamiento
 */
export async function getProductsByCategoryPaginated(
  organizationId: number,
  categoryId: number,
  options: {
    page?: number
    limit?: number
    sort?: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest' | 'best_selling'
    subcategoryId?: number
  } = {}
) {
  const supabase = getSupabaseForPublicRead()
  const { page = 1, limit = 12, sort = 'best_selling', subcategoryId } = options
  const offset = (page - 1) * limit

  // Obtener IDs de subcategorías para incluir productos de subcategorías
  let categoryIds = [categoryId]
  if (!subcategoryId) {
    const { data: subs } = await supabase
      .from('categories')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('parent_id', categoryId)
    if (subs && subs.length > 0) {
      categoryIds = [...categoryIds, ...subs.map((s: any) => s.id)]
    }
  } else {
    categoryIds = [subcategoryId]
  }

  let query = supabase
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (
        id, storage_path, is_primary, display_order,
        shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `, { count: 'exact' })
    .eq('organization_id', organizationId)
    .in('category_id', categoryIds)
    .eq('status', 'active')
    .is('parent_product_id', null)

  // Para best_selling, traer todos y ordenar en memoria con datos de ventas
  if (sort === 'best_selling') {
    query = query.order('name', { ascending: true })
    const { data: allProducts, error: allError, count } = await query

    if (allError || !allProducts) return { products: [], total: 0 }

    // Obtener conteo de ventas
    const productIds = allProducts.map((p: any) => p.id)
    const salesMap: Record<number, number> = {}
    if (productIds.length > 0) {
      const { data: salesData } = await supabase
        .from('web_order_items')
        .select('product_id, quantity')
        .in('product_id', productIds)
      if (salesData) {
        salesData.forEach((item: any) => {
          salesMap[item.product_id] = (salesMap[item.product_id] || 0) + Number(item.quantity || 1)
        })
      }
    }

    // Ordenar por ventas y paginar en memoria
    const sorted = allProducts
      .map((p: any) => ({ ...p, sales_count: salesMap[p.id] || 0 }))
      .sort((a: any, b: any) => b.sales_count - a.sales_count)

    const paginated = sorted.slice(offset, offset + limit)
    return { products: filterStockByBranches(normalizeProductPrices(paginated), await getWebStockBranchIds(organizationId)), total: count || 0 }
  }

  // Ordenamiento estándar
  switch (sort) {
    case 'name_asc':
      query = query.order('name', { ascending: true })
      break
    case 'name_desc':
      query = query.order('name', { ascending: false })
      break
    case 'newest':
      query = query.order('created_at', { ascending: false })
      break
    case 'price_asc':
    case 'price_desc':
      query = query.order('name', { ascending: true })
      break
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) return { products: [], total: 0 }

  const webBranchIds = await getWebStockBranchIds(organizationId)

  // Adjuntar sales_count para los demás sorts
  const prods = filterStockByBranches(data || [], webBranchIds)
  if (prods.length > 0) {
    const productIds = prods.map((p: any) => p.id)
    const salesMap: Record<number, number> = {}
    const { data: salesData } = await supabase
      .from('web_order_items')
      .select('product_id, quantity')
      .in('product_id', productIds)
    if (salesData) {
      salesData.forEach((item: any) => {
        salesMap[item.product_id] = (salesMap[item.product_id] || 0) + Number(item.quantity || 1)
      })
    }
    const enriched = prods.map((p: any) => ({ ...p, sales_count: salesMap[p.id] || 0 }))
    return { products: normalizeProductPrices(enriched), total: count || 0 }
  }

  return { products: normalizeProductPrices(prods), total: count || 0 }
}

/**
 * Obtiene la categoría padre de una categoría
 */
export async function getParentCategory(organizationId: number, parentId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('organization_id', organizationId)
    .eq('id', parentId)
    .single()
  
  if (error || !data) return null
  return data as any
}

/**
 * Obtiene las variantes (productos hijos) de un producto padre
 */
export async function getProductVariants(parentProductId: number, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (
        id, storage_path, is_primary, display_order,
        shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `)
    .eq('parent_product_id', parentProductId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name')

  if (error) return []
  const webBranchIds = await getWebStockBranchIds(organizationId)
  return filterStockByBranches(normalizeProductPrices(data || []), webBranchIds)
}

/**
 * Obtiene los tipos de espacios de una organización (habitaciones, mesas, etc.)
 */
export async function getOrganizationSpaceTypes(organizationId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('space_types')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('base_rate', { ascending: true })
  
  if (error) return []
  return data || []
}

/**
 * Obtiene los espacios reales (habitaciones) de una organización con imágenes, servicios y tipo.
 */
export async function getOrganizationSpaces(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  // Branches de la org
  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)

  if (!branches || branches.length === 0) return []
  const branchIds = branches.map((b: any) => b.id)

  // Spaces con tipo
  const { data: spaces, error } = await supabase
    .from('spaces')
    .select(`
      id, label, floor_zone, status, description, metadata, space_type_id,
      space_types ( id, name, short_name, category_code, base_rate, capacity, area_sqm, amenities, booking_rules )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'available')
    .order('label', { ascending: true })

  if (error || !spaces) return []

  const spaceIds = spaces.map((s: any) => s.id)
  if (spaceIds.length === 0) return spaces

  // Imágenes primarias (una por espacio)
  const { data: images } = await (supabase as any)
    .from('space_images')
    .select('space_id, image_url, storage_path, is_primary, display_order')
    .in('space_id', spaceIds)
    .order('is_primary', { ascending: false })
    .order('display_order', { ascending: true })

  // Servicios por espacio
  const { data: svcData } = await (supabase as any)
    .from('space_services')
    .select('space_id, organization_services ( custom_name, custom_icon, service_id, services ( name, icon ) )')
    .in('space_id', spaceIds)

  // Mapear imágenes por space_id (solo la primera)
  const imgMap: Record<string, string> = {}
  for (const img of (images || []) as any[]) {
    if (!imgMap[img.space_id]) {
      imgMap[img.space_id] = img.image_url || `https://jgmgphmzusbluqhuqihj.supabase.co/storage/v1/object/public/space-images/${img.storage_path}`
    }
  }

  // Mapear servicios por space_id
  const svcMap: Record<string, { name: string; icon: string | null }[]> = {}
  for (const s of (svcData || []) as any[]) {
    const os = s.organization_services
    if (!os) continue
    const svc = os.services
    const name = os.custom_name || svc?.name || 'Servicio'
    const icon = os.custom_icon || svc?.icon || null
    if (!svcMap[s.space_id]) svcMap[s.space_id] = []
    svcMap[s.space_id].push({ name, icon })
  }

  return spaces.map((s: any) => ({
    ...s,
    primaryImage: imgMap[s.id] || null,
    services: svcMap[s.id] || [],
  }))
}

/**
 * Obtiene un espacio individual con todas sus imágenes, servicios y tipo.
 */
export async function getSpaceById(spaceId: string, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  // Branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)

  if (!branches || branches.length === 0) return null
  const branchIds = branches.map((b: any) => b.id)

  const { data: space, error } = await (supabase as any)
    .from('spaces')
    .select(`
      id, label, floor_zone, status, description, metadata, space_type_id,
      space_types ( id, name, short_name, category_code, base_rate, capacity, area_sqm, amenities, booking_rules )
    `)
    .eq('id', spaceId)
    .in('branch_id', branchIds)
    .single()

  if (error || !space) return null

  // Todas las imágenes
  const { data: images } = await (supabase as any)
    .from('space_images')
    .select('image_url, storage_path, is_primary, display_order')
    .eq('space_id', spaceId)
    .order('is_primary', { ascending: false })
    .order('display_order', { ascending: true })

  const imageUrls = (images || []).map((img: any) =>
    img.image_url || `https://jgmgphmzusbluqhuqihj.supabase.co/storage/v1/object/public/space-images/${img.storage_path}`
  )

  // Servicios
  const { data: svcData } = await (supabase as any)
    .from('space_services')
    .select('organization_services ( custom_name, custom_icon, service_id, services ( name, icon, category ) )')
    .eq('space_id', spaceId)

  const services = (svcData || []).map((s: any) => {
    const os = s.organization_services
    const svc = os?.services
    return {
      name: os?.custom_name || svc?.name || 'Servicio',
      icon: os?.custom_icon || svc?.icon || null,
      category: svc?.category || null,
    }
  })

  return { ...(space as any), images: imageUrls, services }
}

/**
 * Obtiene espacios disponibles por tipo
 */
export async function getAvailableSpaces(organizationId: number, spaceTypeId: string, checkin: string, checkout: string) {
  const supabase = getSupabaseForPublicRead()
  
  // Primero obtener branches de la organización
  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
  
  if (!branches || branches.length === 0) return []
  
  const branchIds = branches.map((b: any) => b.id)
  
  // Obtener espacios del tipo solicitado
  const { data: spaces, error } = await supabase
    .from('spaces')
    .select(`*, space_types (*)`)
    .in('branch_id', branchIds)
    .eq('space_type_id', spaceTypeId)
    .eq('status', 'available')
  
  if (error) return []
  
  // Filtrar los que no tienen reserva en las fechas
  const { data: reservations } = await supabase
    .from('reservations')
    .select('space_id')
    .in('space_id', spaces?.map((s: any) => s.id) || [])
    .gte('checkout', checkin)
    .lte('checkin', checkout)
    .in('status', ['confirmed', 'pending'])
  
  const reservedSpaceIds = new Set(reservations?.map((r: any) => r.space_id) || [])
  
  return spaces?.filter((s: any) => !reservedSpaceIds.has(s.id)) || []
}

/**
 * Crea una reservación
 */
export async function createReservation(data: {
  organizationId: number
  branchId?: number
  customerId?: string
  spaceId: string
  spaceTypeId: string
  checkin: string
  checkout: string
  occupantCount: number
  totalEstimated: number
  customerName: string
  customerEmail: string
  customerPhone: string
  notes?: string
}) {
  const supabase = getSupabaseForPublicRead()
  
  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      organization_id: data.organizationId,
      branch_id: data.branchId,
      customer_id: data.customerId,
      space_id: data.spaceId,
      space_type_id: data.spaceTypeId,
      checkin: data.checkin,
      checkout: data.checkout,
      occupant_count: data.occupantCount,
      total_estimated: data.totalEstimated,
      status: 'pending',
      channel: 'website',
      metadata: {
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        customer_phone: data.customerPhone,
        notes: data.notes
      }
    } as any)
    .select()
    .single()
  
  if (error) return { error: error.message }
  return { data: reservation }
}

/**
 * Obtiene un producto por ID
 */
export async function getProductById(productId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('products')
    .select(`*, product_prices (*), categories (*)`)
    .eq('id', productId)
    .eq('status', 'active')
    .single()
  
  if (error) return null
  return normalizeProductPrices([data])[0]
}
export async function getOrCreateCustomer(organizationId: number, email: string, data: {
  firstName?: string
  lastName?: string
  phone?: string
}) {
  const supabase = getSupabaseForPublicRead()
  
  // Buscar si ya existe
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .single()
  
  if (existing) return existing
  
  // Crear nuevo
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      organization_id: organizationId,
      email,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      is_registered: false
    } as any)
    .select()
    .single()
  
  if (error) return null
  return newCustomer
}

// ==========================================
// Website Pages & Sections (Page Builder)
// ==========================================

/**
 * Obtiene una página por slug con sus secciones visibles ordenadas
 */
export async function getWebsitePageBySlug(
  organizationId: number,
  slug: string
): Promise<WebsitePageWithSections | null> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select(`
      *,
      website_page_sections (
        id,
        section_type,
        section_variant,
        content,
        settings,
        sort_order,
        is_visible
      )
    `)
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !data) return null

  // Filtrar secciones visibles y ordenar por sort_order
  const page = data as WebsitePageWithSections
  page.website_page_sections = (page.website_page_sections || [])
    .filter((s) => s.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order)

  return page
}

/**
 * Obtiene una página por page_type con sus secciones visibles ordenadas.
 * Usado por las plantillas de detalle (product_detail, category_detail, etc.)
 * que usan slugs internos con prefijo __ y no se buscan por slug.
 */
export async function getWebsitePageByType(
  organizationId: number,
  pageType: string
): Promise<WebsitePageWithSections | null> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select(`
      *,
      website_page_sections (
        id,
        section_type,
        section_variant,
        content,
        settings,
        sort_order,
        is_visible
      )
    `)
    .eq('organization_id', organizationId)
    .eq('page_type', pageType)
    .eq('is_published', true)
    .single()

  if (error || !data) return null

  const page = data as WebsitePageWithSections
  page.website_page_sections = (page.website_page_sections || [])
    .filter((s) => s.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order)

  return page
}
/**
 * Incluye campos de mega-menú: parent_page_id, linked_category_id, menu_icon, menu_badge
 */
export async function getWebsiteHeaderNav(organizationId: number): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select('id, slug, title, header_order, parent_page_id, linked_category_id, menu_icon, menu_badge')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('show_in_header', true)
    .order('header_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
}

/**
 * Obtiene el árbol jerárquico de páginas del header (anidadas por parent_page_id)
 */
export async function getWebsiteHeaderNavTree(organizationId: number): Promise<WebsitePageWithChildren[]> {
  const flat = await getWebsiteHeaderNav(organizationId)
  return buildMenuTree(flat)
}

/**
 * Obtiene las páginas para el footer
 * Incluye campos de mega-menú para jerarquía del footer
 */
export async function getWebsiteFooterNav(organizationId: number): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select('id, slug, title, footer_order, parent_page_id, linked_category_id, menu_icon, menu_badge')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('show_in_footer', true)
    .order('footer_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
}

/**
 * Obtiene el árbol jerárquico de páginas del footer (anidadas por parent_page_id)
 */
export async function getWebsiteFooterNavTree(organizationId: number): Promise<WebsitePageWithChildren[]> {
  const flat = await getWebsiteFooterNav(organizationId)
  return buildMenuTree(flat)
}

/**
 * Construye un árbol jerárquico desde una lista plana de páginas.
 * Anida por parent_page_id, ordena por header_order/footer_order.
 */
function buildMenuTree(flat: WebsitePage[]): WebsitePageWithChildren[] {
  const map = new Map<string, WebsitePageWithChildren>()
  const roots: WebsitePageWithChildren[] = []

  flat.forEach(page => {
    map.set(page.id, { ...page, children: [], level: 0 })
  })

  flat.forEach(page => {
    const node = map.get(page.id)!
    if (page.parent_page_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(page.parent_page_id)
      if (parent) {
        parent.children.push(node)
        node.level = parent.level + 1
      } else {
        // Padre no encontrado (puede no estar publicado o no estar en header) → raíz
        roots.push(node)
      }
    }
  })

  const sortChildren = (pages: WebsitePageWithChildren[]): WebsitePageWithChildren[] => {
    return pages
      .sort((a, b) => a.header_order - b.header_order)
      .map(p => ({ ...p, children: sortChildren(p.children) }))
  }

  return sortChildren(roots)
}

/**
 * Obtiene las categorías activas para mostrar en el mega-menú del header.
 * Solo se llama si settings.show_categories_in_header = true.
 * Retorna categorías raíz (parent_id = null) con sus subcategorías.
 */
export interface MenuCategory {
  id: number
  uuid: string | null
  name: string
  slug: string
  icon: string | null
  color: string | null
  image_url: string | null
  parent_id: number | null
  is_active: boolean
  display_order: number | null
  rank: number | null
  children: MenuCategory[]
}

export async function getMenuCategories(organizationId: number): Promise<MenuCategory[]> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('categories')
    .select('id, uuid, name, slug, icon, color, image_url, parent_id, is_active, display_order, rank')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('rank', { ascending: true })

  if (error || !data) return []

  // Construir árbol de categorías
  const catMap = new Map<number, MenuCategory>()
  const roots: MenuCategory[] = []

  data.forEach((cat: Omit<MenuCategory, 'children'>) => {
    catMap.set(cat.id, { ...cat, children: [] })
  })

  data.forEach((cat: Omit<MenuCategory, 'children'>) => {
    const node = catMap.get(cat.id)!
    if (cat.parent_id === null) {
      roots.push(node)
    } else {
      const parent = catMap.get(cat.parent_id)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  })

  return roots
}

/**
 * Obtiene todas las páginas de una organización (para admin)
 */
// ==========================================
// Meta Marketing (Pixel)
// ==========================================

/**
 * Obtiene el pixel_id de Meta Marketing para una organización.
 * Busca en integration_credentials de conexiones activas de meta_marketing.
 * Retorna null si no hay integración activa o no tiene pixel_id.
 */
export async function getMetaPixelId(organizationId: number): Promise<string | null> {
  const supabase = getSupabaseForPublicRead()

  // Connector ID de Meta Marketing
  const META_MARKETING_CONNECTOR_ID = '1894a4af-4be2-46a6-b342-ab734d4e0479'

  // Buscar conexión activa
  const { data: connections } = await supabase
    .from('integration_connections')
    .select('id')
    .eq('connector_id', META_MARKETING_CONNECTOR_ID)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)

  if (!connections || connections.length === 0) return null

  const connectionId = (connections[0] as any).id

  // Buscar credencial pixel_id
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('secret_ref')
    .eq('connection_id', connectionId)
    .eq('purpose', 'pixel_id')
    .eq('status', 'active')
    .limit(1)

  if (!credentials || credentials.length === 0) return null
  return (credentials[0] as any).secret_ref || null
}

// ==========================================
// Google Ads (gtag.js)
// ==========================================

/**
 * Obtiene la configuración de Google Ads para inyectar gtag.js.
 * Busca conversion_id (AW-XXXXXXX) y conversion_label en integration_credentials.
 * Retorna null si no hay integración activa.
 */
export async function getGoogleAdsConfig(organizationId: number): Promise<{ conversionId: string; conversionLabel?: string } | null> {
  const supabase = getSupabaseForPublicRead()

  const GOOGLE_ADS_CONNECTOR_ID = '876a3948-ddd2-4a80-9ffe-ed6d3882aa04'

  // Buscar conexión activa
  const { data: connections } = await supabase
    .from('integration_connections')
    .select('id')
    .eq('connector_id', GOOGLE_ADS_CONNECTOR_ID)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)

  if (!connections || connections.length === 0) return null

  const connectionId = (connections[0] as any).id

  // Buscar credenciales: conversion_id y conversion_label
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .in('purpose', ['conversion_id', 'conversion_label'])
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  const conversionIdCred = (credentials as any[]).find((c: any) => c.purpose === 'conversion_id')
  if (!conversionIdCred?.secret_ref) return null

  const conversionLabelCred = (credentials as any[]).find((c: any) => c.purpose === 'conversion_label')

  return {
    conversionId: conversionIdCred.secret_ref,
    conversionLabel: conversionLabelCred?.secret_ref || undefined,
  }
}

// ==========================================
// Gym / Membership Queries
// ==========================================

/**
 * Obtiene los planes de membresía activos de una organización
 */
export async function getMembershipPlans(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('price', { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Obtiene un plan de membresía por ID
 */
export async function getMembershipPlanById(planId: number, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data
}

/**
 * Obtiene las clases activas de un gimnasio con datos del instructor
 */
export async function getGymClasses(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('gym_classes')
    .select(`
      *,
      profiles:instructor_id (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('start_at', { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Obtiene el conteo de reservaciones confirmadas por clase (para calcular cupos disponibles)
 */
export async function getClassReservationCounts(organizationId: number, classIds: number[]) {
  if (classIds.length === 0) return {}
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('class_reservations')
    .select('gym_class_id')
    .eq('organization_id', organizationId)
    .in('gym_class_id', classIds)
    .in('status', ['booked', 'checked_in'])

  if (error || !data) return {}

  const counts: Record<number, number> = {}
  for (const row of data) {
    const id = (row as any).gym_class_id
    counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

/**
 * Obtiene una clase por ID con instructor
 */
export async function getGymClassById(classId: number, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('gym_classes')
    .select(`
      *,
      profiles:instructor_id (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('id', classId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .single()

  if (error) return null
  return data
}

// ==========================================
// Restaurant Menu Queries
// ==========================================

/**
 * Obtiene productos para el menú de restaurante con tags, imágenes y stock
 */
export async function getMenuProducts(organizationId: number, limit = 100) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (
        id, storage_path, is_primary, display_order, shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved ),
      product_tag_relations ( tag_id )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(limit)

  if (error) return []
  const webBranchIds = await getWebStockBranchIds(organizationId)
  return filterStockByBranches(normalizeProductPrices(data || []), webBranchIds)
}

/**
 * Obtiene productos por sus IDs (para favoritos, re-pedidos, etc.)
 */
export async function getProductsByIds(productIds: number[], organizationId: number) {
  if (!productIds.length) return []
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (
        id, storage_path, is_primary, display_order, shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('id', productIds)

  if (error) return []
  const webBranchIds = await getWebStockBranchIds(organizationId)
  return filterStockByBranches(normalizeProductPrices(data || []), webBranchIds)
}

/**
 * Obtiene las etiquetas de productos de una organización (vegetariano, picante, etc.)
 */
export async function getOrganizationTags(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('product_tags')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Obtiene los modificadores (variant_types + variant_values) de una organización
 * Para restaurante: Tamaño, Extras, Preparación, etc.
 */
export async function getProductModifiers(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data: types, error: typesError } = await supabase
    .from('variant_types')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (typesError || !types) return []

  const typeIds = types.map((t: any) => t.id)
  if (typeIds.length === 0) return []

  const { data: values } = await supabase
    .from('variant_values')
    .select('*')
    .in('variant_type_id', typeIds)
    .order('display_order', { ascending: true })

  return types.map((t: any) => ({
    ...t,
    values: (values || []).filter((v: any) => v.variant_type_id === t.id)
  }))
}

/**
 * Obtiene las relaciones producto-variante para saber qué modificadores aplican a cada producto
 */
export async function getProductVariantRelations(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  if (!products || products.length === 0) return []
  const productIds = products.map((p: any) => p.id)

  const { data, error } = await supabase
    .from('product_variant_relations')
    .select('product_id, variant_type_id, variant_value_id')
    .in('product_id', productIds)

  if (error) return []
  return data || []
}

// ==========================================
// Product Modifier Groups (nuevo sistema ERP)
// ==========================================

/**
 * Obtiene los grupos de modificadores de un producto específico
 * con sus opciones (modificadores) activas
 */
export async function getProductModifierGroups(productId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('product_modifier_groups')
    .select(`
      id,
      name,
      selection_mode,
      min_selections,
      max_selections,
      required,
      display_order,
      product_modifiers (
        id,
        name,
        extra_price,
        is_active,
        display_order
      )
    `)
    .eq('product_id', productId)
    .order('display_order')

  if (error || !data) return []

  return (data as any[]).map((group) => ({
    ...group,
    product_modifiers: (group.product_modifiers || [])
      .filter((m: any) => m.is_active)
      .sort((a: any, b: any) => a.display_order - b.display_order),
  }))
}

/**
 * Obtiene todos los grupos de modificadores de una organización
 * con sus opciones activas, agrupados por product_id
 */
export async function getProductModifierGroupsByOrg(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('product_modifier_groups')
    .select(`
      id,
      product_id,
      name,
      selection_mode,
      min_selections,
      max_selections,
      required,
      display_order,
      product_modifiers (
        id,
        name,
        extra_price,
        is_active,
        display_order
      )
    `)
    .eq('organization_id', organizationId)
    .order('display_order')

  if (error || !data) return new Map<number, any[]>()

  const map = new Map<number, any[]>()
  for (const group of data as any[]) {
    const list = map.get(group.product_id) || []
    list.push({
      ...group,
      product_modifiers: (group.product_modifiers || [])
        .filter((m: any) => m.is_active)
        .sort((a: any, b: any) => a.display_order - b.display_order),
    })
    map.set(group.product_id, list)
  }
  return map
}

// ==========================================
// Transport Queries
// ==========================================

/**
 * Obtiene las paradas/terminales activas de una organización para autocomplete
 */
export async function getTransportStops(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('transport_stops')
    .select('id, name, code, stop_type, city, department, latitude, longitude')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('city', { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Busca viajes disponibles por origen, destino y fecha.
 * Join: trips → transport_routes → route_stops → transport_stops
 */
export async function searchTrips(
  organizationId: number,
  originCity: string,
  destinationCity: string,
  date: string,
  passengers: number = 1
) {
  const supabase = getSupabaseForPublicRead()

  // 1. Buscar rutas que conecten origen → destino
  const { data: originStops } = await supabase
    .from('transport_stops')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('city', originCity)
    .eq('is_active', true)

  const { data: destStops } = await supabase
    .from('transport_stops')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('city', destinationCity)
    .eq('is_active', true)

  if (!originStops?.length || !destStops?.length) return []

  const originIds = originStops.map((s: any) => s.id)
  const destIds = destStops.map((s: any) => s.id)

  // 2. Buscar rutas que tengan paradas en ambas ciudades (origen antes que destino)
  const { data: originRouteStops } = await supabase
    .from('route_stops')
    .select('route_id, stop_order')
    .in('stop_id', originIds)

  const { data: destRouteStops } = await supabase
    .from('route_stops')
    .select('route_id, stop_order')
    .in('stop_id', destIds)

  if (!originRouteStops?.length || !destRouteStops?.length) return []

  // Encontrar rutas donde origin.stop_order < dest.stop_order
  const originByRoute: Record<string, number> = {}
  for (const rs of originRouteStops as any[]) {
    if (!originByRoute[rs.route_id] || rs.stop_order < originByRoute[rs.route_id]) {
      originByRoute[rs.route_id] = rs.stop_order
    }
  }

  const validRouteIds: string[] = []
  for (const rs of destRouteStops as any[]) {
    const originOrder = originByRoute[rs.route_id]
    if (originOrder !== undefined && originOrder < rs.stop_order) {
      if (!validRouteIds.includes(rs.route_id)) {
        validRouteIds.push(rs.route_id)
      }
    }
  }

  if (validRouteIds.length === 0) return []

  // 3. Buscar viajes en esas rutas para la fecha
  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      id, trip_code, trip_date, scheduled_departure, scheduled_arrival,
      total_seats, available_seats, base_fare, currency, status,
      transport_routes (
        id, name, code, route_type, origin_stop_id, destination_stop_id,
        estimated_distance_km, estimated_duration_minutes
      ),
      vehicles (
        id, plate, vehicle_type, brand, model, passenger_capacity
      )
    `)
    .eq('organization_id', organizationId)
    .in('route_id', validRouteIds)
    .eq('trip_date', date)
    .eq('status', 'scheduled')
    .gte('available_seats', passengers)
    .order('scheduled_departure', { ascending: true })

  if (error) return []
  return trips || []
}

/**
 * Obtiene un viaje por ID con asientos, ruta completa y tarifas
 */
export async function getTripById(tripId: string, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  // Viaje con ruta y vehículo
  const { data: trip, error } = await supabase
    .from('trips')
    .select(`
      *,
      transport_routes (
        id, name, code, route_type, origin_stop_id, destination_stop_id,
        estimated_distance_km, estimated_duration_minutes, polyline_encoded
      ),
      vehicles (
        id, plate, vehicle_type, brand, model, year, passenger_capacity
      )
    `)
    .eq('id', tripId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !trip) return null

  // Asientos del viaje con layout del vehículo
  const { data: seats } = await supabase
    .from('trip_seats')
    .select(`
      id, seat_label, status, reserved_until,
      vehicle_seats (
        seat_row, seat_column, seat_type, position_x, position_y, price_modifier, is_available
      )
    `)
    .eq('trip_id', tripId)
    .order('seat_label', { ascending: true })

  // Paradas de la ruta en orden
  const routeId = (trip as any).transport_routes?.id || (trip as any).route_id
  const { data: stops } = await supabase
    .from('route_stops')
    .select(`
      stop_order, estimated_arrival_minutes, estimated_departure_minutes,
      fare_from_origin, is_boarding_allowed, is_alighting_allowed,
      transport_stops ( id, name, code, city, department, address, latitude, longitude )
    `)
    .eq('route_id', routeId)
    .order('stop_order', { ascending: true })

  // Tarifas disponibles para esta ruta
  const { data: fares } = await supabase
    .from('transport_fares')
    .select('id, fare_name, fare_code, fare_type, amount, discount_percent, discount_amount, from_stop_id, to_stop_id')
    .eq('route_id', routeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  return {
    ...(trip as any),
    seats: seats || [],
    stops: stops || [],
    fares: fares || [],
  }
}

/**
 * Obtiene un envío por número de tracking para seguimiento público
 */
export async function getShipmentByTracking(trackingNumber: string) {
  const supabase = getSupabaseForPublicRead()

  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(`
      id, shipment_number, tracking_number, service_level,
      sender_city, sender_department,
      receiver_city, receiver_department,
      total_weight_kg, total_packages,
      expected_delivery_date, delivered_at,
      status, created_at
    `)
    .eq('tracking_number', trackingNumber)
    .single()

  if (error || !shipment) return null

  const shipmentId = (shipment as any).id

  // Timeline de eventos
  const { data: events } = await supabase
    .from('transport_events')
    .select('event_type, event_time, location_text, description')
    .eq('reference_type', 'shipment')
    .eq('reference_id', shipmentId)
    .order('event_time', { ascending: false })

  // Proof of delivery si entregado
  let pod = null
  if ((shipment as any).status === 'delivered') {
    const { data: podData } = await supabase
      .from('proof_of_delivery')
      .select('receiver_name, relationship, confirmed_at, photo_urls')
      .eq('shipment_id', shipmentId)
      .order('confirmed_at', { ascending: false })
      .limit(1)

    pod = podData?.[0] || null
  }

  return {
    ...(shipment as any),
    events: events || [],
    proof_of_delivery: pod,
  }
}

/**
 * Obtiene rutas activas de una organización con paradas origen/destino
 */
export async function getTransportRoutes(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('transport_routes')
    .select(`
      id, name, code, route_type, estimated_distance_km, estimated_duration_minutes,
      base_fare, currency, is_active,
      origin:transport_stops!origin_stop_id ( id, name, city ),
      destination:transport_stops!destination_stop_id ( id, name, city )
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Obtiene un ticket de transporte por su ticket_number (TKT-*) con datos del viaje
 */
export async function getTicketByNumber(ticketNumber: string) {
  const supabase = getSupabaseForPublicRead()

  const { data: ticket, error } = await supabase
    .from('trip_tickets')
    .select(`
      id, ticket_number, passenger_name, passenger_email, passenger_phone,
      passenger_doc_type, passenger_doc_number, seat_number, fare, total, currency,
      status, payment_status, qr_code, checkin_code, boarding_stop_id, alighting_stop_id,
      created_at,
      trips (
        id, trip_code, trip_date, scheduled_departure, scheduled_arrival, status,
        transport_routes ( id, name, code, estimated_duration_minutes ),
        vehicles ( brand, model, vehicle_type, plate ),
        organizations ( name )
      )
    `)
    .eq('ticket_number', ticketNumber)
    .single()

  if (error || !ticket) return null

  // Obtener nombres de paradas de boarding/alighting
  let boardingStop = null
  let alightingStop = null

  if ((ticket as any).boarding_stop_id) {
    const { data } = await supabase
      .from('transport_stops')
      .select('id, name, city, department, address')
      .eq('id', (ticket as any).boarding_stop_id)
      .single()
    boardingStop = data
  }

  if ((ticket as any).alighting_stop_id) {
    const { data } = await supabase
      .from('transport_stops')
      .select('id, name, city, department, address')
      .eq('id', (ticket as any).alighting_stop_id)
      .single()
    alightingStop = data
  }

  return {
    ...(ticket as any),
    boardingStop,
    alightingStop,
  }
}

/**
 * Obtiene los tickets de un cliente por email para el portal /mi-cuenta
 */
export async function getCustomerTickets(email: string, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('trip_tickets')
    .select(`
      id, ticket_number, passenger_name, seat_number, fare, total, currency,
      status, payment_status, checkin_code, created_at,
      trips (
        trip_code, trip_date, scheduled_departure,
        transport_routes ( name )
      )
    `)
    .eq('passenger_email', email)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []
  return data || []
}

// ─── Parking: Queries SSR ─────────────────────────────────────

export async function getBranchesByOrg(organizationId: number) {
  const supabase = getSupabaseForPublicRead() as any
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, city, phone, latitude, longitude, opening_hours, capacity, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('is_main', { ascending: false })
  if (error) return [] as any[]
  return (data || []) as any[]
}

export async function getParkingZones(organizationId: number) {
  const supabase = getSupabaseForPublicRead() as any
  const branches = await getBranchesByOrg(organizationId)
  if (branches.length === 0) return [] as any[]

  const branchIds = branches.map((b: any) => b.id)
  const { data, error } = await supabase
    .from('parking_zones')
    .select('id, branch_id, name, description, capacity, rate_multiplier, is_covered, is_vip')
    .in('branch_id', branchIds)
    .eq('is_active', true)
    .order('name')
  if (error) return [] as any[]
  return (data || []) as any[]
}

export async function getParkingRates(organizationId: number) {
  const supabase = getSupabaseForPublicRead() as any
  const { data, error } = await supabase
    .from('parking_rates')
    .select('id, vehicle_type, rate_name, unit, price, grace_period_min, lost_ticket_fee')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('vehicle_type')
  if (error) return [] as any[]
  return (data || []) as any[]
}

export async function getParkingPassTypes(organizationId: number) {
  const supabase = getSupabaseForPublicRead() as any
  const { data, error } = await supabase
    .from('parking_pass_types')
    .select('id, name, description, duration_days, price, max_entries_per_day, includes_car_wash, includes_valet, allowed_vehicle_types')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('price')
  if (error) return [] as any[]
  return (data || []) as any[]
}

export async function getParkingAvailability(organizationId: number) {
  const supabase = getSupabaseForPublicRead() as any
  const branches = await getBranchesByOrg(organizationId)
  if (branches.length === 0) return [] as any[]

  const branchIds = branches.map((b: any) => b.id)

  const [zonesRes, spacesRes] = await Promise.all([
    supabase
      .from('parking_zones')
      .select('id, branch_id, name, capacity, is_covered, is_vip')
      .in('branch_id', branchIds)
      .eq('is_active', true),
    supabase
      .from('parking_spaces')
      .select('id, zone_id, state')
      .in('branch_id', branchIds),
  ])

  const zones = (zonesRes.data || []) as any[]
  const spaces = (spacesRes.data || []) as any[]

  return zones.map((zone: any) => {
    const zoneSpaces = spaces.filter((s: any) => s.zone_id === zone.id)
    const free = zoneSpaces.filter((s: any) => s.state === 'free').length
    const occupied = zoneSpaces.filter((s: any) => s.state === 'occupied').length
    const reserved = zoneSpaces.filter((s: any) => s.state === 'reserved').length
    return {
      ...zone,
      total_spaces: zoneSpaces.length,
      available_spaces: free,
      occupied_spaces: occupied,
      reserved_spaces: reserved,
    }
  })
}

// ─── Servicios (type_id=4) ───────────────────────────────────────────────────

/**
 * Obtiene el catálogo de servicios activos (organization_services + service_charges)
 * Para orgs type_id=4 (services). Diferente de getOrganizationServices que usa products.
 */
export async function getOrgServiceCatalog(organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data: orgServices } = await supabase
    .from('organization_services')
    .select('*, services(*)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const { data: charges } = await supabase
    .from('service_charges')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return {
    services: (orgServices || []) as any[],
    charges: (charges || []) as any[],
  }
}

/**
 * Obtiene el detalle de un servicio específico con sus tarifas asociadas
 */
export async function getServiceById(serviceId: string, organizationId: number) {
  const supabase = getSupabaseForPublicRead()

  const { data: orgService } = await supabase
    .from('organization_services')
    .select('*, services(*)')
    .eq('id', serviceId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  if (!orgService) return null

  const { data: charges } = await supabase
    .from('service_charges')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return {
    service: orgService as any,
    charges: (charges || []) as any[],
  }
}

export async function getWebsitePages(organizationId: number): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select('*')
    .eq('organization_id', organizationId)
    .order('header_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
}

/**
 * Obtiene el impuesto predeterminado de la organización (is_default=true, is_active=true)
 */
export async function getDefaultTax(organizationId: number): Promise<{ name: string; rate: number; taxIncluded: boolean } | null> {
  const supabase = getSupabaseForPublicRead()
  if (!supabase) return null
  const { data } = await (supabase as any)
    .from('organization_taxes')
    .select('name, rate, tax_included')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()
  if (!data) return null
  return { name: data.name, rate: Number(data.rate), taxIncluded: data.tax_included === true }
}

// ============================================================
// QUERIES — MENÚS NOMBRADOS (website_menus + website_menu_items)
// ============================================================

/**
 * Construye árbol jerárquico desde una lista plana de WebsiteMenuItem.
 * Soporta parent_item_id para anidación.
 */
function buildMenuItemTree(
  flat: WebsiteMenuItem[],
  pages?: Map<string, { id: string; slug: string; title: string }>,
  categories?: Map<number, { id: number; name: string; slug: string }>
): WebsiteMenuItemWithChildren[] {
  const map = new Map<string, WebsiteMenuItemWithChildren>()
  const roots: WebsiteMenuItemWithChildren[] = []

  flat.forEach(item => {
    // Si es item de tipo página y la página no existe o no está publicada, se omite
    if (item.item_type === 'page' && item.page_id && !pages?.get(item.page_id)) return
    map.set(item.id, {
      ...item,
      children: [],
      page: pages?.get(item.page_id ?? '') ?? null,
      category: categories?.get(item.category_id ?? -1) ?? null,
    })
  })

  flat.forEach(item => {
    const node = map.get(item.id)
    if (!node) return
    if (item.parent_item_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(item.parent_item_id)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  })

  const sortChildren = (items: WebsiteMenuItemWithChildren[]): WebsiteMenuItemWithChildren[] => {
    return items
      .sort((a, b) => a.display_order - b.display_order)
      .map(i => ({ ...i, children: sortChildren(i.children) }))
  }

  return sortChildren(roots)
}

/**
 * Obtiene todos los menús de una organización con sus items en árbol jerárquico.
 * Incluye datos relacionados (páginas y categorías) para cada item.
 */
export async function getWebsiteMenus(organizationId: number): Promise<WebsiteMenuWithItems[]> {
  const supabase = getSupabaseForPublicRead()
  if (!supabase) return []

  const { data: menus, error: menusError } = await (supabase as any)
    .from('website_menus')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('header_order', { ascending: true })

  if (menusError || !menus || menus.length === 0) return []

  const { data: items, error: itemsError } = await (supabase as any)
    .from('website_menu_items')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (itemsError || !items) {
    return (menus as WebsiteMenu[]).map(m => ({ ...m, items: [] }))
  }

  // Cargar páginas relacionadas (para items de tipo 'page' y 'policy')
  const pageIds = (items as WebsiteMenuItem[])
    .filter(i => i.page_id)
    .map(i => i.page_id!) as string[]
  let pagesMap = new Map<string, { id: string; slug: string; title: string }>()
  if (pageIds.length > 0) {
    const { data: pages } = await (supabase as any)
      .from('website_pages')
      .select('id, slug, title')
      .in('id', pageIds)
      .eq('is_published', true)
    if (pages) {
      pagesMap = new Map(pages.map((p: any) => [p.id as string, p]))
    }
  }

  // Cargar categorías relacionadas (para items de tipo 'category')
  const categoryIds = (items as WebsiteMenuItem[])
    .filter(i => i.category_id)
    .map(i => i.category_id!) as number[]
  let categoriesMap = new Map<number, { id: number; name: string; slug: string }>()
  if (categoryIds.length > 0) {
    const { data: cats } = await (supabase as any)
      .from('categories')
      .select('id, name, slug')
      .in('id', categoryIds)
    if (cats) {
      categoriesMap = new Map(cats.map((c: any) => [c.id as number, c]))
    }
  }

  // Agrupar items por menu_id y construir árbol
  const itemsByMenu = new Map<string, WebsiteMenuItem[]>()
  ;(items as WebsiteMenuItem[]).forEach(item => {
    const existing = itemsByMenu.get(item.menu_id) || []
    existing.push(item)
    itemsByMenu.set(item.menu_id, existing)
  })

  return (menus as WebsiteMenu[]).map(menu => ({
    ...menu,
    items: buildMenuItemTree(itemsByMenu.get(menu.id) || [], pagesMap, categoriesMap),
  }))
}

/**
 * Obtiene menús filtrados por ubicación (header, footer, both).
 * Los menús con location='both' se incluyen en ambos filtros.
 */
export async function getWebsiteMenusByLocation(
  organizationId: number,
  location: 'header' | 'footer'
): Promise<WebsiteMenuWithItems[]> {
  const allMenus = await getWebsiteMenus(organizationId)
  return allMenus.filter(m => m.location === location || m.location === 'both')
}

/**
 * Obtiene un menú específico por ID con sus items en árbol jerárquico.
 * Útil para cargar el menú asignado a header_menu_id o header_mega_menu_id.
 */
export async function getMenuById(menuId: string): Promise<WebsiteMenuWithItems | null> {
  const supabase = getSupabaseForPublicRead()
  if (!supabase) return null

  const { data: menu, error: menuError } = await (supabase as any)
    .from('website_menus')
    .select('*')
    .eq('id', menuId)
    .eq('is_active', true)
    .single()

  if (menuError || !menu) return null

  const { data: items, error: itemsError } = await (supabase as any)
    .from('website_menu_items')
    .select('*')
    .eq('menu_id', menuId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (itemsError || !items) {
    return { ...(menu as WebsiteMenu), items: [] }
  }

  // Cargar páginas relacionadas
  const pageIds = (items as WebsiteMenuItem[])
    .filter(i => i.page_id)
    .map(i => i.page_id!) as string[]
  let pagesMap = new Map<string, { id: string; slug: string; title: string }>()
  if (pageIds.length > 0) {
    const { data: pages } = await (supabase as any)
      .from('website_pages')
      .select('id, slug, title')
      .in('id', pageIds)
      .eq('is_published', true)
    if (pages) {
      pagesMap = new Map(pages.map((p: any) => [p.id as string, p]))
    }
  }

  // Cargar categorías relacionadas
  const categoryIds = (items as WebsiteMenuItem[])
    .filter(i => i.category_id)
    .map(i => i.category_id!) as number[]
  let categoriesMap = new Map<number, { id: number; name: string; slug: string }>()
  if (categoryIds.length > 0) {
    const { data: cats } = await (supabase as any)
      .from('categories')
      .select('id, name, slug')
      .in('id', categoryIds)
    if (cats) {
      categoriesMap = new Map(cats.map((c: any) => [c.id as number, c]))
    }
  }

  return {
    ...(menu as WebsiteMenu),
    items: buildMenuItemTree(items as WebsiteMenuItem[], pagesMap, categoriesMap),
  }
}

// ─── Testimonios (FASE 6) ────────────────────────────────────────────────────

export interface TestimonialRow {
  id: string
  organization_id: number
  customer_id: string | null
  author_name: string
  author_role: string | null
  author_company: string | null
  author_avatar: string | null
  content: string
  rating: number
  is_featured: boolean
  is_active: boolean
  source: string
  source_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * Obtiene los testimonios activos de una organización desde la tabla `testimonials`.
 *
 * Opciones:
 * - `featuredOnly`: filtra `is_featured = true` (data_source = 'featured').
 * - `limit`: cantidad máxima a devolver (default 50).
 *
 * El ordenamiento/aleatorizado se hace en el componente para respetar
 * `randomize_order` y `sort_order` configurados en el editor.
 */
export async function getOrganizationTestimonials(
  organizationId: number,
  options: { featuredOnly?: boolean; limit?: number } = {}
): Promise<TestimonialRow[]> {
  const supabase = getSupabaseForPublicRead()
  const { featuredOnly = false, limit = 50 } = options

  let query = supabase
    .from('testimonials')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (featuredOnly) {
    query = query.eq('is_featured', true)
  }

  query = query.order('sort_order', { ascending: true }).limit(limit)

  const { data, error } = await query
  if (error || !data) return []
  return data as TestimonialRow[]
}
