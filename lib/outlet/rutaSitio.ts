/**
 * Rutas internas del sitio de una sede servida por PREFIJO de ruta
 * (`marca.goadmin.io/sede-norte/menu`).
 *
 * Una sede se sirve de tres maneras (lib/outlet/resolver.ts): dominio propio,
 * sub-subdominio (`sede-norte.marca.goadmin.io`) o prefijo de ruta. Solo en la
 * tercera hay que anteponer `/<slug>` a los enlaces internos: en las otras dos el
 * host ya identifica la sede y `/menu` es correcto.
 *
 * Sin sede, o con la sede resuelta por host, todas las funciones devuelven la ruta
 * tal cual: el sitio principal de las 83 organizaciones no cambia.
 *
 * Puro (sin React ni Supabase): lo usan servidor y navegador. En componentes
 * cliente dentro de `OrganizationLayout`, `useRutaSitio()` (./RutaSitioContext)
 * ya trae el prefijo de la petición.
 */

/**
 * Primeros segmentos que NUNCA son una sede: rutas propias del sitio (app/*) y páginas
 * fijas. Una sede con uno de estos slugs no se alcanza por ruta. La lista del ERP
 * (`RESERVED_SLUGS` de go-admin-erp/src/lib/utils/webIdentityValidation.ts) debe
 * contenerla: lo comprueba `scripts/verify-sedes.mjs`.
 *
 * Aquí (puro) y no en resolver.ts para que el middleware (Edge) la use sin importar Supabase.
 */
export const SLUGS_RESERVADOS: readonly string[] = [
  'home', 'menu', 'productos', 'categorias', 'espacios', 'servicios',
  'ofertas', 'reserva', 'reservas', 'agendar', 'cotizar', 'pedido',
  'ticket', 'tracking', 'viajes', 'pases', 'membresias', 'checkout',
  'carrito', 'mi-cuenta', 'consultar-pedido', 'auth', 'api',
  'contacto', 'nosotros', 'vista-previa',
]

export function esSlugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.includes(slug.toLowerCase())
}

/** Lo mínimo de `ResolvedOutlet` que hace falta. */
export interface SedeRuta {
  branchSlug: string
}

/**
 * Rutas de toda la organización, nunca de una sede: cuenta, sesión y API.
 * (`/mi-cuenta` lista los pedidos de todas las sedes.)
 */
const RUTAS_GLOBALES = ['/api', '/auth', '/mi-cuenta']

/** URL absoluta o esquema (`https:`, `mailto:`, `tel:`, `whatsapp:`) o protocolo relativo (`//`). */
function esExterna(ruta: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(ruta) || ruta.startsWith('//')
}

/**
 * `'/sede-norte'` si la sede se sirve por prefijo de ruta; `''` en cualquier otro caso.
 * `porPrefijo` es `ctx.sedePorPrefijo` de `getOrgContext` (true tanto si el middleware
 * reescribió `/sede-norte/...` como si la página consumió el primer segmento).
 */
export function prefijoSede(outlet: SedeRuta | null | undefined, porPrefijo: boolean | null | undefined): string {
  if (!porPrefijo || !outlet?.branchSlug) return ''
  const slug = outlet.branchSlug.trim().replace(/^\/+|\/+$/g, '')
  return slug ? `/${encodeURIComponent(slug).replace(/%2F/gi, '/')}` : ''
}

/** Antepone `prefijo` (`''` o `'/sede-norte'`) a una ruta interna. Idempotente. */
export function conPrefijo(ruta: string, prefijo: string): string {
  if (!prefijo) return ruta
  const r = (ruta ?? '').trim()
  if (r === '') return prefijo
  // Ancla o query de la misma página, y enlaces externos: tal cual.
  if (r.startsWith('#') || r.startsWith('?') || esExterna(r)) return r
  const absoluta = r.startsWith('/') ? r : `/${r}`
  if (RUTAS_GLOBALES.some((g) => absoluta === g || absoluta.startsWith(`${g}/`) || absoluta.startsWith(`${g}?`))) {
    return absoluta
  }
  // Ya lleva el prefijo.
  if (
    absoluta === prefijo ||
    absoluta.startsWith(`${prefijo}/`) ||
    absoluta.startsWith(`${prefijo}?`) ||
    absoluta.startsWith(`${prefijo}#`)
  ) {
    return absoluta
  }
  if (absoluta === '/') return prefijo
  if (absoluta.startsWith('/?') || absoluta.startsWith('/#')) return `${prefijo}${absoluta.slice(1)}`
  return `${prefijo}${absoluta}`
}

/**
 * Contrato para los paquetes de carta y pedido: la ruta interna con el prefijo de la sede
 * cuando el sitio de la sede se sirve por prefijo de ruta.
 *
 *   rutaSitio('/productos/12', ctx.outlet, ctx.sedePorPrefijo) → '/sede-norte/productos/12'
 *   rutaSitio('/productos/12', null, false)                    → '/productos/12'
 */
export function rutaSitio(ruta: string, outlet: SedeRuta | null | undefined, porPrefijo: boolean | null | undefined): string {
  return conPrefijo(ruta, prefijoSede(outlet, porPrefijo))
}

/** `'/sede-norte/menu'` → `'/menu'` (para comparar el pathname del navegador con rutas internas). */
export function quitarPrefijo(pathname: string, prefijo: string): string {
  if (!prefijo) return pathname
  if (pathname === prefijo) return '/'
  return pathname.startsWith(`${prefijo}/`) ? pathname.slice(prefijo.length) : pathname
}

/**
 * Árbol de navegación (páginas legacy o menús V2 convertidos) con el prefijo aplicado al
 * `slug`, para que `pageToNavItem` (`/${slug}`, `home` → `/`) genere enlaces de la sede.
 * Los enlaces externos y las anclas se dejan como estaban.
 */
export function prefijarArbolNav<T extends { slug: string; children?: T[] }>(arbol: T[] | undefined, prefijo: string): T[] | undefined {
  if (!prefijo || !arbol) return arbol
  return arbol.map((nodo) => {
    const slug = nodo.slug ?? ''
    let nuevo = slug
    if (slug === 'home' || slug === '' || slug === '/') {
      nuevo = prefijo.slice(1)
    } else if (!slug.startsWith('#') && !slug.startsWith('?') && !esExterna(slug)) {
      nuevo = conPrefijo(`/${slug.replace(/^\/+/, '')}`, prefijo).slice(1)
    }
    return {
      ...nodo,
      slug: nuevo,
      children: nodo.children ? prefijarArbolNav(nodo.children, prefijo) : nodo.children,
    }
  })
}

/** Igual que `prefijarArbolNav` para ítems que ya traen `href` (mega menú). */
export function prefijarItemsNav<T extends { href: string; children?: T[] }>(items: T[] | undefined, prefijo: string): T[] | undefined {
  if (!prefijo || !items) return items
  return items.map((item) => ({
    ...item,
    href: conPrefijo(item.href, prefijo),
    children: item.children ? prefijarItemsNav(item.children, prefijo) : item.children,
  }))
}
