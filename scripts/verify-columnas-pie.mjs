/**
 * verify-columnas-pie.mjs — títulos y rejilla de las columnas del pie (SiteFooter y PieTema).
 *
 *   npm run verify:columnas-pie
 *
 * Caso de partida (org 358, plantilla retail_modern, 2026-11-21): en escritorio todas las columnas
 * de enlaces decían «Enlaces», salía una columna vacía y la legal caía a una segunda fila. Los menús
 * ya tenían nombre en el documento publicado, pero el sitio lo ignoraba.
 *
 * 1. Lógica pura (lib/website/columnasPie.ts): título del menú de páginas del pie («Tienda» solo sin
 *    nombre o con «Páginas del pie»), título de cada menú (su nombre), menús sin enlaces fuera,
 *    rejilla calculada con las columnas pintadas (sin huecos ni filas de más).
 * 2. paginasPieDesdeDocumento (lib/website/v2/vistaPublica.ts): el nombre guardado del menú
 *    `paginas-pie`, null si el pie no lo incluye.
 * 3. Render (react-dom/server) de SiteFooter con documentos con la forma de los publicados (etiquetas
 *    inventadas, sin nombres de clientes): composición default legacy (org 358), centrada (org 341),
 *    PieTema con y sin `paginas-pie` (orgs 338 / 335 / 388), legacy sin sitio V2, three_columns y
 *    split. Se comprueban los títulos, la rejilla y que no quede ningún «Enlaces» fijo.
 * 4. Pie igual en todas las páginas (lib/website/pieSitio.ts, lo usa OrganizationLayout): una
 *    página que no es la comodín (producto, carrito…) recibe los mismos menús y pinta el MISMO pie
 *    que la comodín; la comodín (ya trae `menus`) no lee nada más; legacy y fallos.
 * 5. Fuente: OrganizationLayout resuelve el pie y lo pasa hasta SiteFooter; la comodín siempre
 *    pasa `menus`; SiteFooter ya no tiene títulos «Enlaces» fijos ni fuerza «Categorías» con
 *    `show_categories_in_header`.
 *
 * Datos sintéticos; sin red ni base de datos.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-categoria-plantilla.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, base: {} },
})

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8').replace(/\r\n/g, '\n')

const cp = await import('../lib/website/columnasPie.ts')
const vp = await import('../lib/website/v2/vistaPublica.ts')

// ─── 1. Lógica pura ─────────────────────────────────────────────────────────────────────────
igual(cp.tituloPaginasPie('Páginas del pie'), 'Tienda', '«Páginas del pie» (el del importador) → «Tienda»')
igual(cp.tituloPaginasPie('  páginas del pie '), 'Tienda', '«Páginas del pie» con espacios o minúsculas → «Tienda»')
igual(cp.tituloPaginasPie(''), 'Tienda', 'sin nombre → «Tienda»')
igual(cp.tituloPaginasPie('   '), 'Tienda', 'solo espacios → «Tienda»')
igual(cp.tituloPaginasPie(null), 'Tienda', 'null → «Tienda»')
igual(cp.tituloPaginasPie(undefined), 'Tienda', 'ausente (legacy) → «Tienda»')
igual(cp.tituloPaginasPie('Compra'), 'Compra', 'nombre propio del cliente: se respeta')
igual(cp.tituloPaginasPie('Enlaces'), 'Enlaces', 'si el cliente lo llamó «Enlaces», queda «Enlaces»')
igual(cp.tituloPaginasPie(' Mi tienda '), 'Mi tienda', 'nombre propio sin espacios de sobra')
igual(cp.tituloMenuPie('Ayuda'), 'Ayuda', 'menú nombrado: su nombre')
igual(cp.tituloMenuPie('Páginas del pie'), 'Páginas del pie', 'un menú nombrado no se renombra aunque se llame así')
igual(cp.tituloMenuPie(''), 'Enlaces', 'menú nombrado sin nombre: último recurso')

const enlaces = (items) => items.filter((i) => i.name)
const menusFixture = [
  { name: 'Ayuda', footer_column: 1, items: [{ name: 'Preguntas' }, { name: 'Contacto' }] },
  { name: 'Envíos y devoluciones', footer_column: 2, items: [] },
  { name: 'Legales', footer_column: 3, items: [{ name: 'Términos' }, { name: '' }] },
]
igual(cp.columnasMenusPie(menusFixture, enlaces).map((c) => [c.columna, c.titulo, c.enlaces.length]), [[1, 'Ayuda', 2], [3, 'Legales', 1]], 'menús sin enlaces fuera; cada uno con su nombre')
igual(cp.columnasMenusPie([{ name: 'Solo vacíos', footer_column: 1, items: [{ name: '' }] }], enlaces), [], 'un menú con ítems sin nombre cuenta como vacío')
igual(cp.columnasMenusPie(undefined, enlaces), [], 'sin menús: ninguna columna')
igual(
  cp.columnasMenusPie([
    { name: 'Vacío', footer_column: 2, items: [] },
    { name: 'Segundo', footer_column: 2, items: [{ name: 'a' }] },
    { name: 'Tercero', footer_column: 2, items: [{ name: 'b' }] },
    { name: 'Primero', footer_column: 1, items: [{ name: 'c' }] },
  ], enlaces).map((c) => [c.columna, c.titulo, c.enlaces.map((e) => e.name)]),
  [[1, 'Primero', ['c']], [2, 'Segundo', ['a', 'b']]],
  'legacy con varios menús en una columna: se juntan con el nombre del primero con enlaces; orden por columna',
)
igual([1, 2, 3, 4, 5, 6, 7, 0, -2].map((n) => cp.columnasRejillaPie(n)), [1, 2, 3, 4, 5, 6, 6, 1, 1], 'rejilla = columnas pintadas, entre 1 y 6')
igual(cp.claseRejillaPie(4), 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12', '4 pintadas: la clase de siempre (lg:grid-cols-4)')
igual(cp.claseRejillaPie(5), 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-12', '5 pintadas: 5 en una fila (ninguna cae a otra fila)')
igual(cp.claseRejillaPie(3), 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12', '3 pintadas: 3 (sin hueco)')
igual(cp.claseRejillaPie(1), 'grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-8 md:gap-12', 'solo la marca: una columna')
igual(cp.claseRejillaTresColumnas(2), 'grid grid-cols-1 md:grid-cols-2 gap-8', 'three_columns con 2 pintadas: 2')
igual(cp.claseRejillaTresColumnas(3), 'grid grid-cols-1 md:grid-cols-3 gap-8', 'three_columns con 3: la de siempre')
// Tailwind solo emite clases escritas completas en lib/ (tailwind.config content incluye lib/).
const fuenteColumnas = leer('lib/website/columnasPie.ts')
for (const n of [1, 2, 3, 4, 5, 6]) check(fuenteColumnas.includes(`'lg:grid-cols-${n}'`), `lg:grid-cols-${n} escrita literal`)
check(leer('tailwind.config.ts').includes("'./lib/**/*.{js,ts,jsx,tsx,mdx}'"), 'tailwind lee lib/ (las clases de la rejilla se emiten)')

