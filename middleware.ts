import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { esSlugReservado } from '@/lib/outlet/rutaSitio'

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

// --- Sede por prefijo de ruta (/sede-norte/checkout → /checkout + x-outlet-path) ---
// Sin la reescritura, /<sede>/checkout, /<sede>/productos/1, /<sede>/carrito… caían en el
// catch-all con otro slug o en la ruta global, leían el carrito global y cobraban como sitio
// principal. Se reescribe SOLO si el primer segmento es el slug de una sede publicada de la
// organización del host; getOrgContext lo valida otra vez contra la BD.
//
// Coste: UNA consulta global (todas las sedes publicadas con slug; 0 filas el 2026-10-06)
// cada SEDES_RUTA_TTL_MS por instancia. Solo si el segmento coincide con alguna sede y el
// host es un dominio propio se consulta además organization_domains (cacheado igual).
const SEDES_RUTA_TTL_MS = Number(process.env.SEDES_RUTA_CACHE_TTL_MS) || 60 * 1000
type SedeRuta = { organizationId: number; subdomain: string | null }
let sedesRutaCache: { expira: number; porSlug: Map<string, SedeRuta[]> } | null = null
const orgPorDominioCache = new Map<string, { organizationId: number | null; expira: number }>()

async function sedesPublicadasPorSlug(
  supabase: ReturnType<typeof createServerClient>,
): Promise<Map<string, SedeRuta[]>> {
  if (sedesRutaCache && Date.now() < sedesRutaCache.expira) return sedesRutaCache.porSlug
  const { data, error } = await supabase
    .from('branches')
    .select('slug, organization_id, organizations!branches_organization_id_fkey(subdomain)')
    .eq('is_web_published', true)
    .not('slug', 'is', null)
  if (error) {
    // Fallo de BD: no se reescribe (comportamiento anterior) y se reintenta en la próxima petición.
    console.error('[middleware] No se pudieron leer las sedes publicadas', error.message)
    return sedesRutaCache?.porSlug ?? new Map()
  }
  const porSlug = new Map<string, SedeRuta[]>()
  for (const fila of (data ?? []) as { slug: string | null; organization_id: number; organizations: { subdomain: string | null } | { subdomain: string | null }[] | null }[]) {
    if (!fila.slug) continue
    const org = Array.isArray(fila.organizations) ? fila.organizations[0] : fila.organizations
    const clave = fila.slug.toLowerCase()
    porSlug.set(clave, [...(porSlug.get(clave) ?? []), {
      organizationId: fila.organization_id,
      subdomain: org?.subdomain?.toLowerCase() ?? null,
    }])
  }
  sedesRutaCache = { expira: Date.now() + SEDES_RUTA_TTL_MS, porSlug }
  return porSlug
}

async function orgDeDominio(
  supabase: ReturnType<typeof createServerClient>,
  host: string,
): Promise<number | null> {
  const cacheado = orgPorDominioCache.get(host)
  if (cacheado && Date.now() < cacheado.expira) return cacheado.organizationId
  const { data, error } = await supabase
    .from('organization_domains')
    .select('organization_id')
    .eq('host', host)
    .eq('is_active', true)
    .eq('status', 'verified')
    .maybeSingle()
  if (error) return null
  const organizationId = (data as { organization_id: number } | null)?.organization_id ?? null
  if (orgPorDominioCache.size >= BRANCH_DOMAIN_CACHE_MAX) orgPorDominioCache.clear()
  orgPorDominioCache.set(host, { organizationId, expira: Date.now() + SEDES_RUTA_TTL_MS })
  return organizationId
}

/**
 * Slug de sede del primer segmento de la ruta, si es una sede publicada de la organización
 * del host. `null` en cualquier otro caso (y entonces nada cambia).
 */
