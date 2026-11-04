/**
 * Arnés de pruebas del encabezado (matriz del buscador: scripts/pruebas/matriz-buscador.mjs).
 *
 * Solo existe con `PRUEBAS_INTERNAS=1` en el entorno del servidor; en cualquier otro caso, 404.
 * No consulta Supabase: los ajustes y el menú salen de scripts/pruebas/fixtures/encabezados.json
 * (encabezados reales de las tiendas con sitio V2, saneados) con las MISMAS funciones puras que usa
 * la tienda publicada (ajustesPublicosDesdeDocumento, menusPublicosDesdeDocumento,
 * temaPublicoDesdeDocumento), y se pinta el layout real del sitio (OrganizationLayoutCliente →
 * SiteHeader) con contenido de relleno debajo.
 *
 * Query string:
 * - `org`: id de la tienda del fixture (obligatorio).
 * - `header`: default | minimal | mega | centered | split | transparent | comercio. Sin él, el
 *   encabezado real de la tienda (header_layout / header_style tal cual).
 * - `search`: search_style (icon | bar | mini | icon_overlay | mega | pill_floating | hidden).
 * - `msearch`: mobile_search_style (opcional). Sin él, el de la tienda.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { OrganizationLayoutCliente } from '@/components/site/OrganizationLayoutCliente'
import type { MenuCategory } from '@/components/site/header/HeaderShared'
import { getTemplate } from '@/lib/templates'
import { ajustesPublicosDesdeDocumento, menusPublicosDesdeDocumento, type CategoriaMenu } from '@/lib/website/v2/vistaPublica'
import { temaPublicoDesdeDocumento } from '@/lib/website/v2/temaPublico'
import { estiloDeHeaderLayout } from '@/lib/website/v2/mapeoAjustes'
import { buscadorMovilEfectivo } from '@/lib/website/opcionUnica'
import type { DocumentoSitio } from '@/lib/website/v2/contrato/documentoSitio'
import type {
  OrganizationWithDetails,
  WebsiteMenuItemWithChildren,
  WebsitePageWithChildren,
  WebsiteSettings,
} from '@/types/database'
import { MarcaListo } from './MarcaListo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pruebas internas · encabezado', robots: { index: false, follow: false } }

const HEADERS = ['default', 'minimal', 'mega', 'centered', 'split', 'transparent', 'comercio'] as const
const BUSCADORES = ['icon', 'bar', 'mini', 'icon_overlay', 'mega', 'pill_floating', 'hidden'] as const

interface TiendaFixture {
  id: number
  nombre: string
  subdomain: string
  type_id: number | null
  legacy: Record<string, unknown>
  documento: unknown
  categoriasDelMenu: CategoriaMenu[]
  menuCategories: { id: number; name: string; slug: string; parent_id: number | null }[]
}

function leerFixture(): TiendaFixture[] {
  // Se lee en cada petición (no se empaqueta en el build): solo corre con PRUEBAS_INTERNAS=1.
  const ruta = join(process.cwd(), 'scripts', 'pruebas', 'fixtures', 'encabezados.json')
  return (JSON.parse(readFileSync(ruta, 'utf8')) as { tiendas: TiendaFixture[] }).tiendas
}

function uno(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

/**
 * ORIGEN: `menuItemToPageWithChildren` de lib/get-org-context.ts (no exportada; ese módulo lee
 * cabeceras y Supabase y no se puede importar aquí). Misma conversión ítem de menú → nodo del nav.
 */
function itemANodo(item: WebsiteMenuItemWithChildren): WebsitePageWithChildren {
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
    children: item.children.map(itemANodo),
    level: 0,
  } as unknown as WebsitePageWithChildren
}

/** Árbol de categorías como getMenuCategories (lib/supabase/queries.ts). */
function arbolCategorias(filas: TiendaFixture['menuCategories']): MenuCategory[] {
  const porId = new Map<number, MenuCategory>()
  const raices: MenuCategory[] = []
  for (const c of filas) porId.set(c.id, { id: c.id, name: c.name, slug: c.slug, icon: null, color: null, image_url: null, children: [] })
  for (const c of filas) {
    const nodo = porId.get(c.id)!
    const padre = c.parent_id !== null ? porId.get(c.parent_id) : undefined
    if (padre) padre.children.push(nodo)
    else raices.push(nodo)
  }
  return raices
}

