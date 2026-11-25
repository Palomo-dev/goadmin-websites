/**
 * Reglas puras de las pestañas ancla de la ficha (`product_anchor_nav · tabs`). Sin React ni
 * imports: las usa NavAnclasCliente en el navegador y las comprueba
 * `scripts/verify-ficha-plantilla.mjs`.
 */

/** Aire entre el encabezado (o las pestañas fijas) y el bloque al que se salta. */
export const MARGEN_SALTO_ANCLA = 16

/** Cuánto dura el resaltado del bloque al que se saltó. */
export const MS_RESALTE_ANCLA = 1400

export interface SaltoAncla {
  /** `getBoundingClientRect().top` del bloque destino. */
  topDestino: number
  scrollY: number
  /** Alto del encabezado fijo del sitio (`--header-h`). */
  alturaEncabezado: number
  /** Alto de la barra de pestañas. */
  alturaPestanas: number
  /**
   * ¿Las pestañas quedarán fijas encima del bloque? Solo si son fijas y el bloque va después de
   * ellas dentro de su mismo contenedor (más arriba, o fuera de él, las pestañas ya no se pegan).
   */
  pestanasEncima: boolean
}

/**
 * `scrollY` al que saltar para que el bloque quede justo debajo del encabezado y, si las pestañas
 * quedarán pegadas encima, también debajo de ellas. Nunca negativo.
 */
export function destinoSaltoAncla(s: SaltoAncla): number {
  const tapa = s.alturaEncabezado + (s.pestanasEncima ? s.alturaPestanas : 0) + MARGEN_SALTO_ANCLA
  const destino = Math.round(s.scrollY + s.topDestino - tapa)
  return Number.isFinite(destino) ? Math.max(0, destino) : 0
}

/**
 * Pestañas cuyo bloque pinta algo en este dispositivo (alto > 0). Un bloque sin datos (p. ej.
 * características sin marca ni referencia) o oculto en el celular deja su envoltorio vacío: su
 * pestaña no lleva a ninguna parte y no se muestra. Sin medir aún (render del servidor), todas.
 */
export function pestanasConContenido<T extends { target: string }>(
  items: readonly T[],
  conContenido: Readonly<Record<string, boolean>> | null,
): T[] {
  if (!conContenido) return [...items]
  return items.filter((i) => conContenido[i.target] === true)
}

/** Pestaña marcada: la elegida si sigue visible; si no, la primera visible (o `''`). */
export function pestanaActivaValida(activa: string, visibles: readonly { target: string }[]): string {
  return visibles.some((p) => p.target === activa) ? activa : (visibles[0]?.target ?? '')
}
