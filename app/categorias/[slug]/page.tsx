import { notFound } from 'next/navigation'
import { getCategoryBySlug, getSubcategories, getProductsByCategoryPaginated, getParentCategory, getMetaPixelId, getGoogleAdsConfig, getWebsitePageByType } from '@/lib/supabase/queries'
import { getOrgContext } from '@/lib/get-org-context'
import { getPlantillaPublica } from '@/lib/website/v2/lectorPublico'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CategoryDetailRenderer } from '@/components/sections/category-detail/CategoryDetailRenderer'
import { JsonLd } from '@/components/site/JsonLd'
import { Metadata } from 'next'
import { TAMANO_PAGINA_CATEGORIA } from '@/lib/products/paginacionCategoria'
import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { porPaginaDeCampo } from '@/lib/website/v2/paginacionCarrusel'
import { navegacionCategoria } from '@/lib/navegacion/volver'
import { colorCabeceraDe } from '@/lib/navegacion/coloresVolver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { ORDENES_CATEGORIA, normalizarOrdenFiltrosCategoria, normalizarProductosCategoria, type OrdenCategoria } from '@/lib/website/v2/contrato/seccionesTienda'

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

  // F9.4 — Plantilla de detalle de categoría editable (antes de los productos: su orden al entrar
  // y sus productos por página deciden la consulta). Sitio V2: la revisión publicada; legacy: igual.
  const categoryDetailTemplate = await getPlantillaPublica(organization.id, 'category_detail', ctx.branchId,
    () => getWebsitePageByType(organization.id, 'category_detail'))
  const seccionVisible = (tipo: string) =>
    categoryDetailTemplate?.website_page_sections?.find((x: any) => x.section_type === tipo && x.is_visible !== false) ?? null
  // Figma «16 Sitio web», bloque 6: sin claves, «Más vendidos», el tamaño de página del sitio y números.
  const filtrosPlantilla = normalizarOrdenFiltrosCategoria((seccionVisible('category_filters')?.content ?? null) as Record<string, unknown> | null)
  const productosPlantilla = normalizarProductosCategoria((seccionVisible('category_products')?.content ?? null) as Record<string, unknown> | null)

  // Parámetros de búsqueda
  const page = Math.max(1, parseInt(typeof resolvedSearchParams.page === 'string' ? resolvedSearchParams.page : '1', 10) || 1)
  const ordenPedido = typeof resolvedSearchParams.orden === 'string' ? resolvedSearchParams.orden : ''
  const sort: OrdenCategoria = (ORDENES_CATEGORIA as readonly string[]).includes(ordenPedido)
    ? (ordenPedido as OrdenCategoria)
    : filtrosPlantilla.ordenInicial
  // «Ver más» / «Al bajar»: `?hasta=N` trae de la página 1 a la N juntas (tope 10).
  const acumula = productosPlantilla.paginacion !== 'numbers'
  const hasta = acumula ? Math.min(10, Math.max(1, parseInt(typeof resolvedSearchParams.hasta === 'string' ? resolvedSearchParams.hasta : '1', 10) || 1)) : 1
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

  const sitio = await getSitioPublicoV2(organization.id, branchId)
  // «Productos por página» del bloque; sin elegir, el ajuste general del sitio (lo de hoy).
  const limite = productosPlantilla.porPagina ?? porPaginaDeCampo(sitio?.documento?.tema?.paginacion, TAMANO_PAGINA_CATEGORIA)

  // Obtener productos paginados
  const { products, total } = await getProductsByCategoryPaginated(organization.id, category.id, {
    page: acumula ? 1 : page,
    limit: limite * hasta,
    sort,
    subcategoryId,
    branchId
  })

  // Breadcrumbs: obtener categoría padre si existe
  let parentCategory = null
  if (category.parent_id) {
    parentCategory = await getParentCategory(organization.id, category.parent_id)
  }

  const totalPages = Math.ceil(total / limite)

  // F9.5 — JSON-LD ItemList para categoría (URLs de la sede si la página es de una sede)
  const baseUrl = ctx.urlBase
  const itemListJsonLd: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'ItemList',
    name: category.name,
    description: category.description || undefined,
    numberOfItems: total,
    itemListElement: products.slice(0, limite * hasta).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${baseUrl}/productos/${p.uuid}`,
    })),
  }

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} frozenReason={frozenReason} branchId={branchId} menuCategories={ctx.menuCategories}>
      {/* F9.5 — JSON-LD ItemList */}
      <JsonLd data={itemListJsonLd} />
      {/* «← Volver a …» del celular (Figma 5C2): la categoría padre o el inicio. */}
      <BarraVolverMovil
        padre={navegacionCategoria({ categoria: category.name, padre: parentCategory }).padre}
        etiquetaActual={category.name}
        primaryColor={primaryColor}
        colorCabecera={colorCabeceraDe(organization.website_settings)}
        acciones={{ buscar: true, carrito: { subdominio: organization.subdomain || '', branchId } }}
      />
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
        currentPage={acumula ? hasta : page}
        currentSort={sort}
        ordenPorDefecto={filtrosPlantilla.ordenInicial}
        currentSubcategory={subcategorySlug || ''}
        currentView={view}
        categorySlug={slug}
        branchId={branchId}
        enLienzo={resolvedSearchParams.preview === '1'}
      />
    </OrganizationLayout>
  )
}
