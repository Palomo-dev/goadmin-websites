/**
 * Cómo se muestran los totales del correo cuando el IVA ya va en el precio.
 *
 * El pedido no guarda un flag. Si subtotal + envío + propina − descuento
 * cuadra con el total, y sumar el impuesto lo descuadra, el IVA va incluido:
 * se nombra y no se vuelve a sumar.
 */

export interface TotalesCorreo {
  subtotal: number
  tax: number
  shipping: number
  tip?: number
  discount?: number
  total: number
}

function num(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : NaN
}

export function impuestoVaIncluido(totales: TotalesCorreo): boolean {
  const tax = num(totales.tax)
  const subtotal = num(totales.subtotal)
  const shipping = num(totales.shipping)
  const tip = num(totales.tip ?? 0)
  const discount = num(totales.discount ?? 0)
  const total = num(totales.total)
  if (!(tax > 0) || [subtotal, shipping, tip, discount, total].some((n) => Number.isNaN(n))) return false
  const base = subtotal + shipping + tip - discount
  const incluido = Math.abs(base - total) <= 1
  const aparte = Math.abs(base + tax - total) <= 1
  return incluido && !aparte
}