// ─── 2. paginasPieDesdeDocumento ────────────────────────────────────────────────────────────
const doc = (menuIds, menus) => ({ shell: { footer: { menuIds } }, menus })
igual(vp.paginasPieDesdeDocumento(doc(['m1', 'paginas-pie'], [{ id: 'paginas-pie', nombre: 'Páginas del pie', items: [] }])), { nombre: 'Páginas del pie' }, 'el nombre guardado (aunque sea el del importador)')
igual(vp.paginasPieDesdeDocumento(doc(['paginas-pie'], [{ id: 'paginas-pie', nombre: 'Compra', items: [] }])), { nombre: 'Compra' }, 'el nombre renombrado en el editor')
igual(vp.paginasPieDesdeDocumento(doc(['m1'], [{ id: 'paginas-pie', nombre: 'Páginas del pie', items: [] }])), null, 'el pie no incluye el menú: null')
igual(vp.paginasPieDesdeDocumento(doc(['paginas-pie'], [])), null, 'el menú no existe: null')
igual(vp.paginasPieDesdeDocumento(doc(['paginas-pie'], [{ id: 'paginas-pie', items: [] }])), { nombre: null }, 'sin nombre: null (título por defecto)')

// ─── 3. Render ──────────────────────────────────────────────────────────────────────────────
const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
const { SiteFooter } = await import('../components/site/SiteFooter.tsx')
const { TemaColoresProvider } = await import('../components/site/TemaColoresContext.tsx')
const enrutador = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }

