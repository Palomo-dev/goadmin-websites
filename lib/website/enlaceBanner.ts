/**
 * Destino de un banner promocional. Los banners viejos, sin `link_type`,
 * siguen usando `cta_url` / `link_url`.
 */
import { hrefDeSlug, mismoId } from './presentacionTienda'

export interface BannerItem {
  banner_style?: unknown
  title?: string
  subtitle?: string
  image_url?: string
  image_url_mobile?: string
  image_url_hover?: string
  image_fit?: 'cover' | 'contain'
  focal_point?: string
  alt?: string
  kicker?: string
  show_overlay_text?: boolean
  text_align?: string
  text_valign?: string
  bg_color?: string
  text_color?: string
  cta_text?: string
  cta_url?: string
  link_type?: 'category' | 'product' | 'url' | 'page' | 'none'
  link_category_id?: number | string
  link_product_id?: number | string
  link_url?: string
  link_page_id?: string
  show_category_products?: boolean
  max_preview_products?: number
  button_text?: string
  button_style?: 'solid' | 'outline' | 'ghost'
}

export function resolveBannerHref(
  banner: BannerItem,
  data?: {
    categories?: any[]
    products?: any[]
    bannerPages?: Record<string, { slug: string; title: string }>
  },
): string | null {
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
      const cat = data?.categories?.find((c) => mismoId(c.id, banner.link_category_id))
      return cat?.slug ? `/categorias/${cat.slug}` : null
    }
    case 'product': {
      if (!banner.link_product_id) return null
      const prod = data?.products?.find((p) => mismoId(p.id, banner.link_product_id))
      return prod?.uuid ? `/productos/${prod.uuid}` : null
    }
    case 'page': {
      if (!banner.link_page_id) return null
      const page = data?.bannerPages?.[banner.link_page_id]
      return page?.slug ? hrefDeSlug(page.slug) : null
    }
    default:
      return null
  }
}
