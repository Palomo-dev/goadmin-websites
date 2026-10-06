import { cache } from 'react'
import { createAdminClient, createPublicClient } from './server'
import type { Organization, WebsiteSettings, OrganizationWithDetails, WebsitePage, WebsitePageWithSections, WebsitePageWithChildren, WebsiteMenu, WebsiteMenuItem, WebsiteMenuItemWithChildren, WebsiteMenuWithItems } from '@/types/database'
import { filterStockByBranches } from '@/lib/stock'
import { getAllowedCategoryIds } from '@/lib/outlet/catalog-helpers'
import { cacheStructural, cacheCatalog, CONTENT_TTL, SETTINGS_TTL } from './cache'
import { precioVigente } from '@/lib/memberships/precio'
import { SELECT_PADRE_ESTADO, esProductoVisibleEnWeb } from '@/lib/products/visibilidad-web'
import { aplicarCartaSede, esSede, excluirNoListados, leerCartaSede, type CartaSede } from '@/lib/products/carta-sede'

function getSupabaseForPublicRead() {
  return createAdminClient() || createPublicClient()
}

/** Carta de una sede, una sola lectura por petición (react.cache). */
const getCartaSedeDePeticion = cache(async (organizationId: number, branchId: number): Promise<CartaSede | null> => {
  const r = await leerCartaSede(getSupabaseForPublicRead(), organizationId, branchId)
  if (!r.ok) {
    // Fail-safe del listado: sin carta se muestra como el sitio principal. El cobro no depende
    // de esto: /api/orders vuelve a leer la carta y falla cerrado.
    console.error('[carta-sede] No se pudo leer website_branch_products', { organizationId, branchId, error: r.error })
    return null
  }
  return r.carta
})

/**
 * Carta por sede para los listados (lib/products/carta-sede.ts). Sin sede → `null` y los
 * listados quedan exactamente como antes.
 */
export async function getCartaSedeParaListado(
  organizationId: number,
  branchId: number | null | undefined
): Promise<CartaSede | null> {
  if (!esSede(branchId)) return null
  return getCartaSedeDePeticion(organizationId, branchId)
}

/**
 * Columnas públicas de organizations. Nunca select('*'): la fila completa
 * incluye datos fiscales e internos (NIT, razón social, dueño, plan) que
 * terminarían serializados en props del cliente.
 */
const ORG_PUBLIC_COLUMNS =
  'id, name, description, logo_url, website, email, phone, status, type_id, address, city, state, country, postal_code, primary_color, secondary_color, subdomain, custom_domain, country_code, timezone'

/** Columnas públicas de branches (sin gerente, identificación tributaria ni códigos internos). */
const BRANCH_PUBLIC_COLUMNS =
  'id, organization_id, name, address, city, state, country, postal_code, latitude, longitude, phone, email, opening_hours, features, capacity, branch_type, is_main, is_active, slug, subdomain, custom_domain, website_logo_url, website_cover_url, is_web_published, is_web_stock_source, timezone, country_code, state_code'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

export interface VariantChildrenInfo {
  /** parent_product_id → número de variantes activas */
  counts: Record<number, number>
  /** id de variante → parent_product_id (para sumar ventas de hijos al padre) */
  childToParent: Record<number, number>
  /**
   * `true` si alguna consulta falló (timeout, permisos…). En ese caso los
   * padres sin dato NO deben tratarse como "sin variantes": el listado debe
   * dejar `variant_count` indefinido para que la card muestre "Elegir" y no
   * "Agregar" (un padre agregado al carrito acaba en un pedido sin talla).
   */
  failed: boolean
}

/**
 * Variantes activas agrupadas por parent_product_id.
 *
 * PostgREST limita las respuestas (por defecto ~1000-2000 filas), por lo que
 * traer TODAS las variantes de una organización grande (ej: 13.000+) y contar
 * en JS deja a la mayoría de padres con variant_count = 0, lo que hace que el
 * botón de la card muestre "Agregar" en vez de "Elegir".
 *
 * Solución: consultar en lotes pequeños (chunks) para que cada lote traiga
 * todas sus filas sin ser cortado por el límite de PostgREST.
 *
 * @param supabase Cliente Supabase ya creado
 * @param parentIds IDs de productos padre (is_parent = true)
 */
export async function getVariantChildrenByParent(
  supabase: ReturnType<typeof getSupabaseForPublicRead>,
  parentIds: number[]
): Promise<VariantChildrenInfo> {
  const info: VariantChildrenInfo = { counts: {}, childToParent: {}, failed: false }
  if (!parentIds || parentIds.length === 0) return info

  // Procesar en lotes de 200 padres. Cada padre tiene como mucho ~15-20
  // variantes, así que 200 padres = ~3000-4000 filas en el peor caso. Aun
  // así puede superar el límite de PostgREST, por eso se pagina con range.
  const CHUNK_SIZE = 200
  for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
    const chunk = parentIds.slice(i, i + CHUNK_SIZE)
    // Paginar dentro de cada chunk hasta traer todas las variantes.
    // PostgREST devuelve máximo 1000 filas por defecto; usamos range.
    let from = 0
    const PAGE_SIZE = 1000
    let hasMore = true
    while (hasMore) {
      const { data: children, error } = await supabase
        .from('products')
        .select('id, parent_product_id')
        .in('parent_product_id', chunk)
        .eq('status', 'active')
        .range(from, from + PAGE_SIZE - 1)
      if (error) {
        // Antes un error aquí se tragaba en silencio y todo el lote quedaba
        // con 0 variantes → "Agregar" en padres con talla. Se marca y se sigue.
        console.error('[queries] getVariantChildrenByParent error:', error.message || error)
        info.failed = true
        break
      }
      if (children && children.length > 0) {
        children.forEach((c: any) => {
          info.counts[c.parent_product_id] = (info.counts[c.parent_product_id] || 0) + 1
          info.childToParent[c.id] = c.parent_product_id
        })
      }
      hasMore = children ? children.length === PAGE_SIZE : false
      from += PAGE_SIZE
    }
  }
  return info
}

/**
 * Cuenta las variantes activas agrupadas por parent_product_id.
 * Envoltorio de `getVariantChildrenByParent` para quien solo necesita el conteo.
 * @returns Mapa parent_product_id → número de variantes activas
 */
export async function countVariantsByParent(
  supabase: ReturnType<typeof getSupabaseForPublicRead>,
  parentIds: number[]
): Promise<Record<number, number>> {
  return (await getVariantChildrenByParent(supabase, parentIds)).counts
}

/**
 * `variant_count` para el listado: el conteo real, o `undefined` cuando la
 * consulta de variantes falló y el producto es padre (la card lo interpreta
 * como "tiene variantes, cantidad desconocida" y muestra "Elegir").
 */
function variantCountFor(product: any, info: VariantChildrenInfo): number | undefined {
  const n = info.counts[product.id]
  if (n !== undefined) return n
  return info.failed && product.is_parent === true ? undefined : 0
}

/**
 * Unidades vendidas por producto en la web (web_order_items) de una
 * organización, clave product_id.
 *
 * Una sola consulta por organización (paginada por `range`, PostgREST corta en
 * ~1000 filas) en vez de una por listado con `.in(product_id, …)`: con
 * cientos de ids la URL crecía sin control y, peor, nunca incluía a las
 * variantes. Cuenta todos los pedidos web, igual que antes (también los que
 * expiraron o se cancelaron); si algún día se quiere "vendidos" = pagados, el
 * filtro va aquí y en un solo sitio.
 */
