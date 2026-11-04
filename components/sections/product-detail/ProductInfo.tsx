'use client'

import { ReviewSummaryBadge } from '@/components/site/reviews/ReviewSummaryBadge'
import { PrecioFicha } from '@/components/site/PrecioFicha'

export const CONTENT_KEYS = ['blocks', 'show_countdown'] as const

interface ProductInfoProps {
  content: {
    /** Visibilidad por pieza (`sku`, `title`, `rating`, `price`). El orden es fijo. */
    blocks?: Array<{ id: string; visible?: boolean }>
    /**
     * `false` = sin aviso de stock ni contador tras la información. Lo aplica
     * `ProductDetailRenderer` (la urgencia no se pinta dentro de este bloque).
     */
    show_countdown?: boolean
  }
  primaryColor?: string
  data?: {
    product?: any
    variants?: any[]
    isParent?: boolean
    price?: number
    tienePrecio?: boolean
    comparePrice?: number | null
    reviewsConfig?: any
    productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
  }
}

/**
 * Información del producto: SKU, nombre, resumen de reseñas y precio (`PrecioFicha`, que sigue a
 * la variante elegida). Es el mismo marcado que pintaba el layout monolítico de la ficha; la
 * descripción y la urgencia son bloques aparte.
 */
export function ProductInfo({ content, primaryColor = '#3B82F6', data }: ProductInfoProps) {
  const product = data?.product
  if (!product) return null

  const visible = (id: string) => content.blocks?.find((b) => b.id === id)?.visible !== false

  return (
    <div>
      {visible('sku') && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">SKU: {product.sku || 'N/A'}</p>}
      {visible('title') && <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{product.name}</h1>}
      {visible('rating') && (
        <ReviewSummaryBadge
          primaryColor={primaryColor}
          productId={product.id}
          reviewsConfig={data?.reviewsConfig}
          productStats={data?.productStats}
        />
      )}

      {visible('price') && data?.tienePrecio && (
        <PrecioFicha price={data?.price ?? 0} comparePrice={data?.comparePrice ?? null} variants={data?.isParent ? (data?.variants || []) : []} primaryColor={primaryColor} />
      )}
    </div>
  )
}
