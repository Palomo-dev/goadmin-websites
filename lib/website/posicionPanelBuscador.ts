/**
 * Posición del desplegable del buscador (barra y lupa): ancho propio y dentro de la pantalla.
 * Puro (sin React) para poder probarlo; lo usa components/site/buscador/comportamiento.ts.
 */
/** Ancho mínimo del desplegable de resultados (nunca hereda el del input). */
export const ANCHO_MINIMO_PANEL = 360
/** Margen con el borde de la pantalla. */
const MARGEN_PANTALLA = 8
/** Margen lateral de la página en el celular (px-4). */
const MARGEN_PAGINA = 16

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
  // En pantallas angostas el mínimo no pasa de la pantalla menos el margen de página (16 px por
  // lado): un buscador a todo el ancho del celular abre un panel de su mismo ancho, no 2 px más
  // ancho y descuadrado.
  const minimo = Math.min(opciones.minimo ?? ANCHO_MINIMO_PANEL, anchoPantalla - MARGEN_PAGINA * 2)
  const maximo = Math.max(0, anchoPantalla - MARGEN_PANTALLA * 2)
  const deseado = opciones.ancho ?? Math.max(ancla.width, minimo)
  const width = Math.min(Math.max(deseado, minimo), maximo)
  let izquierda = opciones.alinear === 'derecha' ? ancla.right - width : ancla.left
  if (izquierda + width > anchoPantalla - MARGEN_PANTALLA) izquierda = anchoPantalla - MARGEN_PANTALLA - width
  if (izquierda < MARGEN_PANTALLA) izquierda = MARGEN_PANTALLA
  return { left: Math.round(izquierda - ancla.left), width: Math.round(width) }
}

