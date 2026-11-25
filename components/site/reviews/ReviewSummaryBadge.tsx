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
import { pedirPestanaFicha } from '@/components/sections/product-detail/eventosPestanas'
import type { ReviewsConfig } from './types'
import { useResumenResenas } from './useResumenResenas'

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
  // La misma cuenta que la pestaña «Reseñas (N)» (useResumenResenas).
  const { promedio: avgRating, cantidad: totalReviews, oculto } = useResumenResenas(productId, reviewsConfig, productStats)

  // Con reseñas reales y ninguna publicada no se pinta «0.0 (0)»: el estado vacío está abajo.
  // (Solo llega aquí con el origen de la tienda en real/mixed/auto; las de ejemplo, como siempre.)
  if (oculto) return null

  const handleClick = () => {
    // Ficha con pestañas: abre «Reseñas» y baja suave hasta la barra (PestanasFicha).
    if (pedirPestanaFicha('product_reviews')) return
    // Sin pestañas: lo de siempre.
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
