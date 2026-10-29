/**
 * Sincroniza la variante elegida entre los selectores de una misma ficha (VariantSelector
 * principal y la barra fija StickyAddToCart) con un evento de ventana.
 *
 * Solo se emite ante una elección del cliente (no al recibir ni al preseleccionar), así no
 * hay bucles. Cada receptor ignora ids que no están entre sus variantes, por lo que dos
 * fichas o diálogos de productos distintos no se pisan.
 */
export const EVENTO_VARIANTE = 'goadmin:variante-seleccionada'

export interface DetalleVariante {
  variantId: number
  /** Quién emitió: el receptor ignora sus propios eventos. */
  origen: string
}

export function emitirVariante(variantId: number, origen: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<DetalleVariante>(EVENTO_VARIANTE, { detail: { variantId, origen } }))
}

/** Se suscribe a las elecciones de otros selectores. Devuelve la función para desuscribirse. */
export function escucharVariante(origen: string, alRecibir: (variantId: number) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const manejar = (e: Event) => {
    const d = (e as CustomEvent<DetalleVariante>).detail
    if (!d || d.origen === origen) return
    alRecibir(Number(d.variantId))
  }
  window.addEventListener(EVENTO_VARIANTE, manejar)
  return () => window.removeEventListener(EVENTO_VARIANTE, manejar)
}

/**
 * Cantidad elegida en el selector principal (VariantSelector o ProductDetailActions) para un
 * producto o variante. La barra fija la usa al agregar. Mismo patrón que la variante.
 */
export const EVENTO_CANTIDAD = 'goadmin:cantidad-seleccionada'

export interface DetalleCantidad {
  productId: number
  cantidad: number
  origen: string
}

export function emitirCantidad(productId: number, cantidad: number, origen: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<DetalleCantidad>(EVENTO_CANTIDAD, { detail: { productId, cantidad, origen } }))
}

export function escucharCantidad(origen: string, alRecibir: (productId: number, cantidad: number) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const manejar = (e: Event) => {
    const d = (e as CustomEvent<DetalleCantidad>).detail
    if (!d || d.origen === origen) return
    alRecibir(Number(d.productId), Number(d.cantidad))
  }
  window.addEventListener(EVENTO_CANTIDAD, manejar)
  return () => window.removeEventListener(EVENTO_CANTIDAD, manejar)
}
