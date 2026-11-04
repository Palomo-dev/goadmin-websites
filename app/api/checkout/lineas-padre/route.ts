import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_PRODUCTOS = 200

/**
 * POST /api/checkout/lineas-padre
 * Body: { productIds: number[] }
 * Devuelve `{ padres: number[] }`: los ids del carrito que son productos padre
 * (`products.is_parent = true`) de la organización del host.
 *
 * Un padre no se compra: se compra una de sus variantes. El carrito lo usa para
 * marcar la línea y no dejar seguir al checkout; /api/orders la rechaza igual
 * (lib/products/precio-servidor.ts), esto solo lo avisa antes.
 *
 * Columnas verificadas por MCP el 2026-11-04: products.id, organization_id, is_parent.
 */
export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip'
  const limite = checkRateLimit(`lineas-padre:ip:${ip}`, 60, 60 * 1000)
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
  const productIds = Array.from(new Set(
    crudos.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0),
  ))
  if (productIds.length > MAX_PRODUCTOS) {
    return NextResponse.json({ error: 'Demasiados productos' }, { status: 400 })
  }
  if (productIds.length === 0) return NextResponse.json({ padres: [] })

  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[lineas-padre] Falta SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', hostOrgId)
    .eq('is_parent', true)
    .in('id', productIds)
  if (error) {
    console.error('[lineas-padre] No se pudieron leer los productos', { organizationId: hostOrgId, error: error.message })
    return NextResponse.json({ error: 'No se pudieron leer los productos' }, { status: 503 })
  }
  const padres = ((data || []) as { id: unknown }[])
    .map((fila) => Number(fila.id))
    .filter((id) => Number.isInteger(id) && id > 0)
  return NextResponse.json({ padres })
}
