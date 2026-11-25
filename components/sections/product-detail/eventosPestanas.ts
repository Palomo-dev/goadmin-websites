/**
 * Pedir una pestaña de la ficha desde otro sitio de la página: las estrellas «4,8 · 12 reseñas»
 * (→ Reseñas) y «Ver detalles» del resumen de envío (→ Envío y devoluciones). Las pestañas
 * (PestanasFicha) escuchan el evento, abren la pestaña y bajan suave hasta la barra.
 *
 * Devuelve `true` si alguna pestaña lo atendió. Si no (ficha sin pestañas), quien llama hace lo
 * de siempre (bajar hasta el bloque, o dejar que el enlace `#…` haga lo suyo).
 */

export const EVENTO_ABRIR_PESTANA = 'goadmin:ficha-abrir-pestana'

export interface DetalleAbrirPestana {
  /** Tipo del bloque (`product_reviews`) o un alias (`resenas`, `envio`…). */
  destino: string
}

export function pedirPestanaFicha(destino: string): boolean {
  if (typeof window === 'undefined') return false
  const evento = new CustomEvent<DetalleAbrirPestana>(EVENTO_ABRIR_PESTANA, { detail: { destino }, cancelable: true })
  window.dispatchEvent(evento)
  return evento.defaultPrevented
}
