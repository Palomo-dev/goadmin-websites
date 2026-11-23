import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { MARCA_SESION_CORTA, opcionesCookieSesion } from '@/lib/auth/sesionCorta'
import { esSlugReservado } from '@/lib/outlet/rutaSitio'
import {
  CABECERA_SONDA,
  CODIGO_REDIRECCION,
  formaDelPrincipal,
  hostDestinoRedireccion,
  principalPropio,
  rutaSinRedireccion,
  type DominioDeOrg,
  type FormaPrincipal,
} from '@/lib/site/redireccionPrincipal'

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

// --- Redirección al dominio principal propio (lib/site/redireccionPrincipal.ts) ---
// Dominios de la organización por host y forma del principal (sonda), en memoria por instancia:
// como mucho 2 consultas por host y una sonda por principal cada REDIRECCION_TTL_MS.
const REDIRECCION_TTL_MS = Number(process.env.REDIRECCION_PRINCIPAL_TTL_MS) || 5 * 60 * 1000
const dominiosPorHostCache = new Map<string, { dominios: DominioDeOrg[]; esSede: boolean; expira: number }>()
const formaPrincipalCache = new Map<string, { forma: FormaPrincipal | null; expira: number }>()

function guardarEnCache<T>(mapa: Map<string, T>, clave: string, valor: T) {
  if (mapa.size >= BRANCH_DOMAIN_CACHE_MAX) mapa.clear()
  mapa.set(clave, valor)
}

/** Dominios activos de la organización del host. null = fallo de la base (no se redirige). */
async function dominiosDelHost(
  supabase: ReturnType<typeof createServerClient>,
  tenant: { subdomain: string | null; customDomainHost: string | null },
): Promise<{ dominios: DominioDeOrg[]; esSede: boolean } | null> {
  const clave = tenant.customDomainHost ? `d:${tenant.customDomainHost}` : `s:${(tenant.subdomain || '').toLowerCase()}`
  const cacheado = dominiosPorHostCache.get(clave)
  if (cacheado && Date.now() < cacheado.expira) return cacheado
  let organizationId: number | null = null
  let esSede = false
  if (tenant.customDomainHost) {
    const { data, error } = await supabase
      .from('organization_domains')
      .select('organization_id, branch_id')
      .eq('host', tenant.customDomainHost)
      .eq('is_active', true)
      .eq('status', 'verified')
      .maybeSingle()
    if (error) return null
    const fila = data as { organization_id: number; branch_id: number | null } | null
    organizationId = fila?.organization_id ?? null
    esSede = fila?.branch_id !== null && fila?.branch_id !== undefined
  } else if (tenant.subdomain) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', tenant.subdomain.toLowerCase())
      .maybeSingle()
    if (error) return null
    organizationId = (data as { id: number } | null)?.id ?? null
  }
  let dominios: DominioDeOrg[] = []
  if (organizationId !== null && !esSede) {
    const { data, error } = await supabase
      .from('organization_domains')
      .select('host, domain_type, status, is_primary, is_active, updated_at, misconfigured, branch_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
    if (error) return null
    dominios = ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      host: String(d.host ?? ''),
      domainType: String(d.domain_type ?? ''),
      status: String(d.status ?? ''),
      isPrimary: d.is_primary === true,
      isActive: d.is_active === true,
      updatedAt: (d.updated_at as string | null) ?? null,
      misconfigured: d.misconfigured === true,
      branchId: (d.branch_id as number | null) ?? null,
    }))
  }
  const valor = { dominios, esSede, expira: Date.now() + REDIRECCION_TTL_MS }
  guardarEnCache(dominiosPorHostCache, clave, valor)
  return valor
}

async function formaCacheada(principal: string): Promise<FormaPrincipal | null> {
  const cacheado = formaPrincipalCache.get(principal)
  if (cacheado && Date.now() < cacheado.expira) return cacheado.forma
  const forma = await formaDelPrincipal(principal)
  if (forma === null) console.warn(`[middleware] El dominio principal ${principal} no sirve la tienda: no se redirige hacia él`)
  guardarEnCache(formaPrincipalCache, principal, { forma, expira: Date.now() + REDIRECCION_TTL_MS })
  return forma
}

