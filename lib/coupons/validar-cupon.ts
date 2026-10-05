/**
 * Validación de un cupón y cálculo de su descuento. Extraído tal cual de
 * `app/api/coupons/validate/route.ts` para que `/api/orders` aplique exactamente la misma regla
 * sobre el subtotal calculado en el servidor (antes cobraba el `couponDiscount` del cliente).
 *
 * `supabase` es un cliente de servidor. Errores de red se propagan (el llamador decide).
 */

export interface CuponValido {
  id: string
  code: string
  name: string
  discount_type: string
  discount_value: number
}

export type ResultadoCupon =
  | { valid: true; coupon: CuponValido; discount: number }
  | { valid: false; error: string }

export async function validarCupon(
  sb: any,
  input: { code: string; organizationId: number | string; subtotal: unknown; customerId?: unknown },
): Promise<ResultadoCupon> {
  const { code, organizationId, subtotal, customerId } = input

  // Buscar cupón por código y organización
  const { data: coupon, error } = await sb
    .from('coupons')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('code', code.trim())
    .single()

  if (error || !coupon) {
    return { valid: false, error: 'Cupón no encontrado' }
  }

  // Validar estado activo
  if (!coupon.is_active) {
    return { valid: false, error: 'Este cupón está inactivo' }
  }

  // Validar fechas
  const now = new Date()
  if (coupon.start_date && new Date(coupon.start_date) > now) {
    return { valid: false, error: 'Este cupón aún no está vigente' }
  }
  if (coupon.end_date && new Date(coupon.end_date) < now) {
    return { valid: false, error: 'Este cupón ha expirado' }
  }

  // Validar límite de uso global
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, error: 'Este cupón ha alcanzado su límite de uso' }
  }

  // Validar cliente específico
  if (coupon.customer_id && customerId && coupon.customer_id !== customerId) {
    return { valid: false, error: 'Este cupón no está disponible para tu cuenta' }
  }

  // Validar uso por cliente
  if (customerId && coupon.usage_limit_per_customer) {
    const { count } = await sb
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('customer_id', customerId)

    if (count && count >= coupon.usage_limit_per_customer) {
      return { valid: false, error: 'Ya has usado este cupón el máximo de veces permitido' }
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
      return { valid: false, error: 'Este cupón es solo para tu primera compra' }
    }
  }

  // Validar monto mínimo
  const orderSubtotal = Number(subtotal || 0)
  if (coupon.min_purchase_amount && orderSubtotal < Number(coupon.min_purchase_amount)) {
    return {
      valid: false,
      error: `Compra mínima de $${Number(coupon.min_purchase_amount).toLocaleString('es-CO')} requerida`,
    }
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

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
    },
    discount,
  }
}