const getWebSalesByProductUncached = async (organizationId: number): Promise<Record<number, number>> => {
  const supabase = getSupabaseForPublicRead()
  const salesMap: Record<number, number> = {}
  const PAGE_SIZE = 1000
  let from = 0
  let hasMore = true
  while (hasMore) {
    // ORDER BY obligatorio: sin él, Postgres no garantiza el mismo orden entre
    // páginas y `range` repite o se salta filas (hay orgs con >4.000 líneas).
    const { data, error } = await (supabase as any)
      .from('web_order_items')
      .select('product_id, quantity, web_orders!inner(organization_id)')
      .eq('web_orders.organization_id', organizationId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('[queries] getWebSalesByProduct error:', error.message || error)
      break
    }
    for (const item of data || []) {
      if (item.product_id == null) continue
      salesMap[item.product_id] = (salesMap[item.product_id] || 0) + Number(item.quantity || 1)
    }
    hasMore = (data?.length || 0) === PAGE_SIZE
    from += PAGE_SIZE
  }
  return salesMap
}

/**
 * Ids de productos de LISTADO (padre o simple, nunca variante) con ventas web,
 * ordenados de más a menos vendido. Las ventas de una variante se suman a su
 * padre, que es lo que se muestra en la card.
 */
async function getBestSellerListingIds(
  supabase: ReturnType<typeof getSupabaseForPublicRead>,
  organizationId: number,
  max: number,
): Promise<number[]> {
  const salesMap = await getWebSalesByProduct(organizationId)
  const soldIds = Object.keys(salesMap).map(Number).filter(Number.isFinite)
  if (soldIds.length === 0) return []

  const listingSales: Record<number, number> = {}
  const CHUNK = 200
  for (let i = 0; i < soldIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('products')
      .select('id, parent_product_id')
      .eq('organization_id', organizationId)
      .in('id', soldIds.slice(i, i + CHUNK))
    if (error) {
      console.error('[queries] getBestSellerListingIds error:', error.message || error)
      continue
    }
    for (const row of (data || []) as any[]) {
      const listingId = row.parent_product_id ?? row.id
      listingSales[listingId] = (listingSales[listingId] || 0) + (salesMap[row.id] || 0)
    }
  }

  return Object.entries(listingSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => Number(id))
}

/**
 * Enriquece un listado de productos padre/simples con `has_variants`,
 * `variant_count` y `sales_count` (ventas propias + de variantes).
 */
async function enrichListing(
  supabase: ReturnType<typeof getSupabaseForPublicRead>,
  organizationId: number,
  products: any[],
): Promise<any[]> {
  if (!products || products.length === 0) return []
  const parentIds = products.filter((p: any) => p.is_parent).map((p: any) => p.id)
  const [variants, salesMap] = await Promise.all([
    getVariantChildrenByParent(supabase, parentIds),
    getWebSalesByProduct(organizationId),
  ])
  // Índice padre → hijos para no recorrer childToParent por cada producto.
  const childrenOf: Record<number, number[]> = {}
  for (const [childId, parentId] of Object.entries(variants.childToParent)) {
    ;(childrenOf[parentId] ||= []).push(Number(childId))
  }
  return products.map((p: any) => ({
    ...p,
    has_variants: p.is_parent === true,
    variant_count: variantCountFor(p, variants),
    sales_count: (salesMap[p.id] || 0) + (childrenOf[p.id] || []).reduce((s, id) => s + (salesMap[id] || 0), 0),
  }))
}

/**
 * Columnas de `products` que usan los listados del sitio.
 *
 * Sustituye a `*` en las consultas del catálogo. Se omiten `busqueda_nombre`,
 * `busqueda_marca` y `busqueda_descripcion`: son copias normalizadas para la
 * búsqueda de la base y pesaban un tercio de cada respuesta (medido en una
 * tienda de 4.368 productos: 1.339 kB con `*` frente a 882 kB sin ellas). El
 * sitio no las lee en ningún componente. Mantener el payload por debajo de
 * 2 MB importa: Next descarta de la caché de datos las entradas mayores.
 */
export const PRODUCT_LIST_COLUMNS = [
  'id', 'organization_id', 'sku', 'name', 'category_id', 'unit_code',
  'created_at', 'updated_at', 'description', 'barcode', 'status', 'tag_id',
  'parent_product_id', 'tax_id', 'is_parent', 'variant_data', 'uuid',
  'station', 'track_stock', 'is_composite', 'production_type', 'product_type',
  'brand', 'reference', 'track_serial', 'serial_pattern',
  'auto_generate_serial', 'warranty_months', 'rating_avg', 'reviews_count',
  'weight_kg', 'length_cm', 'width_cm', 'height_cm',
].join(', ')

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
 * Cuántos productos por categoría se consideran al buscar la imagen de respaldo.
 * Se recorren en orden de nombre y se usa la imagen del primero que tenga alguna.
 * Acota el coste: antes se traían las imágenes de TODOS los productos.
 */
const FALLBACK_IMAGE_CANDIDATES = 8

/**
 * Para categorías sin image_url, obtiene la imagen del primer producto
 * activo de esa categoría y la usa como fallback.
 */
