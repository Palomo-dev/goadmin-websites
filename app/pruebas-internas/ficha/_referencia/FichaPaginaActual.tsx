/**
 * REFERENCIA CONGELADA — solo para el arnés `app/pruebas-internas/ficha` (verify:ficha-diff).
 *
 * Copia literal del JSX que `app/productos/[id]/page.tsx` pinta cuando la organización NO tiene
 * plantilla `product_detail` (líneas 410-548 en el commit 7480f10). Es lo que ven hoy TODAS las
 * tiendas: el 2026-11-04 ninguna organización tiene página `product_detail` (ni en
 * `website_pages` ni en documentos V2 publicados o en borrador), así que `ProductDetailRenderer`
 * no se usa en producción. El arnés lo compara con el renderer solo como dato informativo.
 * Las variables son las mismas de la página; se reciben como props.
 */
import Link from 'next/link'
import { ArrowLeft, Truck, Shield, Package, Star } from 'lucide-react'
import { ProductImageGallery } from '@/components/site/ProductImageGallery'
import { ProductReviews } from '@/components/site/reviews/ProductReviews'
import { RelatedProducts } from '@/components/site/RelatedProducts'
import { ExpandableDescription } from '@/components/site/ExpandableDescription'
import { ReviewSummaryBadge } from '@/components/site/reviews/ReviewSummaryBadge'
import { ContadorColumnas } from '@/components/site/ContadorColumnas'
import { soloContador } from '@/lib/website/contadorColumnas'
import { ContadoresDe } from '@/components/site/ContadorPublico'
import { conversionManda, type ConversionSitio } from '@/lib/website/conversion'
import { PrecioFicha } from '@/components/site/PrecioFicha'
import { ProductDetailActions } from '@/app/productos/[id]/ProductDetailActions'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import type { OrganizationWithDetails } from '@/types/database'
import type { OrdenAtributos } from '@/lib/products/ordenAtributos'

interface Props {
  organization: OrganizationWithDetails
  primaryColor: string
  product: any
  variants: any[]
  modifierGroups: any[]
  relatedProducts: any[]
  allImageUrls: string[]
  imageUrl: string | null
  price: any
  comparePrice: number | null
  isParent: boolean
  branchId: number | null
  restaurante: { textoAgotado: string | null } | null
  puedePedir: boolean
  ordenAtributos: OrdenAtributos | null
  esRestaurante: boolean
  prefijo: string
}

export function FichaPaginaActual({
  organization, primaryColor, product, variants, modifierGroups, relatedProducts, allImageUrls, imageUrl,
  price, comparePrice, isParent, branchId, restaurante, puedePedir, ordenAtributos, esRestaurante, prefijo,
}: Props) {
  return (
      <div className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link 
            href={conPrefijo(esRestaurante ? '/menu' : '/productos', prefijo)}
            className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {esRestaurante ? 'Volver a la carta' : 'Volver a productos'}
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
              <ReviewSummaryBadge
                primaryColor={primaryColor}
                productId={product.id}
                reviewsConfig={(organization.website_settings as any)?.product_reviews ?? null}
                productStats={{ rating_avg: product.rating_avg, reviews_count: product.reviews_count }}
              />
              
              {price && (
                <PrecioFicha price={Number(price.price)} comparePrice={comparePrice} variants={isParent ? variants : []} primaryColor={primaryColor} />
              )}
            </div>
            
            {/* Countdown */}
            {conversionManda(organization.website_settings as { conversion?: ConversionSitio }, 'producto') ? (
              <ContadoresDe settings={organization.website_settings as { conversion?: ConversionSitio }} ubicacion="producto" primaryColor={primaryColor} variante="inline" />
            ) : (
              <ContadorColumnas settings={soloContador(organization.website_settings)} columna="countdown_show_in_product" primaryColor={primaryColor} variant="inline" />
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
                branchId={branchId}
                restaurante={restaurante}
                puedePedir={puedePedir}
                ordenAtributos={ordenAtributos}
              />
            </div>
            
            {/* Beneficios de e-commerce (envío, garantía, empaque): no aplican a un plato. */}
            {!esRestaurante && (
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
            )}
          </div>
        </div>

        {/* Productos relacionados */}
        <RelatedProducts
          products={relatedProducts}
          primaryColor={primaryColor}
          currentProductId={product.id}
          organizationSubdomain={organization.subdomain || ''}
          branchId={branchId}
        />

        {/* Reviews */}
        <div id="product-reviews">
          <ProductReviews
            productId={product.id}
            productName={product.name}
            primaryColor={primaryColor}
            reviewsConfig={(organization.website_settings as any)?.product_reviews ?? null}
            productStats={{ rating_avg: product.rating_avg, reviews_count: product.reviews_count }}
          />
        </div>
      </div>
  )
}
