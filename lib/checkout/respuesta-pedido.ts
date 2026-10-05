/**
 * Lectura de la respuesta de error de `/api/orders` en el checkout.
 */

export function mensajeErrorPedido(status: number, data: any): string {
  if (status === 409 && data.details) {
    return `Stock insuficiente:\n${data.details.join('\n')}`
  }
  return data.error || 'Error al crear la orden'
}

/** Línea cuyo precio cambió (409 PRECIOS_CAMBIARON de `/api/orders`). */
export interface PrecioCambiado {
  indice: number
  lineId: string | number | null
  nombre: string
  precioAnterior: number | null
  precioNuevo: number
}

/** Las líneas con precio nuevo si la respuesta es un 409 PRECIOS_CAMBIARON; si no, `null`. */
export function preciosCambiados(status: number, data: any): PrecioCambiado[] | null {
  if (status !== 409 || data?.code !== 'PRECIOS_CAMBIARON' || !Array.isArray(data.lineas)) return null
  const lineas = (data.lineas as any[]).filter(
    (l) => l && Number.isInteger(l.indice) && Number.isFinite(Number(l.precioNuevo))
  )
  return lineas.length > 0 ? lineas : null
}

/**
 * Carrito con los precios del servidor. Cada cambio se aplica a la línea de su posición solo si
 * su id coincide (si el carrito cambió entre tanto, esa línea se deja como está).
 */
export function aplicarPreciosNuevos<T extends { id: number | string; price: number }>(
  carrito: T[],
  cambios: PrecioCambiado[],
): T[] {
  const porIndice = new Map(cambios.map((c) => [c.indice, c]))
  return carrito.map((item, i) => {
    const c = porIndice.get(i)
    if (!c) return item
    if (c.lineId !== null && c.lineId !== undefined && String(c.lineId) !== String(item.id)) return item
    return { ...item, price: Number(c.precioNuevo) }
  })
}

export function mensajePreciosCambiados(cambios: PrecioCambiado[], formatear: (n: number) => string): string {
  const detalle = cambios
    .map((c) => c.precioAnterior === null
      ? `${c.nombre}: ${formatear(c.precioNuevo)}`
      : `${c.nombre}: antes ${formatear(c.precioAnterior)}, ahora ${formatear(c.precioNuevo)}`)
    .join('\n')
  return `Algunos precios cambiaron y ya actualizamos tu carrito. Revisa el total y confirma de nuevo:\n${detalle}`
}

/** 409 CUPON_NO_VALIDO: el cupón dejó de valer entre que se aplicó y se pagó. */
export function esCuponNoValido(status: number, data: any): boolean {
  return status === 409 && data?.code === 'CUPON_NO_VALIDO'
}
