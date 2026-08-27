/**
 * ProductDetailRenderer (F9.2)
 *
 * Orquesta la renderización del detalle de producto:
 *  1. Busca la plantilla `product_detail` de la organización.
 *  2. Si tiene secciones → las renderiza via SectionRenderer con datos del producto.
 *  3. Si no tiene secciones → renderiza el layout hardcodeado actual (cero regresión).
 *
 * La lógica transaccional (checkout, pagos) NO se expone aquí.
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { ProductImageGallery } from '@/components/site/ProductImageGallery'
import { StickyAddToCart } from '@/components/site/StickyAddToCart'
import { ProductReviews } from '@/components/site/reviews/ProductReviews'
import { RelatedProducts } from '@/components/site/RelatedProducts'
import { ExpandableDescription } from '@/components/site/ExpandableDescription'
import { ReviewSummaryBadge } from '@/components/site/reviews/ReviewSummaryBadge'
import { CountdownBanner } from '@/components/site/CountdownBanner'
import { Price } from '@/components/site/CurrencyProvider'
import { ProductDetailActions } from '@/app/productos/[id]/ProductDetailActions'
import { Truck, Shield, Package, Star } from 'lucide-react'
import type { OrganizationWithDetails } from '@/types/database'
import type { WebsitePageWithSections } from '@/types/database'

interface ProductDetailRendererProps {
  organization: OrganizationWithDetails
  primaryColor: string
  templatePage: WebsitePageWithSections | null
  product: any
  variants: any[]
  modifierGroups: any[]
  relatedProducts: any[]
  imageUrls: string[]
  imageUrl: string | null
  price: any
  comparePrice: number | null
  isParent: boolean
}

export function ProductDetailRenderer({
  organization,
  primaryColor,
  templatePage,
  product,
  variants,
  modifierGroups,
  relatedProducts,
  imageUrls,
  imageUrl,
  price,
  comparePrice,
  isParent,
}: ProductDetailRendererProps) {
  const hasSections = templatePage && templatePage.website_page_sections.length > 0

  const reviewsConfig = (organization.website_settings as any)?.product_reviews ?? null
  const productStats = { rating_avg: product.rating_avg, reviews_count: product.reviews_count }

  // F9.3 — Ajustes de layout de la página
  const pageSettings = (templatePage?.page_settings || {}) as Record<string, any>
  const columns = pageSettings.columns || '2' // '1' | '2' | '2+sidebar'
  const stickyColumn = pageSettings.sticky_column !== false // default true

  // ---- Datos compartidos para las secciones ----
  const sectionData: Record<string, any> = {
    product,
    variants,
    modifierGroups,
    relatedProducts,
    imageUrls,
    imageUrl,
    price: price ? Number(price.price) : 0,
    comparePrice,
    isParent,
    organization,
    organizationSubdomain: organization.subdomain || '',
    trackStock: product.track_stock,
    stockLevels: product.stock_levels,
    reviewsConfig,
    productStats,
  }

  // ---- Modo plantilla: renderizar secciones ----
  if (hasSections && templatePage) {
    return (
      <div className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/productos"
            className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a productos
          </Link>
        </div>

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
    <div className="container mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <div className="mb-8">
        <Link
          href="/productos"
          className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a productos
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Galería de imágenes */}
        <ProductImageGallery
          images={imageUrls}
          productName={product.name}
          primaryColor={primaryColor}
        />

        {/* Información del producto */}
        <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">SKU: {product.sku || 'N/A'}</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{product.name}</h1>
            <ReviewSummaryBadge
              primaryColor={primaryColor}
              productId={product.id}
              reviewsConfig={reviewsConfig}
              productStats={productStats}
            />

            {price && (
              <div className="flex items-baseline gap-3">
                {comparePrice && comparePrice > Number(price.price) && (
                  <Price value={comparePrice} className="text-xl text-gray-400 line-through" />
                )}
                <Price
                  value={Number(price.price)}
                  className="text-4xl font-bold"
                  style={{ color: primaryColor }}
                />
                {comparePrice && comparePrice > Number(price.price) && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                    -{Math.round((1 - Number(price.price) / comparePrice) * 100)}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Countdown */}
          {(organization.website_settings as any)?.countdown_enabled && (organization.website_settings as any)?.countdown_show_in_product && (
            <CountdownBanner
              config={organization.website_settings as any}
              primaryColor={primaryColor}
              variant="inline"
            />
          )}

          {product.description && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Descripción</h3>
              <ExpandableDescription text={product.description} maxLength={180} />
            </div>
          )}

          {/* Acciones */}
          <div id="product-actions">
            <ProductDetailActions
              product={product}
              variants={variants}
              price={Number(price?.price || 0)}
              comparePrice={comparePrice}
              imageUrl={imageUrl}
              primaryColor={primaryColor}
              isParent={isParent}
              organizationSubdomain={organization.subdomain || ''}
              modifierGroups={modifierGroups}
              trackStock={product.track_stock}
              stockLevels={product.stock_levels}
            />
          </div>

          {/* Beneficios */}
          <div className="grid grid-cols-2 gap-4 pt-6 border-t dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Envío rápido</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">24-48 horas</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Garantía</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">30 días</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Empaque seguro</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Protección total</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Calidad</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">100% original</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Productos relacionados */}
      <RelatedProducts
        products={relatedProducts}
        primaryColor={primaryColor}
        currentProductId={product.id}
        organizationSubdomain={organization.subdomain || ''}
      />

      {/* Reviews */}
      <div id="product-reviews">
        <ProductReviews
          productId={product.id}
          productName={product.name}
          primaryColor={primaryColor}
          reviewsConfig={reviewsConfig}
          productStats={productStats}
        />
      </div>
    </div>
  )
}
