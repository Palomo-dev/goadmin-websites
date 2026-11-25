import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { cargarAjustesResenas } from '@/lib/resenas/ajustesResenas'
import { organizacionDelCuerpoDistinta, validarResena } from '@/lib/resenas/validarResena'
import { verificarCompra } from '@/lib/resenas/verificarCompra'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews — guarda una opinión de producto (Figma «16 Sitio web» 3123-88477, 2B–2D).
 *
 * - La organización sale del HOST (`getOrgIdDelHost`). Si el cuerpo trae `organizationId` distinto:
 *   403 y se registra. Ya no se acepta del cuerpo.
 * - Antispam: 3 por hora por IP (como antes), 3 por hora por correo, y el campo trampa `website`.
 * - «Compra verificada» solo si el servidor la demuestra (`lib/resenas/verificarCompra.ts`): enlace
 *   firmado o token de seguimiento, correo + número de pedido, o sesión de cliente.
 * - «Solo compradores» (`website_settings.reviews_who_can_write = 'buyers'`) se exige aquí: sin
 *   compra verificada, 403 `solo_compradores` y no se guarda.
 * - Una opinión por producto y pedido, por producto y cliente, y por producto y correo: 409 `ya_opino`.
 * - Estado inicial: `pending`, o `approved` si la tienda apagó «Moderar antes de publicar».
 * - El correo, el método de verificación y las fotos ocultas van a `product_review_private` (la
 *   tabla pública se lee sin sesión).
 *
 * Body: { productId, rating, title?, content?, authorName, authorCity?, email?, images?,
 *         orderId?, token?, trackingToken?, orderNumber?, origen?, website? }
 */
const SIN_CACHE = { 'Cache-Control': 'private, no-store' } as const

function respuesta(cuerpo: Record<string, unknown>, status: number, extra?: Record<string, string>) {
  return NextResponse.json(cuerpo, { status, headers: { ...SIN_CACHE, ...(extra ?? {}) } })
}

function limite(clave: string, max: number) {
  const r = checkRateLimit(clave, max, 60 * 60 * 1000)
  if (r.allowed) return null
  const segundos = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
  return respuesta(
    { error: 'Ya enviaste varias opiniones. Por seguridad, espera 1 hora para enviar otra.', codigo: 'limite', retryAfter: segundos },
    429,
    { 'Retry-After': String(segundos) },
  )
}

