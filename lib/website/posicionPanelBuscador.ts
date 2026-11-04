/**
 * Posición del desplegable del buscador (barra y lupa): ancho propio y dentro de la pantalla.
 * Puro (sin React) para poder probarlo; lo usa components/site/buscador/comportamiento.ts.
 */
/** Ancho mínimo del desplegable de resultados (nunca hereda el del input). */
export const ANCHO_MINIMO_PANEL = 360
/** Margen con el borde de la pantalla. */
const MARGEN_PANTALLA = 8

/**
 * Posición del desplegable respecto a su ancla (el contenedor del buscador): el ancho es el del
 * ancla con mínimo `minimo` y máximo la pantalla menos márgenes; `alinear` elige qué borde sigue
 * (izquierdo o derecho del ancla) y luego se corre lo necesario para no salirse de la pantalla.
 * Devuelve `left` relativo al ancla (para un hijo `absolute` del ancla). `null` antes de medir.
 */
export function posicionPanel(
  ancla: { left: number; right: number; width: number },
  anchoPantalla: number,
  opciones: { minimo?: number; ancho?: number; alinear?: 'izquierda' | 'derecha' } = {},
): { left: number; width: number } {
  const minimo = opciones.minimo ?? ANCHO_MINIMO_PANEL
  const maximo = Math.max(0, anchoPantalla - MARGEN_PANTALLA * 2)
  const deseado = opciones.ancho ?? Math.max(ancla.width, minimo)
  const width = Math.min(Math.max(deseado, minimo), maximo)
  let izquierda = opciones.alinear === 'derecha' ? ancla.right - width : ancla.left
  if (izquierda + width > anchoPantalla - MARGEN_PANTALLA) izquierda = anchoPantalla - MARGEN_PANTALLA - width
  if (izquierda < MARGEN_PANTALLA) izquierda = MARGEN_PANTALLA
  return { left: Math.round(izquierda - ancla.left), width: Math.round(width) }
}

