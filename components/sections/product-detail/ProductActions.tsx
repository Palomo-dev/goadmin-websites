'use client'

import { ProductDetailActions } from '@/app/productos/[id]/ProductDetailActions'

export const CONTENT_KEYS = ['sticky_mobile'] as const

interface ProductActionsProps {
  content: {
    sticky_mobile?: boolean
  }
  primaryColor?: string
  data?: {
    product?: any
    variants?: any[]
    price?: number
    comparePrice?: number | null
    imageUrl?: string | null
    isParent?: boolean
    organizationSubdomain?: string
    modifierGroups?: any[]
    trackStock?: boolean
    stockLevels?: any[]
  }
}

export function ProductActions({ content, primaryColor = '#3B82F6', data }: ProductActionsProps) {
  const product = data?.product
  if (!product) return null

  return (
    <div id="product-actions">
      <ProductDetailActions
        product={product}
        variants={data?.variants || []}
        price={data?.price || 0}
        comparePrice={data?.comparePrice ?? null}
        imageUrl={data?.imageUrl ?? null}
        primaryColor={primaryColor}
        isParent={data?.isParent ?? false}
        organizationSubdomain={data?.organizationSubdomain || ''}
        modifierGroups={data?.modifierGroups || []}
        trackStock={data?.trackStock}
        stockLevels={data?.stockLevels}
      />
    </div>
  )
}
