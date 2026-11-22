import { NextRequest, NextResponse } from 'next/server'
import {
  agregarFavoritoCuenta,
  contextoFavoritos,
  juntarEnCuenta,
  leerFavoritosCuenta,
  quitarFavoritoCuenta,
} from '@/lib/favoritos/servidor'
import { MAX_LISTA_COMPARTIDA, favoritoValido, type FavoritoGuardado } from '@/lib/favoritos/logica'

export const dynamic = 'force-dynamic'

/**
 * Favoritos del cliente con sesión (Figma 2762:61067). La organización sale del host y el cliente
 * de la sesión de la tienda (`lib/favoritos/servidor.ts`); nunca del body ni de la query.
 *
 * GET  → `{ sesion, favoritos: FavoritoGuardado[], favorites: number[] }`. Sin sesión,
 *        `{ sesion: false, favoritos: [] }` (los favoritos viven en el dispositivo).
 *        `favorites` (ids) se conserva para las pestañas abiertas con el código anterior.
 * POST → `{ productId, variantId?, action: 'add' | 'remove' }` o `{ action: 'juntar', items }`
 *        (al iniciar sesión: junta los del dispositivo con los de la cuenta, sin duplicar).
 *        Los campos `customerId` / `organizationId` del cliente anterior se ignoran; si traen una
 *        organización distinta a la del host, 403 y queda en el log.
 */
export async function GET() {
  const ctx = await contextoFavoritos()
  if (!ctx) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
  if (!ctx.customerId) return NextResponse.json({ sesion: false, favoritos: [], favorites: [] })
  try {
    const favoritos = await leerFavoritosCuenta({ ...ctx, customerId: ctx.customerId })
    return NextResponse.json({ sesion: true, favoritos, favorites: favoritos.map((f) => f.productId) })
  } catch (error) {
    console.error('[favoritos] GET', { organizationId: ctx.organizationId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'No se pudieron leer los favoritos' }, { status: 500 })
  }
}

const enteroPositivo = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

export async function POST(request: NextRequest) {
  const ctx = await contextoFavoritos()
  if (!ctx) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    const crudo = await request.json()
    body = crudo && typeof crudo === 'object' && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // La organización es la del host. Un body con otra es un intento de escribir en otra tienda.
  if (body.organizationId !== undefined && body.organizationId !== null && Number(body.organizationId) !== ctx.organizationId) {
    console.warn('[favoritos] organización del body distinta a la del host', { host: ctx.organizationId, body: String(body.organizationId) })
    return NextResponse.json({ error: 'Organización no permitida' }, { status: 403 })
  }
  if (!ctx.customerId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const cuenta = { ...ctx, customerId: ctx.customerId }

  try {
    if (body.action === 'juntar') {
      const items = (Array.isArray(body.items) ? body.items : [])
        .slice(0, MAX_LISTA_COMPARTIDA)
        .map((v) => favoritoValido(v))
        .filter((f): f is FavoritoGuardado => f !== null)
      const favoritos = await juntarEnCuenta(cuenta, items)
      return NextResponse.json({ sesion: true, favoritos, favorites: favoritos.map((f) => f.productId) })
    }

    const productId = enteroPositivo(body.productId)
    const variantId = body.variantId === undefined || body.variantId === null ? null : enteroPositivo(body.variantId)
    if (productId === null || (body.variantId != null && variantId === null)) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }
    if (body.action === 'remove') {
      await quitarFavoritoCuenta(cuenta, productId, variantId)
      return NextResponse.json({ ok: true, action: 'remove' })
    }
    if (body.action !== undefined && body.action !== 'add') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    const ok = await agregarFavoritoCuenta(cuenta, productId, variantId)
    if (!ok) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, action: 'add' })
  } catch (error) {
    console.error('[favoritos] POST', { organizationId: ctx.organizationId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'No se pudieron guardar los favoritos' }, { status: 500 })
  }
}
