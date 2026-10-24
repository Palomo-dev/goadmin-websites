/** Interacción del botón Elegir con selectores reales; fetch y escritura de carrito simulados. */
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const { JSDOM } = require(require.resolve('jsdom', { paths: [root, path.resolve(root, '../go-admin-erp')] }))
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'https://org-140.example.test' })
global.window = dom.window; global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true
window.HTMLElement.prototype.scrollIntoView = () => {}
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = React
const prefix = fs.readFileSync(path.join(root, 'scripts/verify-product-card-render.cjs'), 'utf8').split("const { ProductCard } = load(")[0]
const loader = new Module(path.join(root, 'scripts/__choice_test.cjs'), module)
loader.filename = path.join(root, 'scripts/__choice_test.cjs'); loader.paths = Module._nodeModulePaths(root)
loader._compile(prefix + '\nmodule.exports={load,mocks};', loader.filename)
const { load, mocks } = loader.exports
const writes = [], requests = []
mocks['@/lib/cart'] = { addProductToCart() {}, agregarPlatoAlCarrito: (...args) => writes.push(args) }
mocks['@/components/site/CurrencyProvider'].useCurrency = () => ({ formatPrice: (n) => `$${n}` })
mocks['next/dynamic'] = { __esModule: true, default: () => (props) => React.createElement(load(path.join(root, 'components/site/ProductChoiceDialog.tsx')).ProductChoiceDialog, props) }
const { ProductCard } = load(path.join(root, 'components/sections/products/ProductCard.tsx'))
const app = createRoot(document.getElementById('app'))
const product = { id: 1, uuid: 'producto-prueba', name: 'Producto de prueba', product_prices: [{ price: 100 }], product_images: [], track_stock: false, organization_id: 140 }
const variants = [ { ...product, id: 2, name: 'Mediano', variant_data: { tamano: 'M' }, product_prices: [{ price: 110 }] }, { ...product, id: 3, name: 'Grande', variant_data: { tamano: 'L' }, product_prices: [{ price: 130 }] } ]
const groups = [{ id: 10, name: 'Acompañante', selection_mode: 'single', min_selections: 1, max_selections: 1, required: true, display_order: 0, product_modifiers: [{ id: 20, name: 'Papas', extra_price: 15, is_active: true, display_order: 0 }] }]
let payload = { variants, modifierGroups: groups, variantModifierGroups: {}, ordenAtributos: {} }, status = 200, cases = 0
const check = (cond, message) => { cases++; assert.ok(cond, message) }
global.fetch = async (url) => { requests.push(url); return { ok: status === 200, json: async () => payload } }
const buttons = () => [...document.querySelectorAll('button')]
const findButton = (text) => buttons().find((b) => b.textContent.trim() === text)
const click = async (button) => { assert.ok(button, 'botón disponible'); await act(async () => { button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await Promise.resolve() }) }
const render = async (p = product, cardButtons = [{ action: 'choose' }]) => { await act(async () => { app.render(React.createElement(ProductCard, { key: Math.random(), product: p, primaryColor: '#123456', organizationSubdomain: 'org-140', branchId: 8, cardButtons })) }) }
;(async () => {
 for (const width of [390, 1440]) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  const requestsBeforeRender = requests.length
  await render({ ...product, is_parent: true })
  check(requests.length === requestsBeforeRender && !document.querySelector('[role=dialog]'), `${width}: no carga opciones antes del clic`)
  const before = writes.length
  await click(findButton('Elegir'))
  check(requests.at(-1).includes('/api/products/1/variants?branchId=8'), `${width}: opciones de producto y sede correctas`)
  check(document.body.textContent.includes('Selecciona una variante') && document.body.textContent.includes('Acompañante'), `${width}: selector real de variantes y modificadores abierto`)
  await click(findButton('Agregar al carrito'))
  check(writes.length === before && document.body.textContent.includes('Acompañante'), `${width}: grupo obligatorio impide agregar antes de elegir`)
  await click(findButton('L'))
  await click(buttons().find((b) => b.textContent.includes('Papas')))
  await click(findButton('Agregar al carrito'))
  check(writes.length === before + 1, `${width}: agrega solamente tras la elección válida`)
  const [sub, branch, line] = writes.at(-1)
  check(sub === 'org-140' && branch === 8 && line.productId === 3 && line.unitPrice === 145 && line.modifiers[0].modifierId === 20, `${width}: conserva variante, sede, precio y modificadores`)
  check(!document.body.textContent.includes('Selecciona una variante'), `${width}: cierra después de agregar`)
 }
 const requestsBeforeLegacy = requests.length
 await render({ ...product, is_parent: true }, [{ action: 'add_to_cart' }, { action: 'buy_now' }])
 const legacyChoose = [...document.querySelectorAll('a')].filter((link) => link.textContent.trim() === 'Elegir')
 check(legacyChoose.length === 1 && !findButton('Elegir'), 'add/buy del padre conservan su enlace al detalle y su deduplicación')
 check(requests.length === requestsBeforeLegacy, 'add/buy actuales no cargan el selector nuevo')
 payload = { variants: [], modifierGroups: groups, variantModifierGroups: {}, ordenAtributos: {} }
 await render()
 await click(findButton('Elegir'))
 const beforeSimple = writes.length
 await click(findButton('Agregar al carrito'))
 check(writes.length === beforeSimple, 'producto simple con modificador obligatorio tampoco se agrega incompleto')
 await click(buttons().find((b) => b.textContent.includes('Papas')))
 await click(findButton('Agregar al carrito'))
 check(writes.at(-1)[2].productId === 1 && writes.at(-1)[2].unitPrice === 115, 'producto simple conserva sus modificadores y extra')
 await render({ ...product, is_parent: true })
 await click(findButton('Elegir'))
 check(document.querySelector('[role=alert]')?.textContent.includes('variantes disponibles'), 'padre sin variantes falla cerrado')
 check(!findButton('Agregar al carrito'), 'padre sin variantes no ofrece agregar')
 status = 503
 await render()
 const beforeError = writes.length
 await click(findButton('Elegir'))
 check(document.querySelector('[role=alert]') && writes.length === beforeError, 'fallo de carga muestra error sin agregar')
 check(findButton('Reintentar'), 'el fallo ofrece reintentar')
 await act(async () => app.unmount())
 console.log(`verify:product-choice-interaction ok (${cases} casos; selectores reales, móvil/escritorio)`)
})().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => window.close())
