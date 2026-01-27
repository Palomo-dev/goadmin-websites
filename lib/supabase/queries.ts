import { createPublicClient } from './server'
import type { Organization, WebsiteSettings, OrganizationWithDetails } from '@/types/database'

/**
 * Obtiene una organización por su subdominio (busca en organization_domains)
 */
export async function getOrganizationBySubdomain(subdomain: string): Promise<OrganizationWithDetails | null> {
  const supabase = createPublicClient()
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
  const supabase = createPublicClient()
  
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
  const supabase = createPublicClient()
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*)
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
  const supabase = createPublicClient()
  
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
  const supabase = createPublicClient()
  
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
  const supabase = createPublicClient()
  
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
  
  if (error) return []
  return data || []
}
