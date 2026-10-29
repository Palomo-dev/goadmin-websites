/**
 * verify-estilo-categoria.mjs — sin category_style no hay variante nueva.
 *
 *   npm run verify:estilo-categoria
 */
import { ajusteImagenCategoria, clasesPastillas, estiloCategoria, planBento } from '../lib/website/estiloCategoria.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(estiloCategoria(undefined) == null, 'sin estilo se queda la tarjeta de hoy')
check(estiloCategoria('overlay') == null, 'overlay es la tarjeta de hoy')
check(estiloCategoria('circle') === 'circle', 'circle es una variante')
check(ajusteImagenCategoria(undefined) === 'contain', 'las variantes no recortan si no se pide')
check(ajusteImagenCategoria('cover') === 'cover', 'cover se respeta')
check(JSON.stringify(planBento(4)) === '[]', '4 no completa un mosaico')
check(JSON.stringify(planBento(5)) === '[5]', '5 es un mosaico')
check(JSON.stringify(planBento(8)) === '[8]', '8 es un mosaico')
check(JSON.stringify(planBento(10)) === '[5,5]', '10 son dos mosaicos de 5')
check(planBento(13).reduce((s, n) => s + n, 0) === 13, '13 cuadra 5 y 8')
check(planBento(9).reduce((s, n) => s + n, 0) === 8, '9 no deja un hueco: sobra 1')
check(clasesPastillas(undefined) === 'flex gap-3 overflow-x-auto pb-2 md:flex-wrap', 'pastilla sin layout: clases de siempre')
check(clasesPastillas('grid') === 'flex gap-3 overflow-x-auto pb-2 md:flex-wrap', 'pastilla en grid: clases de siempre')
check(!clasesPastillas('carousel').includes('md:flex-wrap'), 'pastilla en carrusel: una sola fila en escritorio')
check(clasesPastillas('carousel').includes('snap-x'), 'pastilla en carrusel: con snap')

if (problemas.length) {
  console.error(`verify-estilo-categoria: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-estilo-categoria: ${casos} casos`)
