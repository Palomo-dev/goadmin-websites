'use client'

/**
 * FASE 10.2 — Badge de resumen de reseñas.
 *
 * En modo `generated` (default) usa exactamente la misma lógica que el
 * componente original (`getSessionSeed` + `getReviewStats`).
 * En modo `real`/`mixed`/`auto` puede usar los agregados de `products`
 * (rating_avg, reviews_count) si están disponibles.
 */

import { Star } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getSessionSeed, getReviewStats } from './providers/generatedReviews'
import type { ReviewsConfig } from './types'
import { resolveReviewsConfig } from './types'

interface ReviewSummaryBadgeProps {
  primaryColor: string
  productId: number
  /** Config de reseñas del editor (opcional — default = generated). */
  reviewsConfig?: Partial<ReviewsConfig> | null
  /** Agregados del producto (rating_avg, reviews_count) para modo real. */
  productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
}

export function ReviewSummaryBadge({
  primaryColor,
  productId,
  reviewsConfig,
  productStats,
}: ReviewSummaryBadgeProps) {
  const config = resolveReviewsConfig(reviewsConfig)

  // El seed generado usa Date.now() que difiere entre server y client,
  // por lo que se calcula solo después del mount para evitar hydration mismatch.
  const [generated, setGenerated] = useState<{ avg: string; count: number } | null>(null)
  useEffect(() => {
    if (config.reviews_source === 'generated' || !productStats || config.rating_source === 'generated_only') {
      const sessionSeed = getSessionSeed(productId)
      const stats = getReviewStats(productId, sessionSeed)
      setGenerated({ avg: stats.avgRating.toFixed(1), count: stats.totalReviews })
    }
  }, [productId, config.reviews_source, config.rating_source, productStats])

  let avgRating: string
  let totalReviews: number

  if (config.reviews_source === 'generated' || !productStats) {
    avgRating = generated?.avg ?? '0.0'
    totalReviews = generated?.count ?? 0
  } else if (config.rating_source === 'generated_only') {
    avgRating = generated?.avg ?? '0.0'
    totalReviews = generated?.count ?? 0
  } else {
    avgRating = productStats.rating_avg ? Number(productStats.rating_avg).toFixed(1) : '0.0'
    totalReviews = productStats.reviews_count || 0
  }

  const handleClick = () => {
    const el = document.getElementById('product-reviews')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 mt-2 hover:opacity-80 transition-opacity"
    >
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`h-4 w-4 ${i <= Math.round(Number(avgRating)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        ))}
      </div>
      <span className="text-sm font-medium text-gray-700">
        {avgRating} ({totalReviews.toLocaleString('es-CO')})
      </span>
    </button>
  )
}
