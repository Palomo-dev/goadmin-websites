/**
 * Reglas del carril horizontal de chips (CarrilChips): rueda del mouse, flechas y llevar a la vista
 * el chip elegido. Sin bucle ni avance automático: son filtros para navegar, no un carrusel.
 *
 * Puro: componente y scripts/verify-carril-chips.mjs.
 */

/** Holgura en px para decir «está en el borde» (redondeos del navegador). */
export const HOLGURA = 2

/** ¿Desborda? Solo así hay flechas, degradado y rueda. */
export function desborda(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth - clientWidth > HOLGURA
}

/** Qué lados tienen chips fuera de vista (para el degradado y las flechas). */
export function ladosOcultos(scrollLeft: number, scrollWidth: number, clientWidth: number): { izquierda: boolean; derecha: boolean } {
  if (!desborda(scrollWidth, clientWidth)) return { izquierda: false, derecha: false }
  return { izquierda: scrollLeft > HOLGURA, derecha: scrollLeft < scrollWidth - clientWidth - HOLGURA }
}

/** Lo que avanza una flecha: el 80 % del ancho visible (deja ver el chip que estaba en el borde). */
export function pasoFlecha(clientWidth: number): number {
  return Math.max(80, Math.round(clientWidth * 0.8))
}

/**
 * Rueda vertical del mouse sobre la barra → desplazamiento horizontal. Devuelve los px a mover, o
 * `null` para dejar el evento al navegador: el trackpad horizontal (ya es horizontal), una barra
 * que no desborda, o una barra que ya llegó a ese borde (la página sigue bajando: no atrapa el scroll).
 */
export function desplazamientoRueda(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
  deltaX: number,
  deltaY: number,
): number | null {
  if (!desborda(scrollWidth, clientWidth)) return null
  if (Math.abs(deltaX) >= Math.abs(deltaY) || deltaY === 0) return null
  const max = scrollWidth - clientWidth
  if (deltaY < 0 && scrollLeft <= HOLGURA) return null
  if (deltaY > 0 && scrollLeft >= max - HOLGURA) return null
  return deltaY
}

/**
 * `scrollLeft` para que el chip elegido quede a la vista (centrado si se puede), o `null` si ya se
 * ve completo y no hay que moverse. `margen`: px de cada borde que no cuentan como visibles (debajo
 * de la flecha y del desvanecido); se usa al tabular, para que el chip con foco no quede tapado.
 */
export function desplazamientoParaMostrar(
  chipIzquierda: number,
  chipAncho: number,
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  margen = 0,
): number | null {
  const izq = scrollLeft > HOLGURA ? margen : 0
  const der = scrollLeft < scrollWidth - clientWidth - HOLGURA ? margen : 0
  const visible = chipIzquierda >= scrollLeft + izq - HOLGURA && chipIzquierda + chipAncho <= scrollLeft + clientWidth - der + HOLGURA
  if (visible) return null
  const centrado = chipIzquierda - (clientWidth - chipAncho) / 2
  return Math.round(Math.min(Math.max(0, centrado), Math.max(0, scrollWidth - clientWidth)))
}

/** Movimiento mínimo (px) para que un arrastre con el mouse cuente como arrastre y no como clic. */
export const UMBRAL_ARRASTRE = 5

/** ¿El mouse ya se movió lo bastante en horizontal para ser arrastre? Por debajo, sigue siendo clic. */
export function esArrastre(dx: number): boolean {
  return Math.abs(dx) > UMBRAL_ARRASTRE
}

/** px a mover por la flecha que no tapa el chip con foco: flecha (32) + aire. */
export const MARGEN_FOCO = 40

/**
 * Píxeles de un evento de rueda: Firefox puede dar líneas (`deltaMode` 1) o páginas (2) en vez de px.
 */
export function pixelesRueda(delta: number, deltaMode: number, clientWidth: number): number {
  if (deltaMode === 1) return delta * 16
  if (deltaMode === 2) return delta * clientWidth
  return delta
}
