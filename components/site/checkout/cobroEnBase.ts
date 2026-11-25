/**
 * «Se cobra en COP: $ 47.300» junto al total del checkout cuando el cliente eligió ver los precios
 * en otra moneda. El cambio de moneda de la tienda es SOLO de visualización (CurrencyProvider
 * convierte al pintar); /api/orders y las pasarelas cobran en la moneda base de la tienda, como
 * siempre. Con la moneda base a la vista, null (no se pinta nada: lo de hoy).
 *
 * Puro: CheckoutWizard y scripts/verify-checkout-v2.mjs.
 */
export function textoCobroEnBase(totalBase: number, monedaBase: string, monedaVista: string, cargando = false): string | null {
  const base = (monedaBase || '').trim().toUpperCase()
  const vista = (monedaVista || '').trim().toUpperCase()
  if (cargando || !base || !vista || base === vista) return null
  let monto: string
  try {
    monto = new Intl.NumberFormat('es-CO', { style: 'currency', currency: base, minimumFractionDigits: base === 'COP' ? 0 : 2, maximumFractionDigits: base === 'COP' ? 0 : 2 }).format(totalBase)
  } catch {
    monto = `${base} ${Math.round(totalBase).toLocaleString('es-CO')}`
  }
  return `Se cobra en ${base}: ${monto}`
}
