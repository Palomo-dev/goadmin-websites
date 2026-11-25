/**
 * Escala única de capas (z-index) del sitio público. Una sola regla, de abajo hacia arriba:
 *
 *   contenido < cabecera < desplegables de la cabecera < menú inferior / burbuja < capas modales
 *
 * Por qué hay una escala (2026-11-25, celular de una tienda con «Al bajar: encoger» y la barra de
 * búsqueda visible): las sugerencias del buscador se pintaban DENTRO de la cabecera. Ahí las
 * alcanzaba todo lo que la cabecera tiene encima: el `overflow-x: clip` de la fila del celular
 * (app/globals.css, `.px-4:has(> [data-fila-movil])`), el `transform` del envoltorio de «Al bajar»
 * (bloque contenedor y contexto de apilamiento), las reglas de texto blanco de la cabecera sobre
 * portada y la `mask-image` del menú que se desliza. Su `z-[100]` no servía de nada: dentro del
 * contexto de la cabecera (`sticky z-40`) vale lo que vale la cabecera. Con el teclado abierto, el
 * panel quedaba recortado al borde de la cabecera y parecía abrirse detrás del banner.
 *
 * Cómo se cumple la escala:
 * - CONTENIDO: las secciones usan z-10/20/30 (nunca 40 o más).
 * - CABECERA: el <header> fijo (`sticky top-0 z-40`) y el envoltorio de «Al bajar» (SiteHeader).
 * - DESPLEGABLES DE LA CABECERA: mismo número que la cabecera (40) pero pintados en la capa
 *   `[data-capa-desplegables-encabezado]`, que SiteHeader deja justo DESPUÉS del encabezado en el
 *   DOM: a igual z-index gana el que va después, así que el desplegable queda sobre la cabecera y
 *   sobre el contenido. Van `position: fixed` con la posición del campo medida en cada cuadro
 *   (PanelFlotanteEncabezado), fuera de cualquier transform, overflow o máscara.
 * - MENÚ INFERIOR y barras fijas de abajo (MenuInferior, MobileBottomNav, pestañas, barras de
 *   compra): también 40, pero van después en el DOM (el layout los pinta tras el <main>), así que
 *   tapan al desplegable. Además el desplegable mide el espacio libre y termina antes de ellas: no
 *   se esconde nada detrás de la barra. La burbuja del chat (Shadow DOM, z-index máximo) se oculta
 *   mientras las sugerencias están abiertas en el celular (`html[data-buscador-abierto]`).
 * - CAPAS MODALES: cajones del carrito y de favoritos (50), menú del encabezado y sus hojas
 *   (CapaEncabezado, 60), buscador a pantalla completa (70 / 9999) y diálogos de Radix (cuenta,
 *   moneda: 2147483646-7). Todas por portal, fuera del <header>.
 *
 * Comprobación: npm run verify:capas-encabezado.
 */
export const CAPA_CONTENIDO_MAX = 30
export const CAPA_CABECERA = 40
/** Igual que la cabecera: lo que la pone encima es su lugar en el DOM (después del encabezado). */
export const CAPA_DESPLEGABLE_CABECERA = 40
/** Igual que la cabecera: van después del desplegable en el DOM y el desplegable termina antes. */
export const CAPA_BARRAS_INFERIORES = 40
export const CAPA_CAJONES = 50
export const CAPA_MENU_ENCABEZADO = 60
export const CAPA_BUSCADOR_PANTALLA = 70
export const CAPA_DIALOGOS = 2147483646

/** Atributo de la capa donde se pintan los desplegables de la cabecera (la deja SiteHeader). */
export const ATRIBUTO_CAPA_DESPLEGABLES = 'data-capa-desplegables-encabezado'

/**
 * Barras fijas de abajo que el desplegable no debe tapar: el menú inferior v2 (sus <nav>; el
 * espaciador es un <div>), la barra de la plantilla (MobileBottomNav) y las pestañas (MobileTabs).
 */
export const SELECTOR_BARRAS_INFERIORES = 'nav[data-menu-inferior], nav[data-barra-app], nav[data-barra-inferior]'

/** Separación entre el campo y su desplegable (el `mt-2` de siempre) y margen con el borde de abajo. */
export const SEPARACION_DESPLEGABLE = 8
export const MARGEN_INFERIOR_DESPLEGABLE = 12
/** Alto mínimo del desplegable aunque el teclado deje poco espacio (se desplaza por dentro). */
export const ALTO_MINIMO_DESPLEGABLE = 160

/**
 * Alto disponible para un desplegable que empieza en `arriba` (px desde el borde superior de la
 * pantalla): hasta el borde visible de abajo (la ventana visual, sin el teclado) o hasta la barra
 * inferior más alta que esté a la vista, lo que llegue antes. Puro, para poder probarlo.
 */
export function altoDisponible(arriba: number, bordeVisible: number, topesBarras: number[]): number {
  let limite = bordeVisible
  for (const tope of topesBarras) {
    if (tope > arriba && tope < limite) limite = tope
  }
  return Math.max(ALTO_MINIMO_DESPLEGABLE, Math.floor(limite - arriba - MARGEN_INFERIOR_DESPLEGABLE))
}
