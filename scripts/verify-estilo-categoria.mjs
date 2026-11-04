/**
 * verify-estilo-categoria.mjs — sin category_style no hay variante nueva.
 *
 *   npm run verify:estilo-categoria
 */
import { MASCARA_CARRIL, ajusteImagenCategoria, alineacionPastillas, clasesCirculosMovil, clasesPastillas, layoutMovilCategorias, estiloCategoria, planBento } from '../lib/website/estiloCategoria.ts'
import { readFileSync } from 'node:fs'

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
check(clasesPastillas(undefined, undefined, 'left') === `flex gap-3 overflow-x-auto pb-2 md:flex-wrap ${MASCARA_CARRIL}`, 'pastilla sin layout a la izquierda: clases de siempre + degradado')
check(clasesPastillas(undefined) === `flex gap-3 overflow-x-auto pb-2 md:flex-wrap ${MASCARA_CARRIL} md:justify-center`, 'pastilla sin layout: centrada en escritorio (por defecto)')
check(clasesPastillas('grid', undefined, 'left') === `flex gap-3 overflow-x-auto pb-2 md:flex-wrap ${MASCARA_CARRIL}`, 'pastilla en grid a la izquierda: clases de siempre + degradado')
check(MASCARA_CARRIL.includes('md:[mask-image:none]'), 'degradado solo en celular')
check(clasesPastillas(undefined, 'list', 'left') === 'flex flex-col gap-2 md:flex-row md:flex-wrap', 'pastilla list en celular')
check(clasesPastillas(undefined, 'list') === 'flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-center', 'pastilla list: centrada en escritorio')
check(clasesPastillas(undefined, 'grid', 'left') === 'grid grid-cols-2 gap-2 md:flex md:flex-wrap', 'pastilla grid en celular')
check(clasesPastillas('carousel', 'list').includes('md:overflow-x-auto') && !clasesPastillas('carousel', 'list').includes('md:flex-wrap'), 'list + carrusel escritorio')
check(clasesPastillas('carousel', 'grid').startsWith('grid grid-cols-2') && clasesPastillas('carousel', 'grid').includes('md:snap-x'), 'grid + carrusel escritorio')
check(layoutMovilCategorias('inherit') === 'carousel' && layoutMovilCategorias('') === 'carousel', 'inherit/vacío = carril')
check(clasesCirculosMovil('list').includes('flex-col') && clasesCirculosMovil('grid').includes('grid-cols-2') && clasesCirculosMovil(undefined).startsWith('flex gap-4 overflow-x-auto pb-2 md:hidden'), 'círculos en celular')
check(!clasesPastillas('carousel').includes('md:flex-wrap'), 'pastilla en carrusel: una sola fila en escritorio')
check(clasesPastillas('carousel').includes('snap-x'), 'pastilla en carrusel: con snap')

// Alineación (4-nov): centradas por defecto; en carrusel «safe center» (centradas si caben, si no a la izquierda)
check(alineacionPastillas(undefined) === 'center' && alineacionPastillas('left') === 'left' && alineacionPastillas('raro') === 'center', 'align: center por defecto, left a pedido')
for (const ml of [undefined, 'list', 'grid']) {
  const c = clasesPastillas('carousel', ml)
  check(c.endsWith(' md:[justify-content:safe_center]') && !c.includes('md:justify-center'), `carrusel ${ml ?? 'carril'}: safe center (no esconde las primeras si desborda)`)
  check(!clasesPastillas('carousel', ml, 'left').includes('justify'), `carrusel ${ml ?? 'carril'} a la izquierda: sin centrar`)
  check(clasesPastillas('grid', ml).endsWith(' md:justify-center'), `filas ${ml ?? 'carril'}: md:justify-center`)
}
check(!clasesPastillas('carousel').split(' ').some((c) => c === 'justify-center' || c.startsWith('[justify')), 'en el celular el carril no se centra')
const carrusel = readFileSync(new URL('../components/sections/products/CarruselPastillas.tsx', import.meta.url), 'utf8')
check(carrusel.includes('const hayDesborde = el.scrollWidth > el.clientWidth + 1') && carrusel.includes('setDer(hayDesborde &&') && carrusel.includes('setIzq(hayDesborde &&'), 'CarruselPastillas: flechas solo si desborda')
const estilos = readFileSync(new URL('../components/sections/products/EstilosCategoria.tsx', import.meta.url), 'utf8')
check((estilos.match(/clasesPastillas\([^)]*content\.align\)/g) || []).length === 2, 'EstilosCategoria pasa align a las dos ramas')

if (problemas.length) {
  console.error(`verify-estilo-categoria: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-estilo-categoria: ${casos} casos`)