/** Host del principal al que redirigir esta petición, o null (se atiende aquí, como antes). */
async function destinoAlPrincipal(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  tenant: { subdomain: string | null; customDomainHost: string | null },
): Promise<string | null> {
  try {
    const datos = await dominiosDelHost(supabase, tenant)
    if (!datos || datos.esSede) return null
    const principal = principalPropio(datos.dominios)
    if (!principal) return null
    const host = (request.headers.get('host') || '').toLowerCase().replace(/:\d+$/, '')
    // Visita al propio principal (lo normal): sin sonda.
    if (host === principal) return null
    return hostDestinoRedireccion({
      host,
      metodo: request.method,
      pathname: request.nextUrl.pathname,
      dominios: datos.dominios,
      esSede: false,
      forma: await formaCacheada(principal),
    })
  } catch (err) {
    console.error('[middleware] Redirección al principal omitida:', err instanceof Error ? err.message : String(err))
    return null
  }
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

// Cabeceras de sede que SOLO este middleware puede poner. Las que traiga la petición se
// descartan: si no, `curl -H 'x-outlet-path: <slug>' /checkout` hacía que getOrgContext
// resolviera esa sede (y el branchId del pedido) sin que estuviera en la URL, y una CDN que
// cachea por URL podía guardar la versión «de sede» de /checkout o de la home.
// (En localhost la simulación con x-outlet-subdomain sigue: se lee de la petición original
// y se vuelve a poner en la respuesta más abajo.)
const CABECERAS_SEDE = ['x-outlet-path', 'x-outlet-subdomain', 'x-custom-outlet-domain'] as const

function cabecerasSinSede(request: NextRequest): Headers {
  const cabeceras = new Headers(request.headers)
  for (const nombre of CABECERAS_SEDE) cabeceras.delete(nombre)
  return cabeceras
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Ignorar rutas de assets estáticos (pero NO /api, para que auth funcione).
  // /sitemap.xml y /robots.txt sí pasan: son por organización y necesitan las cabeceras del host.
  const esArchivoPorHost = url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt'
  // /vista-previa/<carga>.<firma>: el token lleva un punto pero no es un archivo. Si se
  // tomaba por archivo salía de aquí sin `x-subdomain`, la página no resolvía la organización
  // del host y respondía 404 a todo enlace de vista previa.
  const esVistaPrevia = url.pathname.startsWith('/vista-previa/')
  // El navegador pide /favicon.ico aunque el HTML apunte a /api/favicon. No hay archivo
  // estático: si se ignorara por el punto, la pestaña se queda con el icono genérico.
  const esFavicon = url.pathname === '/favicon.ico'
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    (url.pathname.includes('.') && !esArchivoPorHost && !esVistaPrevia && !esFavicon)
  ) {
    return NextResponse.next()
  }

  // Favoritos: la página es pública (/favoritos, Figma 2764:61164). La ruta vieja de la cuenta
  // redirige antes de que el layout de /mi-cuenta mande a iniciar sesión. Conserva el prefijo de
  // sede (`/<sede>/mi-cuenta/favoritos` → `/<sede>/favoritos`) y la consulta.
  if (/\/mi-cuenta\/favoritos\/?$/.test(url.pathname)) {
    const destino = request.nextUrl.clone()
    destino.pathname = url.pathname.replace(/\/mi-cuenta\/favoritos\/?$/, '/favoritos')
    return NextResponse.redirect(destino, 308)
  }

  // --- Refresco de sesión Supabase Auth ---
  // Esto mantiene las cookies de sesión JWT válidas entre requests
  // Se reenvían las cabeceras de la petición sin las de sede (cabecerasSinSede).
  let supabaseResponse = NextResponse.next({ request: { headers: cabecerasSinSede(request) } })

  // Usar service role key si disponible (la anon key falla en runtime de Vercel)
  // Sin service role, la resolución de dominios de sucursal no encuentra filas
  // (RLS no abre branches/organizations a anon): se registra en lugar de fallar
  // en silencio. No se lanza aquí para no tumbar cada request del sitio.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[middleware] Falta SUPABASE_SERVICE_ROLE_KEY: la resolución de dominios de sucursal quedará deshabilitada')
  }
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  // «Recordarme» sin marcar: el refresco del token no vuelve a poner 400 días (lib/auth/sesionCorta.ts).
  const sesionCorta = request.cookies.get(MARCA_SESION_CORTA)?.value === '1'

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
          supabaseResponse = NextResponse.next({ request: { headers: cabecerasSinSede(request) } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, opcionesCookieSesion(value, options, sesionCorta))
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

  // Dominio principal propio: el subdominio del sistema y los demás dominios de la organización
  // (con o sin www) van con 308 al principal, misma ruta y query. Nunca sedes, ni POST, ni
  // /api, /auth, /vista-previa…, ni la sonda del propio middleware. Si la base o la sonda
  // fallan, no se redirige (todo sigue como antes).
  if (
    !isLocalhost &&
    !outletSubdomain &&
    !isCustomOutletDomain &&
    (subdomain || isCustomDomain) &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !rutaSinRedireccion(url.pathname) &&
    !request.headers.has(CABECERA_SONDA)
  ) {
    const destino = await destinoAlPrincipal(supabase, request, {
      subdomain: isCustomDomain ? null : subdomain,
      customDomainHost: isCustomDomain ? effectiveHost : null,
    })
    if (destino) {
      const redireccion = NextResponse.redirect(new URL(`${url.pathname}${url.search}`, `https://${destino}`), CODIGO_REDIRECCION)
      // El navegador la recuerda una hora, no para siempre: si el principal cambia o se quita,
      // nadie queda atrapado en una redirección vieja. «private»: no la guarda la CDN.
      redireccion.headers.set('Cache-Control', 'private, max-age=3600')
      return redireccion
    }
  }

  // Vista previa privada del borrador (app/vista-previa/[token]): nunca se indexa ni se
  // cachea en el borde. Solo esa ruta; el resto de respuestas no cambia.
  if (esVistaPrevia) {
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    supabaseResponse.headers.set('Cache-Control', 'private, no-store, max-age=0')
    supabaseResponse.headers.set('Referrer-Policy', 'no-referrer')
  }

  // Si no hay subdominio ni dominio personalizado, salir
  if (!subdomain && !isCustomDomain) {
    return supabaseResponse
  }

  // /favicon.ico → /api/favicon, con el tenant en la petición (no solo en la respuesta).
  if (esFavicon) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/api/favicon'
    const cabeceras = cabecerasSinSede(request)
    if (subdomain) cabeceras.set('x-subdomain', subdomain)
    if (outletSubdomain) cabeceras.set('x-outlet-subdomain', outletSubdomain)
    if (isCustomOutletDomain) {
      cabeceras.set('x-custom-domain', subdomain!)
      cabeceras.set('x-custom-outlet-domain', effectiveHost)
    } else if (isCustomDomain) {
      cabeceras.set('x-custom-domain', effectiveHost)
    }
    return NextResponse.rewrite(destino, { request: { headers: cabeceras } })
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
      respuesta = NextResponse.rewrite(destino, { request: { headers: cabecerasSinSede(request) } })
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
     * - public folder
     * /favicon.ico sí entra: se reescribe a /api/favicon.
     */
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
