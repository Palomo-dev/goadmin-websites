/**
 * Página de categoría con columna lateral (plantillas de tienda, `category_filters · sidebar_facets`).
 *
 * Código puro (sin React ni Supabase): lo usan CategoryDetailRenderer, FiltrosLaterales y
 * BarraOrdenLateral, y lo prueba `scripts/verify-categoria-plantilla.mjs`.
 *
 * Regla de compatibilidad: sin una sección VISIBLE `category_filters · sidebar_facets`,
 * `planColumnasCategoria` devuelve `null` y la página apila sus secciones como siempre.
 */

/** Lo mínimo de una sección de la plantilla `category_detail`. */
export interface SeccionCategoria {
  section_type: string
  section_variant: string
  is_visible?: boolean | null
}

export const VARIANTE_FILTROS_LATERALES = 'sidebar_facets'

/** Secciones que acompañan a la columna lateral (van a su derecha si la siguen sin cortes). */
export const TIPOS_COLUMNA_PRINCIPAL: readonly string[] = ['category_filters', 'category_subcategories', 'category_products']

export function esFiltrosLaterales(s: SeccionCategoria): boolean {
  return s.section_type === 'category_filters' && s.section_variant === VARIANTE_FILTROS_LATERALES && s.is_visible !== false
}

export type BloqueCategoria<S> =
  | { tipo: 'seccion'; seccion: S; indice: number }
  | { tipo: 'columnas'; lateral: S; indiceLateral: number; principal: Array<{ seccion: S; indice: number }> }

/**
 * Agrupa la columna lateral con las secciones de listado que la siguen (filtros normales,
 * subcategorías y productos, sin cortes). Solo la primera columna lateral visible arma columnas.
 * Devuelve `null` (= la página de siempre) si:
 * - no hay ninguna sección visible `category_filters · sidebar_facets`,
 * - el sitio no la tiene registrada (`registrada = false`: sin componente no se pinta), o
 * - no la sigue ninguna sección de listado (una columna lateral sola no tiene sentido).
 */
export function planColumnasCategoria<S extends SeccionCategoria>(secciones: readonly S[], registrada = true): BloqueCategoria<S>[] | null {
  if (!registrada) return null
  const i = secciones.findIndex(esFiltrosLaterales)
  if (i === -1) return null
  const principal: Array<{ seccion: S; indice: number }> = []
  for (let j = i + 1; j < secciones.length; j++) {
    const s = secciones[j]
    if (!TIPOS_COLUMNA_PRINCIPAL.includes(s.section_type) || esFiltrosLaterales(s)) break
    principal.push({ seccion: s, indice: j })
  }
  if (principal.length === 0) return null
  const bloques: BloqueCategoria<S>[] = []
  secciones.forEach((s, indice) => {
    if (indice < i || indice > i + principal.length) bloques.push({ tipo: 'seccion', seccion: s, indice })
    else if (indice === i) bloques.push({ tipo: 'columnas', lateral: s, indiceLateral: i, principal })
  })
  return bloques
}

/**
 * URL del listado de una categoría con las mismas reglas que `CategoryFilters.buildUrl`:
 * los valores por defecto (`best_selling`, `grid`, vacío) no van en la URL, y cambiar de
 * filtro vuelve a la página 1.
 */
export function urlListadoCategoria(slug: string, valores: { orden?: string; sub?: string; vista?: string }): string {
  const params = new URLSearchParams()
  const pares: Array<[string, string | undefined]> = [['orden', valores.orden], ['sub', valores.sub], ['vista', valores.vista]]
  for (const [clave, valor] of pares) {
    if (valor && valor !== 'best_selling' && valor !== '1' && valor !== 'grid' && valor !== '') params.set(clave, valor)
  }
  const qs = params.toString()
  return `/categorias/${slug}${qs ? `?${qs}` : ''}`
}

/** Cuántos filtros hay puestos: subcategoría elegida y orden distinto del de siempre. */
export function filtrosActivos(subcategoria: string | undefined, orden: string | undefined): number {
  return (subcategoria ? 1 : 0) + (orden && orden !== 'best_selling' ? 1 : 0)
}

/** Nodo del árbol de `getMenuCategories` (categorías activas de la organización). */
export interface NodoCategoria {
  id: number
  name: string
  slug: string
  parent_id: number | null
  children?: NodoCategoria[]
}

/**
 * Categorías del mismo nivel que la actual (ella incluida), en el orden del árbol: las hijas
 * de su padre o, si no tiene padre, las raíces. Sin la categoría en el árbol: `[]`.
 */
export function categoriasHermanas(arbol: readonly NodoCategoria[], categoria: { id: number; parent_id?: number | null } | null | undefined): NodoCategoria[] {
  if (!categoria || !Array.isArray(arbol)) return []
  const buscar = (nodos: readonly NodoCategoria[], id: number): NodoCategoria | null => {
    for (const n of nodos) {
      if (n.id === id) return n
      const hallado = buscar(n.children ?? [], id)
      if (hallado) return hallado
    }
    return null
  }
  if (!buscar(arbol, categoria.id)) return []
  const nivel = categoria.parent_id != null ? buscar(arbol, categoria.parent_id)?.children ?? [] : arbol
  return nivel.filter((n) => n.slug).map(({ id, name, slug, parent_id }) => ({ id, name, slug, parent_id }))
}
