import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/memberships/purchase — RETIRADO (410).
 *
 * Antes creaba la membresía directamente en `memberships` con status `pending_payment` y la
 * cobraba con la referencia `MEM-{id}`. Desde las fases 1–2 de Membresías del ERP:
 *   - `memberships.status` solo admite pending/active/frozen/past_due/expired/cancelled, así
 *     que el insert fallaba siempre (ninguna compra web de membresía llegó a crearse);
 *   - una membresía es un PRODUCTO (`products.service_type = 'membership'`, plan ligado por
 *     `membership_plans.product_id`) y la crea/activa la base al confirmarse la venta, con
 *     `fn_membresias_activar_venta` (idempotente por línea de venta).
 *
 * El flujo nuevo: /membresias agrega el producto del plan al carrito → checkout normal →
 * `/api/orders` crea el pedido web → la pasarela confirma el pago → el webhook llama al ERP
 * (`/api/web-orders/[id]/auto-confirm`), que crea la venta y activa la membresía.
 *
 * Además esta ruta tomaba `organizationId` y `customerId` del body; no se reemplaza por otra
 * que haga lo mismo.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'La compra de membresías se hace desde la página de planes: agrega el plan al carrito y paga el pedido.',
      codigo: 'membresia_por_pedido_web',
    },
    { status: 410 }
  )
}
