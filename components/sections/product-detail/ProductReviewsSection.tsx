'use client'

import { ProductReviews } from '@/components/site/reviews/ProductReviews'

export const CONTENT_KEYS = ['reviews_source'] as const

interface ProductReviewsSectionProps {
  content: {
    reviews_source?: string
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
        productStats={data?.productStats}
      />
    </div>
  )
}
