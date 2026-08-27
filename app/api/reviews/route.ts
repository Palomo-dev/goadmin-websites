import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews
 *
 * Crea una reseña de producto en `product_reviews` con status 'pending'
 * (o 'approved' si la organización desactiva la moderación).
 *
 * Protecciones:
 * - Rate limiting: máximo 3 reseñas/hora/IP
 * - Honeypot: campo oculto `website` que, si se rellena, rechaza silenciosamente
 * - Validación de rating (1-5), author_name, product_id, organization_id
 *
 * Body: {
 *   organizationId: number,
 *   productId: number,
 *   authorName: string,
 *   authorCity?: string,
 *   rating: number (1-5),
 *   title?: string,
 *   content?: string,
 *   images?: string[],
 *   orderId?: string,
 *   website?,  // honeypot — debe estar vacío
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting: 3 reseñas/hora/IP ──
    const clientIP = getClientIP(request)
    const rateLimit = checkRateLimit(clientIP, 3, 60 * 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Has alcanzado el límite de reseñas. Inténtalo más tarde.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      )
    }

    const body = await request.json()
    const {
      organizationId,
      productId,
      authorName,
      authorCity,
      rating,
      title,
      content,
      images,
      orderId,
      website, // honeypot
    } = body

    // ── Honeypot ──
    if (website && String(website).trim() !== '') {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    // ── Validación ──
    if (!organizationId || !productId || !authorName) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: organizationId, productId, authorName' },
        { status: 400 }
      )
    }

    const numericRating = Number(rating)
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json(
        { error: 'La calificación debe ser un número entre 1 y 5' },
        { status: 400 }
      )
    }

    // ── Verificar que el producto existe y pertenece a la organización ──
    const publicClient = createPublicClient()
    const { data: product, error: productError } = await publicClient
      .from('products')
      .select('id, organization_id')
      .eq('id', productId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'El producto no existe o no pertenece a esta organización' },
        { status: 404 }
      )
    }

    // ── Determinar si la organización requiere moderación ──
    // Por defecto, las reseñas se insertan como 'pending'.
    // Si la organización desactiva la moderación, se insertan como 'approved'.
    const { data: settings } = await (publicClient as any)
      .from('website_settings')
      .select('reviews_auto_approve')
      .eq('organization_id', organizationId)
      .maybeSingle() as { data: any }

    const initialStatus = settings?.reviews_auto_approve ? 'approved' : 'pending'

    // ── Insertar la reseña ──
    // Usar admin client para bypass RLS en la inserción
    const adminClient = createAdminClient()
    const insertClient = adminClient || publicClient

    const { data: review, error: insertError } = await (insertClient as any)
      .from('product_reviews')
      .insert({
        organization_id: organizationId,
        product_id: productId,
        author_name: String(authorName).trim().slice(0, 200),
        author_city: authorCity ? String(authorCity).trim().slice(0, 200) : null,
        rating: numericRating,
        title: title ? String(title).trim().slice(0, 500) : null,
        content: content ? String(content).trim().slice(0, 5000) : null,
        images: Array.isArray(images) ? images.slice(0, 10) : null,
        order_id: orderId || null,
        is_verified_purchase: false, // Se verifica manualmente o via token
        status: initialStatus,
      })
      .select('id, status')
      .single() as { data: any, error: any }

    if (insertError) {
      console.error('Error inserting review:', insertError)
      return NextResponse.json(
        { error: 'No se pudo guardar la reseña. Inténtalo más tarde.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reviewId: review?.id,
      status: review?.status,
      message: initialStatus === 'approved'
        ? '¡Gracias por tu reseña! Ya está publicada.'
        : '¡Gracias por tu reseña! Será publicada después de moderación.',
    }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/reviews error:', error?.message || error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
