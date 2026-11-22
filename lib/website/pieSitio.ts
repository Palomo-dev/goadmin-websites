/**
 * Pie igual en todas las páginas (2026-11-21). Solo la ruta comodín ([[...slug]]) pasaba los menús
 * del pie a OrganizationLayout; en producto, categoría, carrito, checkout y el resto faltaban sus
 * columnas. OrganizationLayout los resuelve aquí cuando la página no los pasa, con las MISMAS
 * fuentes y el mismo criterio que getOrgContext (lib/get-org-context.ts):
 *
 * - Sitio V2: `menusPublicosDesdeDocumento` sobre el documento publicado (puro), con las categorías
 *   que referencian sus menús. El árbol de páginas del pie sale del menú `paginas-pie`, como
 *   `footerNavTree` en getOrgContext.
 * - Legacy, o fallo aplicando el documento: los menús del pie de `website_menus`.
 * - La página ya trae `menus` (la comodín, que los saca de getOrgContext): se usan esos y no se lee
 *   nada más; solo se añade el nombre del menú de páginas (puro, sobre el documento ya leído).
 *
 * Las lecturas entran como dependencias para probarlo sin red (scripts/verify-columnas-pie.mjs);
 * OrganizationLayout pasa las cacheadas (getSitioPublicoV2, getCategoriasMenuV2,
 * getWebsiteMenusByLocation), que son las mismas llamadas y claves que usa getOrgContext.
 */
import type { DocumentoSitio } from './v2/contrato/documentoSitio'
import { idsCategoriasDeMenus, menusPublicosDesdeDocumento, paginasPieDesdeDocumento, type CategoriaMenu } from './v2/vistaPublica'
import type { WebsiteMenuItemWithChildren, WebsiteMenuWithItems, WebsitePage, WebsitePageWithChildren } from '@/types/database'

/**
 * Convierte un WebsiteMenuItemWithChildren a WebsitePageWithChildren (formato del header legacy).
 * Esto permite que el menú nombrado funcione con las variantes de header existentes
 * que esperan WebsitePageWithChildren[] como navTree.
 * (Movida desde lib/get-org-context.ts sin cambios, para usarla también en el layout.)
 */
export function menuItemToPageWithChildren(item: WebsiteMenuItemWithChildren): WebsitePageWithChildren {
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

export interface PieSitio {
  menus: WebsiteMenuWithItems[] | undefined
  footerNav: WebsitePage[] | undefined
  footerNavTree: WebsitePageWithChildren[] | undefined
  /** Ver SiteFooter: `undefined` = legacy; `null` = V2 sin `paginas-pie` en el pie; objeto = su nombre. */
  paginasPie: { nombre: string | null } | null | undefined
}

export interface EntradaPieSitio {
  organizationId: number
  branchId: number | undefined
  /** Lo que pasó la página. `menus` definido (aunque vacío) = ya resueltos: no se lee nada. */
  menus?: WebsiteMenuWithItems[]
  footerNav?: WebsitePage[]
  footerNavTree?: WebsitePageWithChildren[]
}

export interface LecturasPieSitio {
  leerSitio: (organizationId: number, branchId: number | undefined) => Promise<{ documento: DocumentoSitio } | null>
  leerCategorias: (organizationId: number, ids: number[]) => Promise<Map<number, CategoriaMenu>>
  leerMenusLegacy: (organizationId: number, branchId: number | undefined) => Promise<WebsiteMenuWithItems[]>
  /** Aviso de un fallo con el documento (se sigue con legacy). */
  alFallar?: (error: unknown) => void
}

export async function resolverPieSitio(e: EntradaPieSitio, l: LecturasPieSitio): Promise<PieSitio> {
  const propios: PieSitio = { menus: e.menus, footerNav: e.footerNav, footerNavTree: e.footerNavTree, paginasPie: undefined }
  const traeMenus = e.menus !== undefined
  try {
    const sitio = await l.leerSitio(e.organizationId, e.branchId)
    if (sitio) {
      const paginasPie = paginasPieDesdeDocumento(sitio.documento)
      if (traeMenus) return { ...propios, paginasPie }
      const categorias = await l.leerCategorias(e.organizationId, idsCategoriasDeMenus(sitio.documento))
      const menus = menusPublicosDesdeDocumento(sitio.documento, e.organizationId, categorias)
      // Mismo árbol que `footerNavTree` de getOrgContext. Las rutas que arman su contexto a mano
      // (/pedido/[id], /reserva/mesa/[token]) pasaban las páginas legacy: aquí quedan como las demás.
      const arbol = (menus.footerPaginas?.items ?? []).map((item) => menuItemToPageWithChildren(item))
      return { menus: menus.footer, footerNav: arbol, footerNavTree: arbol, paginasPie }
    }
  } catch (error) {
    l.alFallar?.(error)
  }
  if (traeMenus) return propios
  try {
    return { ...propios, menus: await l.leerMenusLegacy(e.organizationId, e.branchId) }
  } catch {
    return propios
  }
}
