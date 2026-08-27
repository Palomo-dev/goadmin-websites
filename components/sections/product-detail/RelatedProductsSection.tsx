'use client'

import { RelatedProducts } from '@/components/site/RelatedProducts'

export const CONTENT_KEYS = ['source', 'max_items', 'title'] as const

interface RelatedProductsSectionProps {
  content: {
    source?: string
    max_items?: number
    title?: string
  }
  primaryColor?: string
  data?: {
    relatedProducts?: any[]
    product?: any
    organizationSubdomain?: string
  }
}

export function RelatedProductsSection({ content, primaryColor = '#3B82F6', data }: RelatedProductsSectionProps) {
  const products = data?.relatedProducts || []
  const product = data?.product

  if (products.length === 0) return null

  return (
    <RelatedProducts
      products={products}
      primaryColor={primaryColor}
      currentProductId={product?.id}
      organizationSubdomain={data?.organizationSubdomain || ''}
    />
  )
}
