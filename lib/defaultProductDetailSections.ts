/**
 * Secciones por defecto del detalle de producto (F9.2 — Secciones por defecto).
 *
 * Cuando una plantilla `product_detail` no tiene secciones explícitas en la BD,
 * se usa esta lista canónica para renderizar el detalle como secciones
 * independientes (en vez de un layout hardcodeado monolítico).
 *
 * Esto permite que el editor muestre, reordene, oculte y edite cada bloque
 * individualmente sin perder el comportamiento por defecto.
 *
 * Los IDs son estables y prefijados con `default_` para distinguirlos de
 * secciones reales persistidas en la BD.
 *
 * Fase 1 de la PDP personalizable: `buildDefaultProductDetailSections(page_settings)` arma los
 * bloques con el MISMO orden, la misma visibilidad y las mismas opciones que pintaba el layout
 * monolítico de `ProductDetailRenderer` con esos `page_settings`. El renderer ya no tiene layout
 * propio: el «fallback» es renderizar estos bloques (verify:ficha-diff lo compara al píxel con el
 * renderer anterior).
 */

import type { WebsitePageSection } from '@/types/database'

export interface DefaultSectionDef {
  id: string
  section_type: string
  section_variant: string
  label: string
}

/**
 * Lista canónica de secciones por defecto del detalle de producto.
 * El orden refleja el layout clásico: galería → info → acciones → beneficios
 * → descripción → relacionados → reviews.
 */
export const DEFAULT_PRODUCT_DETAIL_SECTIONS: DefaultSectionDef[] = [
  { id: 'default_product_gallery', section_type: 'product_gallery', section_variant: 'default', label: 'Galería' },
  { id: 'default_product_info', section_type: 'product_info', section_variant: 'default', label: 'Información' },
  { id: 'default_product_actions', section_type: 'product_actions', section_variant: 'default', label: 'Acciones' },
  { id: 'default_product_benefits', section_type: 'product_benefits', section_variant: 'default', label: 'Beneficios' },
  { id: 'default_product_description', section_type: 'product_description', section_variant: 'default', label: 'Descripción' },
  { id: 'default_related_products', section_type: 'related_products', section_variant: 'default', label: 'Productos relacionados' },
  { id: 'default_product_reviews', section_type: 'product_reviews', section_variant: 'default', label: 'Reseñas' },
]

/**
 * Marcador interno de la ficha: dónde va la urgencia (aviso de stock bajo + contador regresivo).
 * No es un tipo de sección del catálogo (no está en SECTION_MAP ni lo ofrece el editor): lo
 * resuelve `ProductDetailRenderer`. Hace falta porque el layout clásico la pone entre la
 * información y las acciones, y con `description_position: 'below_title'` (el default) la
 * descripción queda ANTES de la urgencia y con `'below_price'` DESPUÉS: dos órdenes distintos
 * con los mismos bloques. Una plantilla sin el marcador pinta la urgencia justo después de
 * `product_info`.
 */
export const TIPO_URGENCIA_FICHA = 'product_urgency'

/** Opciones de `page_settings` de la galería que viajan al `contenido` del bloque. */
export const CLAVES_GALERIA_FICHA = [
  'gallery_layout',
  'thumbnails_position',
  'gallery_arrows',
  'gallery_dots',
  'gallery_grid_columns',
  'gallery_scroll_height',
] as const

/** Clave del `contenido` de `related_products` con el layout (`page_settings.related_products_layout`). */
export const CLAVE_LAYOUT_RELACIONADOS = 'related_products_layout'

function seccionVirtual(
  id: string,
  tipo: string,
  orden: number,
  contenido: Record<string, unknown>,
  visible: boolean,
): WebsitePageSection {
  return {
    id,
    page_id: '__default__',
    organization_id: 0,
    section_type: tipo,
    section_variant: 'default',
    content: contenido as WebsitePageSection['content'],
    settings: {},
    sort_order: orden,
    is_visible: visible,
    created_at: '',
    updated_at: '',
  } as WebsitePageSection
}

/**
 * Construye un array de WebsitePageSection virtuales (no persistidas)
 * a partir de la lista canónica, para usar en SectionRenderer.
 *
 * Con `pageSettings` reproduce el layout monolítico de antes (mismas reglas, incluidas las raras):
 * - `description_position` ordena la descripción: `below_title` (default) entre la información y
 *   la urgencia; `below_price` entre la urgencia y las acciones; `below_buttons` tras las
 *   acciones; `above_gallery` antes de la galería (en 2 columnas, columna de la galería) y, en 2
 *   columnas, sin el bloque de información (así lo pintaba el layout de antes).
 * - Una columna (`columns: '1'`) solo pinta la descripción con `above_gallery`; un valor
 *   desconocido de `description_position` no la pinta en ningún sitio.
 * - `show_benefits: false` oculta los beneficios.
 * Lo oculto se devuelve con `is_visible: false` para que el editor conserve la lista completa.
 */
export function buildDefaultProductDetailSections(
  pageSettings?: Record<string, unknown> | null,
): WebsitePageSection[] {
  const ajustes = pageSettings ?? {}
  const unaColumna = (ajustes.columns || '2') === '1'
  const posicion = ajustes.description_position || 'below_title'

  const galeria: Record<string, unknown> = {}
  for (const clave of CLAVES_GALERIA_FICHA) {
    if (ajustes[clave] !== undefined) galeria[clave] = ajustes[clave]
  }
  const acciones: Record<string, unknown> = { buttons_layout: ajustes.buttons_layout || 'stacked' }
  const relacionados: Record<string, unknown> = { [CLAVE_LAYOUT_RELACIONADOS]: ajustes.related_products_layout || 'carousel' }

  const infoVisible = unaColumna || posicion !== 'above_gallery'
  const descripcionVisible = unaColumna
    ? posicion === 'above_gallery'
    : ['below_title', 'below_price', 'below_buttons', 'above_gallery'].includes(String(posicion))

  type Def = [id: string, tipo: string, contenido: Record<string, unknown>, visible: boolean]
  const descripcion: Def = ['default_product_description', 'product_description', {}, descripcionVisible]
  const orden: Def[] = []
  if (posicion === 'above_gallery') orden.push(descripcion)
  orden.push(['default_product_gallery', 'product_gallery', galeria, true])
  orden.push(['default_product_info', 'product_info', {}, infoVisible])
  if (posicion === 'below_title') orden.push(descripcion)
  orden.push(['default_product_urgency', TIPO_URGENCIA_FICHA, {}, true])
  if (posicion === 'below_price') orden.push(descripcion)
  orden.push(['default_product_actions', 'product_actions', acciones, true])
  if (posicion === 'below_buttons') orden.push(descripcion)
  orden.push(['default_product_benefits', 'product_benefits', {}, ajustes.show_benefits !== false])
  // Posición desconocida: el bloque sigue en la lista (oculto) para el editor.
  if (!orden.includes(descripcion)) orden.push(descripcion)
  orden.push(['default_related_products', 'related_products', relacionados, true])
  orden.push(['default_product_reviews', 'product_reviews', {}, true])

  return orden.map(([id, tipo, contenido, visible], i) => seccionVirtual(id, tipo, i, contenido, visible))
}
