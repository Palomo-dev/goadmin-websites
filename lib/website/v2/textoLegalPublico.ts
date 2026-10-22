/**
 * Una página legal sin texto no se enlaza ni se indexa.
 * `body` es el HTML canónico; `content` es el texto viejo del ERP.
 */

export const MIN_TEXTO_LEGAL = 80

const SLUGS = new Set([
  'terminos',
  'terminos-y-condiciones',
  'privacidad',
  'politica-de-privacidad',
  'politica-privacidad',
  'tratamiento-de-datos',
  'politica-tratamiento-datos',
  'politica-de-tratamiento-de-datos',
  'envios',
  'politica-de-envios',
  'politica-envios',
  'cambios-y-devoluciones',
  'devoluciones',
  'cookies',
  'politica-de-cookies',
])

export function textoPlanoLegal(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function htmlDeTextBlock(content: { body?: unknown; content?: unknown } | null | undefined): string {
  const body = typeof content?.body === 'string' ? content.body : ''
  const legado = typeof content?.content === 'string' ? content.content : ''
  return body.trim() ? body : legado
}

export function esPaginaLegalPublica(pagina: { tipo?: string; slug?: string; page_type?: string }): boolean {
  const tipo = pagina.tipo || pagina.page_type || ''
  const slug = pagina.slug || ''
  return tipo === 'legal' || tipo === 'policy' || SLUGS.has(slug) || slug.startsWith('politica-')
}

export function caracteresDeContenidos(bloques: readonly { tipo?: string; section_type?: string; contenido?: unknown; content?: unknown }[]): number {
  return bloques.reduce((n, s) => {
    const tipo = s.tipo || s.section_type || ''
    if (tipo !== 'text_block') return n
    const crudo = s.contenido ?? s.content
    const html = htmlDeTextBlock(crudo && typeof crudo === 'object' ? (crudo as { body?: unknown; content?: unknown }) : null)
    return n + textoPlanoLegal(html).length
  }, 0)
}

/** true solo para una página legal con menos de 80 caracteres de texto. */
export function legalSinTexto(pagina: {
  tipo?: string
  slug?: string
  page_type?: string
  secciones?: readonly { tipo?: string; contenido?: unknown }[]
  website_page_sections?: readonly { section_type?: string; content?: unknown }[]
}): boolean {
  if (!esPaginaLegalPublica(pagina)) return false
  const bloques = pagina.secciones ?? pagina.website_page_sections ?? []
  return caracteresDeContenidos(bloques) < MIN_TEXTO_LEGAL
}
