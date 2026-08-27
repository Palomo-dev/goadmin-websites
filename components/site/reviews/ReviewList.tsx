'use client'

/**
 * FASE 10.2 — Lista de reseñas con paginación.
 * Mantiene el diseño y la lógica de paginación del componente original.
 */

import { Button } from '@/components/ui/button'
import type { ReviewItem } from './types'
import { ReviewCard } from './ReviewCard'

interface ReviewListProps {
  reviews: ReviewItem[]
  primaryColor: string
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ReviewList({ reviews, primaryColor, page, totalPages, onPageChange }: ReviewListProps) {
  return (
    <>
      <div className="space-y-4">
        {reviews.map(review => (
          <ReviewCard key={review.id} review={review} primaryColor={primaryColor} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>

          <div className="flex items-center gap-1">
            {(() => {
              const pages: (number | string)[] = []
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i)
              } else {
                pages.push(1)
                if (page > 3) pages.push('...')
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                  pages.push(i)
                }
                if (page < totalPages - 2) pages.push('...')
                pages.push(totalPages)
              }
              return pages.map((p, idx) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === p ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={page === p ? { backgroundColor: primaryColor } : {}}
                  >
                    {p}
                  </button>
                )
              )
            })()}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </>
  )
}
