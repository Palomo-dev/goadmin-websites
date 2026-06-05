'use client'

import { Star } from 'lucide-react'
import { useMemo } from 'react'

interface ReviewSummaryBadgeProps {
  primaryColor: string
  productId: number
}

// Copia de la función generateReviews de ProductReviews para calcular el promedio
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateReviews(productId: number, count: number = 1047) {
  const reviews = []
  const baseDate = new Date('2024-01-15')

  for (let i = 0; i < count; i++) {
    const seed1 = productId * 10000 + i
    const seed2 = productId * 5000 + i * 3
    const seed3 = productId * 2000 + i * 7
    const seed4 = productId * 1000 + i * 13
    const seed5 = productId * 500 + i * 17

    const rand = seededRandom(seed1)
    const rand2 = seededRandom(seed2)
    const rand3 = seededRandom(seed3)
    const rand4 = seededRandom(seed4)
    const rand5 = seededRandom(seed5)

    // Rating distribution: 76% 5stars, 20% 4stars, 3% 3stars, 1% 2-1stars (promedio ~4.7)
    let rating: number
    if (rand < 0.76) rating = 5
    else if (rand < 0.96) rating = 4
    else if (rand < 0.99) rating = 3
    else if (rand < 0.995) rating = 2
    else rating = 1

    reviews.push({ rating })
  }

  return reviews
}

export function ReviewSummaryBadge({ primaryColor, productId }: ReviewSummaryBadgeProps) {
  const { avgRating, totalReviews } = useMemo(() => {
    const reviews = generateReviews(productId)
    const total = reviews.length
    const avg = (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
    return { avgRating: avg, totalReviews: total }
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
        +{totalReviews.toLocaleString()} opiniones
      </span>
    </button>
  )
}
