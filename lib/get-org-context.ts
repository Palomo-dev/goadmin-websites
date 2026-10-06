import { headers } from 'next/headers'
import { cache } from 'react'
import {
  getOrganizationByHost,
  getWebsiteHeaderNav,
  getWebsiteHeaderNavTree,
  getWebsiteFooterNav,
  getWebsiteFooterNavTree,
  getMenuCategories,
  getMenuById,
  getWebsiteMenusByLocation
} from '@/lib/supabase/queries'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { resolveOutletBySubSubdomain, resolveOutletByCustomDomain, resolveOutletFromPath, type ResolvedOutlet } from '@/lib/outlet/resolver'
import { getEffectiveSettings, getOrgSettings } from '@/lib/outlet/theme-merge'
import { getSitioPublicoV2, getCategoriasMenuV2 } from '@/lib/website/v2/lectorPublico'
import {
  ajustesPublicosDesdeDocumento,
  idsCategoriasDeMenus,
  logoPublicoDesdeDocumento,
  menusPublicosDesdeDocumento,
  type MenusPublicos,
} from '@/lib/website/v2/vistaPublica'
import type { WebsiteMenuWithItems, WebsiteMenuItemWithChildren, WebsitePageWithChildren } from '@/types/database'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { prefijoSede as calcularPrefijoSede } from '@/lib/outlet/rutaSitio'
import { urlsSitio } from '@/lib/seo/sede'

/**
 * Cabecera que pone el middleware al reescribir `/<slug-de-sede>/resto` → `/resto`
 * (sede por prefijo de ruta). Lleva el slug; aquí se valida contra las sedes
 * publicadas de la organización del host, igual que el prefijo de ruta.
 */
export const CABECERA_SEDE_RUTA = 'x-outlet-path'

/**
 * Tipo para items de mega menú (compatible con NavItem de HeaderShared).
 * HeaderShared.NavItem tiene: name, href, children?, icon?, badge?
 */
export interface MegaMenuItem {
  name: string
  href: string
  children?: MegaMenuItem[]
  icon?: string
  badge?: string
}

export type FrozenReason = 'trial_expired' | 'suspended' | 'deleted' | 'payment_failed' | 'canceled' | null

// cache() de React deduplica llamadas dentro del mismo request.
// getOrgContext se llama múltiples veces por página (generateMetadata + page),
// esto elimina ~20 queries duplicadas a Supabase por carga de página.
/**
 * Solo el id de la organización del HOST de la petición (mismas cabeceras y
 * misma búsqueda cacheada que el primer paso de `getOrgContext`), sin cargar
 * menús, ajustes ni suscripción. Para rutas ligeras que se llaman en cada
 * página vista (p. ej. `/api/track-visit`), donde `getOrgContext` completo
 * multiplicaría las consultas por visitante.
 *
 * La organización sale del host, nunca del body ni de la query.
 */
export const getOrgIdDelHost = cache(async (): Promise<number | null> => {
  const headersList = await headers()
  const identifier = headersList.get('x-custom-domain') || headersList.get('x-subdomain')
  if (!identifier) return null
  const organization = await getOrganizationByHost(identifier)
  return organization?.id ?? null
})

