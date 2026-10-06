/**
 * Texto plano a partir de un texto que puede traer HTML (descripciones de productos y
 * categorías pegadas desde un editor en el ERP: `<p data-start="2111" …>`, `<strong>`,
 * `&nbsp;`…).
 *
 * Regla única del sitio para pintar descripciones: carta, tarjetas, hoja del plato, ficha del
 * producto, vista rápida y metadatos. Nunca se inyecta el HTML: se quitan las etiquetas y se
 * decodifican las entidades, y el resultado se pinta como texto (React lo escapa).
 *
 * - Los finales de bloque (`</p>`, `<br>`, `</li>`, `</div>`, títulos) pasan a salto de línea,
 *   y cada `<li>` empieza con «• », para que `ExpandableDescription` conserve párrafos y viñetas.
 * - `<script>`, `<style>` y comentarios se quitan con su contenido.
 * - Una etiqueta cortada al final (texto truncado: `<strong data-start="15`) también se quita.
 * - Un `<` que no abre etiqueta («menos de < 10») se respeta.
 * - Sin `<` ni `&`, devuelve el texto tal cual (camino rápido: la mayoría de descripciones).
 *
 * Pura y sin DOM: corre igual en el servidor y en el navegador.
 */

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
  iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', middot: '·', bull: '•',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  deg: '°', copy: '©', reg: '®', trade: '™', euro: '€', cent: '¢', pound: '£',
  times: '×', divide: '÷', frac12: '½', frac14: '¼', frac34: '¾', ordm: 'º', ordf: 'ª',
}

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (entera, cuerpo: string) => {
    if (cuerpo[0] === '#') {
      const codigo = cuerpo[1] === 'x' || cuerpo[1] === 'X' ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10)
      if (!Number.isFinite(codigo) || codigo <= 0 || codigo > 0x10ffff) return entera
      try {
        return String.fromCodePoint(codigo)
      } catch {
        return entera
      }
    }
    return ENTIDADES[cuerpo] ?? entera
  })
}

const BLOQUE = '(?:p|div|li|ul|ol|h[1-6]|tr|table|blockquote|section|article|header|footer|pre)'

export function textoPlano(valor: string | null | undefined): string {
  if (valor == null) return ''
  const texto = String(valor)
  if (!texto.includes('<') && !texto.includes('&')) return texto

  let s = texto
    // Contenido que nunca es texto visible.
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    // Estructura → saltos de línea y viñetas.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(new RegExp(`<\\/${BLOQUE}\\s*>`, 'gi'), '\n')
    .replace(new RegExp(`<${BLOQUE}\\b[^>]*>`, 'gi'), '\n')
    // Resto de etiquetas (abre o cierra con nombre de etiqueta), y una cortada al final.
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(/<\/?[a-zA-Z][^<>]*$/, '')

  s = decodificarEntidades(s)

  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v ]+/g, ' ')
    .split('\n')
    .map((linea) => linea.trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** `textoPlano` o `null` si queda vacío: para condiciones `desc && <p>…</p>` y metadatos. */
export function textoPlanoONulo(valor: string | null | undefined): string | null {
  const limpio = textoPlano(valor)
  return limpio.trim() ? limpio : null
}
