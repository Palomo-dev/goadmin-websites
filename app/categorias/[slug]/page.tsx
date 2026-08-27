import { notFound } from 'next/navigation'
import { getCategoryBySlug, getSubcategories, getProductsByCategoryPaginated, getParentCategory, getMetaPixelId, getGoogleAdsConfig, getWebsitePageByType } from '@/lib/supabase/queries'
import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CategoryDetailRenderer } from '@/components/sections/category-detail/CategoryDetailRenderer'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Categoría' }
  const { slug } = await params
  const category = await getCategoryBySlug(ctx.organization.id, slug)
  if (!category) return { title: 'Categoría no encontrada' }
  return {
    title: `${category.meta_title || category.name} | ${ctx.organization.name}`,
    description: category.meta_description || category.description || `Productos de ${category.name}`
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
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  const [category, metaPixelId, googleAdsConfig] = await Promise.all([
    getCategoryBySlug(organization.id, slug),
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
  const subcategories = await getSubcategories(organization.id, category.id)

  // Resolver subcategoría seleccionada
  let subcategoryId: number | undefined
  if (subcategorySlug) {
    const sub = (subcategories as any[]).find((s) => s.slug === subcategorySlug)
    if (sub) subcategoryId = sub.id
  }

  // Obtener productos paginados
  const { products, total } = await getProductsByCategoryPaginated(organization.id, category.id, {
    page,
    limit: 12,
    sort,
    subcategoryId
  })

  // Breadcrumbs: obtener categoría padre si existe
  let parentCategory = null
  if (category.parent_id) {
    parentCategory = await getParentCategory(organization.id, category.parent_id)
  }

  const totalPages = Math.ceil(total / 12)

  // F9.4 — Buscar plantilla de detalle de categoría editable
  const categoryDetailTemplate = await getWebsitePageByType(organization.id, 'category_detail')

  // F9.5 — JSON-LD ItemList para categoría
  const baseUrl = organization.custom_domain
    ? `https://${organization.custom_domain}`
    : `https://${organization.subdomain?.toLowerCase()}.goadmin.io`
  const itemListJsonLd: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'ItemList',
    name: category.name,
    description: category.description || undefined,
    numberOfItems: total,
    itemListElement: products.slice(0, 12).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${baseUrl}/productos/${p.uuid}`,
    })),
  }

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} frozenReason={frozenReason}>
      {/* F9.5 — JSON-LD ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
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
        currentPage={page}
        currentSort={sort}
        currentSubcategory={subcategorySlug || ''}
        currentView={view}
        categorySlug={slug}
      />
    </OrganizationLayout>
  )
}
