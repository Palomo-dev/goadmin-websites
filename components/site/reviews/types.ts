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
  /** Destacada por la tienda (solo reales): sale primero en Carrusel y Compacta. */
  featured?: boolean
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
  /**
   * Switch «Mostrar “Compra verificada” en las de ejemplo» (Figma 3144-96345). Sin valor = como
   * hoy (las de ejemplo pueden llevarla); `false` = las de ejemplo sin la insignia (y no cuentan en
   * el filtro ni en la línea de verificadas). Las reales no cambian.
   */
  ejemplos_verificada?: boolean
  /** Solo informan al formulario; `/api/reviews` las vuelve a leer y decide (lib/resenas). */
  quien_escribe?: 'any' | 'buyers'
  fotos_permitidas?: boolean
  moderar?: boolean
}

/** Fuentes que la sección puede elegir (`reviews_source`). */
const FUENTES_SECCION = ['generated', 'real', 'mixed', 'auto'] as const

/**
 * Config de reseñas de una sección `product_reviews`: lo de la sección («De dónde salen las
 * opiniones», `auto_switch_threshold`, `min_visible`, «Compra verificada» en las de ejemplo)
 * manda sobre la base de la tienda. Sin nada en la sección, la MISMA base (mismo objeto).
 * La usan el bloque de reseñas y la pestaña «Reseñas (N)», así cuentan lo mismo.
 */
export function configResenasDeSeccion(
  content: Record<string, unknown> | null | undefined,
  base: Partial<ReviewsConfig> | Record<string, unknown> | null | undefined,
): Partial<ReviewsConfig> | null {
  const c = content ?? {}
  const fuente = typeof c.reviews_source === 'string' && (FUENTES_SECCION as readonly string[]).includes(c.reviews_source)
    ? (c.reviews_source as ReviewsConfig['reviews_source'])
    : null
  const umbral = typeof c.auto_switch_threshold === 'number' ? c.auto_switch_threshold : null
  const minimo = typeof c.min_visible === 'number' ? c.min_visible : null
  // `examples_verified_badge` (CLAVE_EJEMPLOS_VERIFICADA de seccionesFicha): solo `false` cambia algo.
  const sinInsigniaEjemplos = c.examples_verified_badge === false
  const b = (base ?? null) as Partial<ReviewsConfig> | null
  if (!fuente && umbral === null && minimo === null && !sinInsigniaEjemplos) return b
  return {
    ...(b ?? {}),
    ...(fuente ? { reviews_source: fuente } : {}),
    ...(umbral !== null ? { auto_switch_threshold: umbral } : {}),
    ...(minimo !== null ? { min_visible: minimo } : {}),
    ...(sinInsigniaEjemplos ? { ejemplos_verificada: false } : {}),
  }
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

/** PRODUC-88..90: textos del estado vacío en modo «real». Texto vacío o sin clave = el de siempre. */
export function textosEstadoVacio(v?: { titulo?: unknown; mensaje?: unknown; boton?: unknown } | null) {
  const t = (x: unknown, d: string) => (typeof x === 'string' && x.trim() ? x.trim() : d)
  return {
    titulo: t(v?.titulo, 'Aún no hay opiniones para este producto'),
    mensaje: t(v?.mensaje, 'Sé el primero en compartir tu experiencia con este producto.'),
    boton: t(v?.boton, 'Escribir una opinión'),
  }
}

/**
 * Aplica el switch de las de ejemplo: con `conInsignia === false` las reseñas generadas pierden
 * «Compra verificada»; las reales quedan como vienen. Sin cambio, devuelve el MISMO objeto.
 */
export function aplicarInsigniaEjemplos(resultado: ReviewsResult, conInsignia: boolean | undefined): ReviewsResult {
  if (conInsignia !== false) return resultado
  if (!resultado.reviews.some((r) => r.source === 'generated' && r.verified)) return resultado
  return { ...resultado, reviews: resultado.reviews.map((r) => (r.source === 'generated' && r.verified ? { ...r, verified: false } : r)) }
}
