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
  website_page_sections?: ReadonlyArray<{
    section_type: string
    section_variant?: string | null
    is_visible?: boolean | null
    settings?: unknown
  }> | null
}

/** Sección que deja pedir desde la mesa: sin ella, /carta-qr no recibe el QR impreso. */
export const SECCION_PEDIDO_MESA = 'table_order'

/**
 * ¿Se ve en el celular? Misma regla que `visibilidadDeSeccion` (lib/website/v2/estiloSeccion.ts):
 * el ojo cerrado (`is_visible = false`) la oculta en todo; si no, manda la visibilidad fina
 * `settings.visibilidad` {computador, tableta, celular} cuando trae los tres; sin ella, se ve.
 * El celular porque es con lo que se escanea el QR de la mesa.
 */
function visibleEnCelular(s: { is_visible?: boolean | null; settings?: unknown }): boolean {
  if (s.is_visible === false) return false
  const ajustes = s.settings
  const fina = ajustes && typeof ajustes === 'object' ? (ajustes as { visibilidad?: unknown }).visibilidad : null
  if (fina && typeof fina === 'object') {
    const v = fina as { computador?: unknown; tableta?: unknown; celular?: unknown }
    if (typeof v.computador === 'boolean' && typeof v.tableta === 'boolean' && typeof v.celular === 'boolean') return v.celular
  }
  return true
}

/**
 * QR impreso de la mesa (/menu?mesa=<uuid>): ¿se manda a /carta-qr? Solo si esa página tiene
 * «Pedido de la mesa» (`table_order`) visible, que es lo que deja pedir desde la mesa. Con solo
 * «Servicio de mesa», o con el pedido oculto, /carta-qr no deja pedir y el QR se queda en el /menu
 * de siempre (la carta clásica, que sí deja pedir con la mesa).
 */
export function cartaQrRecibeMesa(paginaCartaQr: PaginaParaModoMesa | null | undefined): boolean {
  if (!paginaCartaQr) return false
  return (paginaCartaQr.website_page_sections ?? []).some((s) => s.section_type === SECCION_PEDIDO_MESA && visibleEnCelular(s))
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
