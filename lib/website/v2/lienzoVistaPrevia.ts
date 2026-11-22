/**
 * Parámetros que la capa interior de la vista previa privada (`/vista-previa/<token>/…?marco=1`)
 * pasa a la página pública: SOLO los del lienzo del editor del ERP. Con ellos el lienzo pinta el
 * borrador igual que antes pintaba la página publicada:
 * - `preview=1`: precarga los datos de las secciones que se añaden en vivo (`esVistaPrevia`).
 * - `hora=HH:MM`: «Ver como» de la carta (`horaSimuladaDeVistaPrevia` la valida otra vez).
 * Cualquier otro parámetro se descarta, como hasta ahora (antes no pasaba ninguno).
 *
 * Puro (lo prueba scripts/verify-lienzo-borrador.mjs).
 */
export function parametrosDelLienzo(
  busqueda: Record<string, string | string[] | undefined>
): Record<string, string> {
  const parametros: Record<string, string> = {}
  if (busqueda.preview === '1') parametros.preview = '1'
  const hora = busqueda.hora
  if (typeof hora === 'string' && /^\d{2}:\d{2}$/.test(hora)) parametros.hora = hora
  return parametros
}

/**
 * Plantilla de detalle que pide la ruta de la vista previa (`productos/<uuid>`,
 * `categorias/<slug>`), o `null` si es una página normal (la pinta el catch-all). Con el borrador
 * fijado, esas rutas pintan la ficha o la categoría con la plantilla del BORRADOR
 * (`getPlantillaPublica` lee `sitioVistaPreviaDe`), así el lienzo del editor ve lo que se edita
 * antes de publicar. Solo el sitio principal: las sedes no tienen plantillas propias.
 *
 * Puro (lo prueba scripts/verify-lienzo-borrador.mjs).
 */
const UUID_DETALLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_CATEGORIA = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u

export type PlantillaDetalleVistaPrevia =
  | { tipo: 'producto'; id: string }
  | { tipo: 'categoria'; slug: string }

export function plantillaDetalleDeRuta(ruta: readonly string[]): PlantillaDetalleVistaPrevia | null {
  if (ruta.length !== 2) return null
  const [raiz, valor] = ruta
  if (raiz === 'productos' && UUID_DETALLE.test(valor)) return { tipo: 'producto', id: valor }
  if (raiz === 'categorias' && SLUG_CATEGORIA.test(valor)) return { tipo: 'categoria', slug: valor }
  return null
}
