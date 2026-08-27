import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'

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

interface BannerItem {
  title?: string
  subtitle?: string
  image_url?: string
  bg_color?: string
  text_color?: string
  // Campos heredados (retrocompatibilidad con banners escritos a mano).
  cta_text?: string
  cta_url?: string
  // Destino tipado (F7.1).
  link_type?: 'category' | 'product' | 'url' | 'page' | 'none'
  link_category_id?: number
  link_product_id?: number
  link_url?: string
  link_page_id?: string
  show_category_products?: boolean
  max_preview_products?: number
  button_text?: string
  button_style?: 'solid' | 'outline' | 'ghost'
}

interface PromoBannersGridProps {
  content: {
    title?: string
    subtitle?: string
    layout?: 'grid' | 'carousel' | 'stack'
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

/**
 * Resuelve el `href` final de un banner según su `link_type`.
 * Si el banner no tiene `link_type` (banners heredados) cae a `cta_url` / `link_url`.
 */
function resolveBannerHref(
  banner: BannerItem,
  data: PromoBannersGridProps['data'],
): string | null {
  // Retrocompatibilidad: banners sin link_type usan cta_url / link_url.
  if (!banner.link_type) {
    return banner.cta_url || banner.link_url || null
  }

  switch (banner.link_type) {
    case 'none':
      return null
    case 'url':
      return banner.link_url || banner.cta_url || null
    case 'category': {
      if (!banner.link_category_id) return null
      const cat = data?.categories?.find((c) => c.id === banner.link_category_id)
      return cat?.slug ? `/categorias/${cat.slug}` : null
    }
    case 'product': {
      if (!banner.link_product_id) return null
      const prod = data?.products?.find((p) => p.id === banner.link_product_id)
      return prod?.uuid ? `/productos/${prod.uuid}` : null
    }
    case 'page': {
      if (!banner.link_page_id) return null
      const page = data?.bannerPages?.[banner.link_page_id]
      return page?.slug ? `/${page.slug}` : null
    }
    default:
      return null
  }
}

export function PromoBannersGrid({ content, primaryColor = '#3B82F6', data }: PromoBannersGridProps) {
  const banners = content.banners || []
  const layout = content.layout || 'grid'

  const gridClass =
    layout === 'stack'
      ? 'grid grid-cols-1 gap-6'
      : layout === 'carousel'
        ? 'grid grid-cols-1 md:grid-cols-2 gap-6 overflow-x-auto'
        : 'grid grid-cols-1 md:grid-cols-2 gap-6'

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          {content.title}
        </h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {banners.length > 0 ? (
        <div className={gridClass}>
          {banners.map((banner, i) => {
            const href = resolveBannerHref(banner, data)
            const textColor = banner.text_color || '#ffffff'
            const showPreview =
              banner.link_type === 'category' &&
              banner.show_category_products === true &&
              !!banner.link_category_id
            const maxPreview = banner.max_preview_products || 4
            const previewProducts = showPreview
              ? (data?.bannerCategoryProducts?.[banner.link_category_id!] || []).slice(0, maxPreview)
              : []
            const buttonText = banner.button_text || banner.cta_text
            const buttonStyle = banner.button_style || 'solid'

            const buttonClasses = {
              solid: 'bg-white dark:bg-gray-100 text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-200',
              outline: 'border border-white text-white hover:bg-white hover:text-gray-900',
              ghost: 'text-white hover:underline',
            }[buttonStyle]

            const card = (
              <div
                className="relative rounded-2xl overflow-hidden min-h-[200px] flex flex-col justify-center p-8 w-full"
                style={{ backgroundColor: banner.bg_color || primaryColor }}
              >
                {banner.image_url && (
                  <img
                    src={banner.image_url}
                    alt={banner.title || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="relative z-10" style={{ color: textColor }}>
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
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay promociones activas</p>
        </div>
      )}
    </div>
  )
}
