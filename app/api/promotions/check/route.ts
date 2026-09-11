import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { evaluateCartPromotions, type PromotionEvaluation } from '@/lib/promotions'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

const EMPTY: PromotionEvaluation = { promotions: [], totalDiscount: 0, itemDiscounts: {} }

/**
 * POST /api/promotions/check
 * Detecta y calcula promociones automáticas para los items del carrito.
 * Body: { organizationId, branchId?, items: { id, productId?, name, price, quantity }[] }
 * Returns: { promotions: AppliedPromotion[], totalDiscount, itemDiscounts }
 *
 * La lógica vive en `lib/promotions.ts` y es la misma que usa `/api/orders`
 * al recalcular en servidor, así el cliente ve el mismo descuento que se cobra.
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, branchId, items } = await request.json()

    if (!organizationId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(EMPTY)
    }

    const result = await evaluateCartPromotions(getSupabase(), {
      organizationId: Number(organizationId),
      branchId: Number.isFinite(Number(branchId)) && branchId !== null ? Number(branchId) : null,
      items,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Promotions] Check error:', error)
    return NextResponse.json(EMPTY, { status: 500 })
  }
}
