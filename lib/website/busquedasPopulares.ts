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

/**
 * Categorías que se MUESTRAN en el encabezado (mega-menú) o en la columna «Categorías» del pie:
 * todas si `show_categories_in_header` o `footer_show_categories` está activo; si no, ninguna.
 * Las búsquedas populares no pasan por aquí: usan todas las categorías de la tienda.
 */
export function categoriasVisibles<T>(
  ajustes: { show_categories_in_header?: boolean | null; footer_show_categories?: boolean | null } | null | undefined,
  categorias: readonly T[],
): T[] {
  return ajustes?.show_categories_in_header || ajustes?.footer_show_categories ? [...categorias] : []
}
