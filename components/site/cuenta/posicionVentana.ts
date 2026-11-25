/**
 * Dónde se cuelga la «Ventana desde el ícono» del acceso a la cuenta (AccesoCuenta, modo
 * `ventana` del editor). Una sola regla para quien la abra: el ícono de la cabecera y los enlaces
 * del checkout («¿Ya compraste aquí?», «Ingresar» de contraentrega).
 *
 * - Lo de siempre (el ícono de la cabecera, arriba a la derecha): debajo del ancla, 8 px, con el
 *   borde derecho alineado al del ancla. Si cabe así, la posición es EXACTAMENTE la de antes.
 * - Ancla a la izquierda (un enlace dentro del pago): alineada a su borde izquierdo, sin salirse
 *   de la pantalla, en vez de cortarse por la izquierda.
 * - Ancla abajo en la pantalla sin espacio debajo: se abre hacia arriba, con el alto que quepa.
 *
 * Pura: AccesoCuenta y scripts/verify-checkout-v2.mjs.
 */

/** Ancho de la ventana (clase `w-[340px]` de AccesoCuenta). */
export const ANCHO_VENTANA_CUENTA = 340
/** Alto con el que se decide abrir hacia arriba (formulario de ingreso compacto). */
export const ALTO_MINIMO_VENTANA_CUENTA = 360
const MARGEN = 8

export interface Ancla {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PosicionVentana {
  top?: number
  bottom?: number
  left?: number
  right?: number
  /** Solo cuando se abre hacia arriba: el alto que cabe sobre el ancla. */
  maxHeight?: number
}

export function posicionVentanaCuenta(ancla: Ancla, pantalla: { ancho: number; alto: number }): PosicionVentana {
  // Horizontal: lo de siempre (borde derecho con el del ancla) si la ventana cabe a su izquierda.
  const derecha = Math.max(MARGEN, Math.round(pantalla.ancho - ancla.right))
  const cabeAlineadaDerecha = pantalla.ancho - derecha - ANCHO_VENTANA_CUENTA >= MARGEN
  const horizontal: Pick<PosicionVentana, 'left' | 'right'> = cabeAlineadaDerecha
    ? { right: derecha }
    : { left: Math.max(MARGEN, Math.min(Math.round(ancla.left), Math.round(pantalla.ancho - ANCHO_VENTANA_CUENTA - MARGEN))) }

  // Vertical: debajo (lo de siempre) salvo que no quepa y haya más espacio arriba.
  const espacioAbajo = pantalla.alto - ancla.bottom - MARGEN * 2
  const espacioArriba = ancla.top - MARGEN * 2
  if (espacioAbajo < ALTO_MINIMO_VENTANA_CUENTA && espacioArriba > espacioAbajo) {
    return { ...horizontal, bottom: Math.round(pantalla.alto - ancla.top + MARGEN), maxHeight: Math.round(espacioArriba) }
  } else {
    return { ...horizontal, top: Math.round(ancla.bottom + MARGEN) }
  }
}
