import { notFound } from 'next/navigation'
import { getCategoryBySlug, getSubcategories, getProductsByCategoryPaginated, getParentCategory, getMetaPixelId, getGoogleAdsConfig } from '@/lib/supabase/queries'
import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CategoryPageClient } from './CategoryPageClient'
import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

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

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} frozenReason={frozenReason}>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6 overflow-x-auto">
          <Link href="/" className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link href="/productos" className="hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            Productos
          </Link>
          {parentCategory && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <Link href={`/categorias/${parentCategory.slug}`} className="hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
                {parentCategory.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white truncate">{category.name}</span>
        </nav>

        {/* Header de categoría */}
        <div className="mb-8">
          {category.image_url && (
            <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-6">
              <img
                src={category.image_url}
                alt={category.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h1 className="text-3xl md:text-4xl font-bold text-white">{category.name}</h1>
                {category.description && (
                  <p className="text-white/80 mt-2 max-w-2xl">{category.description}</p>
                )}
              </div>
            </div>
          )}
          {!category.image_url && (
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
              {category.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">{category.description}</p>
              )}
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            {total} {total === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        {/* Componente client con filtros, grid y paginación */}
        <CategoryPageClient
          products={products}
          subcategories={subcategories}
          categorySlug={slug}
          primaryColor={primaryColor}
          total={total}
          totalPages={totalPages}
          currentPage={page}
          currentSort={sort}
          currentSubcategory={subcategorySlug || ''}
          currentView={view as 'grid' | 'list'}
          organizationSubdomain={organization.subdomain || ''}
          organizationId={organization.id}
          showBuyNow={organization.website_settings?.show_buy_now_button !== false}
        />
      </div>
    </OrganizationLayout>
  )
}
