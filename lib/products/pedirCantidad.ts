/**
 * «Tocar un escalón elige esa cantidad» (ficha, «Compra más, paga menos»): la tabla de escalones
 * pide una cantidad y el selector de la ficha (ProductDetailActions o VariantSelector) la pone,
 * respetando su propio tope de stock. Mismo patrón de evento de ventana que
 * `varianteSeleccionada.ts`; el selector vuelve a emitir la cantidad con `emitirCantidad`, así la
 * tabla y la barra fija quedan al día sin estado compartido.
 *
 * `productoIds`: el producto y sus variantes. Cada selector ignora pedidos que no son suyos, así
 * dos fichas o diálogos de productos distintos no se pisan.
 */
export const EVENTO_PEDIR_CANTIDAD = 'goadmin:pedir-cantidad'

export interface DetallePedirCantidad {
  productoIds: number[]
  cantidad: number
}

export function pedirCantidad(productoIds: number[], cantidad: number): void {
  if (typeof window === 'undefined') return
  const q = Math.max(1, Math.floor(Number(cantidad) || 1))
  window.dispatchEvent(new CustomEvent<DetallePedirCantidad>(EVENTO_PEDIR_CANTIDAD, { detail: { productoIds, cantidad: q } }))
}

/** El selector de `productoId` recibe la cantidad pedida. Devuelve la función para desuscribirse. */
export function escucharPedidoCantidad(productoId: number | null | undefined, alRecibir: (cantidad: number) => void): () => void {
  if (typeof window === 'undefined' || productoId == null) return () => {}
  const id = Number(productoId)
  const manejar = (e: Event) => {
    const d = (e as CustomEvent<DetallePedirCantidad>).detail
    if (!d || !Array.isArray(d.productoIds) || !d.productoIds.includes(id)) return
    alRecibir(d.cantidad)
  }
  window.addEventListener(EVENTO_PEDIR_CANTIDAD, manejar)
  return () => window.removeEventListener(EVENTO_PEDIR_CANTIDAD, manejar)
}
