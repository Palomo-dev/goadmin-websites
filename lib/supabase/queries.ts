import { createAdminClient, createPublicClient } from './server'
import type { Organization, WebsiteSettings, OrganizationWithDetails } from '@/types/database'

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
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(limit)
  
  if (error) return []
  return data || []
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
