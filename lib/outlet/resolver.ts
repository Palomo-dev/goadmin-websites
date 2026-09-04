import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

/**
 * Outlet (branch) resuelto para el request actual.
 * `null` significa sitio global de la organización (sin outlet).
 */
export interface ResolvedOutlet {
  branchId: number
  branchSlug: string
  branchName: string
  branchType: string | null
  customDomain: string | null
  isWebPublished: boolean
}

export interface OutletPathPrefix {
  /** Primer segmento del path candidato a prefix de outlet (sin slashes). */
  prefix: string
  /** Resto del path después de remover el prefix. */
  remainingPath: string
}

/**
 * Slugs reservados del sitio global que NUNCA son outlets.
 * Si el primer segmento del path es uno de estos, no se intenta resolver outlet.
 */
const RESERVED_SLUGS = [
  'home', 'menu', 'productos', 'categorias', 'espacios', 'servicios',
  'ofertas', 'reserva', 'reservas', 'agendar', 'cotizar', 'pedido',
  'ticket', 'tracking', 'viajes', 'pases', 'membresias', 'checkout',
  'carrito', 'mi-cuenta', 'consultar-pedido', 'auth', 'api',
  'contacto', 'nosotros',
]

/**
 * Extrae un posible path-prefix de outlet del primer segmento del path.
 * NO valida contra BD — solo parsea. Retorna null si el primer segmento
 * no califica como prefix de outlet (ej: 'menu', 'productos', 'home').
 */
export function parseOutletPathPrefix(pathSegments: string[]): OutletPathPrefix | null {
  if (!pathSegments || pathSegments.length === 0) return null
  const first = pathSegments[0]
  if (!first) return null
  if (RESERVED_SLUGS.includes(first.toLowerCase())) return null
  return {
    prefix: first,
    remainingPath: pathSegments.slice(1).join('/') || 'home',
  }
}

/**
 * Resuelve un outlet por path-prefix (branches.slug) contra la BD.
 * Busca branches donde slug = prefix AND organization_id = orgId AND is_web_published = true.
 */
export async function resolveOutletByPathPrefix(
  organizationId: number,
  prefix: string,
): Promise<ResolvedOutlet | null> {
  const supabase = createAdminClient() || createPublicClient()
  const { data, error } = await (supabase as any)
    .from('branches')
    .select('id, slug, name, branch_type, custom_domain, is_web_published')
    .eq('organization_id', organizationId)
    .eq('slug', prefix.toLowerCase())
    .eq('is_web_published', true)
    .maybeSingle()
  if (error || !data) return null
  return {
    branchId: data.id as number,
    branchSlug: data.slug as string,
    branchName: data.name as string,
    branchType: data.branch_type as string | null,
    customDomain: data.custom_domain as string | null,
    isWebPublished: data.is_web_published as boolean,
  }
}

/**
 * Resuelve un outlet por custom domain de branch.
 * Busca branches donde custom_domain = host AND is_web_published = true.
 * Retorna también el organization_id para que el middleware/getOrgContext
 * puedan resolver la organización padre.
 */
export async function resolveOutletByCustomDomain(
  host: string,
): Promise<{ outlet: ResolvedOutlet; organizationId: number } | null> {
  const supabase = createAdminClient() || createPublicClient()
  const { data, error } = await (supabase as any)
    .from('branches')
    .select('id, slug, name, branch_type, custom_domain, is_web_published, organization_id')
    .eq('custom_domain', host.toLowerCase())
    .eq('is_web_published', true)
    .maybeSingle()
  if (error || !data) return null
  return {
    outlet: {
      branchId: data.id as number,
      branchSlug: data.slug as string,
      branchName: data.name as string,
      branchType: data.branch_type as string | null,
      customDomain: data.custom_domain as string | null,
      isWebPublished: data.is_web_published as boolean,
    },
    organizationId: data.organization_id as number,
  }
}

/**
 * Resuelve un outlet por sub-subdomain (ej: restaurante1.tugranhotel.goadmin.io).
 * Recibe el slug del outlet directamente (ej: 'restaurante1') tal como lo inyecta
 * el middleware vía el header `x-outlet-subdomain`. Delega en
 * resolveOutletByPathPrefix usando ese slug.
 */
export async function resolveOutletBySubSubdomain(
  outletSlug: string,
  organizationId: number,
): Promise<ResolvedOutlet | null> {
  if (!outletSlug || outletSlug.toLowerCase() === 'www') return null
  return resolveOutletByPathPrefix(organizationId, outletSlug)
}

/**
 * Resuelve un outlet desde el path completo (usado por page.tsx).
 * Parsea el primer segmento y valida contra BD. Retorna el outlet + el path
 * efectivo (sin el segmento del outlet) para que page.tsx lo use.
 */
export async function resolveOutletFromPath(
  organizationId: number,
  pathSegments: string[],
): Promise<{ outlet: ResolvedOutlet | null; effectivePath: string[] }> {
  const parsed = parseOutletPathPrefix(pathSegments)
  if (!parsed) {
    return { outlet: null, effectivePath: pathSegments }
  }
  const outlet = await resolveOutletByPathPrefix(organizationId, parsed.prefix)
  if (!outlet) {
    // El primer segmento no es un outlet publicado → path global completo.
    return { outlet: null, effectivePath: pathSegments }
  }
  return {
    outlet,
    effectivePath: parsed.remainingPath ? parsed.remainingPath.split('/') : ['home'],
  }
}
