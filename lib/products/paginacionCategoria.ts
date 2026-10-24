/**
 * Paginación del listado de una categoría.
 *
 * El total y el corte salen de la MISMA lista de ids. Si cada página guarda
 * su propio total, al entrar productos la página 1 anuncia el conteo nuevo y
 * la página 2 sigue sirviendo el corte anterior: pocas fichas y otro número.
 */

export const TAMANO_PAGINA_CATEGORIA = 12

export interface CortePagina<T> {
  pagina: T[]
  total: number
  totalPaginas: number
}

export function paginarIds<T>(
  ids: readonly T[],
  page: number,
  limit: number = TAMANO_PAGINA_CATEGORIA,
): CortePagina<T> {
  const total = ids.length
  const tamano = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : TAMANO_PAGINA_CATEGORIA
  const paginaPedida = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const desde = (paginaPedida - 1) * tamano
  return {
    pagina: ids.slice(desde, desde + tamano),
    total,
    totalPaginas: total === 0 ? 0 : Math.ceil(total / tamano),
  }
}

/**
 * Más vendidos primero. Si empatan, se queda el orden en que llegaron
 * (nombre, como los devuelve la consulta). `Array.prototype.sort` es estable.
 */
export function ordenarPorVentasEstable<T extends { id: number }>(
  filasEnOrdenEstable: readonly T[],
  ventas: Record<number, number>,
): T[] {
  const venta = (id: number) => {
    const n = Number(ventas[id] ?? 0)
    return Number.isFinite(n) ? n : 0
  }
  return [...filasEnOrdenEstable].sort((a, b) => venta(b.id) - venta(a.id))
}

/**
 * Ventas del producto de listado: las suyas más las de sus variantes.
 * Un hijo que no pertenece a este listado no suma.
 */
export function ventasConHijos(
  idsListado: readonly number[],
  ventasPorProducto: Record<number, number>,
  hijoAPadre: Record<number, number>,
): Record<number, number> {
  const ventas: Record<number, number> = {}
  for (const id of idsListado) {
    const n = Number(ventasPorProducto[id] ?? 0)
    ventas[id] = Number.isFinite(n) ? n : 0
  }
  for (const [hijo, padre] of Object.entries(hijoAPadre)) {
    const idPadre = Number(padre)
    if (ventas[idPadre] === undefined) continue
    const n = Number(ventasPorProducto[Number(hijo)] ?? 0)
    if (Number.isFinite(n)) ventas[idPadre] += n
  }
  return ventas
}

/** El tamaño del detalle editable se usa tanto en la consulta como en la grilla. */
export function tamanoPaginaCategoriaPlantilla(secciones: readonly { section_type: string; is_visible?: boolean; content?: unknown }[] | null | undefined): number {
  const seccion = secciones?.find(s => s.section_type === 'category_products' && s.is_visible !== false)
  const contenido = seccion?.content && typeof seccion.content === 'object' ? seccion.content as Record<string, unknown> : {}
  const n = Number(contenido.max_items)
  return Number.isInteger(n) && n >= 1 && n <= 48 ? n : TAMANO_PAGINA_CATEGORIA
}
