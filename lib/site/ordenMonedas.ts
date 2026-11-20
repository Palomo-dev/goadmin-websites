/**
 * Orden de las monedas del selector del encabezado: la moneda base de la tienda primero (COP en
 * Colombia) y las demás por código, en orden alfabético. No muta la lista recibida.
 */
export function ordenarMonedas<T extends { code: string }>(monedas: readonly T[], base: string): T[] {
  const b = (base || '').toUpperCase()
  return [...monedas].sort((x, y) => {
    const xb = x.code.toUpperCase() === b
    const yb = y.code.toUpperCase() === b
    if (xb !== yb) return xb ? -1 : 1
    return x.code.localeCompare(y.code, 'es')
  })
}
