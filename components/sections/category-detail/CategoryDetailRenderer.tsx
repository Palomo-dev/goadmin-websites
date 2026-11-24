/**
 * CategoryDetailRenderer (F9.4)
 *
 * Orquesta la renderización del detalle de categoría:
 *  1. Busca la plantilla `category_detail` de la organización.
 *  2. Si tiene secciones → las renderiza via SectionRenderer con datos de la categoría.
 *  3. Si no tiene secciones → renderiza el layout hardcodeado actual (cero regresión).
 *
 * Mismo patrón que ProductDetailRenderer (F9.2).
 *
 * Plantillas de tienda: si la plantilla trae una sección VISIBLE `category_filters ·
 * sidebar_facets` (registrada en SECTION_MAP), esa sección va en una columna a la izquierda y
 * las secciones de listado que la siguen (filtros, subcategorías, productos) a la derecha
 * (`planColumnasCategoria`). Solo entonces se lee el árbol de categorías (`getMenuCategories`,
 * en caché: es la misma llamada que ya hace getOrgContext). Sin esa sección, todo igual que hoy.
 * Las secciones las pinta `SeccionesCategoria` (síncrono, sin consultas).
 *
 * Lienzo del editor del ERP (`enLienzo`, `?preview=1`): las secciones van en `CategoriaEnVivo`,
 * con el puente en vivo (`PreviewBridge`), y el árbol de categorías se lee siempre (la columna
 * lateral puede aparecer en vivo). Fuera del lienzo, todo igual.
 */

import Link from '@/components/site/Enlace'
import { ChevronRight, Home } from 'lucide-react'
import { CategoryPageClient } from '@/app/categorias/[slug]/CategoryPageClient'
import type { OrganizationWithDetails } from '@/types/database'
import type { WebsitePageWithSections } from '@/types/database'
import { EnlaceSitio } from '@/components/site/EnlaceSitio'
import { getMenuCategories } from '@/lib/supabase/queries'
import { categoriasHermanas } from './columnasCategoria'
import { SeccionesCategoria, usaColumnaLateral } from './SeccionesCategoria'
import { CategoriaEnVivo } from './CategoriaEnVivo'

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
  /** Lienzo del editor del ERP (`?preview=1`): secciones con el puente en vivo. */
  enLienzo?: boolean
}

export async function CategoryDetailRenderer({
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
  enLienzo = false,
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

  // ---- Modo plantilla: las secciones (con columna lateral si la plantilla la trae) ----
  if (!enLienzo && hasSections && templatePage) {
    const secciones = templatePage.website_page_sections
    const hermanas = usaColumnaLateral(secciones)
      ? categoriasHermanas(await getMenuCategories(organization.id, branchId), category)
      : null
    return (
      <SeccionesCategoria
        secciones={secciones}
        organization={organization}
        primaryColor={primaryColor}
        sectionData={sectionData}
        hermanas={hermanas}
      />
    )
  }

  // ---- Fallback: layout hardcodeado actual (cero regresión) ----
  const respaldo = (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6 overflow-x-auto">
        <Link href="/" className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <EnlaceSitio href="/productos" className="hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
          Productos
        </EnlaceSitio>
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

  // ---- Lienzo del editor: las secciones con el puente en vivo; sin secciones, el respaldo ----
  if (enLienzo) {
    const hermanas = categoriasHermanas(await getMenuCategories(organization.id, branchId), category)
    return (
      <CategoriaEnVivo
        inicial={templatePage?.website_page_sections ?? []}
        organization={organization}
        primaryColor={primaryColor}
        sectionData={sectionData}
        hermanas={hermanas}
        respaldo={respaldo}
      />
    )
  }
  return respaldo
}
