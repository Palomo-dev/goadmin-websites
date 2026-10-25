import { notFound } from 'next/navigation'
import { getCategoryBySlug, getSubcategories, getProductsByCategoryPaginated, getParentCategory, getMetaPixelId, getGoogleAdsConfig, getWebsitePageByType } from '@/lib/supabase/queries'
import { getOrgContext } from '@/lib/get-org-context'
import { getPlantillaPublica } from '@/lib/website/v2/lectorPublico'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CategoryDetailRenderer } from '@/components/sections/category-detail/CategoryDetailRenderer'
import { JsonLd } from '@/components/site/JsonLd'
import { Metadata } from 'next'
import { tamanoPaginaCategoriaPlantilla, TAMANO_PAGINA_CATEGORIA } from '@/lib/products/paginacionCategoria'

import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { porPaginaDeCampo } from '@/lib/website/v2/paginacionCarrusel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Categoría' }
  const { slug } = await params
  const category = await getCategoryBySlug(ctx.organization.id, slug, ctx.branchId)
  if (!category) return { title: 'Categoría no encontrada' }
  return {
    title: `${category.meta_title || category.name}${ctx.outlet ? ` · ${ctx.outlet.branchName}` : ''} | ${ctx.organization.name}`,
    description: category.meta_description || category.description || `Productos de ${category.name}`,
    // SEO local: la categoría de una sede tiene su propia URL (host de la sede o /<sede>).
    alternates: { canonical: `${ctx.urlBase}/categorias/${encodeURIComponent(slug)}` },
  }
}

export default async function CategoriaSlugPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, branchId } = ctx

  const [category, metaPixelId, googleAdsConfig] = await Promise.all([
    getCategoryBySlug(organization.id, slug, branchId),
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id)
  ])
  if (!category) return notFound()

  // Parámetros de búsqueda
  const page = Math.max(1, parseInt(typeof resolvedSearchParams.page === 'string' ? resolvedSearchParams.page : '1', 10))
  const sort = (typeof resolvedSearchParams.orden === 'string' ? resolvedSearchParams.orden : 'best_selling') as any
  const subcategorySlug = typeof resolvedSearchParams.sub === 'string' ? resolvedSearchParams.sub : undefined
  const view = typeof resolvedSearchParams.vista === 'string' ? resolvedSearchParams.vista : 'grid'

  // Obtener subcategorías
  const subcategories = await getSubcategories(organization.id, category.id, branchId)

  // Resolver subcategoría seleccionada
  let subcategoryId: number | undefined
  if (subcategorySlug) {
    const sub = (subcategories as any[]).find((s) => s.slug === subcategorySlug)
    if (sub) subcategoryId = sub.id
  }

  // F9.4 — Buscar plantilla de detalle de categoría editable
  // Sitio V2: la plantilla sale de la revisión publicada; legacy: igual que antes.
  const categoryDetailTemplate = await getPlantillaPublica(organization.id, 'category_detail', ctx.branchId,
    () => getWebsitePageByType(organization.id, 'category_detail'))

  const sitio = await getSitioPublicoV2(organization.id, branchId)
  const globalPorPagina = porPaginaDeCampo(sitio?.documento?.tema?.paginacion, TAMANO_PAGINA_CATEGORIA)
  const seccionProductos = categoryDetailTemplate?.website_page_sections.find((s) => s.section_type === 'category_products' && s.is_visible !== false)
  const tieneLimite = seccionProductos?.content && typeof seccionProductos.content === 'object' && 'max_items' in seccionProductos.content && seccionProductos.content.max_items != null
  const porPagina = tieneLimite ? tamanoPaginaCategoriaPlantilla(categoryDetailTemplate?.website_page_sections) : globalPorPagina

  // Obtener productos paginados
  const { products, total } = await getProductsByCategoryPaginated(organization.id, category.id, {
    page,
    limit: porPagina,
    sort,
    subcategoryId,
    branchId
  })

  // Breadcrumbs: obtener categoría padre si existe
  let parentCategory = null
  if (category.parent_id) {
    parentCategory = await getParentCategory(organization.id, category.parent_id)
  }

  const totalPages = Math.ceil(total / porPagina)

  // F9.5 — JSON-LD ItemList para categoría (URLs de la sede si la página es de una sede)
  const baseUrl = ctx.urlBase
  const itemListJsonLd: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'ItemList',
    name: category.name,
    description: category.description || undefined,
    numberOfItems: total,
    itemListElement: products.slice(0, porPagina).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${baseUrl}/productos/${p.uuid}`,
    })),
  }

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} frozenReason={frozenReason} branchId={branchId}>
      {/* F9.5 — JSON-LD ItemList */}
      <JsonLd data={itemListJsonLd} />
      <CategoryDetailRenderer
        organization={organization}
        primaryColor={primaryColor}
        templatePage={categoryDetailTemplate}
        category={category}
        parentCategory={parentCategory}
        subcategories={subcategories}
        products={products}
        total={total}
        totalPages={totalPages}
        currentPage={page}
        currentSort={sort}
        currentSubcategory={subcategorySlug || ''}
        currentView={view}
        categorySlug={slug}
        branchId={branchId}
      />
    </OrganizationLayout>
  )
}
