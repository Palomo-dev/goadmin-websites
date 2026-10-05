import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { validarCupon } from '@/lib/coupons/validar-cupon'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

/**
 * POST /api/coupons/validate
 * Valida un código de cupón para una organización.
 * Body: { code, organizationId, subtotal, customerId? }
 * Returns: { valid, coupon, discount } o { valid: false, error }
 *
 * La regla vive en lib/coupons/validar-cupon.ts (la misma que aplica /api/orders al cobrar).
 */
export async function POST(request: NextRequest) {
  try {
    const { code, organizationId, subtotal, customerId } = await request.json()

    if (!code || !organizationId) {
      return NextResponse.json({ valid: false, error: 'Código requerido' }, { status: 400 })
    }

    const resultado = await validarCupon(getSupabase() as any, { code, organizationId, subtotal, customerId })
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[Coupons] Validate error:', error)
    return NextResponse.json({ valid: false, error: 'Error al validar cupón' }, { status: 500 })
  }
}
