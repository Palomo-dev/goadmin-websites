'use client'

import { ProductImageGallery, type GallerySettings } from '@/components/site/ProductImageGallery'

// `page_layout` (plantillas de tienda): lo lee ProductDetailRenderer, no la galería.
export const CONTENT_KEYS = ['layout', 'zoom', 'aspect_ratio', 'show_video', 'show_badges', 'thumb_size', 'page_layout'] as const

interface ProductGalleryProps {
  content: {
    layout?: string
    zoom?: string
    aspect_ratio?: string
    show_video?: boolean
    show_badges?: boolean
    thumb_size?: string
    /** Opciones de la galería con los nombres de `page_settings` (ver CLAVES_GALERIA_FICHA). */
    gallery_layout?: GallerySettings['gallery_layout']
    thumbnails_position?: GallerySettings['thumbnails_position']
    gallery_arrows?: boolean
    gallery_dots?: boolean
    gallery_grid_columns?: number
    gallery_scroll_height?: number
  }
  primaryColor?: string
  data?: { product?: any; imageUrls?: string[] }
}

export function ProductGallery({ content, primaryColor = '#3B82F6', data }: ProductGalleryProps) {
  const images = data?.imageUrls || []
  const productName = data?.product?.name || 'Producto'

  // Mismas claves que `page_settings` (el layout monolítico las pasaba así a la galería).
  const settings: GallerySettings = {
    gallery_layout: content.gallery_layout,
    thumbnails_position: content.thumbnails_position,
    gallery_arrows: content.gallery_arrows,
    gallery_dots: content.gallery_dots,
    gallery_grid_columns: content.gallery_grid_columns,
    gallery_scroll_height: content.gallery_scroll_height,
  }

  return (
    <ProductImageGallery
      images={images}
      productName={productName}
      primaryColor={primaryColor}
      settings={settings}
    />
  )
}
