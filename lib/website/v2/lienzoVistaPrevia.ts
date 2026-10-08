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
