/**
 * Búsquedas populares del buscador (chips «Populares» cuando se abre vacío).
 *
 * - Configuradas por tienda: `shell.header.opciones.search_popular` (lista de textos, validada en
 *   mapeoAjustes.ts con la regla `listaTextos`).
 * - Sin configurar: las primeras categorías del menú de la tienda, en su orden.
 * - Nunca una lista genérica: sin ninguna de las dos, no hay chips (el bloque no se pinta).
 */
export const MAX_BUSQUEDAS_POPULARES_CATEGORIAS = 4

export function busquedasPopulares(
  configuradas: readonly string[] | null | undefined,
  categorias: readonly { name?: string | null }[] | null | undefined,
): string[] {
  if (configuradas && configuradas.length > 0) return [...configuradas]
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const c of categorias ?? []) {
    const nombre = typeof c?.name === 'string' ? c.name.trim() : ''
    if (!nombre || vistos.has(nombre.toLowerCase())) continue
    vistos.add(nombre.toLowerCase())
    salida.push(nombre)
    if (salida.length >= MAX_BUSQUEDAS_POPULARES_CATEGORIAS) break
  }
  return salida
}
