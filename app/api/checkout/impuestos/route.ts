import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit } from '@/lib/rateLimit'
import { leerTarifasProductos } from '@/lib/orders/leerTarifasProducto'

export const dynamic = 'force-dynamic'

const MAX_PRODUCTOS = 200

/**
 * POST /api/checkout/impuestos
 * Body: { productIds: number[] }
 * Devuelve la tarifa de cada producto de la organización del host.
 * El carrito y el checkout la usan para mostrar el mismo impuesto que cobra /api/orders.
 */
export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip'
  const limite = checkRateLimit(`impuestos:ip:${ip}`, 60, 60 * 1000)
  if (!limite.allowed) {
    return NextResponse.json({ error: 'Demasiadas consultas' }, { status: 429 })
  }

  const hostOrgId = await getOrgIdDelHost()
  if (hostOrgId === null) {
    return NextResponse.json({ error: 'Sitio no encontrado' }, { status: 404 })
  }

  let body: { productIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const crudos = Array.isArray(body.productIds) ? body.productIds : []
  const productIds = crudos
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
  if (productIds.length > MAX_PRODUCTOS) {
    return NextResponse.json({ error: 'Demasiados productos' }, { status: 400 })
  }

  const supabase = createAdminClient() || createPublicClient()
  const leidas = await leerTarifasProductos(supabase as never, hostOrgId, productIds)
  if (!leidas) {
    return NextResponse.json({ error: 'No se pudieron leer los impuestos' }, { status: 503 })
  }

  const tarifas = productIds
    .filter((id, i) => productIds.indexOf(id) === i)
    .filter((id) => leidas.porProducto.has(id))
    .map((id) => ({ productId: id, ...leidas.porProducto.get(id)! }))

  return NextResponse.json({
    tarifas,
    predeterminado: leidas.predeterminado,
  })
}
