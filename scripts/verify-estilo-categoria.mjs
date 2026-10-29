/**
 * verify-estilo-categoria.mjs — sin category_style no hay variante nueva.
 *
 *   npm run verify:estilo-categoria
 */
import { MASCARA_CARRIL, ajusteImagenCategoria, clasesCirculosMovil, clasesPastillas, layoutMovilCategorias, estiloCategoria, planBento } from '../lib/website/estiloCategoria.ts'

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
check(clasesPastillas(undefined) === `flex gap-3 overflow-x-auto pb-2 md:flex-wrap ${MASCARA_CARRIL}`, 'pastilla sin layout: clases de siempre + degradado')
check(clasesPastillas('grid') === `flex gap-3 overflow-x-auto pb-2 md:flex-wrap ${MASCARA_CARRIL}`, 'pastilla en grid: clases de siempre + degradado')
check(MASCARA_CARRIL.includes('md:[mask-image:none]'), 'degradado solo en celular')
check(clasesPastillas(undefined, 'list') === 'flex flex-col gap-2 md:flex-row md:flex-wrap', 'pastilla list en celular')
check(clasesPastillas(undefined, 'grid') === 'grid grid-cols-2 gap-2 md:flex md:flex-wrap', 'pastilla grid en celular')
check(clasesPastillas('carousel', 'list').includes('md:overflow-x-auto') && !clasesPastillas('carousel', 'list').includes('md:flex-wrap'), 'list + carrusel escritorio')
check(clasesPastillas('carousel', 'grid').startsWith('grid grid-cols-2') && clasesPastillas('carousel', 'grid').includes('md:snap-x'), 'grid + carrusel escritorio')
check(layoutMovilCategorias('inherit') === 'carousel' && layoutMovilCategorias('') === 'carousel', 'inherit/vacío = carril')
check(clasesCirculosMovil('list').includes('flex-col') && clasesCirculosMovil('grid').includes('grid-cols-2') && clasesCirculosMovil(undefined).startsWith('flex gap-4 overflow-x-auto pb-2 md:hidden'), 'círculos en celular')
check(!clasesPastillas('carousel').includes('md:flex-wrap'), 'pastilla en carrusel: una sola fila en escritorio')
check(clasesPastillas('carousel').includes('snap-x'), 'pastilla en carrusel: con snap')

if (problemas.length) {
  console.error(`verify-estilo-categoria: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-estilo-categoria: ${casos} casos`)
