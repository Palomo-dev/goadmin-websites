'use client'

/**
 * FASE 10.2 — Barras de distribución de estrellas.
 * Mantiene el diseño del componente original.
 */

interface RatingDistributionProps {
  ratingCounts: { rating: number; count: number; percentage: number }[]
  totalReviews: number
  filterRating: number | null
  onFilterChange: (rating: number | null) => void
  primaryColor: string
}

export function RatingDistribution({
  ratingCounts,
  totalReviews,
  filterRating,
  onFilterChange,
  primaryColor,
}: RatingDistributionProps) {
  return (
    <div className="col-span-2 space-y-2">
      {ratingCounts.map(({ rating, count, percentage }) => (
        <button
          key={rating}
          onClick={() => onFilterChange(filterRating === rating ? null : rating)}
          className={`w-full flex items-center gap-3 p-1.5 rounded-lg transition-colors ${
            filterRating === rating ? 'bg-yellow-50' : 'hover:bg-gray-100'
          }`}
        >
          <span className="text-sm font-medium w-12 text-right">{rating} ★</span>
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percentage}%`, backgroundColor: primaryColor }}
            />
          </div>
          <span className="text-sm text-gray-500 w-16 text-left">{count.toLocaleString('es-CO')}</span>
        </button>
      ))}
    </div>
  )
}
