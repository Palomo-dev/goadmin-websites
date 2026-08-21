/**
 * Obtiene el precio vigente de un producto desde su array de product_prices.
 *
 * El problema: product_prices puede tener múltiples registros (historial de precios)
 * y product_prices[0] no garantiza que sea el más reciente.
 *
 * Solución: devolver el registro con mayor id que tenga effective_to IS NULL
 * (precio vigente sin fecha de fin). Si no hay ninguno con effective_to IS NULL,
 * devolver el de mayor id.
 */
export function getCurrentPrice(product: any): any | null {
  if (!product?.product_prices || !Array.isArray(product.product_prices) || product.product_prices.length === 0) {
    return null
  }

  const prices = product.product_prices

  // 1. Buscar los que tienen effective_to IS NULL (vigentes)
  const vigentes = prices.filter((p: any) => p.effective_to === null || p.effective_to === undefined)

  if (vigentes.length > 0) {
    // De los vigentes, tomar el de mayor id (más reciente)
    return vigentes.reduce((max: any, p: any) => (p.id > max.id ? p : max), vigentes[0])
  }

  // 2. Fallback: el de mayor id (más reciente) de todos
  return prices.reduce((max: any, p: any) => (p.id > max.id ? p : max), prices[0])
}

/**
 * Devuelve el precio vigente (número) o 0 si no hay.
 */
export function getCurrentPriceValue(product: any): number {
  const pp = getCurrentPrice(product)
  return pp ? Number(pp.price) : 0
}

/**
 * Devuelve el compare_price vigente (número) o null si no hay.
 */
export function getCurrentComparePrice(product: any): number | null {
  const pp = getCurrentPrice(product)
  if (!pp || !pp.compare_price) return null
  return Number(pp.compare_price)
}
