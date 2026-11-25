/**
 * Cambiar la cantidad de una línea del carrito y quitarla: UNA regla para el carrito lateral
 * (CartDrawer), la página /carrito (CartPageClient) y el resumen del checkout (CheckoutWizard).
 * Antes cada uno tenía su copia de `updateQuantity` / `removeItem`.
 *
 * - «−» nunca baja de 1 (para sacar la línea está «Quitar»), como el carrito lateral y /carrito.
 * - «+» respeta el stock cuando la línea lo trae (`stock`, existencias del producto): el total del
 *   producto sumando TODAS sus líneas (con y sin opciones o nota) no pasa del stock. Sin dato de
 *   stock, no hay tope (como hoy: /api/orders valida las existencias al crear el pedido).
 * - Promociones (escalones de Promociones V2, «compra X lleva Y»), impuesto, envío y contraentrega
 *   se recalculan solos: salen de las líneas (useCartPromotions, /api/shipping/*, etc.).
 *
 * Pura: no toca localStorage (cada pantalla guarda como siempre). scripts/verify-checkout-v2.mjs.
 */

export interface LineaConCantidad {
  id: number | string
  productId?: number | null
  quantity: number
  /** Existencias del producto, si la línea las trae. */
  stock?: number | null
}

/** Producto de una línea: `productId` si el id es compuesto (`123_4-5`); si no, el id numérico. */
export function productoDeLineaCarrito(item: { id: number | string; productId?: number | null }): number | null {
  const bruto = typeof item.id === 'number' ? item.id : item.productId ?? Number(String(item.id).split('_')[0])
  const n = Number(bruto)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Unidades que todavía se pueden sumar a la línea (null = sin tope conocido). */
export function cupoLinea<T extends LineaConCantidad>(items: readonly T[], id: T['id']): number | null {
  const linea = items.find((i) => i.id === id)
  if (!linea) return 0
  const stock = typeof linea.stock === 'number' && Number.isFinite(linea.stock) ? Math.floor(linea.stock) : null
  if (stock === null) return null
  const producto = productoDeLineaCarrito(linea)
  const delProducto = items
    .filter((i) => (producto !== null ? productoDeLineaCarrito(i) === producto : i.id === id))
    .reduce((t, i) => t + (Number(i.quantity) || 0), 0)
  return Math.max(0, stock - delProducto)
}

/** ¿Se puede sumar una unidad más? (botón «+» activo). */
export function puedeSumarLinea<T extends LineaConCantidad>(items: readonly T[], id: T['id']): boolean {
  const cupo = cupoLinea(items, id)
  return cupo === null || cupo > 0
}

/**
 * Líneas con la cantidad de `id` cambiada en `delta` (−1, +1 o «+6» del empujón de volumen).
 * Mínimo 1; al subir, hasta el cupo del stock (si la línea ya pasaba el stock, no se le quita nada).
 */
export function cambiarCantidadLinea<T extends LineaConCantidad>(items: readonly T[], id: T['id'], delta: number): T[] {
  const linea = items.find((i) => i.id === id)
  if (!linea || !Number.isFinite(delta) || delta === 0) return [...items]
  const actual = Number(linea.quantity) || 0
  let nueva = Math.max(1, actual + delta)
  if (delta > 0) {
    const cupo = cupoLinea(items, id)
    if (cupo !== null) nueva = Math.max(actual, Math.min(nueva, actual + cupo))
  } else {
    // Bajar: solo el mínimo de 1.
  }
  return items.map((i) => (i.id === id ? { ...i, quantity: nueva } : i))
}

/** Líneas sin `id`. */
export function quitarLineaCarrito<T extends LineaConCantidad>(items: readonly T[], id: T['id']): T[] {
  return items.filter((i) => i.id !== id)
}