export const getOrgContext = cache(async (pathFirstSegment?: string) => {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const outletSubdomainHeader = headersList.get('x-outlet-subdomain')
  const customOutletDomainHeader = headersList.get('x-custom-outlet-domain')
  const outletPathHeader = headersList.get(CABECERA_SEDE_RUTA)
  const identifier = customDomain || subdomain

  if (!identifier) return null

  const organization = await getOrganizationByHost(identifier)
  if (!organization) return null

  // --- Resolver outlet (branch) por headers + path-prefix (F1) ---
  // Prioridad: 1) custom-domain de branch, 2) sub-subdomain, 3) prefijo reescrito por el
  // middleware (x-outlet-path), 4) path-prefix consumido por la página.
  let outlet: ResolvedOutlet | null = null
  let pathPrefixConsumed = false
  // true si la sede se sirve por prefijo de ruta (reescrito o consumido): los enlaces
  // internos llevan `/<slug>` (lib/outlet/rutaSitio.ts). `pathPrefixConsumed` sigue
  // significando solo «la página debe quitar el primer segmento».
  let sedePorPrefijo = false
  try {
    if (customOutletDomainHeader) {
      // Dominio personalizado de un branch: restaurante1.tugranhotel.com
      const resolved = await resolveOutletByCustomDomain(customOutletDomainHeader)
      // Solo aceptar si la org resuelta coincide con la organización actual.
      if (resolved && resolved.organizationId === organization.id) {
        outlet = resolved.outlet
      }
    } else if (outletSubdomainHeader) {
      // Sub-subdomain: el middleware ya extrajo el slug del outlet.
      outlet = await resolveOutletBySubSubdomain(outletSubdomainHeader, organization.id)
    }

    // 3. Prefijo reescrito por el middleware (/sede-norte/checkout → /checkout).
    //    Mismo criterio que el prefijo de ruta: sede publicada de ESTA organización.
    if (!outlet && outletPathHeader) {
      const result = await resolveOutletFromPath(organization.id, [outletPathHeader])
      if (result.outlet) {
        outlet = result.outlet
        sedePorPrefijo = true
      }
    }

    // 4. Path-prefix (ej: tugranhotel.com/restaurante-1/menu)
    //    Solo si no se resolvió por headers (sub-subdomain / custom-domain).
    if (!outlet && pathFirstSegment) {
      const result = await resolveOutletFromPath(organization.id, [pathFirstSegment])
      if (result.outlet) {
        outlet = result.outlet
        pathPrefixConsumed = true
        sedePorPrefijo = true
      }
    }
  } catch {
    outlet = null
  }
  const branchId = outlet?.branchId ?? undefined

  // --- Settings efectivos (merge org + outlet) (F2) ---
  // getEffectiveSettings hace query directa de website_settings (branch_id IS NULL
  // + branch_id = branchId) y mergea. Si no hay outlet, retorna los globales.
  // Si no hay globales pero sí outlet, retorna los del outlet.
  const legacySettings = await getEffectiveSettings(organization.id, branchId)

  // --- Sitio V2 (ADR-002 D4) ---
  // Si el sitio adoptó V2, ajustes y menús salen de la revisión publicada (lib/website/v2).
  // Las columnas sin destino en el documento (operación, integraciones) siguen saliendo de la
  // fila legacy. Cualquier fallo → legacy exactamente como antes, con el error registrado.
  let effectiveSettings = legacySettings
  let menusV2: MenusPublicos | null = null
  let logoV2: string | null = null
  const sitioV2 = await getSitioPublicoV2(organization.id, branchId)
  if (sitioV2) {
    try {
      const principalLegacy = sitioV2.principal && !sitioV2.principal.documento
        ? await getOrgSettings(organization.id)
        : null
      const baseHerencia = sitioV2.principal ? { documento: sitioV2.principal.documento, ajustesLegacy: principalLegacy } : null
      const ajustesV2 = ajustesPublicosDesdeDocumento(sitioV2.documento, legacySettings, baseHerencia)
      logoV2 = logoPublicoDesdeDocumento(sitioV2.documento, baseHerencia)
      const categoriasV2 = await getCategoriasMenuV2(organization.id, idsCategoriasDeMenus(sitioV2.documento))
      menusV2 = menusPublicosDesdeDocumento(sitioV2.documento, organization.id, categoriasV2)
      effectiveSettings = ajustesV2
    } catch (error) {
      console.error('[sitio-v2] Error aplicando el documento V2 al contexto; se sirve legacy', {
        organizationId: organization.id, siteStateId: sitioV2.siteStateId,
        error: error instanceof Error ? error.message : String(error),
      })
      effectiveSettings = legacySettings
      menusV2 = null
      logoV2 = null
    }
  } else {
    // Sitio legacy: sin cambios.
  }
  const settings = effectiveSettings

  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  const templateId = settings?.template_id ?? 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(organization.type_id)

  // Cargar árbol jerárquico de navegación (header + footer) con branchId (F1)
  // Las versiones planas se derivan del árbol para evitar queries duplicadas.
  // V2: la navegación sale de los menús del documento; no se mezcla con páginas legacy.
  const [headerNavTree, footerNavTreeLegacy] = menusV2
    ? [[], []]
    : await Promise.all([
        getWebsiteHeaderNavTree(organization.id, branchId),
        getWebsiteFooterNavTree(organization.id, branchId)
      ])
  const footerNavTree = menusV2
    ? (menusV2.footerPaginas?.items ?? []).map(item => menuItemToPageWithChildren(item))
    : footerNavTreeLegacy
  const footerNav = footerNavTree

  // Cargar categorías para el mega-menú solo si la configuración lo activa
  // El pie también las usa (`footer_show_categories`): antes solo se cargaban
  // si el header las mostraba, y la columna «Categorías» del pie salía vacía.
  const showCategoriesInHeader = settings?.show_categories_in_header ?? false
  const showCategoriesInFooter = settings?.footer_show_categories ?? false
  const menuCategories = showCategoriesInHeader || showCategoriesInFooter
    ? await getMenuCategories(organization.id, branchId)
    : []

  // Cargar menús nombrados (sistema nuevo) con fallback al sistema de páginas
  const headerMenuId = settings?.header_menu_id ?? null
  const headerMegaMenuId = settings?.header_mega_menu_id ?? null

  // Cargar menú de header nombrado (si existe) + menú mega nombrado (si existe)
  const [namedHeaderMenu, namedMegaMenu, footerMenus] = menusV2
    ? [menusV2.header, menusV2.mega, menusV2.footer]
    : await Promise.all([
    // Con sede: la copia de esa sede si existe, si no el del principal. Sin sede (branchId
    // undefined): solo menús del principal (branch_id IS NULL).
    headerMenuId ? getMenuById(headerMenuId, organization.id, branchId) : Promise.resolve(null),
    headerMegaMenuId ? getMenuById(headerMegaMenuId, organization.id, branchId) : Promise.resolve(null),
    getWebsiteMenusByLocation(organization.id, 'footer', branchId),
  ])

  // Si hay menú nombrado de header, usarlo como headerNavTree (convertido a WebsitePageWithChildren[])
  // Si no, fallback a headerNavTree del sistema de páginas (backward compat)
  const effectiveHeaderNavTree = namedHeaderMenu && namedHeaderMenu.items.length > 0
    ? namedHeaderMenu.items.map(item => menuItemToPageWithChildren(item))
    : headerNavTree
  // Legacy: headerNav siguen siendo las páginas (como antes). V2: el menú del documento.
  const headerNav = menusV2 ? effectiveHeaderNavTree : headerNavTree

  // Si hay menú mega nombrado, usarlo como megaMenuItems (NavItem[])
  // Si no, fallback a menuCategories (backward compat)
  const megaMenuItems = namedMegaMenu && namedMegaMenu.items.length > 0
    ? namedMegaMenu.items.map(item => menuItemToNavItem(item))
    : null

  // Verificar estado de congelación de la organización
  const frozenReason = await checkFrozenStatus(organization.id, organization.status)

  // Settings de moneda (mostrar código + posición)
  const showCurrencyCode = settings?.show_currency_code ?? false
  const currencyPosition = (settings?.currency_position ?? 'left') as 'left' | 'right'

  // Organization con settings mergeados (para que SiteHeader/SiteFooter y
  // cualquier componente hijo que lea organization.website_settings vea el
  // theme del outlet). Preserva el shape: si settings es null, mantiene el
  // select anidado original (backward compat).
  // Sitio V2 con logo propio (Diseño › Logo): sustituye al de la organización. Legacy: igual.
  const organizacionBase = logoV2 ? { ...organization, logo_url: logoV2 } : organization
  const organizationWithSettings = effectiveSettings
    ? { ...organizacionBase, website_settings: effectiveSettings }
    : organizacionBase

  // SEO local y enlaces de la sede (contratos de lib/outlet/rutaSitio.ts y lib/seo/sede.ts).
  const prefijoSede = calcularPrefijoSede(outlet, sedePorPrefijo)
  const { urlBase, urlBasePrincipal } = urlsSitio({
    organization,
    outlet,
    porPrefijo: sedePorPrefijo,
    hostSede: outlet && !sedePorPrefijo
      ? customOutletDomainHeader || headersList.get('host')
      : null,
  })

  return {
    organization: organizationWithSettings,
    outlet,
    branchId,
    pathPrefixConsumed,
    /** La sede se sirve por prefijo de ruta: pásalo a `rutaSitio(path, outlet, sedePorPrefijo)`. */
    sedePorPrefijo,
    /** `''` o `'/<slug>'`. */
    prefijoSede,
    /** Base pública del sitio que se sirve (con la sede), para canonical y JSON-LD. */
    urlBase,
    /** Base pública del sitio principal de la organización. */
    urlBasePrincipal,
    effectiveSettings: settings,
    primaryColor,
    template,
    headerNav,
    headerNavTree: effectiveHeaderNavTree,
    footerNav,
    footerNavTree,
    menuCategories,
    megaMenuItems,
    websiteMenus: footerMenus,
    frozenReason,
    showCurrencyCode,
    currencyPosition,
  }
})

