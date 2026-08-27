'use client'

import { ProductImageGallery } from '@/components/site/ProductImageGallery'

export const CONTENT_KEYS = ['layout', 'zoom', 'aspect_ratio', 'show_video', 'show_badges', 'thumb_size'] as const

interface ProductGalleryProps {
  content: {
    layout?: string
    zoom?: string
    aspect_ratio?: string
    show_video?: boolean
    show_badges?: boolean
    thumb_size?: string
  }
  primaryColor?: string
  data?: { product?: any; imageUrls?: string[] }
}

export function ProductGallery({ content, primaryColor = '#3B82F6', data }: ProductGalleryProps) {
  const images = data?.imageUrls || []
  const productName = data?.product?.name || 'Producto'

  return (
    <ProductImageGallery
      images={images}
      productName={productName}
      primaryColor={primaryColor}
    />
  )
}
