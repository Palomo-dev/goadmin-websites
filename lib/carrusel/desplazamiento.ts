/**
 * Carruseles de desplazamiento nativo (una fila con `overflow-x`): marcas y productos.
 *
 * Funciones puras sobre las medidas del contenedor, para poder probarlas sin navegador.
 */

export interface MedidasDesplazamiento {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

/** Margen en px para dar por alcanzado un borde (redondeos del navegador). */
const MARGEN = 4

export function enInicio(m: MedidasDesplazamiento): boolean {
  return m.scrollLeft <= MARGEN
}

export function enFinal(m: MedidasDesplazamiento): boolean {
  return m.scrollLeft >= m.scrollWidth - m.clientWidth - MARGEN
}

/**
 * A dónde ir con «siguiente» / «anterior»: `{ por }` desplaza relativo, `{ a }` salta a una
 * posición absoluta (la vuelta con bucle) y `null` es que no hay a dónde ir.
 */
export function destinoDesplazamiento(
  m: MedidasDesplazamiento,
  direccion: 'siguiente' | 'anterior',
  bucle: boolean,
  fraccion: number,
): { por: number } | { a: number } | null {
  if (m.scrollWidth - m.clientWidth <= MARGEN) return null
  const paso = m.clientWidth * fraccion
  if (direccion === 'siguiente') {
    if (!enFinal(m)) return { por: paso }
    return bucle ? { a: 0 } : null
  }
  if (!enInicio(m)) return { por: -paso }
  return bucle ? { a: m.scrollWidth - m.clientWidth } : null
}

/** Aplica el destino al elemento. Devuelve `false` si no había a dónde ir. */
export function desplazar(
  el: HTMLElement | null,
  direccion: 'siguiente' | 'anterior',
  bucle: boolean,
  fraccion: number,
): boolean {
  if (!el) return false
  const d = destinoDesplazamiento(el, direccion, bucle, fraccion)
  if (!d) return false
  if ('por' in d) el.scrollBy({ left: d.por, behavior: 'smooth' })
  else el.scrollTo({ left: d.a, behavior: 'smooth' })
  return true
}
