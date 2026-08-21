'use client'

import { Star } from 'lucide-react'
import { useMemo } from 'react'
import { getSessionSeed, getReviewStats } from '@/lib/review-utils'

interface ReviewSummaryBadgeProps {
  primaryColor: string
  productId: number
}

export function ReviewSummaryBadge({ primaryColor, productId }: ReviewSummaryBadgeProps) {
  const { avgRating, totalReviews } = useMemo(() => {
    const sessionSeed = getSessionSeed(productId)
    const stats = getReviewStats(productId, sessionSeed)
    return { avgRating: stats.avgRating.toFixed(1), totalReviews: stats.totalReviews }
  }, [productId])

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
      <span className="text-sm text-gray-600">{avgRating} / 5</span>
      <span className="text-sm text-gray-400">•</span>
      <span className="text-sm underline" style={{ color: primaryColor }}>
        +{totalReviews.toLocaleString('es-CO')} opiniones
      </span>
    </button>
  )
}
