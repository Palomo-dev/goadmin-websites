import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { evaluateCartPromotions, type PromotionEvaluation } from '@/lib/promotions'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

const EMPTY: PromotionEvaluation = { promotions: [], totalDiscount: 0, itemDiscounts: {} }

/**
 * Sede con la que se evalúa el carrito: la que mandó el cliente si pertenece a
 * la organización (outlet, sede elegida o mesa) o, si no, la sede por defecto
 * del pedido web. La misma función que usa `/api/orders`.
 */
async function sedeDelCarrito(supabase: ReturnType<typeof getSupabase>, organizationId: number, branchId: unknown): Promise<number | null> {
  const pedida = typeof branchId === 'number' || (typeof branchId === 'string' && branchId !== '')
    ? Number(branchId)
    : NaN
  if (Number.isInteger(pedida) && pedida > 0) {
    const { data } = await (supabase as any)
      .from('branches')
      .select('id')
      .eq('id', pedida)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (data?.id != null) return Number(data.id)
  }
  const { data: branches } = await (supabase as any)
    .from('branches')
    .select('id, is_main, is_web_stock_source, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
  return sedeDePedidoWeb(branches)
}

/**
 * POST /api/promotions/check
 * Detecta y calcula promociones automáticas para los items del carrito.
 * Body: { organizationId, branchId?, paymentMethod?, items: { id, productId?, name, price, quantity }[] }
 * Returns: { promotions: AppliedPromotion[], totalDiscount, itemDiscounts }
 *
 * La lógica vive en `lib/promotions.ts` y es la misma que usa `/api/orders`
 * al recalcular en servidor, así el cliente ve el mismo descuento que se cobra.
 * Sin outlet, la sede es la del pedido (`sedeDePedidoWeb`), no `null`: una
 * promoción limitada a esa sede sí aplica. Las globales (nulo o []) no cambian.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, branchId, items, paymentMethod } = await request.json()

    if (!organizationId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(EMPTY)
    }

    const hostOrgId = await getOrgIdDelHost()
    if (hostOrgId !== null && Number(organizationId) !== hostOrgId) {
      console.warn('[Promotions] organizationId del body distinto al del host', {
        hostOrgId, bodyOrgId: organizationId,
      })
      return NextResponse.json(EMPTY, { status: 403 })
    }
    const orgId = hostOrgId ?? Number(organizationId)
    if (!Number.isInteger(orgId) || orgId <= 0) return NextResponse.json(EMPTY)

    const supabase = getSupabase()
    const sede = await sedeDelCarrito(supabase, orgId, branchId)

    const result = await evaluateCartPromotions(supabase, {
      organizationId: orgId,
      branchId: sede,
      // Promociones por método de pago (ERP 20261028180000): solo el checkout lo manda.
      paymentMethod: typeof paymentMethod === 'string' && paymentMethod.trim() ? paymentMethod.trim() : null,
      items,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Promotions] Check error:', error)
    return NextResponse.json(EMPTY, { status: 500 })
  }
}