export async function POST(request: NextRequest) {
  try {
    const organizationId = await getOrgIdDelHost()
    if (!organizationId) return respuesta({ error: 'Tienda no encontrada', codigo: 'sin_tienda' }, 404)

    const ip = getClientIP(request)
    const porIp = limite(`resena:${ip}`, 3)
    if (porIp) return porIp

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return respuesta({ error: 'Petición no válida', codigo: 'peticion_invalida' }, 400)

    if (organizacionDelCuerpoDistinta(body, organizationId)) {
      console.warn('[api/reviews] Organización del cuerpo distinta a la del host', { host: organizationId, cuerpo: String(body.organizationId ?? body.organization_id).slice(0, 20), ip })
      return respuesta({ error: 'No autorizado', codigo: 'organizacion_distinta' }, 403)
    }

    // Campo trampa: responde como si se hubiera guardado.
    if (typeof body.website === 'string' && body.website.trim() !== '') return respuesta({ success: true }, 200)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const v = validarResena(body, { organizationId, supabaseUrl })
    if (!v.ok) return respuesta({ error: v.mensaje, codigo: 'campo_invalido', campo: v.campo }, 400)
    const d = v.datos

    if (d.email) {
      const porCorreo = limite(`resena-correo:${organizationId}:${d.email}`, 3)
      if (porCorreo) return porCorreo
    }

    const sb = createAdminClient() as any
    if (!sb) {
      console.error('[api/reviews] Sin SUPABASE_SERVICE_ROLE_KEY')
      return respuesta({ error: 'No pudimos enviar tu opinión. Inténtalo más tarde.', codigo: 'error_interno' }, 500)
    }

    const { data: producto, error: errorProducto } = await sb
      .from('products')
      .select('id')
      .eq('id', d.productId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (errorProducto || !producto) return respuesta({ error: 'El producto no existe en esta tienda', codigo: 'sin_producto' }, 404)

    const ajustes = await cargarAjustesResenas(sb, organizationId)
    if (!ajustes) return respuesta({ error: 'No pudimos enviar tu opinión. Inténtalo más tarde.', codigo: 'error_interno' }, 500)

    // Sesión de cliente (si la hay): solo para verificar y para no repetir opiniones.
    const cliente = await getAuthCustomer(organizationId)
    const verificacion = await verificarCompra(sb, {
      organizationId,
      productId: d.productId,
      orderId: typeof body.orderId === 'string' ? body.orderId : null,
      token: typeof body.token === 'string' ? body.token : null,
      trackingToken: typeof body.trackingToken === 'string' ? body.trackingToken : null,
      email: d.email,
      orderNumber: typeof body.orderNumber === 'string' ? body.orderNumber : null,
      customerId: cliente?.id ?? null,
    })

    if (ajustes.quienEscribe === 'buyers' && !verificacion.verificado) {
      return respuesta(
        {
          error: 'En esta tienda solo opinan quienes compraron el producto.',
          codigo: 'solo_compradores',
          motivo: verificacion.motivo,
        },
        403,
      )
    }

    const pedidoId = verificacion.verificado ? verificacion.pedido.id : null
    const correo = d.email ?? (verificacion.verificado ? verificacion.pedido.correo : null) ?? (cliente?.email ? cliente.email.toLowerCase() : null)

    // ── Una opinión por producto: por pedido, por cliente y por correo ──
    const yaOpino = respuesta(
      { error: 'Ya opinaste sobre este producto. Puedes cambiar tu opinión desde Mi cuenta › Mis pedidos.', codigo: 'ya_opino' },
      409,
    )
    if (pedidoId) {
      const { data } = await sb.from('product_reviews').select('id').eq('organization_id', organizationId).eq('product_id', d.productId).eq('order_id', pedidoId).limit(1)
      if (Array.isArray(data) && data.length > 0) return yaOpino
    }
    if (cliente?.id) {
      const { data } = await sb.from('product_reviews').select('id').eq('organization_id', organizationId).eq('product_id', d.productId).eq('customer_id', cliente.id).limit(1)
      if (Array.isArray(data) && data.length > 0) return yaOpino
    }
    if (correo) {
      const { data } = await sb
        .from('product_reviews')
        .select('id, product_review_private!inner(author_email)')
        .eq('organization_id', organizationId)
        .eq('product_id', d.productId)
        .eq('product_review_private.author_email', correo)
        .limit(1)
      if (Array.isArray(data) && data.length > 0) return yaOpino
    }

    const estado = ajustes.moderar ? 'pending' : 'approved'
    const { data: resena, error: errorInsert } = await sb
      .from('product_reviews')
      .insert({
        organization_id: organizationId,
        product_id: d.productId,
        customer_id: cliente?.id ?? null,
        order_id: pedidoId,
        author_name: d.authorName,
        author_city: d.authorCity,
        rating: d.rating,
        title: d.title,
        content: d.content,
        images: ajustes.fotos && d.images.length > 0 ? d.images : null,
        is_verified_purchase: verificacion.verificado,
        status: estado,
        source: d.origen,
      })
      .select('id, status')
      .single()

    if (errorInsert) {
      if (errorInsert.code === '23505') return yaOpino
      console.error('[api/reviews] No se pudo guardar la opinión', { organizationId, error: errorInsert.message })
      return respuesta({ error: 'No pudimos enviar tu opinión. Inténtalo más tarde.', codigo: 'error_interno' }, 500)
    }

    const { error: errorPrivado } = await sb.from('product_review_private').insert({
      review_id: resena.id,
      organization_id: organizationId,
      author_email: correo,
      verification_method: verificacion.verificado ? verificacion.metodo : null,
    })
    if (errorPrivado) console.error('[api/reviews] No se pudo guardar el dato privado', { organizationId, reviewId: resena.id, error: errorPrivado.message })

    return respuesta(
      {
        success: true,
        reviewId: resena.id,
        status: resena.status,
        verificado: verificacion.verificado,
        correo,
        message: estado === 'approved' ? '¡Gracias! Tu opinión ya está publicada.' : 'Gracias, la revisamos y la publicamos pronto.',
      },
      201,
    )
  } catch (error: any) {
    console.error('POST /api/reviews error:', error?.message || error)
    return respuesta({ error: 'Error interno del servidor', codigo: 'error_interno' }, 500)
  }
}
