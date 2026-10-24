import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { claseAspectoBanner, claseImagenBanner, clasesColumnasBanner } from '@/lib/website/presentacionTienda'
import { resolveBannerHref, type BannerItem } from '@/lib/website/enlaceBanner'
import { usarDistribucionNueva } from '@/lib/website/distribucionBanner'
import { BannersConfigurados } from './BannersConfigurados'
import { SiLista } from '../ListRenderer'

export type { BannerItem }
export { resolveBannerHref }

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

/**
 * Resuelve la URL pública de la imagen principal de un producto.
 * Réplica mínima del helper de OffersGrid para el preview de categoría.
 */
function getProductImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

interface PromoBannersGridProps {
  content: {
    title?: string
    subtitle?: string
    layout?: 'grid' | 'carousel' | 'stack'
    columns?: unknown
    columns_mobile?: unknown
    aspect_ratio?: unknown
    aspect_ratio_mobile?: unknown
    image_fit?: unknown
    image_position?: unknown
    banners?: BannerItem[]
  }
  primaryColor?: string
  /**
   * Datos prefetched desde page.tsx:
   * - `categories`: lista de categorías (id, slug, name) para resolver enlaces.
   * - `products`: lista de productos (id, uuid) para resolver enlaces de producto.
   * - `bannerCategoryProducts`: mapa `categoryId -> products[]` para el preview.
   * - `bannerPages`: mapa `pageId -> { slug, title }` para resolver enlaces de página.
   */
  data?: {
    categories?: any[]
    products?: any[]
    bannerCategoryProducts?: Record<number, any[]>
    bannerPages?: Record<string, { slug: string; title: string }>
  }
}

export function PromoBannersGrid({ content, primaryColor = '#3B82F6', data }: PromoBannersGridProps) {
  const nuevo = usarDistribucionNueva(content)
  if (nuevo) {
    return <BannersConfigurados content={content} config={nuevo} primaryColor={primaryColor} data={data} />
  }
  const banners = content.banners || []
  const layout = content.layout || 'grid'

  const gridClass = `${clasesColumnasBanner(content.columns, layout, content.columns_mobile)}${layout === 'carousel' ? ' overflow-x-auto' : ''}`
  const aspecto = claseAspectoBanner(content.aspect_ratio, content.aspect_ratio_mobile)
  // Automática en los dos anchos: la imagen va en el flujo y da la altura.
  const altoNatural = aspecto === 'h-auto'
  // Proporción en el celular y automática en escritorio: desde md la foto también va en el flujo.
  // Si siguiera absoluta, `md:h-auto` dejaría la tarjeta en cero.
  const altoNaturalEscritorio = aspecto.includes('md:h-auto')

  return (
    <div>
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          {content.title}
        </h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {banners.length > 0 ? (
        <SiLista content={content} className={gridClass}>
          {banners.map((banner, i) => {
            const href = resolveBannerHref(banner, data)
            const textColor = banner.text_color || '#ffffff'
            const showPreview =
              banner.link_type === 'category' &&
              banner.show_category_products === true &&
              !!banner.link_category_id
            const maxPreview = banner.max_preview_products || 4
            const mapa = data?.bannerCategoryProducts as Record<string, any[]> | undefined
            const previewProducts = showPreview
              ? (mapa?.[String(banner.link_category_id)] || mapa?.[banner.link_category_id as unknown as string] || []).slice(0, maxPreview)
              : []
            const buttonText = banner.button_text || banner.cta_text
            const buttonStyle = banner.button_style || 'solid'

            const buttonClasses = {
              solid: 'bg-white dark:bg-gray-100 text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-200',
              outline: 'border border-white text-white hover:bg-white hover:text-gray-900',
              ghost: 'text-white hover:underline',
            }[buttonStyle]

            const fotoNatural = altoNatural && Boolean(banner.image_url)
            const fotoNaturalMd = !fotoNatural && altoNaturalEscritorio && Boolean(banner.image_url)
            const card = (
              <div
                className={fotoNatural
                  ? 'relative rounded-2xl overflow-hidden w-full'
                  : fotoNaturalMd
                    ? `relative rounded-2xl overflow-hidden ${aspecto} flex flex-col justify-center p-8 md:p-0 w-full`
                    : `relative rounded-2xl overflow-hidden ${aspecto} flex flex-col justify-center p-8 w-full`}
                style={{ backgroundColor: banner.bg_color || primaryColor }}
              >
                {banner.image_url && (
                  <img
                    src={banner.image_url}
                    alt={banner.title || ''}
                    className={fotoNatural ? 'block w-full h-auto'
                      : fotoNaturalMd
                        ? `${claseImagenBanner(content.image_fit, content.image_position)} md:static md:h-auto`
                        : claseImagenBanner(content.image_fit, content.image_position)}
                    loading="lazy"
                  />
                )}
                <div
                  className={fotoNatural
                    ? 'absolute inset-0 z-10 flex flex-col justify-center p-8'
                    : fotoNaturalMd
                      ? 'relative z-10 md:absolute md:inset-0 md:flex md:flex-col md:justify-center md:p-8'
                      : 'relative z-10'}
                  style={{ color: textColor }}
                >
                  {banner.title && (
                    <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
                  )}
                  {banner.subtitle && <p className="mb-4 opacity-90">{banner.subtitle}</p>}

                  {showPreview && previewProducts.length > 0 && (
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {previewProducts.map((product: any) => {
                        const imgUrl = getProductImageUrl(product)
                        const prodUuid = product.uuid
                        return (
                          <Link
                            key={product.id}
                            href={prodUuid ? `/productos/${prodUuid}` : '#'}
                            className="block w-14 h-14 rounded-lg overflow-hidden bg-white/20 shrink-0 hover:opacity-80 transition-opacity"
                            title={product.name}
                          >
                            {imgUrl ? (
                              <Image
                                src={imgUrl}
                                alt={product.name}
                                width={56}
                                height={56}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-white/70" />
                              </div>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}

                  {buttonText && href && (
                    <span className={`inline-block px-5 py-2 rounded-lg font-medium transition-colors ${buttonClasses}`}>
                      {buttonText}
                    </span>
                  )}
                </div>
              </div>
            )

            return href ? (
              <Link key={i} href={href} className="block group">
                {card}
              </Link>
            ) : (
              <div key={i}>{card}</div>
            )
          })}
        </SiLista>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay promociones activas</p>
        </div>
      )}
    </div>
  )
}
