/**
 * «Modo mesa» del layout (Figma 2032:75742, láminas 01–15 del comensal): la página Carta QR se
 * pinta como una app de la mesa, con encabezado mínimo (☰, logo y nombre), sin la barra móvil
 * del sitio, sin el pie completo y solo con «Carta con tecnología GO Admin» al final.
 *
 * Qué página entra en modo mesa:
 * - la de tipo `carta_qr` (la que crea la plantilla de página «Carta QR» del ERP), o
 * - la de slug `carta-qr` armada con alguna sección de mesa (sitios que la armaron a mano).
 * Cualquier otra página, el layout de siempre.
 *
 * Código puro: sin React, Next ni Supabase (lo carga scripts/verify-carta-qr.mjs).
 */

/** Tipo de página V2 de la Carta QR (`tipo` del documento, llega como `page_type`). */
export const TIPO_PAGINA_CARTA_QR = 'carta_qr'

/** Slug de la Carta QR en las plantillas de restaurante (el QR de la mesa redirige a él). */
export const SLUG_CARTA_QR = 'carta-qr'

/** Secciones que solo tienen sentido en la mesa (contrato lib/website/v2/contrato/seccionesMesa.ts). */
export const SECCIONES_DE_MESA: readonly string[] = ['table_service', 'table_order', 'table_bill', 'visit_feedback']

export interface PaginaParaModoMesa {
  slug?: string | null
  page_type?: string | null
  website_page_sections?: ReadonlyArray<{ section_type: string; section_variant?: string | null }> | null
}

export function esPaginaModoMesa(pagina: PaginaParaModoMesa | null | undefined): boolean {
  if (!pagina) return false
  if (pagina.page_type === TIPO_PAGINA_CARTA_QR) return true
  if ((pagina.slug ?? '').replace(/^\/+/, '') !== SLUG_CARTA_QR) return false
  return (pagina.website_page_sections ?? []).some(
    (s) => SECCIONES_DE_MESA.includes(s.section_type) || (s.section_type === 'restaurant_hero' && s.section_variant === 'mesa'),
  )
}

