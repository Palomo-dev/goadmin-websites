/**
 * verify-vista-lista.mjs — vista «Lista» de productos con columnas del editor.
 *
 *   npm run verify:vista-lista
 *
 * 1. Regla (lib/products/fuenteListado.ts): columns_desktop / columns_tablet / columns_mobile →
 *    1 columna en celular (salvo 2 pedidas), tablet lo pedido o hasta 2, escritorio hasta 4. Sin
 *    columnas (o 1): `null` = la lista de una columna de siempre.
 * 2. ProductsList, SiLista/ListRenderer (modo lista), ProductsGrid y las páginas de categoría usan
 *    la regla; sin columnas todo queda como antes.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const f = await import('../lib/products/fuenteListado.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, e, msg) => check(JSON.stringify(a) === JSON.stringify(e), `${msg}: esperado ${JSON.stringify(e)}, obtenido ${JSON.stringify(a)}`)

// 1. Regla
igual(f.columnasVistaLista({}), null, 'sin columnas: una columna (lo de hoy)')
igual(f.columnasVistaLista({ desktop: 1 }), null, '1 en escritorio: una columna')
igual(f.columnasVistaLista({ desktop: 2 }), { movil: 1, tablet: 2, escritorio: 2 }, '2 en escritorio: 1 en celular, 2 en tablet')
igual(f.columnasVistaLista({ desktop: 3 }), { movil: 1, tablet: 2, escritorio: 3 }, '3 en escritorio: tablet hasta 2')
igual(f.columnasVistaLista({ desktop: 6 }), { movil: 1, tablet: 2, escritorio: 4 }, 'escritorio con tope 4')
igual(f.columnasVistaLista({ desktop: 2, tablet: 1, mobile: 2 }), { movil: 2, tablet: 1, escritorio: 2 }, 'respeta lo pedido en tablet y celular')
igual(f.columnasVistaLista({ desktop: '2' }), { movil: 1, tablet: 2, escritorio: 2 }, 'número guardado como texto')
igual(f.columnasVistaLista({ desktop: 0, tablet: 'x' }), null, 'basura = lo de hoy')
igual(f.columnasVistaLista({ tablet: 2 }), { movil: 1, tablet: 2, escritorio: 1 }, 'solo tablet')
igual(f.clasesVistaLista({ desktop: 2 }), 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4', 'clases de 2 columnas en computador')
igual(f.clasesVistaLista({}), null, 'sin columnas: sin rejilla')

// 2. Uso
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8').replace(/\r\n/g, '\n')
const pl = fuente('components/sections/products/ProductsList.tsx')
check(pl.includes('desktop: content.columns_desktop ?? content.desktop_columns ?? content.columns,') && pl.includes('tablet: content.columns_tablet,') && pl.includes('mobile: content.columns_mobile,'), 'ProductsList lee columns_desktop / tablet / mobile (y las claves de antes)')
check(pl.includes("className={claseRejilla ? `${claseRejilla} max-w-6xl mx-auto` : 'space-y-4 max-w-4xl mx-auto'}"), 'ProductsList: 2+ columnas a 6xl; una columna como siempre')
check(!pl.includes('gridTemplateColumns: `repeat(${Math.min(cols, 4)}'), 'ProductsList ya no fuerza las mismas columnas en celular')
const lr = fuente('components/sections/ListRenderer.tsx')
check(lr.includes("const listaConColumnas = lista.mode === 'list'") && lr.includes('grid-template-columns:repeat(${listaConColumnas.movil},minmax(0,1fr))') && lr.includes('@media(min-width:1024px){[data-lista="${id}"]{grid-template-columns:repeat(${listaConColumnas.escritorio}'), 'ListRenderer: lista con columnas = rejilla responsive')
check(lr.includes('`[data-lista="${id}"]{display:flex;flex-direction:column;gap:${gap}px}`'), 'ListRenderer: lista sin columnas, como antes')
const pg = fuente('components/sections/products/ProductsGrid.tsx')
check(pg.includes("? (clasesVistaLista({ desktop: presentacion.columnsDesktop, tablet: presentacion.columnsTablet, mobile: presentacion.columnsMobile }) ?? 'flex flex-col gap-4')"), 'ProductsGrid: lista con columnas o la de siempre')
for (const r of ['app/categorias/[slug]/CategoryPageClient.tsx', 'components/sections/category-detail/CategoryProducts.tsx']) {
  check(fuente(r).includes('<div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={separacion} data-vista-lista="">'), `${r}: vista lista en 2 columnas en computador, 1 en celular`)
}
check(fuente('components/sections/products/CarruselPaginasCategorias.tsx').includes('className="flex select-none will-change-transform"'), 'carrusel de categorías: arrastrar no sombrea el texto')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ vista lista: ${casos} comprobaciones`)
