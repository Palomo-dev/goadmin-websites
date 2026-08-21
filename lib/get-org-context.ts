import { headers } from 'next/headers'
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

export async function getOrgContext() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain

  if (!identifier) return null

  const organization = await getOrganizationByHost(identifier)
  if (!organization) return null

  const primaryColor = organization.website_settings?.primary_color || organization.primary_color || '#3B82F6'
  const templateId = organization.website_settings?.template_id || 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(organization.type_id)

  // Cargar navegación plana (compat) + árbol jerárquico (mega-menú)
  const [headerNav, headerNavTree, footerNav, footerNavTree] = await Promise.all([
    getWebsiteHeaderNav(organization.id),
    getWebsiteHeaderNavTree(organization.id),
    getWebsiteFooterNav(organization.id),
    getWebsiteFooterNavTree(organization.id)
  ])

  // Cargar categorías para el mega-menú solo si la configuración lo activa
  const showCategoriesInHeader = organization.website_settings?.show_categories_in_header ?? false
  const menuCategories = showCategoriesInHeader
    ? await getMenuCategories(organization.id)
    : []

  // Cargar menús nombrados (sistema nuevo) con fallback al sistema de páginas
  const headerMenuId = organization.website_settings?.header_menu_id ?? null
  const headerMegaMenuId = organization.website_settings?.header_mega_menu_id ?? null

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

  return { organization, primaryColor, template, headerNav, headerNavTree: effectiveHeaderNavTree, footerNav, footerNavTree, menuCategories, megaMenuItems, websiteMenus: footerMenus, frozenReason }
}

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