async function enrichCategoriesWithFallbackImage(
  supabase: any,
  categories: any[]
): Promise<any[]> {
  // --- Contar productos activos por categoría (para show_count) ---
  // OJO: PostgREST corta las respuestas a 2.000 filas, así que este conteo ya
  // venía siendo incorrecto en organizaciones con más de 2.000 productos
  // activos. Se deja EXACTAMENTE igual para no cambiar el comportamiento aquí;
  // arreglarlo bien requiere agregar en base de datos, no contar filas en JS.
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

  // Candidatos a imagen de respaldo, en el mismo orden que antes (nombre asc).
  //
  // Antes esta consulta traía TODOS los productos de esas categorías CON TODAS
  // sus imágenes embebidas, para acabar usando como mucho UNA imagen por
  // categoría. Ahora solo se piden id y category_id, y las imágenes se piden
  // aparte para un puñado de candidatos por categoría.
  const { data: products } = await supabase
    .from('products')
    .select('id, category_id')
    .in('category_id', categoryIds)
    .eq('status', 'active')
    .is('parent_product_id', null)
    .order('name', { ascending: true })

  const candidatesByCategory: Record<number, number[]> = {}
  for (const product of (products || [])) {
    const list = (candidatesByCategory[product.category_id] ||= [])
    if (list.length < FALLBACK_IMAGE_CANDIDATES) list.push(product.id)
  }

  const candidateIds = Object.values(candidatesByCategory).flat()
  const imagesByProduct: Record<number, any[]> = {}

  if (candidateIds.length > 0) {
    const { data: images } = await supabase
      .from('product_images')
      .select(`
        product_id, storage_path, is_primary, display_order,
        shared_image_id,
        shared_images ( storage_path )
      `)
      .in('product_id', candidateIds)
      // El embed anterior llegaba ordenado por display_order; se replica para
      // que "la primera imagen" del producto siga siendo la misma de antes.
      .order('display_order', { ascending: true })

    for (const img of (images || [])) {
      (imagesByProduct[img.product_id] ||= []).push(img)
    }
  }

  // Construir mapa: category_id → primera imagen disponible
  const fallbackMap: Record<number, string> = {}
  for (const [catId, productIds] of Object.entries(candidatesByCategory)) {
    for (const productId of productIds) {
      const images = imagesByProduct[productId] || []
      const primary = images.find((img: any) => img.is_primary) || images[0]
      if (!primary) continue

      const path = primary.storage_path || primary.shared_images?.storage_path
      if (!path) continue

      fallbackMap[Number(catId)] = `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
      break
    }
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
async function getOrganizationBySubdomainUncached(subdomain: string): Promise<OrganizationWithDetails | null> {
  const supabase = getSupabaseForPublicRead()
  const subdomainLower = subdomain.toLowerCase().trim()

  // PRIMERO: Buscar directamente en organizations.subdomain
  const { data: orgDirect, error: orgError } = await supabase
    .from('organizations')
    .select(`
      ${ORG_PUBLIC_COLUMNS},
      organization_types (*),
      website_settings (*)
    `)
    .ilike('subdomain', subdomainLower)
    .limit(1)

  // Si hay error de conexion, lanzar para que unstable_cache NO cachee null.
  if (orgError) throw orgError

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
      ${ORG_PUBLIC_COLUMNS},
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
async function getOrganizationByCustomDomainUncached(domain: string): Promise<OrganizationWithDetails | null> {
  const supabase = getSupabaseForPublicRead()

  // Primero buscar en organization_domains
  const { data: domainData, error: domainError } = await supabase
    .from('organization_domains')
    .select('organization_id')
    .eq('host', domain)
    .eq('is_active', true)
    .eq('status', 'verified')
    .single()

  // Si hay error de conexion (BD caida), lanzar para que unstable_cache NO cachee null.
  // Si es un 404/425 (no encontrado), devolver null (si se cachea, esta bien).
  if (domainError) {
    const code = (domainError as { code?: string }).code
    const msg = (domainError as { message?: string }).message || ''
    const isNotFound = code === 'PGRST116' || code === '425' || msg.includes('no rows')
    if (!isNotFound) throw domainError
    return null
  }
  if (!domainData) return null
  
  const orgId = (domainData as { organization_id: number }).organization_id
  
  // Luego obtener la organización completa
  const { data, error } = await supabase
    .from('organizations')
    .select(`
      ${ORG_PUBLIC_COLUMNS},
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
// cache() deduplica llamadas dentro del mismo request (layout + page + generateMetadata)
export const getOrganizationByHost = cache(async (identifier: string): Promise<OrganizationWithDetails | null> => {
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
})

/**
 * Obtiene los ids de las sucursales cuyo inventario surte la tienda web.
 *
 * Devuelve `null` si la organización no tiene ninguna sucursal marcada, para que
 * el sitio siga usando el inventario de todas las sucursales (comportamiento previo).
 */
export const getWebStockBranchIds = cache(async (organizationId: number): Promise<number[] | null> => {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_web_stock_source', true)

  if (error || !data || data.length === 0) return null
  return data.map((b: any) => b.id as number)
})

/**
 * Obtiene los productos de una organización para mostrar en el sitio.
 * F3: acepta `branchId` opcional para filtrar por categorías visibles del outlet.
 */
const getOrganizationProductsUncached = async (organizationId: number, limit = 12, branchId?: number | null) => {
  const supabase = getSupabaseForPublicRead()

  // F3: filtrar categorías permitidas según la regla de branch_id.
  const allowedCategoryIds = await getAllowedCategoryIds(organizationId, branchId)
  if (allowedCategoryIds !== null && allowedCategoryIds.length === 0) return []
  // Carta por sede: null sin sede (sin cambios).
  const cartaSede = await getCartaSedeParaListado(organizationId, branchId)

  let query = supabase
    .from('products')
    .select(`
      ${PRODUCT_LIST_COLUMNS},
      product_prices (id, price, compare_price, effective_to),
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
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .is('parent_product_id', null)

  if (allowedCategoryIds) {
    query = query.in('category_id', allowedCategoryIds)
  }
  query = excluirNoListados(query, cartaSede)

  const { data, error } = await query.limit(limit)

  if (error) return []

  // F3: cuando hay outlet activo, el stock se filtra solo por ese branch.
  const stockBranchIds = (branchId !== undefined && branchId !== null)
    ? [branchId]
    : await getWebStockBranchIds(organizationId)

  // Variantes (para "Elegir" y el badge) y ventas (para ordenar por vendidos).
  return aplicarCartaSede(filterStockByBranches(
    normalizeProductPrices(await enrichListing(supabase, organizationId, data || [])),
    stockBranchIds
  ), cartaSede)
}

/**
 * Obtiene productos en oferta (compare_price > price), ordenados por ventas.
 * F3: acepta `branchId` opcional para filtrar por categorías visibles del outlet.
 */
const getOfferProductsUncached = async (organizationId: number, limit = 500, branchId?: number | null) => {
  const supabase = getSupabaseForPublicRead()

  // F3: filtrar categorías permitidas según la regla de branch_id.
  const allowedCategoryIds = await getAllowedCategoryIds(organizationId, branchId)
  if (allowedCategoryIds !== null && allowedCategoryIds.length === 0) return []

  const OFFER_SELECT = `
      ${PRODUCT_LIST_COLUMNS},
      categories ( id, name, slug ),
      product_prices (id, price, compare_price, effective_to),
      product_images (
        id, storage_path, is_primary, display_order, shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `
  const baseQuery = () => {
    let q = supabase
      .from('products')
      .select(OFFER_SELECT)
      .is('product_prices.effective_to', null)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .is('parent_product_id', null)
    if (allowedCategoryIds) q = q.in('category_id', allowedCategoryIds)
    return q
  }

  // 1. Candidatos. Las tiendas grandes tienen miles de productos y aquí solo
  //    caben 500 antes de ordenar por vendidos, así que la ELECCIÓN de esos 500
  //    decide qué se ve. Regla: primero TODOS los que han vendido algo (propio
  //    o por sus variantes), después se completa con los más recientes.
  //    Antes se tomaban 500 sin orden (subconjunto aleatorio) y luego 500
  //    recientes: en ambos casos el más vendido de una tienda podía quedarse
  //    fuera (org 145: 152 vendidos, producto nº 4.330 por antigüedad).
  const bestSellerIds = await getBestSellerListingIds(supabase, organizationId, limit)

  const products: any[] = []
  const seen = new Set<number>()
  const IDS_PER_QUERY = 200 // mantiene la URL de PostgREST acotada
  for (let i = 0; i < bestSellerIds.length; i += IDS_PER_QUERY) {
    const { data, error } = await baseQuery().in('id', bestSellerIds.slice(i, i + IDS_PER_QUERY))
    if (error) {
      console.error('[queries] getOfferProducts best sellers error:', error.message || error)
      continue
    }
    for (const p of (data || []) as any[]) if (!seen.has(p.id)) { seen.add(p.id); products.push(p) }
  }

  const { data: recent, error } = await baseQuery()
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(500)
  if (error && products.length === 0) return []
  for (const p of (recent || []) as any[]) if (!seen.has(p.id)) { seen.add(p.id); products.push(p) }

  if (products.length === 0) return []

  // Normalizar precios para que [0] sea el vigente. Con sede, la carta va antes del filtro de
  // ofertas: la oferta se decide contra el precio que de verdad se muestra en esa sede.
  const normalized = aplicarCartaSede(
    normalizeProductPrices(products),
    await getCartaSedeParaListado(organizationId, branchId)
  )

  // 2. Filtrar solo los que tienen compare_price > price
  const offers = normalized.filter((p: any) => {
    const pp = p.product_prices?.[0]
    if (!pp) return false
    return pp.compare_price && Number(pp.compare_price) > Number(pp.price)
  })

  if (offers.length === 0) return []

  // 3. Variantes (para "Elegir") y ventas propias + de variantes.
  const enriched = await enrichListing(supabase, organizationId, offers)

  const stockBranchIds = (branchId !== undefined && branchId !== null)
    ? [branchId]
    : await getWebStockBranchIds(organizationId)

  // 4. Ordenar por ventas (descendente) y limitar
  return filterStockByBranches(enriched, stockBranchIds)
    .sort((a: any, b: any) => b.sales_count - a.sales_count)
    .slice(0, limit)
}

/**
 * Obtiene los servicios de una organización (usando productos tipo servicio).
 * F3: acepta `branchId` opcional para filtrar por categorías visibles del outlet.
 */
export async function getOrganizationServices(organizationId: number, limit = 12, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  // F3: filtrar categorías permitidas según la regla de branch_id.
  const allowedCategoryIds = await getAllowedCategoryIds(organizationId, branchId)
  if (allowedCategoryIds !== null && allowedCategoryIds.length === 0) return []

  // Los servicios se manejan como productos con unit_code 'SV' (Servicio)
  let query = supabase
    .from('products')
    .select(`
      *,
      product_prices (id, price, compare_price, effective_to)
    `)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('unit_code', 'SV')
    .eq('status', 'active')

  if (allowedCategoryIds) {
    query = query.in('category_id', allowedCategoryIds)
  }

  const { data, error } = await query.limit(limit)

  if (error) return []
  return aplicarCartaSede(
    normalizeProductPrices(data || []),
    await getCartaSedeParaListado(organizationId, branchId)
  )
}

// getOrganizationSpaces movida más abajo con soporte de imágenes y servicios

/**
 * Obtiene las sucursales de una organización
 */
async function getOrganizationBranchesUncached(organizationId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('branches')
    .select(BRANCH_PUBLIC_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (error) return []
  return data || []
}

/**
 * Obtiene las categorías de productos de una organización.
 * F3: acepta `branchId` opcional. undefined = no filtrar (backward compat),
 * null = solo globales, X = outlet X + globales.
 */
async function getOrganizationCategoriesUncached(organizationId: number, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  // Regla de filtro branch_id (F1 §5.0)
  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (branchId !== undefined) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }
  // branchId === undefined → no filtrar (backward compat)

  const { data, error } = await query
    .order('display_order', { ascending: true })
    .order('rank', { ascending: true })

  if (error) return []
  return enrichCategoriesWithFallbackImage(supabase, data || [])
}

/**
 * Obtiene productos por categoría.
 * F3: acepta `branchId` opcional; valida que la categoría sea visible para el outlet.
 */
async function getProductsByCategoryUncached(organizationId: number, categoryId: number, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  // F3: si hay branchId, validar que la categoría sea visible para ese outlet
  if (typeof branchId === 'number') {
    const { data: cat } = await (supabase as any)
      .from('categories')
      .select('id, branch_id')
      .eq('organization_id', organizationId)
      .eq('id', categoryId)
      .eq('is_active', true)
      .maybeSingle()
    if (!cat || (cat.branch_id !== null && cat.branch_id !== branchId)) {
      return [] // categoría no visible para este outlet
    }
  }

  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_LIST_COLUMNS}, product_prices (id, price, compare_price, effective_to), stock_levels ( branch_id, qty_on_hand, qty_reserved )`)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .is('parent_product_id', null)

  if (error) return []
  const stockBranchIds = (branchId !== undefined && branchId !== null)
    ? [branchId]
    : await getWebStockBranchIds(organizationId)
  return aplicarCartaSede(
    filterStockByBranches(normalizeProductPrices(data || []), stockBranchIds),
    await getCartaSedeParaListado(organizationId, branchId)
  )
}

/**
 * Obtiene productos con imagen para varias categorías a la vez.
 * Devuelve un mapa `categoryId -> products[]` (F7.2 preview de banners).
 * Incluye `product_images` para resolver la miniatura en el preview.
 * F3: acepta `branchId` opcional para filtrar los categoryIds a los visibles del outlet.
 */
const getProductsByCategoryIdsUncached = async (
  organizationId: number,
  categoryIds: number[],
  limitPerCategory = 12,
  branchId?: number | null,
): Promise<Record<number, any[]>> => {
  if (categoryIds.length === 0) return {}
  const supabase = getSupabaseForPublicRead()

  // F3: si hay branchId, filtrar los categoryIds a solo los visibles del outlet
  let effectiveCategoryIds = categoryIds
  if (typeof branchId === 'number') {
    const allowedCategoryIds = await getAllowedCategoryIds(organizationId, branchId)
    if (allowedCategoryIds === null || allowedCategoryIds.length === 0) return {}
    // Intersectar los categoryIds solicitados con los permitidos
    const allowedSet = new Set(allowedCategoryIds)
    effectiveCategoryIds = categoryIds.filter(id => allowedSet.has(id))
    if (effectiveCategoryIds.length === 0) return {}
  }

  const { data, error } = await supabase
    .from('products')
    .select(`
      ${PRODUCT_LIST_COLUMNS},
      product_prices (id, price, compare_price, effective_to),
      product_images (
        id,
        storage_path,
        is_primary,
        shared_images ( storage_path )
      )
    `)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .in('category_id', effectiveCategoryIds)
    .eq('status', 'active')
    .is('parent_product_id', null)

  if (error || !data) return {}

  // Carta por sede: los ocultos no ocupan hueco en el límite por categoría.
  const cartaSede = await getCartaSedeParaListado(organizationId, branchId)
  const map: Record<number, any[]> = {}
  const filas: any[] = cartaSede
    ? aplicarCartaSede(normalizeProductPrices(data as any[]), cartaSede)
    : data // sin sede: exactamente como antes (sin normalizar aquí)
  filas.forEach((p: any) => {
    if (!map[p.category_id]) map[p.category_id] = []
    if (map[p.category_id].length < limitPerCategory) {
      map[p.category_id].push(p)
    }
  })
  // Variantes y ventas solo de los que se van a mostrar (antes no se
  // calculaban y los padres salían con "Agregar").
  const shown = Object.values(map).flat()
  const enriched = await enrichListing(supabase, organizationId, shown)
  const byId = new Map<number, any>(enriched.map((p: any) => [p.id, p]))
  for (const catId of Object.keys(map)) {
    map[Number(catId)] = map[Number(catId)].map((p: any) => byId.get(p.id) || p)
  }
  return map
}

/**
 * Obtiene páginas del sitio por ids (F7.1 enlace tipado a página).
 * Devuelve un mapa `pageId -> { slug, title }` para resolver `/{slug}`.
 */
async function getWebsitePagesByIdsUncached(
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
async function getCategoryBySlugUncached(organizationId: number, slug: string, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('is_active', true)

  // F3-R3: filtrar por branchId del outlet
  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (branchId !== undefined) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query.single()

  if (error || !data) return null
  const [enriched] = await enrichCategoriesWithFallbackImage(supabase, [data])
  return enriched as any
}

/**
 * Obtiene subcategorías de una categoría padre
 */
async function getSubcategoriesUncached(organizationId: number, parentId: number, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('categories')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('parent_id', parentId)
    .eq('is_active', true)

  // F3-R3: filtrar por branchId del outlet
  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (branchId !== undefined) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query.order('rank', { ascending: true })

  if (error) return []
  return enrichCategoriesWithFallbackImage(supabase, data || [])
}

/**
 * Obtiene productos por categoría con paginación y ordenamiento.
 * F3: acepta `branchId` opcional en `options` para validar que la categoría
 * (y subcategorías) sean visibles para el outlet.
 */
async function getProductsByCategoryPaginatedUncached(
  organizationId: number,
  categoryId: number,
  options: {
    page?: number
    limit?: number
    sort?: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest' | 'best_selling'
    subcategoryId?: number
    branchId?: number | null
  } = {}
) {
  const supabase = getSupabaseForPublicRead()
  const { page = 1, limit = 12, sort = 'best_selling', subcategoryId, branchId } = options
  const offset = (page - 1) * limit

  // F3: si hay branchId, validar que la categoría padre sea visible para el outlet
  if (typeof branchId === 'number') {
    const { data: parentCat } = await (supabase as any)
      .from('categories')
      .select('id, branch_id')
      .eq('organization_id', organizationId)
      .eq('id', categoryId)
      .eq('is_active', true)
      .maybeSingle()
    if (!parentCat || (parentCat.branch_id !== null && parentCat.branch_id !== branchId)) {
      return { products: [], total: 0 } // categoría no visible para este outlet
    }
  }

  // Obtener IDs de subcategorías para incluir productos de subcategorías
  let categoryIds = [categoryId]
  if (!subcategoryId) {
    let subQuery = supabase
      .from('categories')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('parent_id', categoryId)
      .eq('is_active', true)
    // F3: filtrar subcategorías visibles del outlet
    if (typeof branchId === 'number') {
      subQuery = subQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
    }
    const { data: subs } = await subQuery
    if (subs && subs.length > 0) {
      categoryIds = [...categoryIds, ...subs.map((s: any) => s.id)]
    }
  } else {
    // F3: si hay branchId y subcategoryId, validar que la subcategoría pertenece al outlet
    if (typeof branchId === 'number') {
      const { data: subCat } = await (supabase as any)
        .from('categories')
        .select('id, branch_id')
        .eq('organization_id', organizationId)
        .eq('id', subcategoryId)
        .eq('is_active', true)
        .maybeSingle()
      if (!subCat || (subCat.branch_id !== null && subCat.branch_id !== branchId)) {
        return { products: [], total: 0 }
      }
    }
    categoryIds = [subcategoryId]
  }

  let query = supabase
    .from('products')
    .select(`
      ${PRODUCT_LIST_COLUMNS},
      product_prices (id, price, compare_price, effective_to),
      product_images (
        id, storage_path, is_primary, display_order,
        shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `, { count: 'exact' })
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .in('category_id', categoryIds)
    .eq('status', 'active')
    .is('parent_product_id', null)

  // Carta por sede: los ocultos se excluyen en SQL para que `count` y `range` cuadren.
  const cartaSede = await getCartaSedeParaListado(organizationId, branchId)
  query = excluirNoListados(query, cartaSede)

  // F3: stock por outlet activo
  const stockBranchIds = (branchId !== undefined && branchId !== null)
    ? [branchId]
    : await getWebStockBranchIds(organizationId)

  // Para best_selling, traer todos y ordenar en memoria con datos de ventas
  if (sort === 'best_selling') {
    query = query.order('name', { ascending: true })
    const { data: allProducts, error: allError, count } = await query

    if (allError || !allProducts) return { products: [], total: 0 }

    // Ventas (propias + de variantes) y variantes, y ordenar/paginar en memoria
    const sorted = (await enrichListing(supabase, organizationId, allProducts))
      .sort((a: any, b: any) => b.sales_count - a.sales_count)

    const paginated = sorted.slice(offset, offset + limit)
    return { products: aplicarCartaSede(filterStockByBranches(normalizeProductPrices(paginated), stockBranchIds), cartaSede), total: count || 0 }
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

  // Adjuntar sales_count y variantes para los demás sorts
  const prods = filterStockByBranches(data || [], stockBranchIds)
  if (prods.length > 0) {
    const enriched = await enrichListing(supabase, organizationId, prods)
    return { products: aplicarCartaSede(normalizeProductPrices(enriched), cartaSede), total: count || 0 }
  }

  return { products: aplicarCartaSede(normalizeProductPrices(prods), cartaSede), total: count || 0 }
}

/**
 * Obtiene la categoría padre de una categoría
 */
async function getParentCategoryUncached(organizationId: number, parentId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('organization_id', organizationId)
    .eq('id', parentId)
    .eq('is_active', true)
    .single()
  
  if (error || !data) return null
  return data as any
}

/**
 * Obtiene las variantes (productos hijos) de un producto padre
 */
export async function getProductVariants(parentProductId: number, organizationId: number, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (id, price, compare_price, effective_to),
      product_images (
        id, storage_path, is_primary, display_order,
        shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved )
    `)
    .is('product_prices.effective_to', null)
    .eq('parent_product_id', parentProductId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name')

  if (error) return []
  const webBranchIds = await getWebStockBranchIds(organizationId)
  // Carta por sede solo si se pasa una sede; sin ella, exactamente como antes.
  return aplicarCartaSede(
    filterStockByBranches(normalizeProductPrices(data || []), webBranchIds),
    await getCartaSedeParaListado(organizationId, branchId)
  )
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
 * F3: acepta `branchId` opcional para filtrar espacios del outlet + globales.
 */
export async function getOrganizationSpaces(organizationId: number, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  // F3: si hay branchId numérico, filtrar espacios del outlet + globales.
  // Si branchId es undefined, traer todos los branches de la org (backward compat).
  let branchIds: number[] | null = null
  if (typeof branchId === 'number') {
    // Outlet activo: espacios del outlet + globales (branch_id IS NULL).
    // Se usa OR en vez de IN para incluir los globales.
    branchIds = null // se maneja con OR abajo
  } else if (branchId === undefined) {
    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', organizationId)
    if (!branches || branches.length === 0) return []
    branchIds = branches.map((b: any) => b.id as number)
  } else {
    // branchId === null → solo espacios globales (branch_id IS NULL)
    branchIds = null
  }

  // Spaces con tipo
  let spacesQuery = supabase
    .from('spaces')
    .select(`
      id, label, floor_zone, status, description, metadata, space_type_id, branch_id,
      space_types ( id, name, short_name, category_code, base_rate, capacity, area_sqm, amenities, booking_rules )
    `)
    .eq('status', 'available')

  if (branchId === null) {
    spacesQuery = (spacesQuery as any).is('branch_id', null)
  } else if (typeof branchId === 'number') {
    // Outlet activo: espacios del outlet + globales (branch_id IS NULL)
    spacesQuery = (spacesQuery as any).or(`branch_id.eq.${branchId},branch_id.is.null`)
  } else if (branchIds) {
    spacesQuery = (spacesQuery as any).in('branch_id', branchIds)
  }

  const { data: spaces, error } = await spacesQuery.order('label', { ascending: true })

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
 * Obtiene un producto por ID dentro de la organización del contexto.
 * Un producto eliminado, o una variante cuyo padre está eliminado, responde como
 * no encontrado (`null`): ver `lib/products/visibilidad-web.ts`.
 */
export async function getProductById(productId: number, organizationId: number) {
  const supabase = getSupabaseForPublicRead()
  
  const { data, error } = await supabase
    .from('products')
    .select(`*, product_prices (id, price, compare_price, effective_to), categories (*), ${SELECT_PADRE_ESTADO}`)
    .is('product_prices.effective_to', null)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle()
  
  if (error || !data) return null
  if (!esProductoVisibleEnWeb(data, organizationId)) return null
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
 * Obtiene una página por slug con sus secciones visibles ordenadas.
 *
 * F1: acepta `branchId` opcional. Cuando es un número (outlet activo), busca
 * primero la página del outlet (branch_id = branchId) y si no existe cae a la
 * página global (branch_id IS NULL). Cuando es null/undefined, behavior
 * idéntica a antes (solo página global).
 */
async function getWebsitePageBySlugUncached(
  organizationId: number,
  slug: string,
  branchId?: number | null,
): Promise<WebsitePageWithSections | null> {
  const supabase = getSupabaseForPublicRead()

  const select = `
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
  `

  // 1. Si hay outlet activo, buscar primero la página del outlet
  if (typeof branchId === 'number') {
    const { data: outletPage } = await supabase
      .from('website_pages')
      .select(select)
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .eq('is_published', true)
      .eq('branch_id', branchId)
      .maybeSingle()
    if (outletPage) {
      const page = outletPage as WebsitePageWithSections
      page.website_page_sections = (page.website_page_sections || [])
        .filter((s) => s.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)
      return page
    }
    // Fallback: buscar página global si no hay del outlet
  }

  // 2. Buscar página global (branch_id IS NULL)
  const { data, error } = await supabase
    .from('website_pages')
    .select(select)
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('is_published', true)
    .is('branch_id', null)
    .maybeSingle()

  if (error || !data) return null

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
async function getWebsitePageByTypeUncached(
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
 * F1: acepta `branchId` opcional para filtrar páginas del outlet + globales.
 */
async function getWebsiteHeaderNavUncached(organizationId: number, branchId?: number | null): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('website_pages')
    .select('id, slug, title, header_order, parent_page_id, linked_category_id, menu_icon, menu_badge')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('show_in_header', true)

  // Regla de filtro branch_id (F1 §5.0)
  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (branchId !== undefined) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }
  // branchId === undefined → no filtrar (backward compat)

  const { data, error } = await query.order('header_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
}

/**
 * Obtiene el árbol jerárquico de páginas del header (anidadas por parent_page_id)
 */
async function getWebsiteHeaderNavTreeUncached(organizationId: number, branchId?: number | null): Promise<WebsitePageWithChildren[]> {
  const flat = await getWebsiteHeaderNav(organizationId, branchId)
  return buildMenuTree(flat)
}

/**
 * Obtiene las páginas para el footer
 * Incluye campos de mega-menú para jerarquía del footer
 * F1: acepta `branchId` opcional para filtrar páginas del outlet + globales.
 */
async function getWebsiteFooterNavUncached(organizationId: number, branchId?: number | null): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('website_pages')
    .select('id, slug, title, footer_order, parent_page_id, linked_category_id, menu_icon, menu_badge')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('show_in_footer', true)

  // Regla de filtro branch_id (F1 §5.0)
  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (branchId !== undefined) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }
  // branchId === undefined → no filtrar (backward compat)

  const { data, error } = await query.order('footer_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
}

/**
 * Obtiene el árbol jerárquico de páginas del footer (anidadas por parent_page_id)
 */
async function getWebsiteFooterNavTreeUncached(organizationId: number, branchId?: number | null): Promise<WebsitePageWithChildren[]> {
  const flat = await getWebsiteFooterNav(organizationId, branchId)
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

async function getMenuCategoriesUncached(organizationId: number, branchId?: number | null): Promise<MenuCategory[]> {
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('categories')
    .select('id, uuid, name, slug, icon, color, image_url, parent_id, is_active, display_order, rank')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  // Regla de filtro branch_id (F1 §5.0)
  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (branchId !== undefined) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }
  // branchId === undefined → no filtrar (backward compat)

  const { data, error } = await query.order('display_order', { ascending: true }).order('rank', { ascending: true })

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
async function getMetaPixelIdUncached(organizationId: number): Promise<string | null> {
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
async function getGoogleAdsConfigUncached(organizationId: number): Promise<{ conversionId: string; conversionLabel?: string } | null> {
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

/** Plan de membresía tal como lo pinta el sitio público. */
export interface MembershipPlanPublic {
  id: number
  name: string
  description: string | null
  duration_days: number
  duration_unit: string
  duration_value: number | null
  frequency: string | null
  access_rules: Record<string, any> | null
  /** Producto que se vende (el plan es su configuración). Null = el plan no se vende en línea. */
  product_id: number | null
  /** Precio vigente del producto en `product_prices`. Null = sin precio vigente: no se vende en línea. */
  price: number | null
  compare_price: number | null
}

/**
 * Obtiene los planes de membresía activos de una organización.
 *
 * Una membresía se compra como su PRODUCTO (pedido web normal) y la base la activa al
 * confirmarse el pago (`fn_membresias_activar_venta`, desde el ERP). Por eso el precio sale
 * de `product_prices` del producto del plan, nunca de `membership_plans.price` (obsoleto),
 * y un plan cuyo producto no está activo o no tiene precio vigente se devuelve con
 * `price = null` (se muestra, pero no se puede agregar al carrito).
 */
export async function getMembershipPlans(organizationId: number): Promise<MembershipPlanPublic[]> {
  const supabase = getSupabaseForPublicRead()

  // `as any`: types/database.ts hoy resuelve a `never` (ver el aviso en ese archivo). Las
  // columnas de membership_plans están declaradas allí con sus nombres reales.
  const { data, error } = await (supabase as any)
    .from('membership_plans')
    .select('id, name, description, duration_days, duration_unit, duration_value, frequency, access_rules, product_id, products:product_id ( id, status, product_prices ( id, price, compare_price, effective_from, effective_to ) )')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (error) {
    console.error('[getMembershipPlans] error consultando membership_plans:', error)
    return []
  }

  const plans: MembershipPlanPublic[] = ((data || []) as any[]).map((row) => {
    const product = row.products
    const vendible = product && product.status === 'active'
    const precio = vendible ? precioVigente(product.product_prices) : null
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      duration_days: row.duration_days,
      duration_unit: row.duration_unit,
      duration_value: row.duration_value ?? null,
      frequency: row.frequency ?? null,
      access_rules: row.access_rules ?? null,
      product_id: precio ? row.product_id : null,
      price: precio ? precio.price : null,
      compare_price: precio ? precio.compare_price : null,
    }
  })

  // Antes se ordenaba por membership_plans.price en la base; ahora por el precio vigente.
  // Los que no se venden en línea (sin precio) van al final.
  return plans.sort((a, b) => {
    if (a.price === null && b.price === null) return a.id - b.id
    if (a.price === null) return 1
    if (b.price === null) return -1
    return a.price - b.price || a.id - b.id
  })
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
 * Obtiene productos para el menú de restaurante con tags, imágenes y stock.
 * F3: acepta `branchId` opcional para filtrar por categorías visibles del outlet.
 */
async function getMenuProductsUncached(organizationId: number, limit = 100, branchId?: number | null) {
  const supabase = getSupabaseForPublicRead()

  // F3: filtrar categorías permitidas según la regla de branch_id.
  const allowedCategoryIds = await getAllowedCategoryIds(organizationId, branchId)
  if (allowedCategoryIds !== null && allowedCategoryIds.length === 0) return []

  let query = supabase
    .from('products')
    .select(`
      ${PRODUCT_LIST_COLUMNS},
      product_prices (id, price, compare_price, effective_to),
      product_images (
        id, storage_path, is_primary, display_order, shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved ),
      product_tag_relations ( tag_id )
    `)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  if (allowedCategoryIds) {
    query = query.in('category_id', allowedCategoryIds)
  }
  // Carta por sede: null sin sede (sin cambios).
  const cartaSede = await getCartaSedeParaListado(organizationId, branchId)
  query = excluirNoListados(query, cartaSede)

  const { data, error } = await query.order('name', { ascending: true }).limit(limit)

  if (error) return []
  const stockBranchIds = (branchId !== undefined && branchId !== null)
    ? [branchId]
    : await getWebStockBranchIds(organizationId)
  return aplicarCartaSede(filterStockByBranches(normalizeProductPrices(data || []), stockBranchIds), cartaSede)
}

/**
 * Obtiene productos por sus IDs (para favoritos, re-pedidos, etc.)
 * F3: acepta `branchId` opcional para filtrar por categorías visibles del outlet.
 */
export async function getProductsByIds(productIds: number[], organizationId: number, branchId?: number | null) {
  if (!productIds.length) return []
  const supabase = getSupabaseForPublicRead()

  let query = supabase
    .from('products')
    .select(`
      *,
      product_prices (id, price, compare_price, effective_to),
      product_images (
        id, storage_path, is_primary, display_order, shared_image_id,
        shared_images ( storage_path )
      ),
      stock_levels ( branch_id, qty_on_hand, qty_reserved ),
      ${SELECT_PADRE_ESTADO}
    `)
    .is('product_prices.effective_to', null)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('id', productIds)

  // F3: si hay branchId, filtrar por categorías visibles del outlet
  if (typeof branchId === 'number') {
    const allowedCategoryIds = await getAllowedCategoryIds(organizationId, branchId)
    if (allowedCategoryIds === null || allowedCategoryIds.length === 0) return []
    query = query.in('category_id', allowedCategoryIds)
  }

  const { data, error } = await query

  if (error) return []
  // Variantes de un padre eliminado: fuera, como si no existieran.
  const visibles = (data || []).filter((p: any) => esProductoVisibleEnWeb(p, organizationId))
  const stockBranchIds = (branchId !== undefined && branchId !== null)
    ? [branchId]
    : await getWebStockBranchIds(organizationId)
  return aplicarCartaSede(
    filterStockByBranches(normalizeProductPrices(visibles), stockBranchIds),
    await getCartaSedeParaListado(organizationId, branchId)
  )
}

/**
 * Obtiene las etiquetas de productos de una organización (vegetariano, picante, etc.)
 */
async function getOrganizationTagsUncached(organizationId: number) {
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
    .select(`id, organization_id, status, parent_product_id, ${SELECT_PADRE_ESTADO}`)
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  if (!products || products.length === 0) return []
  const productIds = products
    .filter((p: any) => esProductoVisibleEnWeb(p, organizationId))
    .map((p: any) => p.id)
  if (productIds.length === 0) return []

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
 * Obtiene un envío por número de tracking para seguimiento público.
 *
 * Esta función devolvía `null` para CUALQUIER guía: seleccionaba seis columnas que
 * no existen en `shipments` (`sender_city`, `sender_department`, `receiver_city`,
 * `receiver_department`, `total_weight_kg`, `total_packages`) y tres que no existen
 * en `proof_of_delivery` (`receiver_name`, `relationship`, `confirmed_at`). El select
 * fallaba, el error se colapsaba en `return null`, y la página lo mostraba como
 * "envío no encontrado" — indistinguible de una guía inexistente.
 *
 * Nombres reales verificados contra el esquema; la referencia de columnas correctas
 * es `app/api/orders/[id]/delivery/route.ts`, que sí funciona.
 *
 * `organizationId` es obligatorio: sin él, el sitio de cualquier organización podía
 * rastrear guías de cualquier otra, y `tracking_number` no es único entre organizaciones
 * (`idx_shipments_tracking` no es un índice único). Por eso también `.maybeSingle()`
 * sobre el más reciente en vez de `.single()`, que lanza con 0 filas y con más de una.
 *
 * El origen del envío no vive en `shipments`, así que ya no se devuelve.
 */
export async function getShipmentByTracking(
  trackingNumber: string,
  organizationId: number
) {
  const supabase = getSupabaseForPublicRead()

  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(`
      id, organization_id, shipment_number, tracking_number, service_level,
      delivery_city, delivery_department,
      weight_kg, package_count,
      expected_delivery_date, delivered_at,
      status, created_at
    `)
    .eq('tracking_number', trackingNumber)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[getShipmentByTracking] error consultando shipments:', error)
    return null
  }
  if (!shipment) return null

  // `as any` a conciencia: types/database.ts hoy resuelve a `never` para todo (ver aviso en ese
  // archivo). El contrato de columnas lo verifica scripts/verify-tracking.mjs contra la base real.
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
      .select('recipient_name, recipient_relationship, delivered_at, photo_urls')
      .eq('shipment_id', shipmentId)
      .order('delivered_at', { ascending: false })
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

async function getBranchesByOrgUncached(organizationId: number) {
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

async function getWebsitePagesUncached(organizationId: number): Promise<WebsitePage[]> {
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
async function getDefaultTaxUncached(organizationId: number): Promise<{ name: string; rate: number; taxIncluded: boolean } | null> {
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
 * Menús por sede (V2, ADR-002 D3). `website_menus.branch_id` NULL = menú del sitio principal; con
 * valor, copia propia de esa sede (`source_menu_id` apunta al original del principal).
 *
 * - Sin sede (`branchId === undefined`): solo menús del principal. Las copias de sede nunca salen
 *   en el sitio principal.
 * - Con sede: el menú de la sede si existe; si no, el del principal. Una copia de sede reemplaza a
 *   su original (aunque la sede la haya desactivado: desactivarla es ocultarlo en esa sede). Los
 *   menús de otras sedes no salen nunca.
 *
 * Recibe las filas SIN filtrar por `is_active` cuando hay sede, para poder respetar una copia
 * desactivada; filtra `is_active` al final.
 */
function menusParaSede(menus: WebsiteMenu[], branchId: number | undefined): WebsiteMenu[] {
  if (branchId === undefined) {
    return menus.filter(m => m.branch_id === null && m.is_active)
  }
  const reemplazados = new Set(
    menus
      .filter(m => m.branch_id === branchId && m.source_menu_id)
      .map(m => m.source_menu_id as string)
  )
  return menus.filter(m => {
    if (!m.is_active) return false
    if (m.branch_id === null) return !reemplazados.has(m.id)
    return m.branch_id === branchId
  })
}

/** `branchId` válido para interpolar en un filtro `.or()` de PostgREST. */
function sedeValida(branchId: number | undefined): branchId is number {
  return typeof branchId === 'number' && Number.isInteger(branchId) && branchId > 0
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Obtiene todos los menús de una organización con sus items en árbol jerárquico.
 * Incluye datos relacionados (páginas y categorías) para cada item.
 */
async function getWebsiteMenusUncached(organizationId: number): Promise<WebsiteMenuWithItems[]> {
  const supabase = getSupabaseForPublicRead()
  if (!supabase) return []

  // Solo menús del sitio principal: las copias por sede (branch_id no nulo) nunca salen aquí.
  const { data: menus, error: menusError } = await (supabase as any)
    .from('website_menus')
    .select('*')
    .eq('organization_id', organizationId)
    .is('branch_id', null)
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
      .eq('organization_id', organizationId)
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
      .eq('organization_id', organizationId)
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
 * Filtra en SQL para no traer menús innecesarios.
 */
async function getWebsiteMenusByLocationUncached(
  organizationId: number,
  location: 'header' | 'footer',
  branchId?: number
): Promise<WebsiteMenuWithItems[]> {
  const supabase = getSupabaseForPublicRead()
  if (!supabase) return []

  // Filtrar por location en SQL: incluir 'both' siempre
  let menusQuery = (supabase as any)
    .from('website_menus')
    .select('*')
    .eq('organization_id', organizationId)
    .in('location', [location, 'both'])
  if (sedeValida(branchId)) {
    // Sede: menús del principal + copias de ESTA sede; menusParaSede elige y filtra is_active.
    menusQuery = menusQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  } else {
    // Sitio principal: exactamente la consulta de antes, más branch_id IS NULL.
    menusQuery = menusQuery.is('branch_id', null).eq('is_active', true)
  }
  const { data: menusRaw, error: menusError } = await menusQuery
    .order(location === 'footer' ? 'footer_order' : 'header_order', { ascending: true })

  if (menusError || !menusRaw || menusRaw.length === 0) return []
  const menus = menusParaSede(menusRaw as WebsiteMenu[], sedeValida(branchId) ? branchId : undefined)
  if (menus.length === 0) return []

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
      .eq('organization_id', organizationId)
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
      .eq('organization_id', organizationId)
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
 * Obtiene un menú específico por ID con sus items en árbol jerárquico.
 * Útil para cargar el menú asignado a header_menu_id o header_mega_menu_id.
 */
async function getMenuByIdUncached(
  menuId: string,
  organizationId: number,
  branchId?: number
): Promise<WebsiteMenuWithItems | null> {
  const supabase = getSupabaseForPublicRead()
  if (!supabase) return null

  // Service role: sin el filtro por organización, un `header_menu_id` ajeno
  // (la FK no exige que el menú sea de la misma organización) pintaría el
  // menú de otra. Igual con sus ítems, páginas y categorías.
  let menu: WebsiteMenu | null = null
  if (sedeValida(branchId) && UUID_RE.test(menuId)) {
    // Sede: la copia de esta sede del menú pedido si existe; si no, el menú pedido (del principal
    // o, si los ajustes de la sede ya apuntan a su copia, la propia copia). Nunca el de otra sede.
    const { data: filas, error: menuError } = await (supabase as any)
      .from('website_menus')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`id.eq.${menuId},and(source_menu_id.eq.${menuId},branch_id.eq.${branchId})`)
    if (menuError || !filas) return null
    const lista = filas as WebsiteMenu[]
    const copia = lista.find(m => m.branch_id === branchId && m.source_menu_id === menuId)
    const pedido = lista.find(m => m.id === menuId && (m.branch_id === null || m.branch_id === branchId))
    const elegido = copia ?? pedido ?? null
    menu = elegido && elegido.is_active ? elegido : null
  } else {
    // Sitio principal: exactamente la consulta de antes, más branch_id IS NULL.
    const { data, error: menuError } = await (supabase as any)
      .from('website_menus')
      .select('*')
      .eq('id', menuId)
      .eq('organization_id', organizationId)
      .is('branch_id', null)
      .eq('is_active', true)
      .maybeSingle()
    if (menuError) return null
    menu = (data as WebsiteMenu | null) ?? null
  }

  if (!menu) return null

  const { data: items, error: itemsError } = await (supabase as any)
    .from('website_menu_items')
    .select('*')
    .eq('menu_id', menu.id)
    .eq('organization_id', organizationId)
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
      .eq('organization_id', organizationId)
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
      .eq('organization_id', organizationId)
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

// ---------------------------------------------------------------------------
// Caché de datos estructurales.
//
// Cada función de arriba conserva su implementación intacta (sufijo
// `Uncached`) y se exporta envuelta, con la MISMA firma pública, así que
// ningún llamador cambia. Solo se cachea lo que no caduca: organización,
// páginas, menús, navegación, categorías, sucursales, impuestos y píxeles.
// Precios, stock y disponibilidad se quedan fuera a propósito.
// ---------------------------------------------------------------------------

export const getOrganizationBySubdomain = cacheStructural('getOrganizationBySubdomain', getOrganizationBySubdomainUncached, SETTINGS_TTL)
export const getOrganizationByCustomDomain = cacheStructural('getOrganizationByCustomDomain', getOrganizationByCustomDomainUncached, SETTINGS_TTL)
export const getOrganizationBranches = cacheStructural('getOrganizationBranches', getOrganizationBranchesUncached, SETTINGS_TTL)
export const getBranchesByOrg = cacheStructural('getBranchesByOrg', getBranchesByOrgUncached, SETTINGS_TTL)
export const getMetaPixelId = cacheStructural('getMetaPixelId', getMetaPixelIdUncached, SETTINGS_TTL)
export const getGoogleAdsConfig = cacheStructural('getGoogleAdsConfig', getGoogleAdsConfigUncached, SETTINGS_TTL)
export const getDefaultTax = cacheStructural('getDefaultTax', getDefaultTaxUncached, SETTINGS_TTL)
export const getOrganizationTags = cacheStructural('getOrganizationTags', getOrganizationTagsUncached, SETTINGS_TTL)
export const getOrganizationCategories = cacheStructural('getOrganizationCategories', getOrganizationCategoriesUncached, CONTENT_TTL)
export const getCategoryBySlug = cacheStructural('getCategoryBySlug', getCategoryBySlugUncached, CONTENT_TTL)
export const getSubcategories = cacheStructural('getSubcategories', getSubcategoriesUncached, CONTENT_TTL)
export const getParentCategory = cacheStructural('getParentCategory', getParentCategoryUncached, CONTENT_TTL)
export const getMenuCategories = cacheStructural('getMenuCategories', getMenuCategoriesUncached, CONTENT_TTL)
export const getWebsitePageBySlug = cacheStructural('getWebsitePageBySlug', getWebsitePageBySlugUncached, CONTENT_TTL)
export const getWebsitePageByType = cacheStructural('getWebsitePageByType', getWebsitePageByTypeUncached, CONTENT_TTL)
export const getWebsitePages = cacheStructural('getWebsitePages', getWebsitePagesUncached, CONTENT_TTL)
export const getWebsitePagesByIds = cacheStructural('getWebsitePagesByIds', getWebsitePagesByIdsUncached, CONTENT_TTL)
export const getWebsiteHeaderNav = cacheStructural('getWebsiteHeaderNav', getWebsiteHeaderNavUncached, CONTENT_TTL)
export const getWebsiteHeaderNavTree = cacheStructural('getWebsiteHeaderNavTree', getWebsiteHeaderNavTreeUncached, CONTENT_TTL)
export const getWebsiteFooterNav = cacheStructural('getWebsiteFooterNav', getWebsiteFooterNavUncached, CONTENT_TTL)
export const getWebsiteFooterNavTree = cacheStructural('getWebsiteFooterNavTree', getWebsiteFooterNavTreeUncached, CONTENT_TTL)
export const getWebsiteMenus = cacheStructural('getWebsiteMenus', getWebsiteMenusUncached, CONTENT_TTL)
export const getWebsiteMenusByLocation = cacheStructural('getWebsiteMenusByLocation', getWebsiteMenusByLocationUncached, CONTENT_TTL)
export const getMenuById = cacheStructural('getMenuById', getMenuByIdUncached, CONTENT_TTL)

// ---------------------------------------------------------------------------
// Caché del catálogo (ver lib/supabase/cache.ts, sección "Caché del CATÁLOGO").
//
// Misma firma pública que antes. `cache()` de React sigue deduplicando dentro
// de una misma petición (layout + page + generateMetadata); `cacheCatalog`
// añade la caché ENTRE peticiones con TTL corto y etiqueta por organización,
// que el ERP invalida al editar productos, precios o stock.
// ---------------------------------------------------------------------------

export const getOrganizationProducts = cache(
  cacheCatalog('getOrganizationProducts', getOrganizationProductsUncached, (...args) => args[0])
)
export const getOfferProducts = cache(
  cacheCatalog('getOfferProducts', getOfferProductsUncached, (...args) => args[0])
)
export const getProductsByCategoryIds = cache(
  cacheCatalog('getProductsByCategoryIds', getProductsByCategoryIdsUncached, (...args) => args[0])
)
export const getProductsByCategory = cacheCatalog('getProductsByCategory', getProductsByCategoryUncached, (...args) => args[0])
export const getProductsByCategoryPaginated = cacheCatalog(
  'getProductsByCategoryPaginated',
  getProductsByCategoryPaginatedUncached,
  (...args) => args[0]
)
export const getMenuProducts = cacheCatalog('getMenuProducts', getMenuProductsUncached, (...args) => args[0])
// Ventas web por producto de una organización: una consulta por org cada
// CATALOG_TTL, compartida por todos los listados de la misma petición.
export const getWebSalesByProduct = cache(
  cacheCatalog('getWebSalesByProduct', getWebSalesByProductUncached, (...args) => args[0])
)

// Platos elegidos por id para `signature_dishes` cuando no están entre los
// 500 que precarga getOrganizationProducts (cartas grandes). Misma consulta
// que favoritos/re-pedidos (organización + sede + carta de la sede), con la
// caché del catálogo: la clave incluye los ids, así que una misma sección no
// vuelve a consultar en cada visita.
export const getProductsByIdsCatalog = cache(
  cacheCatalog('getProductsByIds', getProductsByIds, (...args) => args[1])
)
