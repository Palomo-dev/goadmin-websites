import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { correoNormalizado, organizacionDelCuerpoDistinta } from '@/lib/resenas/validarResena'
import { verificarCompra } from '@/lib/resenas/verificarCompra'
import { firmarEnlaceResena } from '@/lib/resenas/firmaResena'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/verificar — «Verificar compra» del formulario (Figma 2C / 2H).
 *
 * Body: { productId, email?, orderNumber? }. Sin correo ni número, prueba con la sesión de cliente.
 * Si verifica, devuelve el pedido y un enlace firmado (`token`) para que `POST /api/reviews` lo
 * vuelva a comprobar al guardar (el servidor siempre decide; esta respuesta solo abre el formulario).
 * No dice si un pedido existe con otro correo: «No encontramos un pedido entregado con ese correo y
 * ese número». Límite: 10 intentos por hora por IP.
 */
export async function POST(request: NextRequest) {
  const sinCache = { 'Cache-Control': 'private, no-store' }
  const organizationId = await getOrgIdDelHost()
  if (!organizationId) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404, headers: sinCache })

  const r = checkRateLimit(`resena-verificar:${getClientIP(request)}`, 10, 60 * 60 * 1000)
  if (!r.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un momento.', codigo: 'limite' }, { status: 429, headers: sinCache })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Petición no válida' }, { status: 400, headers: sinCache })
  if (organizacionDelCuerpoDistinta(body, organizationId)) {
    return NextResponse.json({ error: 'No autorizado', codigo: 'organizacion_distinta' }, { status: 403, headers: sinCache })
  }
  const productId = Number(body.productId)
  if (!Number.isInteger(productId) || productId <= 0) return NextResponse.json({ error: 'Falta el producto' }, { status: 400, headers: sinCache })

  const sb = createAdminClient()
  if (!sb) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500, headers: sinCache })

  const email = correoNormalizado(body.email)
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber : null
  const conPedido = !!(email && orderNumber && orderNumber.trim())
  const cliente = conPedido ? null : await getAuthCustomer(organizationId)
  const v = await verificarCompra(sb as any, { organizationId, productId, email, orderNumber, customerId: cliente?.id ?? null })

  if (!v.verificado) {
    return NextResponse.json({ verificado: false, motivo: v.motivo, conSesion: !!cliente }, { headers: sinCache })
  }
  const nombre = v.pedido.nombre ? v.pedido.nombre.split(/\s+/).slice(0, 2).join(' ') : null
  return NextResponse.json(
    {
      verificado: true,
      metodo: v.metodo,
      orderId: v.pedido.id,
      orderNumber: v.pedido.numero,
      entregadoEn: v.pedido.entregadoEn,
      nombre,
      token: firmarEnlaceResena(organizationId, v.pedido.id),
    },
    { headers: sinCache },
  )
}
