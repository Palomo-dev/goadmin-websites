import { Metadata } from 'next'
import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CategoryPageClient } from '@/app/categorias/[slug]/CategoryPageClient'
import { EnlaceSitio } from '@/components/site/EnlaceSitio'
import { getCategoryBySlug, getCartaSedeParaListado, getFichasListadoCategoria, getGoogleAdsConfig, getMetaPixelId } from '@/lib/supabase/queries'
import { getAllowedCategoryIds } from '@/lib/outlet/catalog-helpers'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { TAMANO_PAGINA_CATEGORIA, paginarIds } from '@/lib/products/paginacionCategoria'
import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { porPaginaDeCampo } from '@/lib/website/v2/paginacionCarrusel'
import {
  buscarIdsProductos,
  idsCategoriaConSubcategorias,
  intersectarCategorias,
  limpiarSlugCategoria,
  limpiarTextoBusqueda,
  type OrdenBusqueda,
} from '@/lib/products/busquedaPublica'

export const dynamic = 'force-dynamic'

type Params = Record<string, string | string[] | undefined>
const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? '' : '')

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  const q = limpiarTextoBusqueda(texto((await searchParams).q))
  const titulo = q ? `Resultados para «${q}»` : 'Buscar'
  // Las páginas de resultados no se indexan (contenido duplicado e infinito).
  return { title: ctx ? `${titulo} | ${ctx.organization.name}` : titulo, robots: { index: false, follow: true } }
}

/**
 * Resultados del buscador: `/search?q=<texto>&categoria=<slug>`. Antes la ruta no existía y el
 * Enter del buscador caía en «página no encontrada». La categoría incluye sus subcategorías;
 * la visibilidad (sede, carta, precio vigente) es la del listado de categorías.
 */
export default async function BuscarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, branchId, menuCategories } = ctx
  const sp = await searchParams
  const qCrudo = texto(sp.q).trim().slice(0, 80)
  const q = limpiarTextoBusqueda(qCrudo)
  const slugCategoria = limpiarSlugCategoria(texto(sp.categoria))
  const page = Math.max(1, parseInt(texto(sp.page) || '1', 10) || 1)
  const sort = (texto(sp.orden) || 'best_selling') as OrdenBusqueda
  const view = texto(sp.vista) === 'list' ? 'list' : 'grid'

  const supabase = createAdminClient() || createPublicClient()
  const [metaPixelId, googleAdsConfig, categoria, permitidas, carta, sitio] = await Promise.all([
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id),
    slugCategoria ? getCategoryBySlug(organization.id, slugCategoria, branchId) : Promise.resolve(null),
    getAllowedCategoryIds(organization.id, branchId),
    getCartaSedeParaListado(organization.id, branchId),
    getSitioPublicoV2(organization.id, branchId),
  ])
  const limite = porPaginaDeCampo(sitio?.documento?.tema?.paginacion, TAMANO_PAGINA_CATEGORIA)

  let ids: number[] = []
  if (supabase && (q || categoria)) {
    try {
      const filtro = categoria && slugCategoria
        ? await idsCategoriaConSubcategorias(supabase, organization.id, slugCategoria, branchId)
        : null
      // Categoría pedida pero no visible: sin resultados (no se cae a toda la tienda).
      const categoryIds = slugCategoria && !filtro ? [] : intersectarCategorias(permitidas, filtro)
      ids = await buscarIdsProductos(supabase, organization.id, { q, categoryIds, carta, sort })
    } catch (error) {
      console.error('[search] búsqueda', { organizationId: organization.id, error: error instanceof Error ? error.message : String(error) })
      ids = []
    }
  }
  const { pagina, total } = paginarIds(ids, page, limite)
  let products: any[] = []
  if (pagina.length > 0) {
    try {
      products = await getFichasListadoCategoria(organization.id, pagina, branchId ?? null)
    } catch (error) {
      console.error('[search] fichas', { organizationId: organization.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const totalPages = Math.ceil(total / limite)
  const paramsBase: Record<string, string> = {}
  if (qCrudo) paramsBase.q = qCrudo
  if (categoria && slugCategoria) paramsBase.categoria = slugCategoria
  const titulo = qCrudo ? `Resultados para «${qCrudo}»` : categoria ? categoria.name : 'Buscar productos'

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} frozenReason={frozenReason} branchId={branchId} menuCategories={menuCategories}>
      <div className="container mx-auto px-4 py-8" data-pagina-busqueda="">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6 overflow-x-auto">
          <Link href="/" className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <EnlaceSitio href="/productos" className="hover:text-gray-700 dark:hover:text-gray-200 shrink-0">Productos</EnlaceSitio>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white truncate">Búsqueda</span>
        </nav>
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{titulo}</h1>
          {categoria && qCrudo && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              En{' '}
              <EnlaceSitio href={`/categorias/${categoria.slug}`} className="font-medium hover:underline">{categoria.name}</EnlaceSitio>
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{total} {total === 1 ? 'producto' : 'productos'}</p>
        </div>
        <CategoryPageClient
          products={products}
          subcategories={[]}
          categorySlug={slugCategoria ?? ''}
          primaryColor={primaryColor}
          total={total}
          totalPages={totalPages}
          currentPage={page}
          currentSort={sort}
          currentSubcategory=""
          currentView={view}
          organizationSubdomain={organization.subdomain || ''}
          organizationId={organization.id}
          showBuyNow={organization.website_settings?.show_buy_now_button !== false}
          branchId={branchId}
          rutaBase="/search"
          paramsBase={paramsBase}
          textoVacio={qCrudo ? `No encontramos productos para «${qCrudo}»` : 'Escribe qué buscas en el buscador'}
        />
      </div>
    </OrganizationLayout>
  )
}