type SubscriptionRow = { status: string; trial_end: string | null; current_period_end: string | null }

// Solo se cachea la FILA de la suscripción, no el veredicto: el veredicto
// compara fechas con `now` y tiene que recalcularse en cada petición.
//
// Antes se consultaba en cada petición de cada tienda: 714 veces en el minuto
// del pico del 2026-09-14. Un cambio de estado de la suscripción tarda ahora
// hasta CONTENT_TTL en reflejarse en el sitio público, que es aceptable.
const getLatestSubscription = cacheStructural(
  'getLatestSubscription',
  async (orgId: number): Promise<SubscriptionRow | null> => {
    const supabase = createAdminClient() || createPublicClient()
    const { data } = await supabase
      .from('subscriptions')
      .select('status, trial_end, current_period_end')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: SubscriptionRow | null }
    return data
  },
  CONTENT_TTL
)

export async function checkFrozenStatus(orgId: number, orgStatus: string | null): Promise<FrozenReason> {
  // Si la organización está suspendida o eliminada, está congelada
  if (orgStatus === 'suspended') return 'suspended'
  if (orgStatus === 'deleted') return 'deleted'

  // Consultar el estado de la suscripción
  const sub = await getLatestSubscription(orgId)

  if (!sub) return null

  const now = new Date()

  // Si el trial expiró
  if (sub.status === 'trialing' && sub.trial_end) {
    const trialEnd = new Date(sub.trial_end)
    if (trialEnd < now) return 'trial_expired'
  }

  // Si el pago falló (past_due)
  if (sub.status === 'past_due') return 'payment_failed'

  // Si la suscripción fue cancelada
  if (sub.status === 'canceled') return 'canceled'

  // Si está activa o en trial válido, no está congelada
  return null
}