const ORG = {
  id: 1, name: 'Tienda de prueba', subdomain: 'prueba', description: null, logo_url: null,
  address: null, city: null, state: null, phone: '+57 300 000 0000', email: 'hola@ejemplo.test',
}
let idItem = 0
const pagina = (titulo, slug) => ({
  id: `i${++idItem}`, item_type: 'page', custom_label: titulo, custom_url: null, icon: null, badge: null,
  children: [], page: { id: `p${idItem}`, slug, title: titulo }, category: null,
})
const enlace = (titulo, url) => ({
  id: `i${++idItem}`, item_type: 'custom_link', custom_label: titulo, custom_url: url, icon: null, badge: null,
  children: [], page: null, category: null,
})
const menu = (nombre, columna, items) => ({ id: `m${columna}`, name: nombre, footer_column: columna, items })
// Ítems del menú de páginas del pie como llegan a SiteFooter (footerNavTree).
const arbol = (titulos) => titulos.map((t, i) => ({ id: `pg${i}`, title: t, slug: t.toLowerCase().replace(/\s+/g, '-'), menu_icon: null, menu_badge: null, children: [] }))

const pintar = (props, conTema = false) => {
  const pie = React.createElement(SiteFooter, { organization: ORG, primaryColor: '#2254F8', ...props })
  return renderToStaticMarkup(
    React.createElement(AppRouterContext.Provider, { value: enrutador },
      conTema ? React.createElement(TemaColoresProvider, { value: true }, pie) : pie),
  )
}
const sinEtiquetas = (html) => html.replace(/<[^>]+>/g, '').trim()
// Títulos de columna del pie legacy: <summary><span>Título</span>… (acordeón) o <h3> (apilado).
const titulosLegacy = (html) => [...html.matchAll(/<summary[^>]*><span>(.*?)<\/span>|<h3[^>]*>(.*?)<\/h3>/g)].map((m) => sinEtiquetas(m[1] ?? m[2]))
// Títulos de PieTema en escritorio (h3) — los acordeones del celular repiten los mismos.
const titulosTema = (html) => [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => sinEtiquetas(m[1]))
const rejilla = (html) => (html.match(/data-pie-columnas="(\d+)"/) || [])[1] ?? null

// Org 358 (forma del documento publicado): default, sin tema de colores, sin contacto, menús
// Ayuda (2) · Envíos y devoluciones (0) · Legales (6, con «Tratamiento de datos») · paginas-pie (5).
const ajustes358 = { footer_style: 'default', footer_columns: 4, footer_show_contact: false, show_powered_by: false, show_categories_in_header: true }
const menus358 = [
  menu('Ayuda', 1, [pagina('Preguntas frecuentes', 'preguntas-frecuentes'), pagina('Contacto', 'contacto')]),
  menu('Envíos y devoluciones', 2, []),
  menu('Legales', 3, ['Términos y condiciones', 'Política de privacidad', 'Política de envíos', 'Cambios y devoluciones', 'Política de cookies', 'Tratamiento de datos'].map((t, i) => pagina(t, `legal-${i}`))),
]
const nav358 = arbol(['Productos', 'Categorías', 'Ofertas', 'Consultar pedido', 'Contacto'])
const cats = [{ id: 1, name: 'Categoría A', slug: 'a', icon: null, children: [] }]
const h358 = pintar({ settings: ajustes358, menus: menus358, footerNavTree: nav358, paginasPie: { nombre: 'Páginas del pie' }, menuCategories: cats })
igual(titulosLegacy(h358), ['Tienda de prueba', 'Tienda', 'Ayuda', 'Legales'], 'org 358: marca · Tienda · Ayuda · Legales (sin «Envíos y devoluciones» vacío)')
igual(rejilla(h358), '4', 'org 358: 4 columnas pintadas')
check(h358.includes('lg:grid-cols-4'), 'org 358: lg:grid-cols-4, una sola fila')
check(!h358.includes('>Categorías</h4>'), 'org 358: sin footer_show_categories no sale el bloque «Categorías» (aunque el encabezado las muestre)')
check(!/>Enlaces</.test(h358), 'org 358: ningún «Enlaces»')

