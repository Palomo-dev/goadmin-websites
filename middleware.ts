import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Dominios del sistema donde se sirven los sitios de organizaciones.
// Se comparan contra el host completo (no por número de etiquetas) para
// soportar TLDs con múltiples partes (ej: goadmin.co.uk = 3 etiquetas).
const SYSTEM_DOMAINS = ['goadmin.co.uk', 'goadmin.io']

/**
 * Devuelve el system domain que matchea el hostname (o null si no hay match).
 * Se elige el match más largo para que un TLD compuesto prevalezca.
 */
function matchSystemDomain(hostname: string): string | null {
  let best: string | null = null
  for (const d of SYSTEM_DOMAINS) {
    if (hostname === d || hostname.endsWith(`.${d}`)) {
      if (!best || d.length > best.length) best = d
    }
  }
  return best
}

// --- Caché en memoria para resolveBranchOrgByCustomDomain ---
// El middleware corre en Edge; la misma instancia atiende múltiples requests,
// así que este caché module-level evita repetir las 2 queries por cada request.
// TTL de 5 min (configurable via BRANCH_DOMAIN_CACHE_TTL_MS).
// Tamaño máximo para evitar memory leaks en instancias long-lived.
const BRANCH_DOMAIN_CACHE_TTL_MS = Number(process.env.BRANCH_DOMAIN_CACHE_TTL_MS) || 5 * 60 * 1000
const BRANCH_DOMAIN_CACHE_MAX = 500
const branchDomainCache = new Map<string, { orgIdentifier: string; expiresAt: number } | null>()

/**
 * Lookup de org desde un dominio custom de branch.
 * Flujo: branches.custom_domain = host → organization_id → organizations.subdomain.
 * Devuelve { orgIdentifier } o null si no hay match.
 * Cacha resultados por BRANCH_DOMAIN_CACHE_TTL_MS para evitar 2 queries por request.
 */
