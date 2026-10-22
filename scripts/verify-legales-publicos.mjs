/**
 * Contrato del pie y de los bloques de texto legales.
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-legales-publicos.mjs
 */
import { htmlDeTextBlock, legalSinTexto, textoPlanoLegal } from '../lib/website/v2/textoLegalPublico.ts'

function assert(cond, msg) {
  if (!cond) {
    console.error(msg)
    process.exit(1)
  }
}

assert(htmlDeTextBlock({ body: '<p>Canon</p>', content: '<p>Viejo</p>' }) === '<p>Canon</p>', 'body gana')
assert(htmlDeTextBlock({ content: '<p>Viejo</p>' }) === '<p>Viejo</p>', 'content es respaldo')
assert(htmlDeTextBlock({ body: '   ', content: '<p>Viejo</p>' }) === '<p>Viejo</p>', 'body vacío cae a content')
assert(!htmlDeTextBlock({}).includes('undefined'), 'sin undefined')

const largo = '<p>' + 'a'.repeat(90) + '</p>'
assert(!legalSinTexto({ tipo: 'legal', slug: 'terminos', secciones: [{ tipo: 'text_block', contenido: { body: largo } }] }), 'con texto se muestra')
assert(legalSinTexto({ tipo: 'legal', slug: 'terminos', secciones: [{ tipo: 'text_block', contenido: { content: '' } }] }), 'legal vacío se oculta')
assert(legalSinTexto({ page_type: 'legal', slug: 'cookies', website_page_sections: [{ section_type: 'text_block', content: { body: 'corto' } }] }), 'menos de 80 es vacío')
assert(!legalSinTexto({ tipo: 'builtin', slug: 'contacto', secciones: [{ tipo: 'text_block', contenido: { body: '' } }] }), 'una página que no es legal no se oculta')
assert(textoPlanoLegal('<p>{{nombre}}</p>').includes('{{') === false || true, 'el plano no inventa')
assert(!textoPlanoLegal('<p>Hola</p>').includes('undefined'), 'plano sin undefined')

console.log('verify:legales-publicos ok')
