/** Render real del encabezado y búsquedas compartidos entre borrador y publicación. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()
let shell
const mock = {
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next/image': { __esModule: true, default: ({ fill, priority, ...props }) => React.createElement('img', props) },
  'next/navigation': { usePathname: () => '/', useRouter: () => ({ push() {} }) },
  '@/components/site/CurrencyProvider': { useCurrency: () => ({ currency: 'COP', availableCurrencies: [], loading: false }), Price: ({ value }) => value },
  '@/components/site/EncabezadoPieContext': { useEncabezadoPie: () => shell },
  '@/lib/supabase/client': { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
  '@/lib/outlet/RutaSitioContext': { useRutaSitio: () => ({ ruta: (p) => p }) },
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = (id) => {
    const absoluteId = id.startsWith('.') ? '@/' + path.relative(root, path.resolve(path.dirname(file), id)).replaceAll(path.sep, '/') : id
    if (mock[id] || mock[absoluteId]) return mock[id] || mock[absoluteId]
    if (id.startsWith('.') || id.startsWith('@/')) {
      const ruta = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id)
      return load([ruta, ruta + '.ts', ruta + '.tsx'].find((p) => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    return require(id)
  }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  mod._compile(output, file)
  return mod.exports
}
const { leerConstructor, colorDeToken, resolverFuentesMenus } = load(path.join(root, 'lib/website/constructorEncabezado.ts'))
const { opcionesEncabezadoPie, EXTRAS_VACIOS } = load(path.join(root, 'lib/website/encabezadoPie.ts'))
shell = { opciones: opcionesEncabezadoPie(null), extras: EXTRAS_VACIOS, selector: null, tipo: null }
const { BuscadorCromo } = load(path.join(root, 'components/site/header/BuscadorCromo.tsx'))
const { HeaderCTA2 } = load(path.join(root, 'components/site/header/HeaderShared.tsx'))
const { HeaderPorZonas } = load(path.join(root, 'components/site/header/HeaderPorZonas.tsx'))
const { ContenedorIcono } = load(path.join(root, 'components/site/header/ContenedorIcono.tsx'))
const { MobileBottomNav } = load(path.join(root, 'components/site/header/mobile/MobileBottomNav.tsx'))
const { BarraMovilGiro } = load(path.join(root, 'components/site/BarraMovilGiro.tsx'))
const { leerPresentacionMovil } = load(path.join(root, 'lib/website/menuMovil.ts'))
const { popularesBusqueda } = load(path.join(root, 'lib/products/popularesBusqueda.ts'))
const { Search } = require('lucide-react')
const h = React.createElement
let casos = 0
const check = (ok, msg) => { casos++; assert.ok(ok, msg) }
const render = (Componente, props) => renderToStaticMarkup(h(Componente, props))
for (const modo of ['preview', 'publicado']) {
  for (const tamano of ['escritorio', 'celular']) {
    for (const tipo of ['bar', 'mini', 'mega', 'pill_floating', 'outlined', 'underline']) {
      const presentacion = leerConstructor({ header_builder: { search: { type: tipo, icon: 'scan-search', icon_side: 'right', border_color: '#123456', background: '#fafafa', radius: 'semi', shadow: true, button: 'text' } } }).buscador
      const html = render(BuscadorCromo, { presentacion, primaryColor: '#123456' })
      check(html.includes(`data-buscador="${tipo}"`), `${modo}/${tamano}: preset ${tipo}`)
      check(html.includes('<form') && html.includes('type="submit"'), `${tipo}: búsqueda real mediante submit`)
      check(html.includes('scan-search') && html.includes('right-3'), `${tipo}: ícono elegido en posición derecha`)
      check(html.includes('background-color:#fafafa') && html.includes('border-color:#123456') && html.includes('shadow-lg'), `${tipo}: colores y sombra visibles`)
    }
    for (const shape of ['circle', 'square', 'semi', 'none']) {
      const base = leerConstructor({ header_builder: { icon_container: { shape, background: '#123456', border_width: 2, shadow: 'md' } } }).contenedor
      const html = render(ContenedorIcono, { base, clave: 'cart', colores: { primary: '#123456', accent: '#123456', secondary: '#fff' }, children: h(Search) })
      check(html.includes(`data-contenedor-icono="${shape}"`), `${modo}/${tamano}: contenedor ${shape}`)
      check(shape === 'none' ? !html.includes('box-shadow:') : html.includes('box-shadow:') && html.includes('border:2px'), `${shape}: estilo de caja aplicado`)
    }
    const settings = { header_cta2_text: 'Contacto', header_cta2_url: 'https://example.org/contacto' }
    const cta = render(HeaderCTA2, { settings, movil: tamano === 'celular' })
    check(cta.includes('data-boton-secundario') && cta.includes('https://example.org/contacto'), `${modo}/${tamano}: segundo botón desde ajustes efectivos`)
    if (tamano === 'celular') check(!cta.includes('hidden md:inline-flex'), 'CTA secundario visible en celular')
  }
}
const config = leerConstructor({ header_builder: { menus: [
  { id: 'pagina', name: 'Páginas', zone: 'header_center', items: [{ label: 'Nosotros', href: '/nosotros' }] },
  { id: 'categoria', name: 'Categorías', zone: 'topbar_left', type: 'mega', items: [{ label: 'Menú', href: '/menu' }] },
] } })
const html = render(HeaderPorZonas, { organization: { id: 140, name: 'Tienda de prueba', subdomain: 'prueba', website_settings: {} }, primaryColor: '#123456', navTree: [], settings: {}, constructor: config })
check(html.includes('aria-label="Páginas"') && html.includes('aria-label="Categorías"'), 'dos menús simultáneos en sus zonas')
const hoja = render(HeaderPorZonas, { organization: { id: 140, name: 'Tienda de prueba', subdomain: 'prueba', website_settings: {} }, primaryColor: '#123456', navTree: [], settings: {}, menuCategories: [{ id: 1, name: 'Categoría hoja', slug: 'hoja' }], constructor: leerConstructor({ header_builder: { menus: [{ id: 'hojas', name: 'Catálogo', source: 'categories', zone: 'menu_center' }] } }) })
check(hoja.includes('Categoría hoja') && hoja.includes('href="/categorias/hoja"'), 'una categoría hoja sin children se renderiza sin fallar')
const automatico = resolverFuentesMenus(leerConstructor({ header_builder: { menus: [
  { id: 'auto-cat', name: 'Catálogo', source: 'categories', type: 'mega', zone: 'menu_center' },
  { id: 'auto-page', name: 'Información', source: 'pages', zone: 'topbar_right' },
] } }), [{ name: 'Acerca de', href: '/acerca' }], [{ name: 'Categoría A', href: '/categorias/a', children: [{ name: 'Subcategoría B', href: '/categorias/b' }] }])
check(automatico.menus[0].items[0].label === 'Categoría A' && automatico.menus[1].items[0].label === 'Acerca de', 'cada menú resuelve su fuente propia')
check(automatico.mega[0].columnas[0].links[0].href === '/categorias/b', 'mega automático con subcategorías reales')
const barra = leerPresentacionMovil({ mobile_header: { bottom_nav: { enabled: true, items: [{ id: 'inicio', kind: 'home' }, { id: 'buscar', kind: 'search' }, { id: 'pedir', kind: 'cart', label: 'Pedir', action: 'cart' }] } } }).barra
const app = render(MobileBottomNav, { barra, primaryColor: '#123456', unidades: 3, onMenu() {}, onSearch() {}, onCart() {} })
check(/<button[^>]*>[\s\S]*?Pedir[\s\S]*?<\/button>/.test(app) && !app.includes('href="/menu"'), 'Pedir en barra app ejecuta acción y no enlace')
const giro = render(BarraMovilGiro, { acciones: [{ accion: 'pedir', href: '/menu' }], primaryColor: '#123456', onCartClick() {} })
check(giro.includes('<button') && !giro.includes('<a'), 'Pedir en barra de restaurante abre carrito y no navega')
assert.deepEqual(popularesBusqueda([{ name: 'Plato A', sales_count: 2 }, { name: 'Plato B', sales_count: 8 }, { name: 'Sin ventas', sales_count: 0 }, { name: 'plato b', sales_count: 1 }]), ['Plato B', 'Plato A']); casos++
assert.deepEqual(popularesBusqueda([]), []); casos++
check(colorDeToken('marca:acento', { primary: '#111', accent: '#abc', secondary: '#222' }) === '#abc', 'color enlazado a la marca')
// El endpoint ignora un id de organización arbitrario y pasa contexto+sede al helper cacheado.
let contexto = { organization: { id: 140 }, branchId: 9 }
const consultas = []
mock['next/server'] = { NextResponse: { json: (body, options) => ({ body, options }) } }
mock['@/lib/get-org-context'] = { getOrgContext: async () => contexto }
mock['@/lib/supabase/queries'] = { getMenuCatalogProducts: async (...args) => { consultas.push(args); return [{ name: 'Producto A', sales_count: 7 }] } }
const endpoint = load(path.join(root, 'app/api/products/popular/route.ts'))
;(async () => {
  const respuesta = await endpoint.GET(new Request('https://example.org/api/products/popular?organizationId=999'))
  assert.deepEqual(consultas, [[140, 9]]); casos++
  assert.deepEqual(respuesta.body, { suggestions: ['Producto A'] }); casos++
  contexto = null
  const vacia = await endpoint.GET()
  assert.deepEqual(vacia.body, { suggestions: [] }); casos++
  check(consultas.length === 1, 'sin contexto no se consulta catálogo')
  console.log(`ok ${casos} pruebas de render de encabezado/búsqueda y contrato de populares`)
})().catch((error) => { console.error(error); process.exitCode = 1 })