// El cliente renombra el menú de páginas en el editor: se respeta.
const h358r = pintar({ settings: ajustes358, menus: menus358, footerNavTree: nav358, paginasPie: { nombre: 'Compra' } })
igual(titulosLegacy(h358r)[1], 'Compra', 'nombre propio del menú de páginas: se respeta')
// Con horario y contacto: 6 columnas en una fila.
const h358c = pintar({ settings: { ...ajustes358, footer_show_contact: true }, menus: menus358, footerNavTree: nav358, paginasPie: { nombre: null }, horarioSede: { monday: { open: '08:00', close: '18:00' } } })
igual(titulosLegacy(h358c).filter((t) => t !== 'Horarios'), ['Tienda de prueba', 'Contacto', 'Tienda', 'Ayuda', 'Legales'], 'con contacto: marca · Contacto · Tienda · Ayuda · Legales')
check(rejilla(h358c) === String(titulosLegacy(h358c).length), 'la rejilla cuenta exactamente las columnas pintadas')
// Con footer_show_categories: el bloque sale dentro de la columna de páginas.
const h358k = pintar({ settings: { ...ajustes358, footer_show_categories: true }, menus: menus358, footerNavTree: nav358, paginasPie: { nombre: null }, menuCategories: cats })
check(h358k.includes('>Categorías</h4>') && h358k.includes('Categoría A'), 'footer_show_categories: true → bloque «Categorías»')
// Sitio V2 cuyo pie no incluye el menú de páginas: sin columna de páginas (ni la de la plantilla).
const hSinPp = pintar({ settings: ajustes358, menus: menus358, footerNavTree: [], paginasPie: null, template: { navigation: [{ name: 'De plantilla', href: '/x' }] } })
igual(titulosLegacy(hSinPp), ['Tienda de prueba', 'Ayuda', 'Legales'], 'V2 sin paginas-pie: sin columna de páginas')
check(!hSinPp.includes('De plantilla'), 'V2 sin paginas-pie: no se cuela la navegación de la plantilla')
igual(rejilla(hSinPp), '3', 'V2 sin paginas-pie: 3 columnas')
// Legacy (sin sitio V2): la columna de páginas como siempre, ahora con título «Tienda».
const hLegacy = pintar({ settings: { footer_style: 'default', footer_show_contact: true }, footerNav: [], template: { navigation: [{ name: 'De plantilla', href: '/x' }] } })
igual(titulosLegacy(hLegacy), ['Tienda de prueba', 'Contacto', 'Tienda'], 'legacy: marca · Contacto · Tienda')
check(hLegacy.includes('De plantilla'), 'legacy sin páginas en el pie: la navegación de la plantilla, como siempre')
const hLegacyVacio = pintar({ settings: { footer_style: 'default', footer_show_contact: false } })
check(hLegacyVacio.includes('Productos') && hLegacyVacio.includes('Nosotros'), 'legacy sin nada: Productos/Servicios/Nosotros/Contacto, como siempre')
// Contacto sin datos: no hay columna vacía.
const hSinDatos = renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: enrutador },
  React.createElement(SiteFooter, { organization: { ...ORG, phone: null, email: null }, primaryColor: '#000', settings: { footer_style: 'default' }, footerNavTree: nav358, paginasPie: { nombre: null } })))
