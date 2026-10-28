'use client'

import { ProductReviews } from '@/components/site/reviews/ProductReviews'

export const CONTENT_KEYS = ['reviews_source', 'empty_state_title', 'empty_state_message', 'empty_state_cta'] as const

interface ProductReviewsSectionProps {
  content: {
    reviews_source?: string
    empty_state_title?: string
    empty_state_message?: string
    empty_state_cta?: string
  }
  primaryColor?: string
  data?: {
    product?: any
    reviewsConfig?: any
    productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
  }
}

export function ProductReviewsSection({ content, primaryColor = '#3B82F6', data }: ProductReviewsSectionProps) {
  const product = data?.product
  if (!product) return null

  return (
    <div id="product-reviews">
      <ProductReviews
        productId={product.id}
        productName={product.name}
        primaryColor={primaryColor}
        reviewsConfig={data?.reviewsConfig}
        estadoVacio={{ titulo: content?.empty_state_title, mensaje: content?.empty_state_message, boton: content?.empty_state_cta }}
        productStats={data?.productStats}
      />
    </div>
  )
}
