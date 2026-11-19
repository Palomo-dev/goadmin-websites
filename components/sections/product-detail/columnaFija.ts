/**
 * `top` (px) de la columna de información fija cuando la galería va en «Desplazamiento».
 * Puro y sin React: lo usa ColumnaInfoFija y lo comprueba scripts/verify-galeria-scroll.mjs.
 *  - Si la columna cabe en la pantalla: justo debajo del header (`alturaHeader + margen`).
 *  - Si es más alta: negativo, para que suba con la página hasta mostrar su final y ahí se quede.
 */
export const MARGEN_COLUMNA_FIJA = 16

export function topColumnaFija(alturaColumna: number, altoVentana: number, alturaHeader: number, margen = MARGEN_COLUMNA_FIJA): number {
  return Math.min(alturaHeader + margen, altoVentana - alturaColumna - margen)
}
