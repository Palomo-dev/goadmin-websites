import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

/**
 * POST /api/coupons/validate
 * Valida un código de cupón para una organización.
 * Body: { code, organizationId, subtotal, customerId? }
 * Returns: { valid, coupon, discount } o { valid: false, error }
 */
export async function POST(request: NextRequest) {
  try {
    const { code, organizationId, subtotal, customerId } = await request.json()

    if (!code || !organizationId) {
      return NextResponse.json({ valid: false, error: 'Código requerido' }, { status: 400 })
    }

    const supabase = getSupabase()
    const sb = supabase as any

    // Buscar cupón por código y organización
    const { data: coupon, error } = await sb
      .from('coupons')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('code', code.trim())
      .single()

    if (error || !coupon) {
      return NextResponse.json({ valid: false, error: 'Cupón no encontrado' })
    }

    // Validar estado activo
    if (!coupon.is_active) {
      return NextResponse.json({ valid: false, error: 'Este cupón está inactivo' })
    }

    // Validar fechas
    const now = new Date()
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      return NextResponse.json({ valid: false, error: 'Este cupón aún no está vigente' })
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      return NextResponse.json({ valid: false, error: 'Este cupón ha expirado' })
    }

    // Validar límite de uso global
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return NextResponse.json({ valid: false, error: 'Este cupón ha alcanzado su límite de uso' })
    }

    // Validar cliente específico
    if (coupon.customer_id && customerId && coupon.customer_id !== customerId) {
      return NextResponse.json({ valid: false, error: 'Este cupón no está disponible para tu cuenta' })
    }

    // Validar uso por cliente
    if (customerId && coupon.usage_limit_per_customer) {
      const { count } = await sb
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('customer_id', customerId)

      if (count && count >= coupon.usage_limit_per_customer) {
        return NextResponse.json({ valid: false, error: 'Ya has usado este cupón el máximo de veces permitido' })
      }
    }

    // Validar primera compra
    if (coupon.applies_to_first_purchase && customerId) {
      const { count } = await sb
        .from('web_orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('organization_id', organizationId)
        .neq('status', 'cancelled')

      if (count && count > 0) {
        return NextResponse.json({ valid: false, error: 'Este cupón es solo para tu primera compra' })
      }
    }

    // Validar monto mínimo
    const orderSubtotal = Number(subtotal || 0)
    if (coupon.min_purchase_amount && orderSubtotal < Number(coupon.min_purchase_amount)) {
      return NextResponse.json({
        valid: false,
        error: `Compra mínima de $${Number(coupon.min_purchase_amount).toLocaleString('es-CO')} requerida`
      })
    }

    // Calcular descuento
    let discount = 0
    if (coupon.discount_type === 'percentage') {
      discount = Math.round(orderSubtotal * Number(coupon.discount_value) / 100)
    } else {
      discount = Number(coupon.discount_value)
    }

    // Aplicar tope de descuento
    if (coupon.max_discount_amount && discount > Number(coupon.max_discount_amount)) {
      discount = Number(coupon.max_discount_amount)
    }

    // No puede ser mayor al subtotal
    if (discount > orderSubtotal) {
      discount = orderSubtotal
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
      },
      discount,
    })
  } catch (error) {
    console.error('[Coupons] Validate error:', error)
    return NextResponse.json({ valid: false, error: 'Error al validar cupón' }, { status: 500 })
  }
}
