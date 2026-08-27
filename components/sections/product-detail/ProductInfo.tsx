'use client'

import { ReviewSummaryBadge } from '@/components/site/reviews/ReviewSummaryBadge'
import { CountdownBanner } from '@/components/site/CountdownBanner'
import { ExpandableDescription } from '@/components/site/ExpandableDescription'
import { Price } from '@/components/site/CurrencyProvider'

export const CONTENT_KEYS = ['blocks', 'show_countdown'] as const

interface ProductInfoProps {
  content: {
    blocks?: Array<{ id: string; visible?: boolean }>
    show_countdown?: boolean
  }
  primaryColor?: string
  data?: {
    product?: any
    organization?: any
    price?: number
    comparePrice?: number | null
    reviewsConfig?: any
    productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
  }
}

export function ProductInfo({ content, primaryColor = '#3B82F6', data }: ProductInfoProps) {
  const product = data?.product
  if (!product) return null

  const price = data?.price
  const comparePrice = data?.comparePrice ?? null
  const organization = data?.organization

  // Default block order: sku, title, rating, price, savings, short_description
  const defaultBlocks = [
    { id: 'sku', visible: true },
    { id: 'title', visible: true },
    { id: 'rating', visible: true },
    { id: 'price', visible: true },
    { id: 'savings', visible: true },
    { id: 'short_description', visible: true },
  ]
  const blocks = content.blocks?.length ? content.blocks : defaultBlocks

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        if (block.visible === false) return null

        switch (block.id) {
          case 'sku':
            return (
              <p key="sku" className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                SKU: {product.sku || 'N/A'}
              </p>
            )
          case 'title':
            return (
              <h1 key="title" className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {product.name}
              </h1>
            )
          case 'rating':
            return <ReviewSummaryBadge key="rating" primaryColor={primaryColor} productId={product.id} reviewsConfig={data?.reviewsConfig} productStats={data?.productStats} />
          case 'price':
            return price != null ? (
              <div key="price" className="flex items-baseline gap-3">
                {comparePrice && comparePrice > price && (
                  <Price value={comparePrice} className="text-xl text-gray-400 line-through" />
                )}
                <Price value={price} className="text-4xl font-bold" style={{ color: primaryColor }} />
                {comparePrice && comparePrice > price && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                    -{Math.round((1 - price / comparePrice) * 100)}%
                  </span>
                )}
              </div>
            ) : null
          case 'savings':
            return null // savings is rendered within price block
          case 'short_description':
            return product.description ? (
              <div key="short_description">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Descripción</h3>
                <ExpandableDescription text={product.description} maxLength={180} />
              </div>
            ) : null
          default:
            return null
        }
      })}

      {content.show_countdown !== false && organization?.website_settings?.countdown_enabled && organization?.website_settings?.countdown_show_in_product && (
        <CountdownBanner
          config={organization.website_settings}
          primaryColor={primaryColor}
          variant="inline"
        />
      )}
    </div>
  )
}
