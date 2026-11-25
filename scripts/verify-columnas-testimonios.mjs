/**
 * verify-columnas-testimonios.mjs — columnas por dispositivo de los testimonios (y beneficios de la
 * ficha): nunca las columnas del computador en el celular.
 *
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-columnas-testimonios.mjs
 *
 * El bug (QA 2026-11-25, org 338, celular de ~390 px): `gridColumnsClass` armaba
 * «grid-cols-1 grid-cols-2 grid-cols-3» sin prefijos de breakpoint; en la hoja de Tailwind gana la
 * última, así que la sección «Grid» salía en 3 columnas de ~90 px en el celular, con el texto de
 * una palabra por línea, las estrellas fuera de la tarjeta y el nombre cortado.
 *
 * Qué comprueba:
 *  1. Contrato (`seccionesTienda.ts`, copia del ERP): sin claves, Grid = 1 por fila en el celular,
 *     Carrusel = carrusel deslizable; tableta = min(computador, 2); `columns_tablet` 1–3 y
 *     `columns_mobile` 1 / 2 / carousel; el `{ desktop, tablet, mobile }` viejo se sigue leyendo.
 *  2. Clases: para TODA combinación, una sola clase de columnas sin prefijo (la del celular) y con
 *     1 o 2 columnas; tableta con `md:` y computador con `lg:`. Cada clase está escrita literal en el
 *     fuente (Tailwind solo emite las que encuentra así).
 *  3. Pintado (React en el servidor, sucrase como en verify-portada-tienda): la sección de la
 *     captura (Grid, sin `columns`, 3 testimonios) sale con 1 columna en el celular, estrellas que
 *     bajan de línea, nombre y cargo en hasta 2 líneas (sin `truncate`). El Carrusel, deslizable en
 *     el celular, con región enfocable y nombrada.
 *  4. Beneficios de la ficha: con 3 o 4 columnas, como mucho 2 en el celular.
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'package.json'))
const Module = require('module')
const { transform } = require('sucrase')

const resolverOriginal = Module._resolveFilename
Module._resolveFilename = function (pedido, padre, ...resto) {
  const p = pedido.startsWith('@/') ? join(ROOT, pedido.slice(2)) : pedido
  return resolverOriginal.call(this, p, padre, ...resto)
}
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, archivo) => {
    const { code } = transform(readFileSync(archivo, 'utf8'), {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: archivo,
    })
    m._compile(code, archivo)
  }
}
process.env.NODE_ENV = 'production'
const cargaOriginal = Module._load
Module._load = function (pedido, padre, ...resto) {
  const real = cargaOriginal.call(this, pedido, padre, ...resto)
  if (pedido === 'next/navigation') return { ...real, useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }) }
  return real
}

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const h = React.createElement
const cargar = (ruta) => require(join(ROOT, ruta))
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8').replace(/\r\n/g, '\n')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── 1. Contrato ─────────────────────────────────────────────────────────────────────────────
const { columnasTestimonios, celularPorDefectoTestimonios, CLAVES_AJUSTE_TIENDA } = cargar('lib/website/v2/contrato/seccionesTienda.ts')
check(igual(columnasTestimonios({}, 'grid'), { escritorio: 3, tableta: 2, celular: '1' }), 'Grid sin claves: 3 / 2 / 1 por fila')
check(igual(columnasTestimonios({}, 'carousel'), { escritorio: 3, tableta: 2, celular: 'carousel' }), 'Carrusel sin claves: 3 / 2 / carrusel en el celular')
check(igual(columnasTestimonios(null, 'grid'), { escritorio: 3, tableta: 2, celular: '1' }), 'sin contenido: los de siempre')
check(columnasTestimonios({ columns: 1 }, 'grid').tableta === 1, 'computador en 1: tableta en 1')
check(columnasTestimonios({ columns: 4 }, 'grid').tableta === 2 && columnasTestimonios({ columns: 4 }, 'grid').escritorio === 4, 'computador en 4: tableta en 2')
check(columnasTestimonios({ columns: '5' }, 'grid').escritorio === 5, '`columns` como texto se lee')
check(columnasTestimonios({ columns: 9 }, 'grid').escritorio === 3, '`columns` fuera de 1–6: el de siempre (3)')
check(columnasTestimonios({ columns_tablet: '3' }, 'grid').tableta === 3, 'columns_tablet «3»')
check(columnasTestimonios({ columns_tablet: 4 }, 'grid').tableta === 2, 'columns_tablet fuera de 1–3: el de siempre')
check(columnasTestimonios({ columns_mobile: '2' }, 'grid').celular === '2', 'columns_mobile «2»')
check(columnasTestimonios({ columns_mobile: 2 }, 'carousel').celular === '2', 'columns_mobile 2 (número)')
check(columnasTestimonios({ columns_mobile: 'carousel' }, 'grid').celular === 'carousel', 'Grid con carrusel en el celular')
check(columnasTestimonios({ columns_mobile: '1' }, 'carousel').celular === '1', 'Carrusel con 1 por fila en el celular')
check(columnasTestimonios({ columns_mobile: 3 }, 'grid').celular === '1', 'columns_mobile 3: nunca 3 en el celular (el de siempre)')
check(igual(columnasTestimonios({ columns: { desktop: 4, tablet: 3, mobile: 2 } }, 'grid'), { escritorio: 4, tableta: 3, celular: '2' }), 'el objeto viejo { desktop, tablet, mobile } se sigue leyendo')
check(celularPorDefectoTestimonios('quotes') === '1' && celularPorDefectoTestimonios('carousel') === 'carousel', 'por defecto del celular por variante')
check(['columns_tablet', 'columns_mobile'].every((k) => CLAVES_AJUSTE_TIENDA.testimonials.includes(k)), 'las claves nuevas están en CLAVES_AJUSTE_TIENDA')

// ── 2. Clases ───────────────────────────────────────────────────────────────────────────────
const { clasesColumnasTestimonios, gridColumnsClass, atributosCarruselCelular, CLASE_ESTRELLAS } = cargar('components/sections/testimonials/testimonialsUtils.ts')
const fuenteUtils = leer('components/sections/testimonials/testimonialsUtils.ts')
const columnasDe = (clases) => clases.split(/\s+/).filter((c) => /(^|:)grid-cols-\d+$/.test(c))
let combinaciones = 0
for (const variante of ['grid', 'carousel']) {
  for (const columns of [undefined, 1, 2, 3, 4, 5, 6]) {
    for (const columns_tablet of [undefined, '1', '2', '3']) {
      for (const columns_mobile of [undefined, '1', '2', 'carousel']) {
        combinaciones++
        const content = { columns, columns_tablet, columns_mobile }
        const { lista, tarjeta, carruselCelular } = clasesColumnasTestimonios(content, variante)
        const cols = columnasDe(lista)
        const base = cols.filter((c) => !c.includes(':'))
        const md = cols.filter((c) => c.startsWith('md:'))
        const lg = cols.filter((c) => c.startsWith('lg:'))
        const nombre = `${variante} ${JSON.stringify(content)}`
        const esperado = columnasTestimonios(content, variante)
        if (carruselCelular) {
          check(esperado.celular === 'carousel' && base.length === 0 && /(^| )flex( |$)/.test(lista) && lista.includes('snap-x') && lista.includes('md:grid'), `${nombre}: carrusel en el celular y rejilla desde md`)
          check(tarjeta.includes('w-[85%]') && tarjeta.includes('md:w-auto'), `${nombre}: en el carrusel la siguiente tarjeta asoma (85 %)`)
        } else {
          check(base.length === 1 && Number(base[0].split('-').pop()) <= 2 && base[0] === `grid-cols-${esperado.celular}`, `${nombre}: una sola clase sin prefijo y de 1 o 2 columnas (${lista})`)
          check(tarjeta === '', `${nombre}: sin ancho fijo de tarjeta en la rejilla`)
        }
        check(md.length === 1 && md[0] === `md:grid-cols-${esperado.tableta}`, `${nombre}: tableta con md: (${lista})`)
        check(lg.length === 1 && lg[0] === `lg:grid-cols-${esperado.escritorio}`, `${nombre}: computador con lg: (${lista})`)
        for (const c of cols) check(fuenteUtils.includes(`'${c}'`), `${c}: escrita literal en testimonialsUtils.ts (Tailwind la emite)`)
      }
    }
  }
}
check(combinaciones === 224, 'se probaron todas las combinaciones')
check(gridColumnsClass(undefined) === 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', `gridColumnsClass por defecto: 1 / md:2 / lg:3 (${gridColumnsClass(undefined)})`)
check(gridColumnsClass(4) === 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4', 'gridColumnsClass(4)')
check(!/(^|\s)grid-cols-[3-9]/.test(gridColumnsClass({ desktop: 6, tablet: 3, mobile: 5 })), 'gridColumnsClass nunca da 3+ columnas sin prefijo')
check(CLASE_ESTRELLAS.includes('flex-wrap') && CLASE_ESTRELLAS.includes('max-w-full'), 'las estrellas bajan de línea en vez de salirse')
check(igual(atributosCarruselCelular('  Opiniones '), { role: 'region', 'aria-label': 'Opiniones', tabIndex: 0 }), 'carrusel: región nombrada y enfocable')
check(atributosCarruselCelular(undefined)['aria-label'] === 'Testimonios', 'carrusel sin título: «Testimonios»')

// ── 3. Pintado ──────────────────────────────────────────────────────────────────────────────
const { TestimonialsGrid } = cargar('components/sections/testimonials/TestimonialsGrid.tsx')
const { TestimonialsCarousel } = cargar('components/sections/testimonials/TestimonialsCarousel.tsx')
const pintar = (C, content) => renderToStaticMarkup(h(C, { content, primaryColor: '#123456', data: {} }))
const claseDe = (html, marca) => {
  const i = html.indexOf(marca)
  if (i < 0) return ''
  const abre = html.lastIndexOf('class="', i)
  return html.slice(abre + 7, html.indexOf('"', abre + 7))
}
// La sección de la captura: Grid, sin `columns`, 4 testimonios y «Cantidad a mostrar» 3.
const CAPTURA = {
  title: 'Lo que dicen nuestros clientes',
  data_source: 'manual',
  max_items: 3,
  items: [
    { id: 'a', name: 'Cliente con un nombre largo de verdad', role: 'Una ciudad con nombre compuesto', rating: 5, content: 'Texto de una reseña bastante larga para ver cómo se acomoda en la tarjeta.' },
    { id: 'b', name: 'Cliente B', role: 'Ciudad B', rating: 5, content: 'Otra reseña.' },
    { id: 'c', name: 'Cliente C', role: 'Ciudad C', rating: 4, content: 'Otra más.' },
    { id: 'd', name: 'Cliente D', role: 'Ciudad D', rating: 5, content: 'La cuarta no sale.' },
  ],
}
const htmlGrid = pintar(TestimonialsGrid, CAPTURA)
const contenedorGrid = (htmlGrid.match(/<div class="(grid [^"]*)"/) || [])[1] || ''
check(/(^| )grid-cols-1( |$)/.test(contenedorGrid) && contenedorGrid.includes('md:grid-cols-2') && contenedorGrid.includes('lg:grid-cols-3'), `captura (Grid): 1 columna en el celular, 2 en tableta y 3 en computador («${contenedorGrid}»)`)
check(!/(^| )grid-cols-[23]( |$)/.test(contenedorGrid), 'captura (Grid): nada de 2 o 3 columnas sin prefijo')
check((htmlGrid.match(/★/g) || []).length === 14, 'captura (Grid): 3 tarjetas con sus estrellas (5 + 5 + 4)')
check(claseDe(htmlGrid, '>★<').includes('flex-wrap') || htmlGrid.includes(CLASE_ESTRELLAS), 'captura (Grid): la fila de estrellas hace flex-wrap')
const nombre = claseDe(htmlGrid, '>Cliente con un nombre largo de verdad<')
const cargo = claseDe(htmlGrid, '>Una ciudad con nombre compuesto<')
check(nombre.includes('line-clamp-2') && !nombre.includes('truncate'), `captura (Grid): nombre completo en hasta 2 líneas («${nombre}»)`)
check(cargo.includes('line-clamp-2') && !cargo.includes('truncate'), `captura (Grid): cargo completo en hasta 2 líneas («${cargo}»)`)
check(/class="relative min-w-0 bg-white/.test(htmlGrid), 'captura (Grid): la tarjeta encoge con la columna (min-w-0) y ancla las comillas de fondo (relative)')
check(!htmlGrid.includes('La cuarta no sale'), 'captura (Grid): «Cantidad a mostrar» 3 se respeta')
check(!htmlGrid.includes('role="region"'), 'Grid con 1 por fila: sin región de carrusel')

const htmlGridCarrusel = pintar(TestimonialsGrid, { ...CAPTURA, columns_mobile: 'carousel' })
check(htmlGridCarrusel.includes('role="region"') && htmlGridCarrusel.includes('aria-label="Lo que dicen nuestros clientes"') && htmlGridCarrusel.includes('tabindex="0"'), 'Grid con carrusel en el celular: región nombrada y enfocable')
check(htmlGridCarrusel.includes('w-[85%]') && htmlGridCarrusel.includes('snap-start'), 'Grid con carrusel en el celular: la siguiente tarjeta asoma')
const htmlGrid2 = pintar(TestimonialsGrid, { ...CAPTURA, columns: 4, columns_tablet: '3', columns_mobile: '2' })
check(/class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4/.test(htmlGrid2), 'Grid 2 / 3 / 4 se pinta tal cual')

const htmlCarrusel = pintar(TestimonialsCarousel, { title: 'Opiniones', items: CAPTURA.items.slice(0, 3) })
check(/class="flex overflow-x-auto snap-x/.test(htmlCarrusel) && htmlCarrusel.includes('md:grid-cols-2') && htmlCarrusel.includes('lg:grid-cols-3'), 'Carrusel: deslizable en el celular, 2 en tableta, 3 en computador')
check(htmlCarrusel.includes('role="region"') && htmlCarrusel.includes('aria-label="Opiniones"') && htmlCarrusel.includes('tabindex="0"'), 'Carrusel: región nombrada y enfocable (teclado)')
check((htmlCarrusel.match(/w-\[85%\]/g) || []).length === 3, 'Carrusel: cada tarjeta mide 85 % y asoma la siguiente')
check(!/sm:flex-shrink-1|sm:grid /.test(htmlCarrusel), 'Carrusel: sin las clases viejas (sm:grid, sm:flex-shrink-1 inexistente)')
const htmlCarrusel1 = pintar(TestimonialsCarousel, { items: CAPTURA.items.slice(0, 3), columns_mobile: '1' })
check(/class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3/.test(htmlCarrusel1) && !htmlCarrusel1.includes('w-[85%]'), 'Carrusel con 1 por fila en el celular')
check(!/>Cliente [A-Z]?[^<]*<\/span>/.test(htmlCarrusel) && claseDe(htmlCarrusel, '>Cliente B<').includes('line-clamp-2'), 'Carrusel: nombre en hasta 2 líneas')

// ── 4. Beneficios de la ficha ───────────────────────────────────────────────────────────────
const beneficios = leer('components/sections/product-detail/ProductBenefits.tsx')
check(beneficios.includes('COLS_BASE[Math.min(Number(columns) || 2, 2)]') && beneficios.includes("COLS_ESCRITORIO[Number(columns)] ?? 'md:grid-cols-2'"), 'beneficios (de siempre): como mucho 2 en el celular y las elegidas desde md')
check(beneficios.includes('COLS_BASE[o.columnasCelular ?? Math.min(o.columnas, 2)]'), 'beneficios (con opciones): sin «Columnas en celular», como mucho 2 en el celular')

if (problemas.length) {
  console.error(`verify-columnas-testimonios: ${problemas.length} problema(s) en ${casos} comprobaciones`)
  for (const p of problemas.slice(0, 40)) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`verify-columnas-testimonios: ${casos} comprobaciones en verde`)
