/** Render real del componente compartido por borrador/publicado, sin backend ni navegador. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()
const element = (tag) => ({ children, ...props }) => React.createElement(tag, props, children)
const mocks = {
  'next/link': { __esModule: true, default: element('a') },
  'next/image': { __esModule: true, default: ({ fill, ...props }) => React.createElement('img', props) },
  'next/navigation': { useRouter: () => ({ push() {} }) },
  '@/components/ui/button': { Button: ({ variant, size, asChild, children, ...props }) => asChild ? React.cloneElement(children, props) : React.createElement('button', props, children) },
  '@/components/site/CurrencyProvider': { Price: ({ value, ...props }) => React.createElement('span', props, `$${value}`) },
  '@/lib/hooks/useFavorites': { useFavorites: () => ({ isFavorite: () => false, toggleFavorite() {} }) },
  '@/lib/hooks/useAuthCustomer': { useAuthCustomer: () => ({ customer: null }) },
  '@/components/site/ProductQuickView': { ProductQuickView: () => null },
  '@/components/site/ShareDialog': { ShareDialog: () => null },
  '@/lib/cart': { addProductToCart() {} },
  '@/lib/outlet/RutaSitioContext': { useRutaSitio: () => ({ ruta: (p) => p }) },
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod)
  mod.filename = file
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = (id) => {
    if (mocks[id]) return mocks[id]
    if (id.startsWith('./')) { const ruta = path.resolve(path.dirname(file), id); return load(fs.existsSync(`${ruta}.ts`) ? `${ruta}.ts` : `${ruta}.tsx`) }
    if (id.startsWith('@/')) { const ruta = path.join(root, id.slice(2)); return load(fs.existsSync(`${ruta}.ts`) ? `${ruta}.ts` : `${ruta}.tsx`) }
    return require(id)
  }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  mod._compile(output, file)
  return mod.exports
}
const { ProductCard } = load(path.join(root, 'components/sections/products/ProductCard.tsx'))
const style = load(path.join(root, 'lib/sectionStyle.ts'))
const product = { id: 1, uuid: 'producto-prueba', name: 'Producto de prueba', product_prices: [{ price: 100, compare_price: 120 }], product_images: [], track_inventory: false, rating_avg: 4.7, reviews_count: 12, organization_id: 140 }
let cases = 0
const check = (ok, message) => { cases++; assert.ok(ok, message) }
const { TarjetaProductoProvider, useEstiloTarjeta } = load(path.join(root, 'components/site/TarjetaProductoContext.tsx'))
const render = (props) => {
  const { globalStyle, ...cardProps } = props
  return renderToStaticMarkup(React.createElement(TarjetaProductoProvider, { valor: globalStyle }, React.createElement(ProductCard, { product, primaryColor: '#123456', ...cardProps })))
}
for (const variant of ['grid', 'list', 'overlay']) {
  for (const position of ['above_title', 'below_title', 'below_price']) {
    const html = render({ variant, cardStyle: { show_rating: true, reviews_source: 'real', rating_position: position } })
    check(html.includes(`data-rating-position="${position}"`), `${variant}: reseñas en ${position}`)
    const ratingAt = html.indexOf('data-rating-position')
    const titleAt = html.indexOf('<h3')
    const priceAt = html.lastIndexOf('$100')
    check(position === 'above_title' ? ratingAt < titleAt : position === 'below_price' ? ratingAt > priceAt : ratingAt > titleAt && ratingAt < priceAt, `${variant}: orden real ${position}`)
  }
}
for (const position of ['below', 'below_left', 'below_right', 'beside_price', 'overlay_bottom', 'overlay_top_left', 'overlay_top_right', 'overlay_bottom_left', 'overlay_bottom_right', 'overlay_hover', 'bottom_bar']) {
  for (const variant of ['grid', 'list']) {
    const html = render({ variant, cardButtons: [{ action: 'add_to_cart', label: 'Acción', position, full_width: true }] })
    check(html.includes(`data-button-position="${position}"`), `${variant}: botón ${position}`)
    check((html.match(/Acción/g) || []).length === 1, `${variant}: botón ${position} visible una sola vez`)
    if (['below_left', 'below_right', 'beside_price'].includes(position)) {
      check(!html.slice(html.indexOf('data-button-position'), html.indexOf('data-button-position') + 180).includes('w-full'), `${position}: contenedor ajustado al botón`)
    }
    if (position === 'overlay_hover') check(html.includes('opacity-100 md:opacity-0'), 'hover visible en dispositivos táctiles')
  }
}
for (const row of ['top', 'middle', 'bottom']) {
  for (const col of ['left', 'center', 'right']) {
    const html = render({ cardStyle: { text_align: `${row}-${col}` } })
    check(html.includes(`text-align:${col}`), `${row}-${col}: alineación horizontal`)
    check(html.includes(`justify-content:${row === 'top' ? 'flex-start' : row === 'middle' ? 'center' : 'flex-end'}`), `${row}-${col}: alineación vertical`)
  }
}
const overlay = render({ cardStyle: { card_layout: 'overlay' } })
check(overlay.includes('data-card-layout="overlay"'), 'el campo card_layout activa la superposición')
check(overlay.includes('from-black/90'), 'superposición con degradado de contraste')
check((overlay.match(/<h3/g) || []).length === 1, 'superposición sin duplicar título')
for (const shape of ['pill', 'square', 'ribbon', 'corner', 'rounded', 'semi']) {
  const html = render({ badges: [{ type: 'custom', label: 'Etiqueta', shape }] })
  check(html.includes(style.resolveBadgeClasses({ shape })), `forma ${shape} renderizada`)
}
const choose = render({ cardButtons: [{ action: 'choose' }] })
check(choose.includes('<button') && !choose.includes('aria-label="Elegir"'), 'Elegir se dibuja como botón de apertura del selector')
check(choose.includes('Elegir') && !choose.includes('ProductChoiceDialog'), 'Elegir no abre el selector antes de la interacción')
check(render({}).includes('data-card-layout="vertical"'), 'predeterminado vertical conservado')
for (const position of ['above_title', 'below_title', 'below_price', 'over_image']) {
  const html = render({ cardStyle: { reviews_source: 'real', product_card_style: { show_reviews: true, reviews_position: position } } })
  check(html.includes(`data-rating-position="${position}"`), `inspector nuevo: reseñas ${position}`)
}
for (const preset of ['actual', 'minimal', 'boxed', 'overlay', 'compact', 'rich']) {
  const html = render({ cardStyle: { product_card_style: { card_preset: preset } } })
  check(html.includes('Producto de prueba'), `preset ${preset} conserva el producto`)
  if (preset === 'overlay') check(html.includes('data-card-layout="overlay"'), 'preset nuevo overlay activa texto en imagen')
  if (preset === 'compact') check(html.includes('data-card-layout="horizontal"'), 'preset nuevo compacto activa fila')
}
for (const position of ['above_title', 'below_title', 'beside_button', 'over_image']) {
  const html = render({ cardStyle: { product_card_style: { price_position: position } } })
  check(html.includes(`data-price-position="${position}"`), `inspector nuevo: precio ${position}`)
}
const disabledButtons = render({ cardStyle: { product_card_style: { add: { show: false }, buy: { show: false } } } })
check(!disabledButtons.includes('data-button-position'), 'los interruptores del inspector nuevo ocultan los botones')
const hiddenLabels = render({ cardStyle: { product_card_style: { label_discount: { show: false }, label_sold_out: { show: false }, label_new: { show: false }, label_shipping: { show: false } } } })
check(!hiddenLabels.includes('-17%'), 'etiquetas apagadas no reaparecen por fallback')
const gradientButton = render({ cardStyle: { product_card_style: { add: { button_style: 'gradient', gradient_1: '#112233', gradient_2: '#445566', gradient_angle: 45 } } } })
check(gradientButton.includes('linear-gradient(45deg'), 'degradado del botón del inspector nuevo')
const shapeStyle = render({ cardStyle: { product_card_style: { label_shape: 'rounded', label_style: 'outline' } } })
check(shapeStyle.includes('rounded-xl') && shapeStyle.includes('background-color:transparent'), 'etiqueta redondeada y contorno desde inspector nuevo')
check(render({ globalStyle: { card_preset: 'actual' } }) === render({}), 'el preset global actual no cambia el markup predeterminado')
const globalCard = render({ globalStyle: { card_preset: 'boxed', card_radius: 20, price_color: '#AABBCC' } })
check(globalCard.includes('--card-radius:20px') && globalCard.includes('#AABBCC'), 'el estilo global se dibuja en la tarjeta real')
const sectionWins = render({ globalStyle: { card_radius: 20, price_color: '#AABBCC' }, cardStyle: { product_card_style: { card_radius: 4 } } })
check(sectionWins.includes('--card-radius:4px') && sectionWins.includes('#AABBCC'), 'la sección pisa radio y conserva el precio del sitio')
const Probe = () => React.createElement('pre', null, JSON.stringify(useEstiloTarjeta({ card_radius: 4 })))
const inherited = renderToStaticMarkup(React.createElement(TarjetaProductoProvider, { valor: { card_preset: 'boxed', card_gap: 24 } }, React.createElement(Probe)))
check(inherited.includes('&quot;card_gap&quot;:24') && inherited.includes('&quot;card_radius&quot;:4'), 'el contexto conserva gap global y el reemplazo parcial de la sección')
const customButtons = render({ cardButtons: [{ action: 'add_to_cart', label: 'Mi compra', bg_color: '#ABCDEF', full_width: false }, { action: 'share', label: 'Compartir enlace' }], cardStyle: { product_card_style: { add: { button_shape: 'pill' } } } })
check(customButtons.includes('Mi compra') && customButtons.includes('Compartir enlace'), 'un ajuste parcial conserva botones y textos personalizados')
check(customButtons.includes('#ABCDEF'), 'el ajuste parcial no pisa el color anterior del botón')
const { temaPublicoDesdeTema, temaPublicoDesdeMensaje } = load(path.join(root, 'lib/website/v2/temaPublico.ts'))
const siteTheme = { colores: {}, tipografia: {}, tarjetaProducto: { mode: 'value', value: { card_radius: 20, card_gap: 24 } } }
const branchTheme = { colores: {}, tipografia: {}, tarjetaProducto: { mode: 'inherit' } }
check(temaPublicoDesdeTema(branchTheme, true, siteTheme).tarjetaProducto.card_radius === 20, 'la sede hereda tarjetas del principal publicado')
check(temaPublicoDesdeTema({ ...branchTheme, tarjetaProducto: { mode: 'clear' } }, true, siteTheme).tarjetaProducto === null, 'la sede puede vaciar el estilo global')
check(temaPublicoDesdeTema({ colores: {}, tipografia: {} }, false, null).tarjetaProducto === null, 'tema antiguo sigue sin parche de tarjeta')
check(temaPublicoDesdeMensaje({ tema: siteTheme, esSede: false }).tarjetaProducto.card_gap === 24, 'el mensaje de vista previa admite y conserva la misma configuración global')
console.log(`verify:product-card-render ok (${cases} casos)`)
