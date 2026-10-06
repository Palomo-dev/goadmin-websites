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
import type React from 'react'
import { ArrowLeft } from 'lucide-react'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { ProductImageGallery, type GallerySettings } from '@/components/site/ProductImageGallery'
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
import type { WebsitePageWithSections, WebsitePageSection } from '@/types/database'
import { buildDefaultProductDetailSections } from '@/lib/defaultProductDetailSections'
import { conPrefijo } from '@/lib/outlet/rutaSitio'

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
  branchId?: number | null
  /** Modo restaurante (type_id = 1): ficha de plato, sin beneficios de e-commerce por defecto. */
  restaurante?: { textoAgotado: string | null } | null
  puedePedir?: boolean
  /** `''` o `'/sede-norte'` (sede servida por prefijo de ruta): «Volver a la carta» de la sede. */
  prefijoSede?: string
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
  branchId = null,
  restaurante = null,
  puedePedir = true,
  prefijoSede = '',
}: ProductDetailRendererProps) {
  const volver = restaurante
    ? { href: conPrefijo('/menu', prefijoSede), texto: 'Volver a la carta' }
    : { href: conPrefijo('/productos', prefijoSede), texto: 'Volver a productos' }
  const hasSections = templatePage && templatePage.website_page_sections.length > 0

  const reviewsConfig = (organization.website_settings as any)?.product_reviews ?? null
  const productStats = { rating_avg: product.rating_avg, reviews_count: product.reviews_count }

  // F9.3 — Ajustes de layout de la página
  const pageSettings = (templatePage?.page_settings || {}) as Record<string, any>
  const columns = pageSettings.columns || '2' // '1' | '2' | '2+sidebar'
  const stickyColumn = pageSettings.sticky_column !== false // default true
  const galleryWidth = pageSettings.gallery_width ?? 50
  const descPos = pageSettings.description_position || 'below_title'
  const buttonsLayout = pageSettings.buttons_layout || 'stacked'
  const showBenefits = pageSettings.show_benefits !== false
  const showBreadcrumb = pageSettings.show_breadcrumb !== false
  const relatedLayout = pageSettings.related_products_layout || 'carousel'

  // Configuración de galería pasada al componente
  const gallerySettings: GallerySettings = {
    gallery_layout: pageSettings.gallery_layout,
    thumbnails_position: pageSettings.thumbnails_position,
    gallery_arrows: pageSettings.gallery_arrows,
    gallery_dots: pageSettings.gallery_dots,
    gallery_grid_columns: pageSettings.gallery_grid_columns,
    gallery_scroll_height: pageSettings.gallery_scroll_height,
  }

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
    branchId,
    restaurante,
    puedePedir,
  }

  // ---- Modo plantilla: renderizar secciones respetando page_settings.columns ----
  // Las secciones se agrupan en columnas para replicar el layout del fallback
  // monolítico: galería a la izquierda, info/actions/benefits/description a la
  // derecha, y relacionadas/reviews a full width abajo.
  if (hasSections && templatePage) {
    const visibleSections = templatePage.website_page_sections.filter((s) => s.is_visible !== false)

    // Tipos que van en la columna izquierda (galería)
    const LEFT_TYPES = new Set(['product_gallery'])
    // Tipos que van a full width (debajo del grid de 2 columnas)
    const FULL_WIDTH_TYPES = new Set(['related_products', 'product_reviews'])

    const leftSections = visibleSections.filter((s) => LEFT_TYPES.has(s.section_type))
    const rightSections = visibleSections.filter((s) => !LEFT_TYPES.has(s.section_type) && !FULL_WIDTH_TYPES.has(s.section_type))
    const fullWidthSections = visibleSections.filter((s) => FULL_WIDTH_TYPES.has(s.section_type))

    const renderSection = (section: WebsitePageSection) => (
      <SectionRenderer
        key={section.id}
        section={section}
        organization={organization}
        primaryColor={primaryColor}
        data={sectionData}
      />
    )

    const tplColumns = pageSettings.columns || '2'
    const tplGalleryWidth = pageSettings.gallery_width ?? 50
    const tplSticky = pageSettings.sticky_column !== false

    return (
      <div className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        {showBreadcrumb && (
          <div className="mb-8">
            <Link
              href={volver.href}
              className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {volver.texto}
            </Link>
          </div>
        )}

        {tplColumns === '1' ? (
          /* 1 columna: todo apilado verticalmente */
          <div className="space-y-12">
            {[...leftSections, ...rightSections].map(renderSection)}
          </div>
        ) : (
          /* 2 columnas: galería | info, como el fallback monolítico */
          <div className="flex flex-col lg:flex-row gap-12">
            <div style={{ flexBasis: `${tplGalleryWidth}%` }} className="space-y-3 min-w-0">
              {leftSections.map(renderSection)}
            </div>
            <div style={{ flexBasis: `${100 - tplGalleryWidth}%` }} className={`min-w-0 space-y-6 ${tplSticky ? 'lg:sticky lg:top-4 lg:self-start' : ''}`}>
              {rightSections.map(renderSection)}
            </div>
          </div>
        )}

        {/* Secciones full width (relacionados, reviews) */}
        <div className="mt-12 space-y-12">
          {fullWidthSections.map(renderSection)}
        </div>
      </div>
    )
  }

  // ---- Fallback: layout configurable (cero regresión) ----
  // Construir descripción reutilizable
  const descriptionBlock = product.description && (
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Descripción</h3>
      <ExpandableDescription text={product.description} maxLength={180} />
    </div>
  )

  // Bloque de información del producto (título, reviews, precio, countdown)
  const productInfoBlock = (
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
  )

  // Countdown
  const countdownBlock = (organization.website_settings as any)?.countdown_enabled && (organization.website_settings as any)?.countdown_show_in_product && (
    <CountdownBanner
      config={organization.website_settings as any}
      primaryColor={primaryColor}
      variant="inline"
    />
  )

  // Acciones
  const actionsBlock = (
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
        buttonsLayout={buttonsLayout}
        branchId={branchId}
        restaurante={restaurante}
        puedePedir={puedePedir}
      />
    </div>
  )

  // Beneficios
  // Restaurante: los beneficios por defecto (envío 24-48 h, garantía…) no aplican a un plato.
  const benefitsBlock = showBenefits && !restaurante && (
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
  )

  // Breadcrumb
  const breadcrumbBlock = showBreadcrumb && (
    <div className="mb-8">
      <Link
        href={volver.href}
        className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {volver.texto}
      </Link>
    </div>
  )

  // Galería
  const galleryBlock = (
    <ProductImageGallery
      images={imageUrls}
      productName={product.name}
      primaryColor={primaryColor}
      settings={gallerySettings}
    />
  )

  // Construir columna de información según orden configurado por description_position
  const infoColumn = (
    <div className={`space-y-6 ${stickyColumn ? 'lg:sticky lg:top-4 lg:self-start' : ''}`}>
      {descPos === 'above_gallery' ? null : productInfoBlock}
      {descPos === 'below_title' && descriptionBlock}
      {countdownBlock}
      {descPos === 'below_price' && descriptionBlock}
      {actionsBlock}
      {descPos === 'below_buttons' && descriptionBlock}
      {benefitsBlock}
    </div>
  )

  // Layout según columns
  const layoutGrid = (() => {
    if (columns === '1') {
      return (
        <div className="space-y-12">
          {descPos === 'above_gallery' && descriptionBlock}
          {galleryBlock}
          {productInfoBlock}
          {countdownBlock}
          {actionsBlock}
          {benefitsBlock}
        </div>
      )
    }

    // columns === '2' o '2+sidebar'
    const galleryStyle = { flexBasis: `${galleryWidth}%` } as React.CSSProperties
    const infoStyle = { flexBasis: `${100 - galleryWidth}%` } as React.CSSProperties

    return (
      <div className="flex flex-col lg:flex-row gap-12">
        <div style={galleryStyle} className="space-y-3">
          {descPos === 'above_gallery' && descriptionBlock}
          {galleryBlock}
        </div>
        <div style={infoStyle} className="min-w-0">
          {infoColumn}
        </div>
      </div>
    )
  })()

  return (
    <div className="container mx-auto px-4 py-12">
      {breadcrumbBlock}
      {layoutGrid}

      {/* Productos relacionados */}
      <RelatedProducts
        products={relatedProducts}
        primaryColor={primaryColor}
        currentProductId={product.id}
        organizationSubdomain={organization.subdomain || ''}
        layout={relatedLayout}
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
