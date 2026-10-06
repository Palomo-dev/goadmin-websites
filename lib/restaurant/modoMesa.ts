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

/**
 * Colores derivados para las secciones de mesa (components/sections/restaurant/mesa/estilo.ts),
 * que el CSS solo no puede calcular:
 * - `--texto-sobre-primario`: negro o blanco sobre el color primario, el de más contraste (misma
 *   regla que el botón del encabezado). Noir (#C8A97E) lleva texto oscuro; Marfil, blanco.
 * - `--primario-texto`: el primario como TEXTO sobre el fondo del tema, solo si llega a AA
 *   (4,5:1); si no (Pop: #E11D48 sobre #FFE94D da 3,8), el texto del tema.
 * Sin colores hex válidos no emite nada y las secciones usan sus valores de siempre.
 */
export function variablesColorMesa(
  primario: string | null | undefined,
  tema: { fondo: string | null; texto: string | null } | null | undefined,
  medir: { sobre: (hex: unknown) => string | null; contraste: (a: string, b: string) => number | null },
): Record<string, string> {
  const vars: Record<string, string> = {}
  if (!primario) return vars
  const sobre = medir.sobre(primario)
  if (sobre) vars['--texto-sobre-primario'] = sobre
  if (tema?.fondo && tema.texto) {
    const razon = medir.contraste(primario, tema.fondo)
    if (razon !== null && razon < 4.5) vars['--primario-texto'] = tema.texto
  }
  return vars
}