igual(titulosLegacy(hSinDatos), ['Tienda de prueba', 'Tienda'], 'contacto encendido pero sin datos: sin columna vacía')

// Org 341 (forma): composición centrada, solo paginas-pie. La centrada no lleva títulos de columna.
const h341 = pintar({ settings: { footer_style: 'centered', show_powered_by: false }, footerNavTree: arbol(['Productos', 'Categorías', 'Ofertas', 'Contacto']), paginasPie: { nombre: 'Páginas del pie' } })
igual(titulosLegacy(h341), [], 'org 341 (centrada): sin títulos de columna, como siempre')
check(['Productos', 'Categorías', 'Ofertas', 'Contacto'].every((t) => h341.includes(`>${t}</a>`)), 'org 341: los 4 enlaces de páginas en línea')

// three_columns y split: el título del menú y sin columnas vacías.
const h3 = pintar({ settings: { footer_style: 'three_columns' }, footerNavTree: nav358, paginasPie: { nombre: 'Compra' } })
igual(titulosLegacy(h3), ['Tienda de prueba', 'Compra', 'Contacto'], 'three_columns: marca · nombre del menú · Contacto')
check(h3.includes('md:grid-cols-3'), 'three_columns con 3: md:grid-cols-3')
const h3v = pintar({ settings: { footer_style: 'three_columns' }, footerNavTree: [], paginasPie: null })
igual(titulosLegacy(h3v), ['Tienda de prueba', 'Contacto'], 'three_columns sin páginas: sin «Sin enlaces»')
check(h3v.includes('md:grid-cols-2') && !h3v.includes('Sin enlaces'), 'three_columns sin páginas: 2 columnas, sin hueco')
const hs = pintar({ settings: { footer_style: 'split' }, footerNavTree: nav358, paginasPie: { nombre: null } })
igual(titulosLegacy(hs), ['Tienda de prueba', 'Tienda'], 'split: marca · Tienda')
check(!hs.includes('sm:grid-cols-2'), 'split sin horario ni boletín: la sub-rejilla no deja hueco')

// PieTema (sitio con tema de colores).
// Org 338 (forma): tema + paginas-pie: la columna aparece primero con su nombre.
const ajustesTema = { footer_style: 'default', show_powered_by: false, footer_show_contact: false }
const h338 = pintar({ settings: ajustesTema, footerNavTree: arbol(['Productos', 'Ofertas']), paginasPie: { nombre: 'Páginas del pie' }, menus: [menu('Ayuda', 1, [pagina('Preguntas frecuentes', 'faq')])] }, true)
check(h338.includes('data-pie-tema="default"'), 'con tema: pinta PieTema')
igual(titulosTema(h338), ['Tienda', 'Ayuda'], 'PieTema con paginas-pie: Tienda · Ayuda')
check(h338.includes('>Ofertas</a>'), 'PieTema: los enlaces de paginas-pie')
const h338r = pintar({ settings: ajustesTema, footerNavTree: arbol(['Productos']), paginasPie: { nombre: 'Compra' }, menus: [] }, true)
igual(titulosTema(h338r), ['Compra'], 'PieTema: nombre propio del menú de páginas')
// Org 335 (forma): menús «Tienda» (nombrado, 4) · Ayuda (3) · Legales (0); sin paginas-pie.
const h335 = pintar({ settings: ajustesTema, footerNavTree: [], paginasPie: null, menus: [
  menu('Tienda', 1, ['Inicio', 'Productos', 'Categorías', 'Ofertas'].map((t, i) => pagina(t, `t${i}`))),
  menu('Ayuda', 2, [enlace('Consultar pedido', '/consultar-pedido'), pagina('Preguntas frecuentes', 'faq'), pagina('Contacto', 'contacto')]),
  menu('Legales', 3, []),
] }, true)
igual(titulosTema(h335), ['Tienda', 'Ayuda'], 'org 335: Tienda · Ayuda (Legales vacío fuera), sin cambios')
// Org 388 (forma): Ayuda (2) · Envíos y devoluciones (2) · Legales (6, «Tratamiento de datos» abajo).
const h388 = pintar({ settings: ajustesTema, footerNavTree: [], paginasPie: null, menus: [
  menu('Ayuda', 1, [pagina('Preguntas frecuentes', 'faq'), pagina('Contacto', 'contacto')]),
  menu('Envíos y devoluciones', 2, [enlace('Rastrear mi envío', '/tracking'), enlace('Consultar mi pedido', '/consultar-pedido')]),
  menu('Legales', 3, ['Términos y condiciones', 'Política de privacidad', 'Política de envíos', 'Cambios y devoluciones', 'Política de cookies', 'Tratamiento de datos'].map((t, i) => pagina(t, `l${i}`))),
] }, true)
igual(titulosTema(h388), ['Ayuda', 'Envíos y devoluciones', 'Legales'], 'org 388: Ayuda · Envíos y devoluciones · Legales, sin cambios')
check(/ · <a[^>]*>Tratamiento de datos<\/a>/.test(h388), 'org 388: «Tratamiento de datos» sigue en la barra inferior')