// ============================================================
// HELPERS — Conversión de WebsiteMenuItem a formatos del header
// ============================================================

/**
 * Convierte un WebsiteMenuItemWithChildren a NavItem (formato del header).
 * Soporta todos los item_type: page, category, policy, custom_link.
 */
function menuItemToNavItem(item: WebsiteMenuItemWithChildren): MegaMenuItem {
  let name = item.custom_label || ''
  let href = item.custom_url || '#'

  if (item.item_type === 'page' || item.item_type === 'policy') {
    if (item.page) {
      name = item.page.title
      href = item.page.slug === 'home' ? '/' : `/${item.page.slug}`
    }
  } else if (item.item_type === 'category') {
    if (item.category) {
      name = item.category.name
      href = `/categorias/${item.category.slug}`
    }
  } else if (item.item_type === 'custom_link') {
    name = item.custom_label || ''
    href = item.custom_url || '#'
  }

  return {
    name,
    href,
    children: item.children.length > 0 ? item.children.map(menuItemToNavItem) : undefined,
    icon: item.icon ?? undefined,
    badge: item.badge ?? undefined,
  }
}

/**
 * Convierte un WebsiteMenuItemWithChildren a WebsitePageWithChildren (formato del header legacy).
 * Esto permite que el menú nombrado funcione con las variantes de header existentes
 * que esperan WebsitePageWithChildren[] como navTree.
 */
function menuItemToPageWithChildren(item: WebsiteMenuItemWithChildren): WebsitePageWithChildren {
  let title = item.custom_label || ''
  let slug = item.custom_url || ''

  if (item.item_type === 'page' || item.item_type === 'policy') {
    if (item.page) {
      title = item.page.title
      slug = item.page.slug
    }
  } else if (item.item_type === 'category') {
    if (item.category) {
      title = item.category.name
      slug = `categorias/${item.category.slug}`
    }
  } else if (item.item_type === 'custom_link') {
    title = item.custom_label || ''
    slug = item.custom_url || ''
  }

  return {
    id: item.id,
    organization_id: item.organization_id,
    slug,
    title,
    is_published: true,
    show_in_header: true,
    show_in_footer: false,
    header_order: item.display_order,
    footer_order: 0,
    parent_page_id: item.parent_item_id,
    linked_category_id: item.category_id,
    menu_icon: item.icon,
    menu_badge: item.badge,
    created_at: item.created_at,
    updated_at: item.updated_at,
    children: item.children.map(menuItemToPageWithChildren),
    level: 0,
  } as WebsitePageWithChildren
}