async function resolveBranchOrgByCustomDomain(
  supabase: ReturnType<typeof createServerClient>,
  host: string,
): Promise<{ orgIdentifier: string } | null> {
  // 1. Revisar caché
  const cached = branchDomainCache.get(host)
  if (cached !== undefined) {
    if (cached === null) return null // negative cache (host no es branch)
    if (Date.now() < cached.expiresAt) return { orgIdentifier: cached.orgIdentifier }
  }

  // 2. Miss → consultar BD
  const { data: branch } = await supabase
    .from('branches')
    .select('organization_id')
    .eq('custom_domain', host)
    .eq('is_web_published', true)
    .maybeSingle()

  if (!branch?.organization_id) {
    setBranchDomainCacheEntry(host, null)
    return null
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('subdomain')
    .eq('id', branch.organization_id)
    .maybeSingle()

  if (!org?.subdomain) {
    setBranchDomainCacheEntry(host, null)
    return null
  }

  const result = { orgIdentifier: org.subdomain }
  setBranchDomainCacheEntry(host, { ...result, expiresAt: Date.now() + BRANCH_DOMAIN_CACHE_TTL_MS })
  return result
}

function setBranchDomainCacheEntry(
  host: string,
  entry: { orgIdentifier: string; expiresAt: number } | null,
) {
  // Evitar memory leaks: si el caché crece demasiado, limpiar entradas expiradas
  if (branchDomainCache.size >= BRANCH_DOMAIN_CACHE_MAX) {
    const now = Date.now()
    for (const [k, v] of branchDomainCache) {
      if (v === null || v.expiresAt < now) branchDomainCache.delete(k)
    }
    // Si sigue lleno después de limpiar expirados, no agregar más
    if (branchDomainCache.size >= BRANCH_DOMAIN_CACHE_MAX) return
  }
  branchDomainCache.set(host, entry)
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Ignorar rutas de assets estáticos (pero NO /api, para que auth funcione)
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.') // archivos con extensión
  ) {
    return NextResponse.next()
  }

  // --- Refresco de sesión Supabase Auth ---
  // Esto mantiene las cookies de sesión JWT válidas entre requests
  let supabaseResponse = NextResponse.next({ request })

  // Usar service role key si disponible (la anon key falla en runtime de Vercel)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: No usar getSession() aquí, getUser() valida contra el servidor
  await supabase.auth.getUser()

  // --- Lógica de subdominios / dominios personalizados / outlets ---
  // Detectar si es un subdominio del sistema
  const isLocalhost = hostname.includes('localhost')
  const systemDomain = matchSystemDomain(hostname)

  // Host efectivo sin www (para lookups en BD; branches.custom_domain y
  // organization_domains.host se almacenan sin www).
  const effectiveHost = hostname.replace(/^www\./, '')

  let subdomain: string | null = null
  let outletSubdomain: string | null = null
  let isCustomDomain = false
  let isCustomOutletDomain = false

  if (isLocalhost) {
    // En desarrollo, usar query param o header para simular subdominio
    subdomain = url.searchParams.get('subdomain') || request.headers.get('x-subdomain')

    // Simular outlet por query param 'outlet' o header x-outlet-subdomain
    outletSubdomain = url.searchParams.get('outlet') || request.headers.get('x-outlet-subdomain') || null

    if (!subdomain) {
      // También intentar extraer del hostname si es algo como subdomain.localhost
      // o outlet.subdomain.localhost
      const parts = hostname.split('.')
      if (parts.length > 2 && parts[0] !== 'localhost') {
        // outlet.subdomain.localhost → outlet + subdomain
        outletSubdomain = outletSubdomain || parts[0]
        subdomain = parts[1]
      } else if (parts.length > 1 && parts[0] !== 'localhost') {
        subdomain = parts[0]
      }
    }
  } else if (systemDomain) {
    // Extraer subdominio delante del system domain matcheado (sin asumir nº de etiquetas).
    //   tugranhotel.goadmin.io        → prefix = 'tugranhotel'        → org
    //   hotel.tugranhotel.goadmin.io  → prefix = 'hotel.tugranhotel'  → outlet + org
    const prefix = hostname.slice(0, hostname.length - systemDomain.length - 1)
    const labels = prefix.split('.')
    if (labels.length >= 2) {
      // Sub-subdomain: outlet + org
      subdomain = labels[1]
      outletSubdomain = labels[0].toLowerCase() === 'www' ? null : labels[0].toLowerCase()
    } else if (labels.length === 1 && labels[0]) {
      subdomain = labels[0]
    }
  } else {
    // Dominio personalizado: clasificar por número de etiquetas (sin www).
    let parts = effectiveHost.split('.')
    if (parts[0] === 'www') parts = parts.slice(1)

    if (parts.length >= 3) {
      // Candidato a outlet por sub-subdomain en dominio custom (ej: hotel.tugranhotel.com).
      // Lookup REAL en BD: si branches.custom_domain = effectiveHost, es un outlet.
      const branchRow = await resolveBranchOrgByCustomDomain(supabase, effectiveHost)
      if (branchRow?.orgIdentifier) {
        isCustomOutletDomain = true
        subdomain = branchRow.orgIdentifier // identificador de la org
      } else {
        // No matchea branches.custom_domain → tratar como custom-org.
        isCustomDomain = true
      }
    } else {
      isCustomDomain = true
    }
  }

  // Si no hay subdominio ni dominio personalizado, salir
  if (!subdomain && !isCustomDomain) {
    return supabaseResponse
  }

  // Agregar headers con información del tenant al response de Supabase
  if (subdomain) {
    supabaseResponse.headers.set('x-subdomain', subdomain)
  }

  if (outletSubdomain) {
    supabaseResponse.headers.set('x-outlet-subdomain', outletSubdomain)
  }

  if (isCustomOutletDomain) {
    // Dominio custom de BRANCH: x-custom-domain lleva el identificador de la org
    // (resuelto vía lookup), NO el hostname del branch. El hostname del branch va
    // en x-custom-outlet-domain para que getOrgContext lo valide contra branches.custom_domain.
    supabaseResponse.headers.set('x-custom-domain', subdomain!)
    supabaseResponse.headers.set('x-custom-outlet-domain', effectiveHost)
  } else if (isCustomDomain) {
    // Dominio custom de ORG: x-custom-domain lleva el hostname (sin www).
    supabaseResponse.headers.set('x-custom-domain', effectiveHost)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
