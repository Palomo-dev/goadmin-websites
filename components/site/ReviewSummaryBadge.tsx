'use client'

import { Star } from 'lucide-react'

interface ReviewSummaryBadgeProps {
  primaryColor: string
}

export function ReviewSummaryBadge({ primaryColor }: ReviewSummaryBadgeProps) {
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
          <Star key={i} className={`h-4 w-4 ${i <= 5 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        ))}
      </div>
      <span className="text-sm text-gray-600">4.7 / 5</span>
      <span className="text-sm text-gray-400">•</span>
      <span className="text-sm underline" style={{ color: primaryColor }}>
        +1,047 opiniones
      </span>
    </button>
  )
}
