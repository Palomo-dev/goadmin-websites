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
 * Construye un array de WebsitePageSection virtuales (no persistidas)
 * a partir de la lista canónica, para usar en SectionRenderer.
 */
export function buildDefaultProductDetailSections(): WebsitePageSection[] {
  return DEFAULT_PRODUCT_DETAIL_SECTIONS.map((def, index) => ({
    id: def.id,
    page_id: '__default__',
    organization_id: 0,
    section_type: def.section_type,
    section_variant: def.section_variant,
    content: {},
    settings: {},
    sort_order: index,
    is_visible: true,
    created_at: '',
    updated_at: '',
  }))
}
