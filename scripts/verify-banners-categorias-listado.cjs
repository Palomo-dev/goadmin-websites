/** Pruebas del render real usado por el lienzo y por la web. Sin consultas ni pedidos. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')
const root = path.resolve(__dirname, '..')
const cache = new Map()
const mocks = {
  'next/link': { __esModule: true, default: ({ children, ...p }) => React.createElement('a', p, children) },
  'next/image': { __esModule: true, default: ({ fill, ...p }) => React.createElement('img', p) },
  'next/navigation': { useRouter: () => ({ push() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() },
  '@/lib/outlet/RutaSitioContext': { useRutaSitio: () => ({ ruta: p => p }) },
  './ProductCard': { ProductCard: ({ product }) => React.createElement('article', { 'data-product-id': product.id }, product.name), getProductPrice: () => 100, getProductImageUrl: () => null, getProductComparePrice: () => null },
}
mocks['@/components/sections/products/ProductCard'] = mocks['./ProductCard']
function local(base) {
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
  throw new Error(`No se encuentra ${base}`)
}
function load(file) {
  if (file.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) }
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod)
  mod.filename = file
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = id => {
    if (mocks[id]) return mocks[id]
    if (id.startsWith('@/')) return load(local(path.join(root, id.slice(2))))
    if (id.startsWith('.')) return load(local(path.resolve(path.dirname(file), id)))
    return require(id)
  }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  mod._compile(output, file)
  return mod.exports
}
let casos = 0
const check = (ok, mensaje) => { casos++; assert.ok(ok, mensaje) }
const render = (C, props) => renderToStaticMarkup(React.createElement(C, props))
const { usarDistribucionNueva, DISTRIBUCIONES } = load(local(path.join(root, 'lib/website/distribucionBanner')))
const { PromoBannersGrid } = load(local(path.join(root, 'components/sections/retail/PromoBannersGrid')))
const banners = Array.from({ length: 5 }, (_, i) => ({ title: `Promoción ${i}`, image_url: `https://example.org/${i}.png`, cta_text: 'Ver oferta', cta_url: '/productos' }))
check(usarDistribucionNueva({ banners }) === null, 'sin claves nuevas conserva la ruta actual')
for (const layout of DISTRIBUCIONES.filter(l => l !== 'grid')) {
  const html = render(PromoBannersGrid, { content: { title: 'Promociones', banners, banner_layout: layout } })
  check(html.includes(`data-banner-layout="${layout}"`), `${layout}: distribución efectiva`)
  check(html.includes('<h2') && html.includes('Promociones'), `${layout}: título de sección`)
  check((html.match(/data-banner-index/g) || []).length === 5, `${layout}: conserva banners sin huecos`)
}
for (const enlazados of [true, false]) {
  const html = render(PromoBannersGrid, { content: { banner_layout: 'hero_plus_2', banners: banners.slice(0, 3).map(b => enlazados ? b : { ...b, cta_url: undefined }) } })
  const documento = new JSDOM(html).window.document
  const grande = documento.querySelector('[data-banner-index="0"]')
  const arriba = documento.querySelector('[data-banner-index="1"]')
  const abajo = documento.querySelector('[data-banner-index="2"]')
  check(grande.tagName === (enlazados ? 'A' : 'DIV'), `hero+2: ${enlazados ? 'el enlace' : 'el contenedor'} es el nodo colocado`)
  check(grande.parentElement === arriba.parentElement && arriba.parentElement === abajo.parentElement && grande.parentElement.style.gridTemplateColumns === '2fr 1fr', 'hero+2: los tres banners son hijos directos de la misma rejilla')
  check(grande.style.gridColumn === '1 / span 1' && grande.style.gridRow === '1 / span 2', 'hero+2: el hijo directo grande ocupa las dos filas de la primera columna')
  check(arriba.style.gridColumn === '2 / span 1' && arriba.style.gridRow === '1 / span 1' && abajo.style.gridColumn === '2 / span 1' && abajo.style.gridRow === '2 / span 1', 'hero+2: los dos hijos pequeños se colocan en la columna derecha')
  check(grande.style.height === '100%' && grande.querySelector('[data-banner-shape]').style.height === '100%', 'hero+2: enlace y panel grande cubren la altura de las dos filas')
}
for (const forma of ['rect', 'rounded', 'semi', 'circle', 'arch']) {
  const html = render(PromoBannersGrid, { content: { banners: [{ ...banners[0], banner_style: { banner_shape: forma, border_width: 3, border_color: '#123456', shadow: 'md', overlay: 'gradient', text_align: 'right', hover: 'lift', button_style: 'outline' } }] } })
  check(html.includes(`data-banner-shape="${forma}"`), `forma ${forma} por banner activa render nuevo`)
  check((html.includes('3px solid #123456') || (html.includes('border-width:3px') && html.includes('border-color:#123456'))) && html.includes('text-align:right') && html.includes('linear-gradient'), `${forma}: borde, alineación y degradado`)
}
for (const overlay of ['gradient', 'solid']) {
  const conOpacidad = valor => render(PromoBannersGrid, { content: { banner_layout: 'grid', banner_style: { overlay, overlay_color: '#123456', overlay_opacity: valor }, banners: [banners[0]] } })
  const suave = conOpacidad(20)
  const fuerte = conOpacidad(80)
  check(suave !== fuerte && suave.includes('opacity:0.2') && fuerte.includes('opacity:0.8'), `${overlay}: la opacidad cambia la capa incluso con color explícito`)
}
for (const estiloBoton of [undefined, 'solid']) {
  const conHover = color => render(PromoBannersGrid, { content: { banner_layout: 'grid', banner_style: { button_style: estiloBoton, button_hover: color }, banners: [banners[0]] } })
  const oscuro = conHover('#111111')
  const claro = conHover('#EEEEEE')
  check(oscuro !== claro && oscuro.includes('--banner-button-hover:#111111') && claro.includes('--banner-button-hover:#EEEEEE'), `${estiloBoton || 'clásico'}: color hover aplicado al botón real`)
  check(oscuro.includes('data-banner-button-hover='), `${estiloBoton || 'clásico'}: selector CSS conectado al botón real`)
}
const cssHover = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')
check(/\[data-banner-button-hover\]:hover,[\s\S]*?background:\s*var\(--banner-button-hover\) !important/.test(cssHover), 'la regla de hover sobreescribe el fondo inline configurado')
const circuloHorizontal = render(PromoBannersGrid, { content: { banners: [{ ...banners[0], banner_style: { banner_shape: 'circle' } }] } })
check(circuloHorizontal.includes('aspect-square') && circuloHorizontal.includes('border-radius:50%'), 'círculo con fotografía horizontal conserva proporción cuadrada y radio circular')
check(!circuloHorizontal.includes('block w-full h-auto'), 'la fotografía horizontal deja de imponer su proporción natural al círculo')
const { CategoriesGrid } = load(local(path.join(root, 'components/sections/products/CategoriesGrid')))
const categories = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Categoría ${i + 1}`, slug: `categoria-${i + 1}`, image_url: `https://example.org/cat-${i}.png` }))
for (const estilo of ['circle', 'card_bottom', 'pill', 'minimal_icon', 'bento']) {
  const html = render(CategoriesGrid, { sectionVariant: estilo, content: { title: 'Categorías', max_items: 6 }, data: { categories } })
  check(html.includes(`data-category-style="${estilo}"`), `${estilo}: variante tiene render propio`)
  check(new Set([...html.matchAll(/href="(\/categorias\/[^"]+)"/g)].map(m => m[1])).size === 6, `${estilo}: límite 6`)
  if (estilo === 'bento') check(html.includes('col-span-2 row-span-2'), 'mosaico con tamaños distintos')
  if (estilo === 'pill') check(html.includes('border-radius:9999px') || html.includes('rounded-full'), 'píldoras con forma propia')
}
for (const cantidad of [8, 9, 16]) {
  const listaBento = Array.from({ length: cantidad }, (_, i) => ({ id: i + 1, name: `Categoría ${i + 1}`, slug: `categoria-${i + 1}` }))
  const html = render(CategoriesGrid, { content: { category_style: 'bento', max_items: 100 }, data: { categories: listaBento } })
  check(new Set([...html.matchAll(/href="(\/categorias\/[^"]+)"/g)].map(m => m[1])).size === cantidad, `bento ${cantidad}: conserva todas las categorías`)
  check((html.match(/col-span-2 row-span-2/g) || []).length >= Math.floor(cantidad / 8), `bento ${cantidad}: cada grupo de ocho incluye una celda grande en escritorio`)
  check((html.match(/col-span-2 min-h-\[104px\]/g) || []).length >= Math.floor(cantidad / 8), `bento ${cantidad}: una celda ancha completa cada grupo de ocho sin huecos`)
}
const categoriasPaginadas = render(CategoriesGrid, { sectionVariant: 'circle', content: { max_items: 6, enable_search: true, enable_pagination: true, page_size: 4 }, data: { categories } })
check(new Set([...categoriasPaginadas.matchAll(/href="(\/categorias\/[^"]+)"/g)].map(m => m[1])).size === 4, 'estilos nuevos respetan el tamaño de página del renderer compartido')
check(categoriasPaginadas.includes('aria-label="Buscar categorías"') && categoriasPaginadas.includes('aria-label="Paginación"'), 'estilos nuevos conservan buscador y navegación de páginas')
const viejo = render(CategoriesGrid, { content: {}, data: { categories } })
check(!viejo.includes('data-category-style'), 'categorías sin cambio conservan el diseño actual')
const { recorteListado } = load(local(path.join(root, 'lib/products/limiteListado')))
check(recorteListado(19, 1, { show_pagination: false }, 4).hasta === 4, 'el tamaño global forzado mantiene su precedencia frente al interruptor legado')
check(recorteListado(19, 1, { max_items: 6 }).hasta === 6, 'máximo 6 recorta 19')
check(recorteListado(19, 1, { products_limit: 6 }).hasta === 6, 'Cantidad nueva también recorta 19')
check(recorteListado(19, 2, { pagination: 'pages', per_page: 6 }).desde === 6, 'segunda página sin solaparse')
check(recorteListado(19, 2, { pagination: 'load_more', per_page: 6 }).hasta === 12, 'ver más acumula páginas')
check(recorteListado(19, 1, { pagination: 'none', max_items: 6 }).hasta === 6, 'lista larga respeta límite')
const products = Array.from({ length: 19 }, (_, i) => ({ id: i + 1, name: `Producto ${i}`, product_prices: [{ price: 100 }] }))
for (const name of ['ProductsGrid', 'ProductsList', 'ProductsCarousel']) {
  const C = load(local(path.join(root, `components/sections/products/${name}`)))[name]
  for (const clave of ['max_items', 'products_limit']) {
    const html = render(C, { content: { [clave]: 6, show_filters: false }, data: { products }, organization: { subdomain: 'org-140' } })
    check((html.match(/data-product-id/g) || []).length === 6, `${name}: ${clave}=6 muestra 6 de 19`)
  }
  const html = render(C, { content: { pagination: 'pages', per_page: 4, products_limit: 19, show_filters: false }, data: { products }, organization: { subdomain: 'org-140' } })
  check((html.match(/data-product-id/g) || []).length === 4 && (html.includes('Página siguiente') || html.includes('aria-label="Siguiente"') || html.includes('lucide-chevron-right')), `${name}: paginación visible y tamaño de página efectivo`)
}
const { CategoryProducts } = load(local(path.join(root, 'components/sections/category-detail/CategoryProducts')))
const grillaCategoria = render(CategoryProducts, { content: { max_items: 6 }, data: { products, total: 19, totalPages: 4, currentPage: 1 } })
check((grillaCategoria.match(/data-product-id/g) || []).length === 6, 'detalle de categoría también respeta máximo6 en su render compartido')
const { PaginacionListado } = load(local(path.join(root, 'components/sections/products/PaginacionListado')))
const paginacionActual = render(PaginacionListado, { legadoGrid: true, recorte: { paginas: 2, universo: 19, hasta: 12 }, pagina: 1, onPagina() {}, content: {}, color: '#123456' })
check(paginacionActual.includes('flex items-center justify-center gap-1 mt-8'), 'sin opciones conserva margen8 y separación1 de la grilla publicada')
check(paginacionActual.includes('lucide-chevron-left') && paginacionActual.includes('lucide-chevron-right') && !paginacionActual.includes('>Anterior<') && !paginacionActual.includes('>Siguiente<'), 'sin opciones conserva flechas, sin texto nuevo')
check(paginacionActual.includes('min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all'), 'sin opciones conserva geometría de botones publicada')
const { SectionWrapper } = load(local(path.join(root, 'components/sections/SectionWrapper')))
for (const sectionType of ['restaurant_hero', 'promo_banners']) {
  const primera = render(SectionWrapper, { isFirst: true, sectionType, settings: {}, content: {}, children: 'Bloque' })
  const intermedia = render(SectionWrapper, { isFirst: false, sectionType, settings: {}, content: {}, children: 'Bloque' })
  const explicita = render(SectionWrapper, { isFirst: true, sectionType, settings: {}, content: { padding_top: 'sm' }, children: 'Bloque' })
  check(!primera.includes('pt-12 md:pt-16'), `${sectionType}: primera sección pegada al encabezado`)
  check(intermedia.includes('pt-12 md:pt-16'), `${sectionType}: separacion intermedia predeterminada conservada`)
  check(explicita.includes('pt-4 md:pt-6'), `${sectionType}: espaciado explícito se respeta`)
}
const { presentacionSeccion } = load(local(path.join(root, 'lib/website/v2/estiloSeccionPublico')))
const imagen = 'https://example.org/fondo.png'
check(presentacionSeccion({ estilo: { v: 1, fondo: 'imagen', imagenFondo: imagen } }, {}).contenido.bg_image === imagen, 'selector de imagen llega al render compartido')
check(presentacionSeccion({ estilo: { v: 1, fondo: 'imagen', imagenFondo: imagen } }, { bg_image: 'https://example.org/avanzado.png' }).contenido.bg_image.endsWith('avanzado.png'), 'Avanzado conserva precedencia')
console.log(`verify:banners-categorias-listado ok (${casos} casos de render y recorte)`)
