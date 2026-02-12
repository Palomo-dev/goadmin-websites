import { createAdminClient, createPublicClient } from './server'
import type { Organization, WebsiteSettings, OrganizationWithDetails, WebsitePage, WebsitePageWithSections } from '@/types/database'

function getSupabaseForPublicRead() {
  return createAdminClient() || createPublicClient()
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
    .or('status.eq.active,status.is.null')
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
    .or('status.eq.active,status.is.null')
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
    .or('status.eq.active,status.is.null')
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

  return (data || []).map((p: any) => ({
    ...p,
    has_variants: p.is_parent === true,
    variant_count: variantCountMap[p.id] || 0,
  }))
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
  return data || []
}

/**
 * Obtiene los espacios/habitaciones de una organización (para hoteles, parking, etc.)
 */
export async function getOrganizationSpaces(organizationId: number) {
  const supabase = getSupabaseForPublicRead()
  
  // Primero obtener las sucursales de la organización
  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
  
  if (!branches || branches.length === 0) return []
  
  const branchIds = (branches as { id: number }[]).map(b => b.id)
  
  const { data, error } = await supabase
    .from('spaces')
    .select(`
      *,
      space_types (*)
    `)
    .in('branch_id', branchIds)
    .eq('status', 'available')
  
  if (error) return []
  return data || []
}

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
  return data || []
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
  return data || []
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
      stock_levels ( qty_on_hand, qty_reserved )
    `)
    .eq('parent_product_id', parentProductId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name')

  if (error) return []
  return data || []
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
    .single()
  
  if (error) return null
  return data
}

/**
 * Obtiene o crea un customer por email
 */
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
 * Obtiene las páginas para el header (navegación principal)
 */
export async function getWebsiteHeaderNav(organizationId: number): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select('id, slug, title, header_order')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('show_in_header', true)
    .order('header_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
}

/**
 * Obtiene las páginas para el footer
 */
export async function getWebsiteFooterNav(organizationId: number): Promise<WebsitePage[]> {
  const supabase = getSupabaseForPublicRead()

  const { data, error } = await supabase
    .from('website_pages')
    .select('id, slug, title, footer_order')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
    .eq('show_in_footer', true)
    .order('footer_order', { ascending: true })

  if (error || !data) return []
  return data as WebsitePage[]
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
      stock_levels ( qty_on_hand, qty_reserved ),
      product_tag_relations ( tag_id )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(limit)

  if (error) return []
  return data || []
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
      stock_levels ( qty_on_hand, qty_reserved )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('id', productIds)

  if (error) return []
  return data || []
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
