'use client'

/**
 * Promedio y número de reseñas de un producto, con la misma regla que el resumen de estrellas de
 * la ficha (ReviewSummaryBadge). Lo usan las estrellas y la pestaña «Reseñas (N)»: los dos dicen
 * siempre el mismo número.
 *
 * - Ejemplos (`generated`, el default) o sin agregados: los de `getReviewStats`, calculados tras
 *   montar (la semilla usa la hora y difiere entre servidor y navegador).
 * - `rating_source: generated_only`: también los de ejemplo.
 * - Si no: `rating_avg` y `reviews_count` del producto.
 *
 * `oculto`: origen real sin ninguna reseña publicada (no se pinta «0.0 (0)»).
 */

import { useEffect, useState } from 'react'
import { getSessionSeed, getReviewStats } from './providers/generatedReviews'
import type { ReviewsConfig } from './types'
import { resolveReviewsConfig } from './types'

export interface ResumenResenas {
  promedio: string
  cantidad: number
  oculto: boolean
}

export function useResumenResenas(
  productId: number | null,
  reviewsConfig: Partial<ReviewsConfig> | null | undefined,
  productStats: { rating_avg?: number | null; reviews_count?: number | null } | null | undefined,
): ResumenResenas {
  const config = resolveReviewsConfig(reviewsConfig)
  const usaEjemplos = config.reviews_source === 'generated' || !productStats || config.rating_source === 'generated_only'

  const [generado, setGenerado] = useState<{ avg: string; count: number } | null>(null)
  useEffect(() => {
    if (productId === null || !usaEjemplos) return
    const semilla = getSessionSeed(productId)
    const stats = getReviewStats(productId, semilla)
    setGenerado({ avg: stats.avgRating.toFixed(1), count: stats.totalReviews })
  }, [productId, usaEjemplos])

  if (usaEjemplos) {
    return { promedio: generado?.avg ?? '0.0', cantidad: generado?.count ?? 0, oculto: false }
  }
  const cantidad = productStats?.reviews_count || 0
  return {
    promedio: productStats?.rating_avg ? Number(productStats.rating_avg).toFixed(1) : '0.0',
    cantidad,
    oculto: cantidad === 0,
  }
}
