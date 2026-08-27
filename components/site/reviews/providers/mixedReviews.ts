/**
 * FASE 10.2 — Provider mixto.
 *
 * Muestra las reseñas reales primero y completa hasta `min_visible` con
 * reseñas generadas. Útil para tiendas en transición que tienen algunas
 * reseñas reales pero no suficientes para llenar la sección.
 */

import type { ReviewItem, ReviewsResult, ReviewsConfig } from '../types'
import { getGeneratedReviews, getSessionSeed } from './generatedReviews'
import { getRealReviews } from './realReviews'

/**
 * Combina reseñas reales + generadas.
 * Las reales van primero; las generadas rellenan hasta `min_visible`.
 *
 * @param productId - ID del producto.
 * @param config - Configuración de la sección (usa `min_visible`).
 */
export async function getMixedReviews(
  productId: number,
  config: ReviewsConfig,
): Promise<ReviewsResult> {
  const minVisible = config.min_visible ?? 10

  // 1. Obtener reseñas reales (hasta minVisible * 2 para tener margen)
  const realResult = await getRealReviews(productId, minVisible * 2)
  const realReviews = realResult.reviews

  // 2. Si ya hay suficientes reales, devolver solo esas
  if (realReviews.length >= minVisible) {
    return realResult
  }

  // 3. Completar con generadas
  const sessionSeed = getSessionSeed(productId)
  const generatedResult = getGeneratedReviews(productId, sessionSeed, config)
  const needed = minVisible - realReviews.length
  const generatedFill = generatedResult.reviews.slice(0, needed)

  const combinedReviews: ReviewItem[] = [
    ...realReviews,
    ...generatedFill,
  ]

  // 4. Promedio ponderado: reales tienen prioridad pero las generadas aportan
  const totalRating = combinedReviews.reduce((sum, r) => sum + r.rating, 0)
  const avgRating = combinedReviews.length > 0 ? totalRating / combinedReviews.length : 0

  return {
    reviews: combinedReviews,
    totalReviews: combinedReviews.length,
    avgRating,
    isReal: realReviews.length > 0,
  }
}

/**
 * Modo `auto`: usa generadas hasta que el producto acumule
 * `auto_switch_threshold` reseñas reales; a partir de ahí, solo reales.
 */
export async function getAutoReviews(
  productId: number,
  config: ReviewsConfig,
  productStats?: { reviews_count?: number | null; rating_avg?: number | null },
): Promise<ReviewsResult> {
  const threshold = config.auto_switch_threshold ?? 3
  const realCount = productStats?.reviews_count || 0

  // Si no hay suficientes reales, usar generadas
  if (realCount < threshold) {
    const sessionSeed = getSessionSeed(productId)
    return getGeneratedReviews(productId, sessionSeed, config)
  }

  // Si alcanzó el umbral, usar solo reales
  return getRealReviews(productId, 50)
}