async function sedeDelPrefijo(
  supabase: ReturnType<typeof createServerClient>,
  pathname: string,
  tenant: { subdomain: string | null; customDomainHost: string | null },
): Promise<{ slug: string; resto: string } | null> {
  const [, primero = '', ...resto] = pathname.split('/')
  if (!primero || esSlugReservado(primero) || !/^[a-z0-9-]+$/i.test(primero)) return null
  const candidatas = (await sedesPublicadasPorSlug(supabase)).get(primero.toLowerCase())
  if (!candidatas || candidatas.length === 0) return null
  let coincide = false
  if (tenant.customDomainHost) {
    const organizationId = await orgDeDominio(supabase, tenant.customDomainHost)
    coincide = organizationId !== null && candidatas.some((c) => c.organizationId === organizationId)
  } else if (tenant.subdomain) {
    const sub = tenant.subdomain.toLowerCase()
    coincide = candidatas.some((c) => c.subdomain === sub)
  }
  return coincide ? { slug: primero.toLowerCase(), resto: `/${resto.join('/')}` } : null
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Ignorar rutas de assets estáticos (pero NO /api, para que auth funcione).
  // /sitemap.xml y /robots.txt sí pasan: son por organización y necesitan las cabeceras del host.
  const esArchivoPorHost = url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt'
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    (url.pathname.includes('.') && !esArchivoPorHost) // archivos con extensión
  ) {
    return NextResponse.next()
  }

  // --- Refresco de sesión Supabase Auth ---
  // Esto mantiene las cookies de sesión JWT válidas entre requests
  let supabaseResponse = NextResponse.next({ request })

  // Usar service role key si disponible (la anon key falla en runtime de Vercel)
  // Sin service role, la resolución de dominios de sucursal no encuentra filas
  // (RLS no abre branches/organizations a anon): se registra en lugar de fallar
  // en silencio. No se lanza aquí para no tumbar cada request del sitio.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[middleware] Falta SUPABASE_SERVICE_ROLE_KEY: la resolución de dominios de sucursal quedará deshabilitada')
  }
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

  // Vista previa privada del borrador (app/vista-previa/[token]): nunca se indexa ni se
  // cachea en el borde. Solo esa ruta; el resto de respuestas no cambia.
  if (url.pathname.startsWith('/vista-previa/')) {
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    supabaseResponse.headers.set('Cache-Control', 'private, no-store, max-age=0')
    supabaseResponse.headers.set('Referrer-Policy', 'no-referrer')
  }

  // Si no hay subdominio ni dominio personalizado, salir
  if (!subdomain && !isCustomDomain) {
    return supabaseResponse
  }

  // Sede por prefijo de ruta: solo en el host del sitio principal (con la sede ya resuelta
  // por host —sub-subdominio o dominio propio de sede— el primer segmento es una página).
  let respuesta: NextResponse = supabaseResponse
  if (!outletSubdomain && !isCustomOutletDomain && !esArchivoPorHost) {
    const sede = await sedeDelPrefijo(supabase, url.pathname, {
      subdomain: isCustomDomain ? null : subdomain,
      customDomainHost: isCustomDomain ? effectiveHost : null,
    })
    if (sede) {
      const destino = request.nextUrl.clone()
      destino.pathname = sede.resto
      respuesta = NextResponse.rewrite(destino, { request })
      // Conservar las cookies de sesión que refrescó Supabase y las cabeceras ya puestas.
      supabaseResponse.cookies.getAll().forEach((cookie) => respuesta.cookies.set(cookie))
      supabaseResponse.headers.forEach((valor, clave) => {
        if (clave.startsWith('x-middleware-') || clave === 'set-cookie') return
        respuesta.headers.set(clave, valor)
      })
      respuesta.headers.set('x-outlet-path', sede.slug)
    } else {
      // Sin sede en la ruta: exactamente como antes.
    }
  }

  // Agregar headers con información del tenant al response
  if (subdomain) {
    respuesta.headers.set('x-subdomain', subdomain)
  }

  if (outletSubdomain) {
    respuesta.headers.set('x-outlet-subdomain', outletSubdomain)
  }

  if (isCustomOutletDomain) {
    // Dominio custom de BRANCH: x-custom-domain lleva el identificador de la org
    // (resuelto vía lookup), NO el hostname del branch. El hostname del branch va
    // en x-custom-outlet-domain para que getOrgContext lo valide contra branches.custom_domain.
    respuesta.headers.set('x-custom-domain', subdomain!)
    respuesta.headers.set('x-custom-outlet-domain', effectiveHost)
  } else if (isCustomDomain) {
    // Dominio custom de ORG: x-custom-domain lleva el hostname (sin www).
    respuesta.headers.set('x-custom-domain', effectiveHost)
  }

  return respuesta
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
