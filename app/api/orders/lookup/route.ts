import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/lookup — RETIRADO (2026-11-24, «Consultar pedido v2»).
 *
 * Buscaba pedidos por número O por correo y devolvía hasta 10 con nombre, totales y productos:
 * con solo el correo de alguien se veían sus compras. /consultar-pedido ya no lo usa: exige número
 * + correo o teléfono de la compra en /api/cuenta/buscar-pedido (mismo mensaje si no existe o no
 * coincide, límite por IP y por número) y muestra el pedido con su token de seguimiento.
 *
 * Responde 410 a cualquiera que lo siga llamando; no consulta la base.
 */
function retirado() {
  return NextResponse.json(
    { error: 'Esta búsqueda ya no existe. Consulta tu pedido con el número y el correo o teléfono de la compra.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}

export const GET = retirado
export const POST = retirado
