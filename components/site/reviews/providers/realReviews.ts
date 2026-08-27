/**
 * FASE 10.2 — Provider de reseñas reales.
 *
 * Consulta la tabla `product_reviews` (status = 'approved') via Supabase.
 * Solo se activa cuando la organización elige `real`, `mixed` o `auto`.
 *
 * RLS permite lectura pública solo de reseñas aprobadas, por lo que esta
 * consulta funciona sin autenticación.
 */

import type { ReviewItem, ReviewsResult } from '../types'

/** Cliente Supabase browser — se importa dinámicamente para no romper SSR. */
async function getSupabaseClient() {
  const { createClient } = await import('@/lib/supabase/client')
  return createClient()
}

/**
 * Obtiene las reseñas reales aprobadas de un producto.
 * @param productId - ID numérico del producto en la tabla `products`.
 * @param limit - Máximo de reseñas a devolver (default 50).
 */
export async function getRealReviews(
  productId: number,
  limit: number = 50,
): Promise<ReviewsResult> {
  try {
    const supabase = await getSupabaseClient()
    const { data, error } = await (supabase as any)
      .from('product_reviews')
      .select('id, author_name, author_city, rating, title, content, images, is_verified_purchase, helpful_count, reply_text, reply_at, created_at')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) {
      return { reviews: [], totalReviews: 0, avgRating: 0, isReal: true }
    }

    const reviews: ReviewItem[] = data.map((r: any) => ({
      id: r.id,
      name: r.author_name,
      city: r.author_city,
      rating: r.rating,
      comment: r.content || r.title || '',
      title: r.title,
      date: r.created_at,
      likes: r.helpful_count || 0,
      verified: r.is_verified_purchase || false,
      images: r.images || [],
      replyText: r.reply_text,
      replyAt: r.reply_at,
      avatar: (r.author_name as string).charAt(0).toUpperCase(),
      source: 'real',
    }))

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0)
    const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0

    return {
      reviews,
      totalReviews: reviews.length,
      avgRating,
      isReal: true,
    }
  } catch {
    // Si la tabla no existe o hay error de red, devolver vacío (no romper la página).
    return { reviews: [], totalReviews: 0, avgRating: 0, isReal: true }
  }
}

/**
 * Obtiene solo el conteo y promedio de reseñas reales (sin traer todos los datos).
 * Usa las columnas agregadas `reviews_count` y `rating_avg` de `products`
 * para evitar N+1 (F10.5).
 */
export function getRealReviewStatsFromProduct(product: {
  reviews_count?: number | null
  rating_avg?: number | null
}): { totalReviews: number; avgRating: number } {
  return {
    totalReviews: product.reviews_count || 0,
    avgRating: product.rating_avg ? Number(product.rating_avg) : 0,
  }
}
