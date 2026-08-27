'use client'

import { ExpandableDescription } from '@/components/site/ExpandableDescription'

export const CONTENT_KEYS = ['layout', 'max_height', 'show_specs'] as const

interface ProductDescriptionProps {
  content: {
    layout?: string
    max_height?: number
    show_specs?: boolean
  }
  primaryColor?: string
  data?: { product?: any }
}

export function ProductDescription({ content, data }: ProductDescriptionProps) {
  const product = data?.product
  if (!product?.description) return null

  return (
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Descripción</h3>
      <ExpandableDescription text={product.description} maxLength={content.max_height || 180} />
    </div>
  )
}