// ─── 4. Pie igual en todas las páginas ──────────────────────────────────────────────────────
const ps = await import('../lib/website/pieSitio.ts')
// Documento con la forma del de org 358 (etiquetas inventadas): Ayuda (2, con una categoría) ·
// Envíos y devoluciones (0) · Legales (2) · paginas-pie (3).
const pag = (id, titulo) => ({ id, slug: `p-${id}`, titulo, tipo: 'standard', publicada: true, secciones: [] })
const it = (id, paginaId, etiqueta) => ({ id, tipo: 'page', paginaId, etiqueta })
const doc358 = {
  shell: { header: { menuPrincipalId: null, menuMegaId: null }, footer: { menuIds: ['ayuda', 'envios', 'legales', 'paginas-pie'] } },
  paginas: [pag('a', 'Productos'), pag('b', 'Ofertas'), pag('c', 'Contacto'), pag('d', 'Preguntas'), pag('e', 'Términos'), pag('f', 'Privacidad')],
  menus: [
    { id: 'ayuda', nombre: 'Ayuda', items: [it('i1', 'd', 'Preguntas'), { id: 'i2', tipo: 'entity', entidad: 'category', entidadId: '7', etiqueta: 'Categoría' }] },
    { id: 'envios', nombre: 'Envíos y devoluciones', items: [] },
    { id: 'legales', nombre: 'Legales', items: [it('i3', 'e', 'Términos'), it('i4', 'f', 'Privacidad')] },
    { id: 'paginas-pie', nombre: 'Páginas del pie', items: [it('i5', 'a', 'Productos'), it('i6', 'b', 'Ofertas'), it('i7', 'c', 'Contacto')] },
  ],
}
const lecturas = (sitio, { fallaCategorias = false } = {}) => {
  const n = { sitio: 0, categorias: 0, legacy: 0, fallos: 0, ramaLegacy: null }
  return {
    n,
    l: {
      leerSitio: async () => { n.sitio++; return sitio },
      leerCategorias: async (_org, ids) => {
        n.categorias++
        if (fallaCategorias) throw new Error('sin categorías')
        return new Map(ids.map((id) => [id, { id, name: `Cat ${id}`, slug: `cat-${id}` }]))
      },
      leerMenusLegacy: async (_org, rama) => { n.legacy++; n.ramaLegacy = rama; return [menu('Legacy', 1, [enlace('Uno', '/uno')])] },
      alFallar: () => { n.fallos++ },
    },
  }
}
// Lo que hace getOrgContext para la comodín: menusPublicosDesdeDocumento + footerNavTree de paginas-pie.
const ctxComodin = (() => {
  const m = vp.menusPublicosDesdeDocumento(doc358, 1, new Map([[7, { id: 7, name: 'Cat 7', slug: 'cat-7' }]]))
  const arbolCtx = (m.footerPaginas?.items ?? []).map((x) => ps.menuItemToPageWithChildren(x))
  return { menus: m.footer, footerNav: arbolCtx, footerNavTree: arbolCtx }
})()
const sitio358 = { documento: doc358 }

