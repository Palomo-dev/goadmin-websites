import type { WebsitePageSection } from '@/types/database'

export const BLOQUES_BASE_PRODUCTO = ['product_gallery', 'product_info', 'product_actions'] as const
export const BLOQUES_BASE_CATEGORIA = ['category_products'] as const

/** Las secciones decorativas amplían una ficha; nunca sustituyen su contenido esencial. */
export function completarBloquesBase(
  secciones: readonly WebsitePageSection[],
  tipos: readonly string[],
  posicion: 'antes' | 'despues' = 'antes',
): WebsitePageSection[] {
  const visibles = secciones.filter((s) => s.is_visible !== false).map((s) => tipos.includes(s.section_type) ? { ...s, settings: { ...(s.settings as Record<string, unknown>), visibilidad: { computador: true, tableta: true, celular: true } } } : s)
  const faltantes = tipos.filter((tipo) => !visibles.some((s) => s.section_type === tipo))
  if (!faltantes.length) return visibles
  const referencia = secciones[0]
  const base = faltantes.map((tipo, i): WebsitePageSection => ({
    id: `base_obligatoria_${tipo}`,
    page_id: referencia?.page_id ?? '__default__',
    organization_id: referencia?.organization_id ?? 0,
    section_type: tipo,
    section_variant: 'default',
    content: { padding_top: 'none', padding_bottom: 'none', padding_x: 'none' },
    settings: {},
    sort_order: i,
    is_visible: true,
    created_at: '',
    updated_at: '',
  }))
  // Una cabecera de categoría y las secciones anteriores a su grilla conservan su lugar.
  // La grilla faltante se suma al final, después de la cabecera configurada.
  if (posicion === 'despues') return [...visibles, ...base]
  return [...base, ...visibles]
}
