/**
 * Enlaces de Google Maps de una sede: «Cómo llegar» y el mapa embebido.
 *
 * Una sola construcción para «Horario y sedes», el mapa (`map`) y la barra móvil del
 * restaurante. Con coordenadas se usan las coordenadas (exactas); si no, la dirección.
 * Puro: servidor y navegador.
 */

export interface LugarMapa {
  lat?: number | null
  lng?: number | null
  /** Dirección legible («Calle 00 # 00-00, Ciudad»). */
  direccion?: string | null
}

/** Destino para Maps: «lat,lng» o la dirección. `null` si no hay ninguno. */
export function destinoMapa(lugar: LugarMapa | null | undefined): string | null {
  if (!lugar) return null
  if (typeof lugar.lat === 'number' && typeof lugar.lng === 'number' && Number.isFinite(lugar.lat) && Number.isFinite(lugar.lng)) {
    return `${lugar.lat},${lugar.lng}`
  }
  const direccion = lugar.direccion?.trim()
  return direccion ? direccion : null
}

/** «Cómo llegar»: abre la ruta en Google Maps (app en el móvil). */
export function urlComoLlegar(lugar: LugarMapa | null | undefined): string | null {
  const destino = destinoMapa(lugar)
  return destino ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}` : null
}

/** URL del iframe del mapa. */
export function urlMapaEmbebido(lugar: LugarMapa | null | undefined): string | null {
  const destino = destinoMapa(lugar)
  return destino ? `https://maps.google.com/maps?q=${encodeURIComponent(destino)}&output=embed` : null
}

/**
 * `tel:` para «Llamar» (barra móvil, «Horario y sedes»): dígitos y un «+» inicial.
 * `null` si el teléfono no tiene al menos 7 dígitos.
 */
export function urlLlamar(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const limpio = telefono.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  return limpio.replace(/\D/g, '').length >= 7 ? `tel:${limpio}` : null
}
