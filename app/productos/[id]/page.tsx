import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Button } from '@/components/ui/button'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, Package, Truck, Shield, Star, Layers } from 'lucide-react'
import { AddToCartButton } from '@/components/site/AddToCartButton'
import { ProductImageGallery } from '@/components/site/ProductImageGallery'
import { StickyAddToCart } from '@/components/site/StickyAddToCart'
import { ProductReviews } from '@/components/site/ProductReviews'
import { RelatedProducts } from '@/components/site/RelatedProducts'
import { ExpandableDescription } from '@/components/site/ExpandableDescription'
import { ReviewSummaryBadge } from '@/components/site/ReviewSummaryBadge'
import { getProductVariants } from '@/lib/supabase/queries'
import { ProductDetailActions } from './ProductDetailActions'
import { MetaPixelViewContent } from '@/components/site/MetaPixelEvents'
import { CountdownBanner } from '@/components/site/CountdownBanner'
import { Price } from '@/components/site/CurrencyProvider'

export const dynamic = 'force-dynamic'

async function getProduct(productUuid: string, organizationId: number): Promise<any | null> {
  const supabase = createAdminClient() || createPublicClient()
  
  const { data, error } = await (supabase as any)
    .from('products')
    .select(`
      *,
      product_prices (*),
      product_images (*)
    `)
    .eq('uuid', productUuid)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .single()
  
  if (error || !data) return null
  return data as any
}

async function getRelatedProducts(organizationId: number, categoryId: number | null, tagId: number | null, currentProductId: number, limit: number = 8): Promise<any[]> {
  const supabase = createAdminClient() || createPublicClient()
  const selectFields = `
    id, uuid, name, is_parent,
    product_prices (*),
    product_images (
      id, storage_path, is_primary, display_order,
      shared_image_id,
      shared_images ( storage_path )
    )
  `
  const collected = new Map<number, any>()

  // 1. Por categoría
  if (categoryId) {
    const { data } = await (supabase as any)
      .from('products')
      .select(selectFields)
      .eq('organization_id', organizationId)
      .eq('category_id', categoryId)
      .eq('status', 'active')
      .is('parent_product_id', null)
      .neq('id', currentProductId)
      .limit(limit)
    if (data) data.forEach((p: any) => collected.set(p.id, p))
  }

  // 2. Por tag
  if (tagId && collected.size < limit) {
    const { data } = await (supabase as any)
      .from('products')
      .select(selectFields)
      .eq('organization_id', organizationId)
      .eq('tag_id', tagId)
      .eq('status', 'active')
      .is('parent_product_id', null)
      .neq('id', currentProductId)
      .limit(limit)
    if (data) data.forEach((p: any) => collected.set(p.id, p))
  }

  // 3. Fallback: productos aleatorios de la misma organización
  if (collected.size < limit) {
    const { data } = await (supabase as any)
      .from('products')
      .select(selectFields)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .is('parent_product_id', null)
      .neq('id', currentProductId)
      .limit(limit * 2)
    if (data) data.forEach((p: any) => collected.set(p.id, p))
  }

  // Mezclar aleatoriamente y limitar
  const all = Array.from(collected.values())
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, limit)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Producto' }
  const { id } = await params
  const product = await getProduct(id, ctx.organization.id)
  return {
    title: product ? `${product.name} | ${ctx.organization.name}` : `Producto | ${ctx.organization.name}`,
    description: product?.description || undefined
  }
}

export default async function ProductoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  const product = await getProduct(id, organization.id)
  if (!product) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">📦</p>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Producto no encontrado</h1>
            <Link href="/productos" className="text-sm hover:underline" style={{ color: primaryColor }}>Ver todos los productos</Link>
          </div>
        </div>
      </OrganizationLayout>
    )
  }

  const price = product.product_prices?.[0]
  const comparePrice = price?.compare_price ? Number(price.compare_price) : null
  const isParent = product.is_parent === true

  // Obtener variantes si es producto padre
  let variants: any[] = []
  if (isParent) {
    variants = await getProductVariants(product.id, organization.id)
  }

  // Obtener productos relacionados por categoría, tag y aleatorio
  const relatedProducts = await getRelatedProducts(organization.id, product.category_id || null, product.tag_id || null, product.id)

  // Construir URLs de imágenes
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'
  const sortedImages = (product.product_images || [])
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order)
  const allImageUrls: string[] = sortedImages
    .map((img: any) => {
      const path = img.storage_path || img.shared_images?.storage_path
      return path ? `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}` : null
    })
    .filter(Boolean) as string[]
  const imageUrl = allImageUrls[0] || null

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      {/* Meta Pixel ViewContent */}
      <MetaPixelViewContent
        contentId={product.sku || String(product.id)}
        contentName={product.name}
        value={price?.price ? Number(price.price) : undefined}
      />
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
            images={allImageUrls}
            productName={product.name}
            primaryColor={primaryColor}
          />
          
          {/* Información del producto */}
          <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">SKU: {product.sku || 'N/A'}</p>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{product.name}</h1>
              <ReviewSummaryBadge primaryColor={primaryColor} productId={product.id} />
              
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
          />
        </div>
      </div>

      {/* Sticky Add to Cart (mobile) */}
      {price && (
        <StickyAddToCart
          productId={product.id}
          productName={product.name}
          price={Number(price.price)}
          comparePrice={comparePrice}
          imageUrl={imageUrl}
          primaryColor={primaryColor}
          isParent={isParent}
          variants={variants}
          organizationSubdomain={organization.subdomain || ''}
        />
      )}
    </OrganizationLayout>
  )
}
