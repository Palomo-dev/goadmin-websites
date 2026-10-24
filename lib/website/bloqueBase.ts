/**
 * El detalle de producto y la página de categoría siempre dibujan su bloque
 * base (galería + nombre + precio + agregar, o la grilla), aunque la página
 * tenga otras secciones. Una lista vacía no se toca: sigue el layout monolítico.
 */

import type { WebsitePageSection } from '@/types/database'

/** Imagen, nombre/precio y «Agregar al carrito». */
export const TIPOS_BASE_PRODUCTO = ['product_gallery', 'product_info', 'product_actions'] as const

/** La grilla de la categoría. */
export const TIPO_BASE_CATEGORIA = 'category_products'

/** Van encima de la grilla cuando la página aún no trae el bloque base. */
export const TIPOS_ENCIMA_CATEGORIA = [
  'category_header',
  'category_subcategories',
  'category_filters',
] as const

function virtual(tipo: string, orden: number): WebsitePageSection {
  return {
    id: `default_${tipo}`,
    page_id: '__default__',
    organization_id: 0,
    section_type: tipo,
    section_variant: 'default',
    content: {},
    settings: {},
    sort_order: orden,
    is_visible: true,
    created_at: '',
    updated_at: '',
  }
}

/**
 * Inserta los tipos base que falten, en su orden canónico.
 * - Si ya están todos, la lista vuelve igual.
 * - Si no hay ninguno: `encima` queda arriba, el bloque base en medio y el resto abajo.
 * - Si hay algunos: lo que está antes del primero se queda arriba; los base se
 *   emiten en orden canónico (el guardado o uno virtual); el resto baja.
 */
export function completarBloqueBase(
  secciones: WebsitePageSection[],
  bases: readonly string[],
  encima: readonly string[] = [],
): WebsitePageSection[] {
  if (secciones.length === 0) return secciones
  const presentes = new Set(secciones.map((s) => s.section_type))
  if (bases.every((tipo) => presentes.has(tipo))) return secciones

  const esBase = (tipo: string) => bases.includes(tipo)
  const primeraBase = secciones.findIndex((s) => esBase(s.section_type))

  if (primeraBase === -1) {
    const arriba: WebsitePageSection[] = []
    const abajo: WebsitePageSection[] = []
    for (const seccion of secciones) {
      if (encima.includes(seccion.section_type)) arriba.push(seccion)
      else abajo.push(seccion)
    }
    const virtuales = bases.map((tipo, i) => virtual(tipo, arriba.length + i))
    return [...arriba, ...virtuales, ...abajo]
  }

  const antes = secciones.slice(0, primeraBase)
  const existentes = new Map<string, WebsitePageSection>()
  const resto: WebsitePageSection[] = []
  for (const seccion of secciones.slice(primeraBase)) {
    if (esBase(seccion.section_type)) {
      if (!existentes.has(seccion.section_type)) existentes.set(seccion.section_type, seccion)
    } else {
      resto.push(seccion)
    }
  }
  const ordenadas = bases.map((tipo, i) => existentes.get(tipo) ?? virtual(tipo, antes.length + i))
  return [...antes, ...ordenadas, ...resto]
}
