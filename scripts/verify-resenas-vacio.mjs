import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { textosEstadoVacio } from '../components/site/reviews/types.ts'
const d = textosEstadoVacio(null)
assert.deepEqual(d, { titulo: 'Aún no hay opiniones para este producto', mensaje: 'Sé el primero en compartir tu experiencia con este producto.', boton: 'Escribir una opinión' })
assert.deepEqual(textosEstadoVacio({ titulo: '  ', mensaje: undefined, boton: 3 }), d)
assert.deepEqual(textosEstadoVacio({ titulo: 'Sin reseñas', mensaje: 'Cuéntanos', boton: 'Opinar' }), { titulo: 'Sin reseñas', mensaje: 'Cuéntanos', boton: 'Opinar' })
const sec = readFileSync(new URL('../components/sections/product-detail/ProductReviewsSection.tsx', import.meta.url), 'utf8')
assert.ok(sec.includes('titulo: content?.empty_state_title, mensaje: content?.empty_state_message, boton: content?.empty_state_cta'))
const pr = readFileSync(new URL('../components/site/reviews/ProductReviews.tsx', import.meta.url), 'utf8')
for (const k of ['{vacio.titulo}', '{vacio.mensaje}', '{vacio.boton}']) assert.ok(pr.includes(k), k)
console.log('verify-resenas-vacio: 7 casos ok')
