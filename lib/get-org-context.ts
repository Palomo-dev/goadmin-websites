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
import { getEffectiveSettings } from '@/lib/outlet/theme-merge'
import type { WebsiteMenuWithItems, WebsiteMenuItemWithChildren, WebsitePageWithChildren } from '@/types/database'

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
export const getOrgContext = cache(async (pathFirstSegment?: string) => {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const outletSubdomainHeader = headersList.get('x-outlet-subdomain')
  const customOutletDomainHeader = headersList.get('x-custom-outlet-domain')
  const identifier = customDomain || subdomain

  if (!identifier) return null

  const organization = await getOrganizationByHost(identifier)
  if (!organization) return null

  // --- Resolver outlet (branch) por headers + path-prefix (F1) ---
  // Prioridad: 1) custom-domain de branch, 2) sub-subdomain, 3) path-prefix.
  let outlet: ResolvedOutlet | null = null
  let pathPrefixConsumed = false
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

    // 3. Path-prefix (ej: tugranhotel.com/restaurante-1/menu)
    //    Solo si no se resolvió por headers (sub-subdomain / custom-domain).
    if (!outlet && pathFirstSegment) {
      const result = await resolveOutletFromPath(organization.id, [pathFirstSegment])
      if (result.outlet) {
        outlet = result.outlet
        pathPrefixConsumed = true
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
  const effectiveSettings = await getEffectiveSettings(organization.id, branchId)
  const settings = effectiveSettings

  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  const templateId = settings?.template_id ?? 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(organization.type_id)

  // Cargar árbol jerárquico de navegación (header + footer) con branchId (F1)
  // Las versiones planas se derivan del árbol para evitar queries duplicadas.
  const [headerNavTree, footerNavTree] = await Promise.all([
    getWebsiteHeaderNavTree(organization.id, branchId),
    getWebsiteFooterNavTree(organization.id, branchId)
  ])
  const headerNav = headerNavTree // el árbol ya contiene todos los nodos
  const footerNav = footerNavTree

  // Cargar categorías para el mega-menú solo si la configuración lo activa
  const showCategoriesInHeader = settings?.show_categories_in_header ?? false
  const menuCategories = showCategoriesInHeader
    ? await getMenuCategories(organization.id, branchId)
    : []

  // Cargar menús nombrados (sistema nuevo) con fallback al sistema de páginas
  const headerMenuId = settings?.header_menu_id ?? null
  const headerMegaMenuId = settings?.header_mega_menu_id ?? null

  // Cargar menú de header nombrado (si existe) + menú mega nombrado (si existe)
  const [namedHeaderMenu, namedMegaMenu, footerMenus] = await Promise.all([
    headerMenuId ? getMenuById(headerMenuId) : Promise.resolve(null),
    headerMegaMenuId ? getMenuById(headerMegaMenuId) : Promise.resolve(null),
    getWebsiteMenusByLocation(organization.id, 'footer'),
  ])

  // Si hay menú nombrado de header, usarlo como headerNavTree (convertido a WebsitePageWithChildren[])
  // Si no, fallback a headerNavTree del sistema de páginas (backward compat)
  const effectiveHeaderNavTree = namedHeaderMenu && namedHeaderMenu.items.length > 0
    ? namedHeaderMenu.items.map(item => menuItemToPageWithChildren(item))
    : headerNavTree

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
  const organizationWithSettings = effectiveSettings
    ? { ...organization, website_settings: effectiveSettings }
    : organization

  return {
    organization: organizationWithSettings,
    outlet,
    branchId,
    pathPrefixConsumed,
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

export async function checkFrozenStatus(orgId: number, orgStatus: string | null): Promise<FrozenReason> {
  // Si la organización está suspendida o eliminada, está congelada
  if (orgStatus === 'suspended') return 'suspended'
  if (orgStatus === 'deleted') return 'deleted'

  // Consultar el estado de la suscripción
  const supabase = createAdminClient() || createPublicClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, trial_end, current_period_end')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: { status: string; trial_end: string | null; current_period_end: string | null } | null }

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
