import { NextRequest, NextResponse } from 'next/server'
import { contextoFavoritos, crearListaCompartida } from '@/lib/favoritos/servidor'
import { MAX_LISTA_COMPARTIDA } from '@/lib/favoritos/logica'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/favorites/compartir — `{ productIds: number[] }` → `{ ruta }` (enlace corto
 * `/favoritos?lista=<token>`). Funciona con o sin sesión: compartir no revela al cliente (la lista
 * solo guarda ids de productos de la organización del host). 20 por hora por IP.
 */
export async function POST(request: NextRequest) {
  const ctx = await contextoFavoritos()
  if (!ctx) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
  const limite = checkRateLimit(`favoritos-compartir:${getClientIP(request)}`, 20, 60 * 60 * 1000)
  if (!limite.allowed) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })

  let ids: number[] = []
  try {
    const body = (await request.json()) as { productIds?: unknown }
    ids = (Array.isArray(body?.productIds) ? body.productIds : [])
      .filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0)
      .slice(0, MAX_LISTA_COMPARTIDA)
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (ids.length === 0) return NextResponse.json({ error: 'Lista vacía' }, { status: 400 })
  try {
    const ruta = await crearListaCompartida(ctx, ids)
    if (!ruta) return NextResponse.json({ error: 'Ningún producto de la lista está disponible' }, { status: 404 })
    return NextResponse.json({ ruta })
  } catch (error) {
    console.error('[favoritos] compartir', { organizationId: ctx.organizationId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'No se pudo compartir la lista' }, { status: 500 })
  }
}
