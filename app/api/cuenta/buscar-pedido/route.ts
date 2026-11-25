import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { rutaSeguimiento, tokenSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { NO_ENCONTRADO_SIN_CUENTA, contactoCoincide, normalizarNumeroPedido, tipoContacto } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' }

/**
 * POST /api/cuenta/buscar-pedido — consultar un pedido sin cuenta (/consultar-pedido, que reemplazó a
 * /rastrear; Figma «16 Sitio web» › Consultar pedido v2, 3102:84056).
 *
 * Body: { numero, contacto }. Si el correo o el teléfono es el de la compra, devuelve la ruta de la
 * página del pedido CON su token (`/pedido/<n>?t=…`), que es lo que muestra dirección y entrega, y
 * el mismo número y token sueltos (`pedido`) para pintarlo en /consultar-pedido sin navegar. Nunca
 * lista pedidos: un número y su contacto dan, como mucho, ese pedido.
 *
 * - Organización del HOST, nunca del body: un número de otra tienda no existe aquí.
 * - Misma respuesta si el pedido no existe o si el contacto no coincide (no revela si existe).
 * - Límite por IP y por número de pedido (para no adivinar el teléfono de un pedido conocido).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`buscar-pedido:ip:${ip}`, 10, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchas búsquedas. Espera unos minutos.' }, { status: 429, headers: SIN_CACHE })
    }

    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: NO_ENCONTRADO_SIN_CUENTA }, { status: 404, headers: SIN_CACHE })

    const body = await request.json().catch(() => ({}))
    const numero = normalizarNumeroPedido(body?.numero)
    if (!numero || !tipoContacto(body?.contacto)) {
      return NextResponse.json({ error: 'Escribe el número del pedido y el correo o teléfono con el que compraste.' }, { status: 400, headers: SIN_CACHE })
    }
    if (!checkRateLimit(`buscar-pedido:numero:${orgId}:${numero}`, 5, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchas búsquedas. Espera unos minutos.' }, { status: 429, headers: SIN_CACHE })
    }

    const supabase = createAdminClient() as any
    if (!supabase) return NextResponse.json({ error: 'No pudimos buscar tu pedido. Intenta de nuevo.' }, { status: 503, headers: SIN_CACHE })

    const { data: pedido, error } = await supabase
      .from('web_orders')
      .select('id, order_number, customer_email, customer_phone')
      .eq('organization_id', orgId)
      .eq('order_number', numero)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[buscar-pedido] Error al buscar', { orgId, error: error.message })
      return NextResponse.json({ error: 'No pudimos buscar tu pedido. Intenta de nuevo.' }, { status: 500, headers: SIN_CACHE })
    }
    if (!pedido || !contactoCoincide(pedido, body?.contacto)) {
      return NextResponse.json({ error: NO_ENCONTRADO_SIN_CUENTA }, { status: 404, headers: SIN_CACHE })
    }
    // `pedido` es para /consultar-pedido, que muestra el resultado en la misma página con el mismo
    // token de seguimiento; `ruta` se conserva para quien aún navegue a /pedido/<n>.
    return NextResponse.json(
      { ruta: rutaSeguimiento(orgId, pedido), pedido: { numero: pedido.order_number, token: tokenSeguimiento(orgId, pedido.id) } },
      { headers: SIN_CACHE },
    )
  } catch (error) {
    console.error('[buscar-pedido] Error', error)
    return NextResponse.json({ error: 'No pudimos buscar tu pedido. Intenta de nuevo.' }, { status: 500, headers: SIN_CACHE })
  }
}