// Página que no es la comodín (producto, carrito, checkout…): no pasa menus.
const prod = lecturas(sitio358)
const pieProducto = await ps.resolverPieSitio({ organizationId: 1, branchId: undefined }, prod.l)
igual(pieProducto.menus.map((m) => [m.name, m.items.length]), [['Ayuda', 2], ['Envíos y devoluciones', 0], ['Legales', 2]], 'producto: los menús del pie del documento')
igual(pieProducto.footerNavTree.map((p) => p.title), ['Productos', 'Ofertas', 'Contacto'], 'producto: el árbol de paginas-pie')
igual(pieProducto.paginasPie, { nombre: 'Páginas del pie' }, 'producto: el nombre del menú de páginas')
igual([prod.n.sitio, prod.n.categorias, prod.n.legacy], [1, 1, 0], 'producto V2: documento (ya cacheado) + categorías cacheadas; nada legacy')
// Comodín: trae `menus` de getOrgContext → no se lee nada más que el documento ya cacheado.
const com = lecturas(sitio358)
const pieComodin = await ps.resolverPieSitio({ organizationId: 1, branchId: undefined, ...ctxComodin }, com.l)
check(pieComodin.menus === ctxComodin.menus && pieComodin.footerNavTree === ctxComodin.footerNavTree, 'comodín: usa sus propios menús y árbol tal cual')
igual([com.n.categorias, com.n.legacy], [0, 0], 'comodín: no vuelve a leer menús ni categorías')
igual(pieComodin.paginasPie, { nombre: 'Páginas del pie' }, 'comodín: también el nombre del menú de páginas')
igual(JSON.stringify(pieProducto.menus), JSON.stringify(ctxComodin.menus), 'producto y comodín: los mismos menús')
igual(JSON.stringify(pieProducto.footerNavTree), JSON.stringify(ctxComodin.footerNavTree), 'producto y comodín: el mismo árbol de páginas')
// El mismo pie pintado (HTML idéntico): las mismas columnas en la comodín y en producto.
const pintarPie = (pie) => pintar({ settings: ajustes358, menus: pie.menus, footerNav: pie.footerNav, footerNavTree: pie.footerNavTree, paginasPie: pie.paginasPie })
const hProducto = pintarPie(pieProducto)
const hComodin = pintarPie(pieComodin)
check(hProducto === hComodin, 'producto y comodín pintan exactamente el mismo pie')
igual(titulosLegacy(hProducto), ['Tienda de prueba', 'Tienda', 'Ayuda', 'Legales'], 'producto: marca · Tienda · Ayuda · Legales (como la comodín)')
igual(rejilla(hProducto), '4', 'producto: 4 columnas en una fila')
check(hProducto.includes('>Cat 7</span>'), 'producto: la categoría del menú Ayuda resuelta')
// Referencia: sin menus (lo que veía producto antes) solo marca + páginas.
const hAntes = pintar({ settings: ajustes358, footerNavTree: ctxComodin.footerNavTree, paginasPie: { nombre: 'Páginas del pie' } })
igual(titulosLegacy(hAntes), ['Tienda de prueba', 'Tienda'], 'referencia: sin menus solo marca y Tienda')
// /pedido/[id] arma su contexto a mano con las páginas legacy: en V2 quedan las del documento.
const ped = lecturas(sitio358)
const piePedido = await ps.resolverPieSitio({ organizationId: 1, branchId: undefined, footerNav: [{ id: 'x', title: 'Página legacy', slug: 'legacy' }] }, ped.l)
igual(piePedido.footerNav.map((p) => p.title), ['Productos', 'Ofertas', 'Contacto'], '/pedido en V2: el árbol del documento, no las páginas legacy')
// Legacy (sin sitio V2): los menús de website_menus, con la sede de la página.
const leg = lecturas(null)
const pieLegacy = await ps.resolverPieSitio({ organizationId: 1, branchId: 9, footerNav: [{ id: 'x', title: 'Página legacy', slug: 'legacy' }] }, leg.l)
igual([leg.n.legacy, leg.n.ramaLegacy, leg.n.categorias], [1, 9, 0], 'legacy: una lectura de menús (cacheada) con la sede')
igual(pieLegacy.menus.map((m) => m.name), ['Legacy'], 'legacy: sus menús del pie')
igual(pieLegacy.footerNav.map((p) => p.title), ['Página legacy'], 'legacy: el árbol de páginas que pasó la página, sin tocar')
igual(pieLegacy.paginasPie, undefined, 'legacy: paginasPie ausente')
const legCom = lecturas(null)
await ps.resolverPieSitio({ organizationId: 1, branchId: undefined, menus: [] }, legCom.l)
igual(legCom.n.legacy, 0, 'comodín legacy con menús vacíos: no se vuelve a leer (pasa [] en vez de undefined)')
// Fallo con el documento: como getOrgContext, los menús legacy.
const fal = lecturas(sitio358, { fallaCategorias: true })
const pieFallo = await ps.resolverPieSitio({ organizationId: 1, branchId: undefined }, fal.l)
igual([fal.n.fallos, fal.n.legacy, pieFallo.menus.map((m) => m.name)], [1, 1, ['Legacy']], 'fallo leyendo el documento: aviso y menús legacy')

