/**
 * CategoryDetailRenderer (F9.4)
 *
 * Orquesta la renderización del detalle de categoría:
 *  1. Busca la plantilla `category_detail` de la organización.
 *  2. Si tiene secciones → las renderiza via SectionRenderer con datos de la categoría.
 *  3. Si no tiene secciones → renderiza el layout hardcodeado actual (cero regresión).
 *
 * Mismo patrón que ProductDetailRenderer (F9.2).
 */

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { CategoryPageClient } from '@/app/categorias/[slug]/CategoryPageClient'
import type { OrganizationWithDetails } from '@/types/database'
import type { WebsitePageWithSections } from '@/types/database'

interface CategoryDetailRendererProps {
  organization: OrganizationWithDetails
  primaryColor: string
  templatePage: WebsitePageWithSections | null
  category: any
  parentCategory: any
  subcategories: any[]
  products: any[]
  total: number
  totalPages: number
  currentPage: number
  currentSort: string
  currentSubcategory: string
  currentView: string
  categorySlug: string
  branchId?: number | null
}

export function CategoryDetailRenderer({
  organization,
  primaryColor,
  templatePage,
  category,
  parentCategory,
  subcategories,
  products,
  total,
  totalPages,
  currentPage,
  currentSort,
  currentSubcategory,
  currentView,
  categorySlug,
  branchId,
}: CategoryDetailRendererProps) {
  const hasSections = templatePage && templatePage.website_page_sections.length > 0

  // ---- Datos compartidos para las secciones ----
  const sectionData: Record<string, any> = {
    category,
    parentCategory,
    subcategories,
    products,
    total,
    totalPages,
    currentPage,
    currentSort,
    currentSubcategory,
    currentView,
    categorySlug,
    organizationSubdomain: organization.subdomain || '',
    showBuyNow: organization.website_settings?.show_buy_now_button !== false,
    branchId,
  }

  // ---- Modo plantilla: renderizar secciones ----
  if (hasSections && templatePage) {
    return (
      <div className="container mx-auto px-4 py-8">
        {templatePage.website_page_sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            organization={organization}
            primaryColor={primaryColor}
            data={sectionData}
          />
        ))}
      </div>
    )
  }

  // ---- Fallback: layout hardcodeado actual (cero regresión) ----
  return (
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
        categorySlug={categorySlug}
        primaryColor={primaryColor}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
        currentSort={currentSort}
        currentSubcategory={currentSubcategory}
        currentView={currentView as 'grid' | 'list'}
        organizationSubdomain={organization.subdomain || ''}
        organizationId={organization.id}
        showBuyNow={organization.website_settings?.show_buy_now_button !== false}
        branchId={branchId}
      />
    </div>
  )
}