export default function PaginaPruebaEncabezado({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (process.env.PRUEBAS_INTERNAS !== '1') notFound()

  const orgId = Number(uno(searchParams.org))
  const tienda = leerFixture().find((t) => t.id === orgId)
  if (!tienda) notFound()

  const header = uno(searchParams.header)
  const search = uno(searchParams.search)
  const msearch = uno(searchParams.msearch)
  if (header && !(HEADERS as readonly string[]).includes(header)) notFound()
  if (search && !(BUSCADORES as readonly string[]).includes(search)) notFound()
  if (msearch && !(BUSCADORES as readonly string[]).includes(msearch)) notFound()

  const documento = tienda.documento as DocumentoSitio
  const ajustes = ajustesPublicosDesdeDocumento(documento, tienda.legacy as unknown as WebsiteSettings, null) as unknown as Record<string, unknown>
  if (header) {
    // header_layout manda sobre header_style (SiteHeader): para forzar una variante se quita.
    delete ajustes.header_layout
    ajustes.header_style = header
  }
  if (search) ajustes.search_style = search
  if (msearch) ajustes.mobile_search_style = msearch

  const categorias = new Map(tienda.categoriasDelMenu.map((c) => [Number(c.id), c]))
  const menus = menusPublicosDesdeDocumento(documento, tienda.id, categorias)
  const navTree = (menus.header?.items ?? []).map(itemANodo)
  const menuCategories = arbolCategorias(tienda.menuCategories)
  const tema = temaPublicoDesdeDocumento(documento, false, null)
  const settings = ajustes as unknown as WebsiteSettings
  const primaryColor = (ajustes.primary_color as string | null) || '#3B82F6'
  const template = getTemplate((ajustes.template_id as string | null) ?? 'modern')

  const organization = {
    id: tienda.id,
    name: tienda.nombre,
    subdomain: tienda.subdomain,
    type_id: tienda.type_id,
    logo_url: null,
    phone: null,
    email: null,
    primary_color: primaryColor,
    secondary_color: (ajustes.secondary_color as string | null) ?? null,
    status: 'active',
    organization_types: null,
    website_settings: settings,
  } as unknown as OrganizationWithDetails

  // Lo que la matriz necesita saber del caso (no es parte del sitio).
  const datos = {
    org: tienda.id,
    header: header ?? null,
    headerEfectivo: estiloDeHeaderLayout(ajustes.header_layout) || (ajustes.header_style as string | null) || 'default',
    header_layout: ajustes.header_layout ?? null,
    search_style: ajustes.search_style ?? null,
    mobile_search_style: ajustes.mobile_search_style ?? null,
    mobile_search_same_as_desktop: ajustes.mobile_search_same_as_desktop ?? null,
    buscadorMovil: buscadorMovilEfectivo(ajustes),
    mobile_breakpoint: (ajustes.mobile_breakpoint as number | null) ?? 768,
    mobile_menu_style: ajustes.mobile_menu_style ?? null,
    menu: navTree.map((n) => n.title),
  }

  return (
    <OrganizationLayoutCliente
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={navTree}
      headerNavTree={navTree}
      menuCategories={menuCategories}
      effectiveSettings={settings}
      temaSitio={tema}
    >
      <script type="application/json" id="datos-prueba-encabezado" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }} />
      <MarcaListo />
      <div data-relleno="" className="mx-auto max-w-7xl px-4 py-10">
        {Array.from({ length: 6 }, (_, i) => (
          <section key={i} className="py-10">
            <h2 className="text-2xl font-bold">Sección de relleno {i + 1}</h2>
            <p className="mt-4 max-w-3xl text-gray-600">
              Contenido de relleno para que la página tenga alto y se pueda hacer clic fuera del buscador. No
              representa ninguna tienda.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="h-32 rounded-lg bg-gray-100" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </OrganizationLayoutCliente>
  )
}