// ─── 5. Fuente ──────────────────────────────────────────────────────────────────────────────
const footer = leer('components/site/SiteFooter.tsx')
check(!footer.includes('title="Enlaces"'), 'SiteFooter: ningún título «Enlaces» fijo')
check(!footer.includes('settings?.show_categories_in_header'), 'SiteFooter: «Categorías» del pie ya no depende de show_categories_in_header')
check(!footer.includes('getFooterGridClass'), 'SiteFooter: la rejilla ya no sale fija de footer_columns')
check(footer.includes('claseRejillaPie(columnasPintadas)'), 'SiteFooter: rejilla con las columnas pintadas')
const layout = leer('components/site/OrganizationLayout.tsx')
check(layout.includes('resolverPieSitio(') && layout.includes('menus={pie.menus}') && layout.includes('paginasPie={pie.paginasPie}'), 'OrganizationLayout resuelve el pie (menús y nombre) y lo pasa')
check(layout.includes('leerSitio: getSitioPublicoV2') && layout.includes('leerCategorias: getCategoriasMenuV2') && layout.includes("getWebsiteMenusByLocation(organizationId, 'footer', branchId)"), 'OrganizationLayout usa las lecturas cacheadas de getOrgContext')
const comodin = leer('app/[[...slug]]/page.tsx')
check(comodin.split('menus={footerMenus ?? []}').length - 1 === 4 && !comodin.includes('footerMenus : undefined'), 'la comodín siempre pasa `menus` (también vacíos): el layout no los vuelve a leer')
const ctxFuente = leer('lib/get-org-context.ts')
check(ctxFuente.includes("import { menuItemToPageWithChildren } from '@/lib/website/pieSitio'") && !ctxFuente.includes('function menuItemToPageWithChildren'), 'getOrgContext y el layout comparten menuItemToPageWithChildren')
const cliente = leer('components/site/OrganizationLayoutCliente.tsx')
check(cliente.includes('paginasPie={paginasPie}'), 'OrganizationLayoutCliente pasa paginasPie a SiteFooter')
const tema = leer('components/site/footer/PieTema.tsx')
check(tema.includes('p.paginasPie'), 'PieTema pinta paginas-pie')

if (problemas.length) {
  console.error(`✗ verify-columnas-pie: ${problemas.length} problema(s) en ${casos} casos`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-columnas-pie: ${casos} casos`)
