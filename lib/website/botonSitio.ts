/**
 * Marca de los botones de las secciones para el estilo general del sitio V2 (Diseño › Botones:
 * redondeo, «Contorno», «Sombra dura»). Las reglas de app/globals.css cuelgan de `data-boton`,
 * así que alcanzan a los botones de verdad y no a tarjetas, chips de carrusel o fotos.
 *
 * - `primario`: la acción principal de la sección (fondo de marca). Recibe redondeo y estilo.
 * - `secundario`: acción secundaria (contorno o texto). Solo recibe el redondeo.
 *
 * Sin tema propio (legacy o sin tokens) el atributo no cambia nada: las reglas también exigen
 * el `data-radio-boton` / `data-estilo-boton` del layout.
 */
export const BOTON_PRIMARIO = { 'data-boton': 'primario' } as const
export const BOTON_SECUNDARIO = { 'data-boton': 'secundario' } as const
