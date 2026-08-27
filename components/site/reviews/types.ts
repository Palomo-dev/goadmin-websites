/**
 * FASE 10 — Tipos compartidos del sistema dual de reseñas.
 *
 * El orquestador (`ProductReviews.tsx`) y los tres providers
 * (`generatedReviews`, `realReviews`, `mixedReviews`) devuelven siempre
 * esta misma forma de datos, así que la UI no distingue el origen.
 */

/** Una reseña individual, independientemente de su origen. */
export interface ReviewItem {
  id: number | string
  name: string
  city?: string | null
  rating: number
  comment: string
  date: string
  likes: number
  verified: boolean
  avatar: string
  /** Marca el origen para depuración; no afecta la UI. */
  source?: 'generated' | 'real'
  /** Campos solo presentes en reseñas reales. */
  title?: string | null
  images?: string[]
  replyText?: string | null
  replyAt?: string | null
}

/** Resultado que devuelve cualquier provider. */
export interface ReviewsResult {
  reviews: ReviewItem[]
  totalReviews: number
  avgRating: number
  /** True si los datos provienen de product_reviews (reales). */
  isReal: boolean
}

/** Configuración de la sección product_reviews (desde el editor). */
export interface ReviewsConfig {
  reviews_source: 'generated' | 'real' | 'mixed' | 'auto'
  auto_switch_threshold?: number
  min_visible?: number
  rating_source?: 'same_as_reviews' | 'real_only' | 'generated_only'
  show_generated_disclaimer?: boolean
  generated_count?: number
  generated_rating_range?: { min: number; max: number }
  generated_names_pool?: 'colombia' | 'mexico' | 'espana' | 'neutro'
}

/** Configuración por defecto — replica exactamente el comportamiento actual. */
export const DEFAULT_REVIEWS_CONFIG: ReviewsConfig = {
  reviews_source: 'generated',
  auto_switch_threshold: 3,
  min_visible: 10,
  rating_source: 'same_as_reviews',
  show_generated_disclaimer: false,
  generated_count: undefined, // undefined = usar lógica original de getReviewStats
  generated_rating_range: undefined, // undefined = usar lógica original (4.4–4.9)
  generated_names_pool: 'colombia',
}

/**
 * Resuelve la configuración mezclando los defaults con los valores
 * que vienen del editor. Asegura que sitios sin config vean `generated`.
 */
export function resolveReviewsConfig(
  partial?: Partial<ReviewsConfig> | null,
): ReviewsConfig {
  if (!partial) return { ...DEFAULT_REVIEWS_CONFIG }
  return { ...DEFAULT_REVIEWS_CONFIG, ...partial }
}

/**
 * Determina si el AggregateRating de JSON-LD debe emitirse.
 * Solo cuando rating_source resuelve a datos reales (F10.6).
 */
export function shouldEmitAggregateRating(config: ReviewsConfig, hasRealData: boolean): boolean {
  if (config.rating_source === 'real_only') return hasRealData
  if (config.rating_source === 'generated_only') return false
  // same_as_reviews: depende del modo activo
  if (config.reviews_source === 'generated') return false
  // real / mixed / auto → emite si hay datos reales
  return hasRealData
}
