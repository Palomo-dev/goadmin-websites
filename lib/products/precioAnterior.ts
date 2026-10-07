/**
 * «Mostrar precio tachado» (`show_compare_price`) fuera de la tarjeta de producto.
 *
 * El precio anterior sale SOLO de `product_prices.compare_price` (el precio vigente del producto,
 * o del producto del plan de membresía). Si no existe o no es mayor que el precio actual, no se
 * pinta nada: nunca se inventa un descuento.
 */

/** El precio anterior a mostrar tachado, o `null` si no hay oferta real. */
export function precioAnteriorValido(anterior: unknown, actual: unknown): number | null {
  const a = Number(anterior)
  const p = Number(actual)
  if (anterior === null || anterior === undefined || anterior === '') return null
  if (!Number.isFinite(a) || !Number.isFinite(p) || a <= 0 || a <= p) return null
  return a
}

/**
 * Las secciones que leen el interruptor por primera vez NO pintaban el precio anterior: con la
 * clave ausente se mantiene apagado (la tarjeta de producto, que siempre lo pintó, no usa esto).
 */
export function mostrarPrecioAnterior(content: Record<string, unknown> | null | undefined): boolean {
  const v = content?.show_compare_price
  return v === true || v === 'true'
}
