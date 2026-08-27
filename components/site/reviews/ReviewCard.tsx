'use client'

/**
 * FASE 10.2 — Tarjeta individual de reseña.
 * Renderiza igual que el diseño actual, sin distinguir el origen.
 */

import { Star, ThumbsUp } from 'lucide-react'
import type { ReviewItem } from './types'

interface ReviewCardProps {
  review: ReviewItem
  primaryColor: string
}

export function ReviewCard({ review, primaryColor }: ReviewCardProps) {
  return (
    <div className="p-5 border rounded-xl hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: primaryColor }}
          >
            {review.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{review.name}</span>
              {review.verified && (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  ✓ Compra verificada
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {review.city && <span className="text-xs text-gray-400">{review.city}</span>}
              {review.city && <span className="text-xs text-gray-300">•</span>}
              <span className="text-xs text-gray-400">
                {new Date(review.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className={`h-4 w-4 ${i <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          ))}
        </div>
      </div>
      {review.title && (
        <p className="mt-3 font-medium text-gray-900 text-sm">{review.title}</p>
      )}
      <p className="mt-3 text-gray-700 text-sm leading-relaxed">{review.comment}</p>

      {/* Imágenes de la reseña (solo reseñas reales) */}
      {review.images && review.images.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {review.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`Foto ${idx + 1}`}
              className="w-20 h-20 object-cover rounded-lg border"
            />
          ))}
        </div>
      )}

      {/* Respuesta del comercio (solo reseñas reales) */}
      {review.replyText && (
        <div className="mt-3 ml-4 p-3 bg-gray-50 rounded-lg border-l-2" style={{ borderColor: primaryColor }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Respuesta del comercio</p>
          <p className="text-sm text-gray-700">{review.replyText}</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          <ThumbsUp className="h-3.5 w-3.5" />
          Útil ({review.likes})
        </button>
      </div>
    </div>
  )
}
