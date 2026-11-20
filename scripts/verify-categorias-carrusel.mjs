/**
 * verify-categorias-carrusel.mjs — carrusel por páginas de la rejilla de categorías («Círculo» y
 * «Pastilla» con `desktop_layout: 'carousel'` y `desktop_rows` / `mobile_rows`).
 *
 *   npm run verify:categorias-carrusel
 *
 * 1. Paginación pura: `chunkArray` (movida a lib/website/estiloCategoria.ts), `paginasCategorias`
 *    (columnas × filas por lado; `mobile_layout` ausente o `inherit` hereda el de escritorio),
 *    página según el desplazamiento y tras un arrastre con el mouse.
 * 2. Opciones del panel «Carrusel» (`content.carrusel` con `usar_global: false`, o el del sitio):
 *    defaults sin nada guardado (flechas y puntos, sin avance automático ni bucle) y lectura de
 *    flechas, indicador, avance automático y bucle; índice siguiente/anterior con y sin bucle.
 * 3. Fuente: EstilosCategoria usa la paginación, flechas y puntos en el primario, CategoriesGrid
 *    importa chunkArray, accesibilidad de flechas y puntos.
 * 4. Render (react-dom/server): sin filas o sin layout carrusel el HTML es idéntico al de HEAD;
 *    con filas, el caso del dueño (org 358, círculos 2×6 / 2×3): páginas de 12 y de 6.
 *
 * Datos sintéticos; sin red ni base de datos.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const e = await import('../lib/website/estiloCategoria.ts')
const c = await import('../lib/website/carruselCategorias.ts')
const oc = await import('../lib/carrusel/opcionesCarrusel.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8').replace(/\r\n/g, '\n')
const contar = (texto, trozo) => texto.split(trozo).length - 1

// ─── 1. Paginación ──────────────────────────────────────────────────────────────────────────
const items = Array.from({ length: 58 }, (_, i) => i + 1)
const p12 = e.chunkArray(items, 12)
igual(p12.map((p) => p.length), [12, 12, 12, 12, 10], '58 a 2×6: 5 páginas, la última de 10')
igual(p12.flat(), items, '2×6 conserva el orden y no pierde ninguna')
const p6 = e.chunkArray(items, 6)
igual(p6.length, 10, '58 a 2×3: 10 páginas')
igual(p6[9], [55, 56, 57, 58], '2×3: la última página trae las 4 que sobran')
igual(e.chunkArray(items, 0), [items], 'tamaño 0: una sola página (una fila como hoy)')
igual(e.chunkArray(items, 100), [items], 'cabe todo: una sola página')
igual(e.chunkArray([], 6), [[]], 'sin ítems: una página vacía')

const DUENO = { desktop_layout: 'carousel', desktop_columns: 6, desktop_rows: 2, mobile_columns: 3, mobile_rows: 2 }
igual(e.paginasCategorias('circle', DUENO), { escritorio: { columnas: 6, filas: 2, porPagina: 12 }, movil: { columnas: 3, filas: 2, porPagina: 6 } }, 'caso del dueño: 12 por página en escritorio y 6 en el celular')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel' }), { escritorio: null, movil: null }, 'sin filas: el carril de una fila de hoy')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: 0, mobile_rows: 0 }), { escritorio: null, movil: null }, 'filas en 0: el carril de hoy')
igual(e.paginasCategorias('pill', {}), { escritorio: null, movil: null }, 'sin claves: lo de hoy')
igual(e.paginasCategorias('circle', { desktop_layout: 'grid', desktop_rows: 2, mobile_rows: 2 }), { escritorio: null, movil: null }, 'rejilla con filas: no es carrusel (y el celular hereda la rejilla)')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: 2, mobile_layout: 'inherit', mobile_rows: 2 }).movil?.porPagina, 6, '`inherit` hereda el carrusel de escritorio')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: 2, mobile_layout: 'grid', mobile_rows: 2 }).movil, null, 'celular en rejilla: el celular como hoy')
igual(e.paginasCategorias('circle', { desktop_layout: 'grid', mobile_layout: 'carousel', mobile_rows: 3 }), { escritorio: null, movil: { columnas: 3, filas: 3, porPagina: 9 } }, 'solo el celular en carrusel con filas')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: 2, mobile_rows: 1 }), { escritorio: { columnas: 6, filas: 2, porPagina: 12 }, movil: { columnas: 3, filas: 1, porPagina: 3 } }, 'círculos sin columnas: 6 y 3')
igual(e.paginasCategorias('pill', { desktop_layout: 'carousel', desktop_rows: 3, mobile_rows: 4 }), { escritorio: { columnas: 4, filas: 3, porPagina: 12 }, movil: { columnas: 2, filas: 4, porPagina: 8 } }, 'pastillas sin columnas: 4 y 2')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: '2', desktop_columns: '5' }).escritorio, { columnas: 5, filas: 2, porPagina: 10 }, 'números guardados como texto')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: 10, desktop_columns: 20, mobile_rows: 9, mobile_columns: 9 }), { escritorio: { columnas: 8, filas: 6, porPagina: 48 }, movil: { columnas: 4, filas: 6, porPagina: 24 } }, 'acotado: 8 columnas y 6 filas en escritorio, 4 columnas en el celular')
igual(e.paginasCategorias('circle', { desktop_layout: 'carousel', desktop_rows: -1, mobile_rows: 'x' }), { escritorio: null, movil: null }, 'filas inválidas: lo de hoy')
igual(e.layoutMovilEfectivo(undefined, 'carousel'), 'carousel', 'móvil ausente hereda escritorio')
igual(e.layoutMovilEfectivo('inherit', 'list'), 'list', 'inherit hereda escritorio')
igual(e.layoutMovilEfectivo(undefined, undefined), 'grid', 'sin nada: rejilla, como CategoriesGrid')
igual(e.layoutMovilEfectivo('grid', 'carousel'), 'grid', 'móvil propio manda')

igual([e.paginaDeScroll(0, 1000, 5), e.paginaDeScroll(1000, 1000, 5), e.paginaDeScroll(1490, 1000, 5), e.paginaDeScroll(1510, 1000, 5), e.paginaDeScroll(99999, 1000, 5)], [0, 1, 1, 2, 4], 'página según el desplazamiento')
igual([e.paginaDeScroll(500, 0, 5), e.paginaDeScroll(500, 1000, 1)], [0, 0], 'sin ancho o con una página: la primera')
igual([e.paginaTrasArrastre(0, -60, 5), e.paginaTrasArrastre(0, 60, 5), e.paginaTrasArrastre(4, -60, 5), e.paginaTrasArrastre(2, -10, 5), e.paginaTrasArrastre(2, 70, 5)], [1, 0, 4, 2, 1], 'arrastre con el mouse: siguiente, anterior o la misma; sin pasar los bordes')

// ─── 2. Opciones del panel «Carrusel» ───────────────────────────────────────────────────────
const def = c.opcionesCarruselCategorias(null, null, false)
igual(def, { activo: false, flechas: true, puntos: 'dots', autoplay: false, intervaloMs: 5000, loop: false, pausaHover: true, arrastre: true }, 'sin nada guardado: flechas y puntos, sin avance ni bucle')
igual(c.opcionesCarruselCategorias(null, null, true), { ...def }, 'sin nada guardado en el celular: igual')
igual(c.opcionesCarruselCategorias(null, { autoplay: true, loop: true }, false).autoplay, false, 'sección sin `usar_global: false` sigue al sitio (como el resto de carruseles)')
const sec = { usar_global: false, autoplay: true, segundos: 3, loop: true, indicador: 'ninguno', flechasEscritorio: false, pausaHover: false, arrastre: false, colorActivo: '#FF0000' }
const oEsc = c.opcionesCarruselCategorias(null, sec, false)
igual([oEsc.activo, oEsc.autoplay, oEsc.intervaloMs, oEsc.loop, oEsc.puntos, oEsc.flechas, oEsc.pausaHover, oEsc.arrastre, oEsc.colorActivo], [true, true, 3000, true, null, false, false, false, '#FF0000'], 'sección: avance cada 3 s, bucle, sin puntos ni flechas en escritorio')
igual(c.opcionesCarruselCategorias(null, sec, true).flechas, true, 'flechas del celular aparte (`flechasMovil`, por defecto sí)')
igual(c.opcionesCarruselCategorias(null, { usar_global: false, flechasMovil: false }, true).flechas, false, '`flechasMovil: false` las quita en el celular')
const glob = c.opcionesCarruselCategorias({ autoplay: true, loop: true, indicador: 'barra' }, null, false)
igual([glob.activo, glob.autoplay, glob.loop, glob.puntos], [true, true, true, 'bars'], 'ajuste del sitio: aplica a la sección que lo usa')
igual(c.opcionesCarruselCategorias({ autoplay: true }, { usar_global: false, autoplay: false }, false).autoplay, false, 'la sección pisa al sitio')
igual(c.opcionesCarruselCategorias(null, { usar_global: false, indicador: 'numeros' }, false).puntos, 'numbers', 'indicador en números')
igual(c.opcionesCarruselCategorias(null, { usar_global: false, indicador: 'progreso' }, false).puntos, 'dots', 'indicadores sin pieza propia aquí: puntos')
const basura = c.opcionesCarruselCategorias(null, { usar_global: false, autoplay: 'si', segundos: 99, indicador: 'estrellas', colorActivo: 'rojo' }, false)
igual([basura.autoplay, basura.intervaloMs, basura.puntos, basura.colorActivo], [false, 5000, 'dots', undefined], 'valores inválidos: los defaults')
igual([oc.indiceSiguiente(3, 5, false), oc.indiceSiguiente(4, 5, false), oc.indiceSiguiente(4, 5, true)], [4, null, 0], 'siguiente: sin bucle se detiene en la última; con bucle vuelve a la primera')
igual([oc.indiceAnterior(1, 5, false), oc.indiceAnterior(0, 5, false), oc.indiceAnterior(0, 5, true)], [0, null, 4], 'anterior: sin bucle se detiene en la primera; con bucle va a la última')
igual([oc.indiceSiguiente(0, 1, true), oc.indiceAnterior(0, 1, true)], [null, null], 'una sola página: no se mueve')

// ─── 3. Fuente ──────────────────────────────────────────────────────────────────────────────
const estilos = leer('components/sections/products/EstilosCategoria.tsx')
const carrusel = leer('components/sections/products/CarruselPaginasCategorias.tsx')
const grid = leer('components/sections/products/CategoriesGrid.tsx')
const controles = leer('components/site/carrusel/ControlesCarrusel.tsx')
const autoplayFuente = leer('lib/carrusel/useCarrusel.ts')
check(estilos.includes("paginasCategorias(estilo, content)"), 'EstilosCategoria calcula las páginas con paginasCategorias')
check(contar(estilos, 'chunkArray(categorias, paginas.movil.porPagina)') === 2 && contar(estilos, 'chunkArray(categorias, paginas.escritorio.porPagina)') === 2, 'círculos y pastillas paginan con chunkArray en los dos lados')
check(contar(estilos, '<CarruselPaginasCategorias') === 4, 'EstilosCategoria usa CarruselPaginasCategorias (círculo y pastilla, celular y escritorio)')
check(contar(estilos, 'color={color}\n            carruselSeccion={content.carrusel}') === 4, 'el carrusel recibe el primario y el panel «Carrusel» de la sección')
check(estilos.includes("const color = primaryColor || '#111827'"), 'color = primaryColor de la tienda')
check(estilos.includes('cuerpo = !paginas.movil && !paginas.escritorio ? hoy :'), 'pastillas sin filas: la rama de hoy tal cual')
check(estilos.includes("<div className={clasesCirculosMovil(content.mobile_layout)} style={{ scrollbarWidth: 'none' }}>") && estilos.includes("<div className={carrusel ? 'hidden gap-4 overflow-x-auto md:flex' : 'hidden gap-6 md:grid'}"), 'círculos sin filas: los contenedores de hoy')
check((estilos.match(/clasesPastillas\([^)]*content\.align\)/g) || []).length === 2, 'las pastillas de hoy siguen pasando align (verify:estilo-categoria)')
check(contar(carrusel, 'color={color}') === 4, 'las cuatro flechas en el color primario')
check(carrusel.includes('color={o.colorActivo || color}'), 'los puntos en el primario (o el color activo del panel)')
check(carrusel.includes('etiqueta={(i) => `Ir a la página ${i + 1}`}'), 'puntos: «Ir a la página N»')
check(controles.includes("aria-current={i === actual ? 'true' : undefined}") && controles.includes("aria-current={activo ? 'true' : undefined}"), 'punto activo con aria-current')
check(controles.includes("aria-label={etiqueta ?? (direccion === 'anterior' ? 'Anterior' : 'Siguiente')}"), 'flechas: «Anterior» / «Siguiente»')
check(carrusel.includes('onClick={siguiente}') && carrusel.includes('onClick={anterior}') && carrusel.includes('const ir = (i: number) => setActual(') && !carrusel.includes('scrollBy(') && !carrusel.includes('desplazarPagina('), 'las flechas cambian de página moviendo la pista (sin scroll nativo)')
check(carrusel.includes('indiceSiguiente(actual, total, o.loop)') && carrusel.includes('indiceAnterior(actual, total, o.loop)'), 'bucle con indiceSiguiente / indiceAnterior')
check(carrusel.includes('activo: o.autoplay && total > 1 && !tocado') && carrusel.includes('pausarAlPasar: o.pausaHover') && carrusel.includes('onTouchStart={() => setTocado(true)}'), 'avance automático: pausa con el mouse y se detiene al tocar')
check(autoplayFuente.includes("'(prefers-reduced-motion: reduce)'"), 'el avance automático respeta prefers-reduced-motion')
// 2026-11-20: pista con translate3d (el scroll suave con snap cambiaba casi en el sitio en Windows).
check(carrusel.includes('transform: `translate3d(calc(${-actual * 100}% + ${dx}px), 0, 0)`') && carrusel.includes('className="w-full shrink-0"'), 'páginas de 100 % sobre una pista con translate3d')
check(carrusel.includes("export const DURACION_MS = 480") && carrusel.includes("export const CURVA = 'cubic-bezier(0.22, 1, 0.36, 1)'"), 'paso de página de 480 ms con curva suave')
check(carrusel.includes("arrastrando ? 'none' : `transform ${reducido ? DURACION_REDUCIDA_MS : DURACION_MS}ms ${CURVA}`") && carrusel.includes('export const DURACION_REDUCIDA_MS = 200'), 'sin transición al arrastrar (1:1); con prefers-reduced-motion, un paso corto de 200 ms')
check(carrusel.includes("style={{ touchAction: 'pan-y' }}") && carrusel.includes('onPointerCancel={(e) => terminar(e, true)}'), 'el dedo solo toma el gesto horizontal; el vertical sigue siendo de la página')
check(carrusel.includes("if (e.pointerType === 'mouse' && !o.arrastre) return"), 'el arrastre con mouse respeta el panel')
check(carrusel.includes('onFocusCapture={alEnfocar}'), 'el foco del teclado lleva a la página de la categoría')
check(carrusel.includes('onPointerDown={alBajar}') && carrusel.includes('onClickCapture={alClic}') && carrusel.includes('const UMBRAL_CLIC = 6'), 'arrastre (más de 6 px) sin abrir la categoría al soltar')
check(/import \{[^}]*\bchunkArray\b[^}]*\} from '@\/lib\/website\/estiloCategoria'/.test(grid) && !grid.includes('function chunkArray'), 'CategoriesGrid importa chunkArray del módulo puro')
check(!/organization|org_id|organizationId/.test(carrusel), 'el carrusel no conoce organizaciones')

// ─── 4. Render ──────────────────────────────────────────────────────────────────────────────
// Grafo base: EstilosCategoria y estiloCategoria antes del carrusel por páginas (sin claves = hoy).
// Base: el commit anterior al carrusel por páginas (3bdf8d5). Contra HEAD ya no sirve: HEAD lo trae.
const BASE_REF = process.env.VERIFY_BASE || '3bdf8d5^'
const base = {}
for (const ruta of ['components/sections/products/EstilosCategoria.tsx', 'lib/website/estiloCategoria.ts']) {
  try {
    base[ruta] = execFileSync('git', ['show', `${BASE_REF}:${ruta}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch {
    check(false, `no se pudo leer ${ruta} en ${BASE_REF}`)
  }
}
register(pathToFileURL(join(ROOT, 'scripts/verify-categoria-plantilla.cargador.mjs')).href, import.meta.url, { data: { root: ROOT, base } })
const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
const url = pathToFileURL(join(ROOT, 'components/sections/products/EstilosCategoria.tsx')).href
const ACT = await import(url)
const BAS = Object.keys(base).length === 2 ? await import(`${url}?base`) : null
const enrutador = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }
const pintar = (m, props) => renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: enrutador }, React.createElement(m.EstilosCategoria, props)))

const CATS = Array.from({ length: 58 }, (_, i) => ({
  id: i + 1,
  name: `Categoría ${i + 1}`,
  slug: `categoria-${i + 1}`,
  icon: i % 3 === 0 ? 'smartphone' : null,
  color: i % 2 === 0 ? '#2563EB' : null,
  image_url: i % 5 === 0 ? `https://ejemplo.test/c${i + 1}.png` : null,
  product_count: i,
}))
const PRIMARIO = '#E11D48'

if (BAS) {
  const SIN = [
    {},
    { desktop_layout: 'carousel' },
    { desktop_layout: 'carousel', mobile_layout: 'grid' },
    { desktop_layout: 'carousel', mobile_layout: 'list', align: 'left', show_count: true },
    { desktop_layout: 'carousel', desktop_rows: 0, mobile_rows: 0 },
    { desktop_layout: 'grid', desktop_columns: 5, desktop_rows: 2, mobile_rows: 2 },
    { desktop_layout: 'carousel', mobile_layout: 'grid', mobile_rows: 2 },
    { desktop_layout: 'carousel', carrusel: { usar_global: false, autoplay: true, loop: true } },
    { title: 'Categorías', subtitle: 'Todo', show_view_all: true, card_hover: 'zoom' },
  ]
  let iguales = 0
  for (const estilo of ['circle', 'pill', 'card_bottom', 'bento', 'minimal_icon', 'title_top', 'text_list']) {
    for (const content of [...SIN, ...(estilo === 'circle' || estilo === 'pill' ? [] : [DUENO])]) {
      const props = { categorias: CATS.slice(0, 14), estilo, primaryColor: PRIMARIO, content: { ...content, category_style: estilo } }
      const a = pintar(ACT, props)
      const b = pintar(BAS, props)
      check(a === b, `${estilo} ${JSON.stringify(content)}: sin filas en carrusel el HTML cambió frente a ${BASE_REF}`)
      if (a === b) iguales++
    }
  }
  // Control: con filas sí cambia (si no, el grafo base no sería el de la referencia).
  const conFilas = { categorias: CATS.slice(0, 14), estilo: 'circle', primaryColor: PRIMARIO, content: { ...DUENO, category_style: 'circle' } }
  check(pintar(ACT, conFilas) !== pintar(BAS, conFilas), `con filas el HTML debe cambiar frente a ${BASE_REF} (si no, no hay carrusel por páginas)`)
  console.log(`  ✓ sin filas / sin carrusel = ${BASE_REF}: ${iguales} configuraciones idénticas`)
}

// Caso del dueño (org 358): círculos, 2 filas × 6 columnas en escritorio y 2 × 3 en el celular.
const html = pintar(ACT, { categorias: CATS, estilo: 'circle', primaryColor: PRIMARIO, content: { ...DUENO, category_style: 'circle', title: 'Categorías' } })
check(html.includes('data-carrusel-categorias="escritorio"') && html.includes('data-carrusel-categorias="movil"'), 'org 358: carrusel en escritorio y en el celular')
igual(contar(html, '" aria-label="Página '), 15, 'org 358: 5 páginas en escritorio + 10 en el celular')
check(html.includes('aria-label="Página 5 de 5"') && html.includes('aria-label="Página 10 de 10"'), 'org 358: «Página N de M»')
igual(contar(html, 'aria-label="Ir a la página '), 15, 'org 358: un punto por página')
igual(contar(html, 'aria-current="true"'), 2, 'org 358: un punto activo por carrusel')
igual(contar(html, 'href="/categorias/'), 116, 'org 358: las 58 categorías en cada lado')
const escritorio = html.slice(html.indexOf('data-carrusel-categorias="escritorio"'))
const primeraPagina = escritorio.slice(escritorio.indexOf('aria-label="Página 1 de 5"'), escritorio.indexOf('aria-label="Página 2 de 5"'))
igual([...primeraPagina.matchAll(/href="\/categorias\/categoria-(\d+)"/g)].map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'org 358: la primera página trae las 12 primeras, en su orden')
check(escritorio.includes('grid-template-columns:repeat(6, minmax(0, 1fr))') && html.includes('grid-template-columns:repeat(3, minmax(0, 1fr))'), 'org 358: 6 columnas en escritorio y 3 en el celular')
igual(contar(html, 'aria-label="Anterior"'), 2, 'org 358: flecha «Anterior» en cada carrusel')
igual(contar(html, 'aria-label="Siguiente"'), 2, 'org 358: flecha «Siguiente» en cada carrusel')
check(new RegExp(`aria-label="Anterior"[^>]*style="color:${PRIMARIO}"`).test(html) || new RegExp(`style="color:${PRIMARIO}"[^>]*aria-label="Anterior"`).test(html), 'flechas en el color primario')
check(new RegExp(`aria-current="true"[^>]*style="background-color:${PRIMARIO}"`).test(html) || new RegExp(`style="background-color:${PRIMARIO}"[^>]*aria-current="true"`).test(html), 'punto activo en el color primario')
check(/disabled=""[^>]*aria-label="Anterior"|aria-label="Anterior"[^>]*disabled=""/.test(html), 'sin bucle: «Anterior» deshabilitada en la primera página')
check(html.includes('aria-label="Categorías"') && html.includes('aria-roledescription="carrusel"'), 'región con nombre y descripción de carrusel')
check(html.includes('smartphone') || html.includes('<svg'), 'el ícono de la categoría se sigue pintando')

const conBucle = pintar(ACT, { categorias: CATS, estilo: 'circle', primaryColor: PRIMARIO, content: { ...DUENO, category_style: 'circle', carrusel: { usar_global: false, loop: true } } })
check(!/disabled=""[^>]*aria-label="Anterior"|aria-label="Anterior"[^>]*disabled=""/.test(conBucle), 'con bucle: «Anterior» habilitada en la primera página')
const sinControles = pintar(ACT, { categorias: CATS, estilo: 'circle', primaryColor: PRIMARIO, content: { ...DUENO, category_style: 'circle', carrusel: { usar_global: false, flechasEscritorio: false, flechasMovil: false, indicador: 'ninguno' } } })
check(!sinControles.includes('aria-label="Anterior"') && !sinControles.includes('Ir a la página'), 'panel sin flechas ni indicador: no se pintan')
check(sinControles.includes('aria-label="Página 5 de 5"'), 'sin controles las páginas siguen ahí (se desliza)')
const unaPagina = pintar(ACT, { categorias: CATS.slice(0, 10), estilo: 'circle', primaryColor: PRIMARIO, content: { desktop_layout: 'carousel', desktop_rows: 2, desktop_columns: 6, mobile_layout: 'grid', category_style: 'circle' } })
check(unaPagina.includes('aria-label="Página 1 de 1"') && !unaPagina.includes('aria-label="Siguiente"') && !unaPagina.includes('Ir a la página'), '10 categorías en 2×6: una página, sin flechas ni puntos')
const pastillas = pintar(ACT, { categorias: CATS.slice(0, 20), estilo: 'pill', primaryColor: PRIMARIO, content: { desktop_layout: 'carousel', desktop_rows: 2, desktop_columns: 4, mobile_layout: 'grid', category_style: 'pill' } })
check(pastillas.includes('data-carrusel-categorias="escritorio"') && !pastillas.includes('data-carrusel-categorias="movil"') && pastillas.includes('<div class="md:hidden">'), 'pastillas con filas solo en escritorio: el celular como hoy')
igual(contar(pastillas, '" aria-label="Página '), 3, 'pastillas 20 en 2×4: 3 páginas')

if (problemas.length) {
  console.error(`✗ verify-categorias-carrusel: ${problemas.length} de ${casos} comprobaciones fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`verify-categorias-carrusel: ${casos} casos`)
