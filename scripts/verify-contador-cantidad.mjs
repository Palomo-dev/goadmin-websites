/**
 * verify-contador-cantidad.mjs — «Contador de cantidad» de la tarjeta (add.quantity_stepper).
 *
 *   npm run verify:contador-cantidad
 *
 * - La clave es booleana, false por defecto, y solo cuenta con icon_only + circle.
 * - getLineQty / setLineQty: qty <= 0 quita la línea, siempre dispara `cart-updated`.
 * - Bajar la cantidad no es un AddToCart (CartEventTracker solo cuenta lo que sube).
 * - ProductCard sin la clave no usa el contador.
 * - Fusión sitio + sección (4-nov): el preset de una sección no borra el contador escrito en el sitio;
 *   lo escrito en la sección sigue ganando.
 * - Padres: el «+» abre el selector de variantes (DialogoVariantes, el mismo de ProductGrid).
 * - `data-contador-razon` (estilo | carrito_externo | padre | sin_stock | sin_precio).
 * - Prioridad card_buttons / product_card_style.add, documentada en ProductCard.
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import { aplicarEstiloTarjeta, contadorCantidadActivo, PRESETS_TARJETA, razonSinContador, resolverTarjetaProducto } from '../lib/website/tarjetaProducto.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }

// ── Clave y valor por defecto ──
const est = (add) => aplicarEstiloTarjeta({ add })
check(contadorCantidadActivo(undefined) === false, 'sin estilo: sin contador')
check(contadorCantidadActivo({ button_style: 'icon_only', button_shape: 'circle' }) === false, 'sin la clave: sin contador (default false)')
check(contadorCantidadActivo({ button_style: 'icon_only', button_shape: 'circle', quantity_stepper: true }) === true, 'icon_only + circle + true: contador')
check(contadorCantidadActivo({ button_style: 'solid', button_shape: 'pill', quantity_stepper: true }) === false, 'otro estilo: sin contador')
check(contadorCantidadActivo({ button_style: 'icon_only', button_shape: 'rounded', quantity_stepper: true }) === false, 'icon_only sin círculo: sin contador')
const normal = est({ button_style: 'icon_only', button_shape: 'circle', quantity_stepper: 'true' })
check(normal?.add?.quantity_stepper === undefined, 'solo el booleano true se guarda')
const normalOff = est({ button_style: 'icon_only', button_shape: 'circle', quantity_stepper: false })
check(normalOff?.add && !('quantity_stepper' in normalOff.add), 'false no se guarda (ausente = lo de hoy)')
const normalOn = est({ button_style: 'icon_only', button_shape: 'circle', quantity_stepper: true })
check(normalOn?.add?.quantity_stepper === true, 'true se conserva')

// ── Carrito (lib/cart.ts sin alias ni React) ──
const dir = await mkdtemp(join(tmpdir(), 'verify-contador-'))
try {
  let src = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/cart.ts'), 'utf8'))
  src = src
    .replace(/import \{ useEffect, useState \} from 'react'/, "const useEffect = () => {}; const useState = (v) => [v, () => {}]")
    .replace(/import \{ getCartKey \} from '@\/lib\/utils'/, 'const getCartKey = (s, b) => Number.isInteger(b) ? `cart_${s}_${b}` : `cart_${s}`')
  await writeFile(join(dir, 'cart.mjs'), src)
  const almacen = new Map()
  let eventos = 0
  globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) }
  globalThis.window = { dispatchEvent: (e) => { if (e.type === 'cart-updated') eventos++ } }
  globalThis.CustomEvent = class { constructor(type) { this.type = type } }
  const cart = await import(pathToFileURL(join(dir, 'cart.mjs')).href)
  const linea = { id: 7, name: 'Camisa', price: 50000, sku: 'CAM-7' }
  check(cart.getLineQty('demo', 3, 7) === 0, 'sin línea: 0')
  cart.setLineQty('demo', 3, 7, 1, linea)
  check(cart.getLineQty('demo', 3, 7) === 1 && eventos === 1, '+ desde 0 crea la línea y dispara cart-updated')
  const guardada = JSON.parse(almacen.get('cart_demo_3'))[0]
  check(guardada.id === 7 && guardada.price === 50000 && guardada.sku === 'CAM-7' && guardada.quantity === 1, 'la línea tiene el formato de addProductToCart')
  cart.setLineQty('demo', 3, 7, 3, linea)
  check(cart.getLineQty('demo', 3, 7) === 3 && eventos === 2, 'cambia la cantidad')
  cart.setLineQty('demo', 3, 7, 0, linea)
  check(cart.getLineQty('demo', 3, 7) === 0 && JSON.parse(almacen.get('cart_demo_3')).length === 0 && eventos === 3, 'qty 0 quita la línea y dispara cart-updated')
  cart.setLineQty('demo', 3, 7, -2)
  check(eventos === 4 && JSON.parse(almacen.get('cart_demo_3')).length === 0, 'qty negativa sin línea: nada, pero dispara cart-updated')
  cart.setLineQty('demo', 3, 9, 2)
  check(cart.getLineQty('demo', 3, 9) === 0, 'sin datos de la línea no se crea')
  cart.addProductToCart('demo', null, linea)
  cart.setLineQty('demo', null, 7, 2)
  check(cart.getLineQty('demo', null, 7) === 2, 'sin sede usa la clave de siempre')
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ── «−» no es AddToCart: CartEventTracker solo cuenta lo que sube ──
const tracker = await readFile(join(ROOT, 'components/site/CartEventTracker.tsx'), 'utf8')
check(/if \(added <= 0\) continue/.test(tracker), 'CartEventTracker ignora bajas de cantidad')

// ── Con la clave en false la tarjeta no cambia ──
const tarjeta = await readFile(join(ROOT, 'components/sections/products/ProductCard.tsx'), 'utf8')
check(tarjeta.includes("const conContador = !!estiloTarjeta && estiloTarjeta.add?.quantity_stepper === true && razonContador === null"), 'el contador exige la clave y ninguna razón en contra')
check(tarjeta.includes('razonSinContador(estiloTarjeta.add, { esPadre: isParent, sinStock: outOfStock, sinPrecio: precioContador === null, carritoExterno: !!onAddToCart })'), 'la razón sale del estilo resuelto, padre, stock, precio y carrito externo')
check(/useCartLineQty\(subCarrito, branchId, product\.id, conContador\)/.test(tarjeta), 'apagado no escucha el carrito')

// ── Fusión sitio + sección: el preset de la sección no apaga el contador del sitio ──
const PILDORA_SITIO = { add: { button_style: 'icon_only', button_shape: 'circle', button_position: 'over_image_corner', quantity_stepper: true } }
for (const preset of PRESETS_TARJETA) {
  const r = resolverTarjetaProducto(PILDORA_SITIO, { card_preset: preset, card_radius: 4 })
  check(contadorCantidadActivo(r?.add), `sitio con contador + sección con preset «${preset}»: sigue el contador`)
}
{
  const r = resolverTarjetaProducto(PILDORA_SITIO, { card_preset: 'boxed', add: { bg: '#ff0000' } })
  check(contadorCantidadActivo(r?.add) && r.add.bg === '#ff0000', 'lo escrito en la sección se suma, clave por clave')
  const r2 = resolverTarjetaProducto(PILDORA_SITIO, { add: { button_shape: 'rounded' } })
  check(!contadorCantidadActivo(r2?.add) && r2.add.button_style === 'icon_only', 'lo escrito en la sección gana: sin círculo no hay contador')
  const r3 = resolverTarjetaProducto({ card_preset: 'boxed' }, { add: { button_style: 'icon_only', button_shape: 'circle', quantity_stepper: true } })
  check(contadorCantidadActivo(r3?.add), 'contador escrito en la sección sobre un sitio con preset')
  const r4 = resolverTarjetaProducto({ add: { button_style: 'icon_only', button_shape: 'circle' } }, { add: { quantity_stepper: true } })
  check(contadorCantidadActivo(r4?.add), 'la sección solo enciende el contador; forma y estilo vienen del sitio')
  const r5 = resolverTarjetaProducto({ card_preset: 'minimal', add: { button_style: 'icon_only' } }, { card_preset: 'boxed' })
  check(r5?.add?.button_style === 'icon_only', 'escrito en el sitio > preset de la sección (botones)')
  const r6 = resolverTarjetaProducto({ card_preset: 'minimal' }, { card_preset: 'boxed' })
  const boxed = aplicarEstiloTarjeta({ card_preset: 'boxed' })
  check(JSON.stringify(r6?.add) === JSON.stringify({ ...aplicarEstiloTarjeta({ card_preset: 'minimal' }).add, ...boxed.add }), 'sin nada escrito: preset de la sección sobre preset del sitio (como antes)')
  const r7 = resolverTarjetaProducto({ card_radius: 20 }, { card_preset: 'boxed' })
  check(r7?.card_radius === boxed.card_radius, 'las claves de tarjeta siguen como antes: el preset de la sección gana al sitio')
  check(resolverTarjetaProducto(null, null) === null && resolverTarjetaProducto({ card_preset: 'actual' }, { card_preset: 'actual' }) === null, 'sin estilo: la tarjeta de hoy')
}

// ── data-contador-razon ──
const SIMPLE = { esPadre: false, sinStock: false, sinPrecio: false, carritoExterno: false }
const ADD_OK = { button_style: 'icon_only', button_shape: 'circle', quantity_stepper: true }
check(razonSinContador(undefined, SIMPLE) === null && razonSinContador({ button_style: 'icon_only', button_shape: 'circle' }, SIMPLE) === null, 'sin la clave: sin razón (no se pidió)')
check(razonSinContador(ADD_OK, SIMPLE) === null, 'simple con stock y precio: sale el contador')
check(razonSinContador({ ...ADD_OK, button_shape: 'rounded' }, SIMPLE) === 'estilo', 'estilo')
check(razonSinContador({ ...ADD_OK, button_style: 'solid' }, { ...SIMPLE, esPadre: true }) === 'estilo', 'estilo antes que padre')
check(razonSinContador(ADD_OK, { ...SIMPLE, carritoExterno: true }) === 'carrito_externo', 'carrito_externo')
check(razonSinContador(ADD_OK, { ...SIMPLE, esPadre: true }) === 'padre', 'padre')
check(razonSinContador(ADD_OK, { ...SIMPLE, sinStock: true }) === 'sin_stock', 'sin_stock')
check(razonSinContador(ADD_OK, { ...SIMPLE, sinPrecio: true }) === 'sin_precio', 'sin_precio')
check(tarjeta.includes("{...(razonContador ? { 'data-contador-razon': razonContador } : {})}"), 'la tarjeta deja data-contador-razon')

// ── Padres: el «+» abre el selector de variantes ──
check(tarjeta.includes("if (esPadre && contadorEnPadre && accion === 'add_to_cart') return estilo.add"), 'padre con contador: el «+» usa el estilo de «Agregar», no «Elegir»')
check(tarjeta.includes("if (button.action === 'add_to_cart' && isParent && abrirVariantes && btnIconOnly)") && tarjeta.includes('abrirVariantes()'), 'el «+» del padre abre el selector')
check(tarjeta.includes('const contadorEnPadre = !!estiloTarjeta && contadorCantidadActivo(estiloTarjeta.add) && !onAddToCart && isParent && !padreSinVariantes(product)'), 'solo con el contador, sin carrito externo y con variantes')
check(tarjeta.includes('{contadorEnPadre && dialogoVariantes.dialogo}'), 'la tarjeta monta el diálogo solo con el contador en un padre')
const dialogo = await readFile(join(ROOT, 'components/site/DialogoVariantes.tsx'), 'utf8')
check(dialogo.includes('/api/products/${producto.id}/variants?organizationId=${organizationId}${sedeParam}') && dialogo.includes('agregarPlatoAlCarrito(organizationSubdomain, branchId, {'), 'DialogoVariantes: misma carga y misma línea de carrito de siempre')
const grilla = await readFile(join(ROOT, 'components/site/ProductGrid.tsx'), 'utf8')
check(grilla.includes('useDialogoVariantes(') && !grilla.includes('<VariantSelector'), 'ProductGrid usa el mismo diálogo (sin copia)')

// ── Sin <a> dentro de <a>: «Elegir» sobre la imagen es botón (React #418/#423 al hidratar) ──
check(tarjeta.includes("const POSICIONES_SOBRE_IMAGEN = ['overlay_bottom', 'overlay_top_left', 'overlay_top_right', 'overlay_bottom_left', 'overlay_bottom_right', 'overlay_hover']"), 'posiciones sobre la imagen en una sola lista')
check(tarjeta.includes('const overlayPositions = POSICIONES_SOBRE_IMAGEN'), 'la tarjeta usa la misma lista para pintar sobre la imagen')
check(tarjeta.includes('dentroDeEnlace={!!positionFilter && POSICIONES_SOBRE_IMAGEN.includes(positionFilter)}'), 'renderButtons marca los botones que van dentro del enlace de la imagen')
check(/if \(dentroDeEnlace\) \{\s*return \(\s*<Button/.test(tarjeta) && tarjeta.includes("navegar(ruta(`/productos/${product.uuid}`))"), '«Elegir» dentro del enlace es un botón que navega al detalle')
{
  // El único <Link> de CardButtonRenderer es el «Elegir» fuera de la imagen.
  const ini = tarjeta.indexOf('function CardButtonRenderer(')
  const fin = tarjeta.indexOf('\nexport function ProductCard(', ini)
  const cuerpo = tarjeta.slice(ini, fin)
  check((cuerpo.match(/<Link /g) || []).length === 1 && !/<a /.test(cuerpo), 'CardButtonRenderer: un solo <Link> (fuera de la imagen) y ningún <a>')
}

// ── Prioridad card_buttons / product_card_style.add ──
check(tarjeta.includes("// Prioridad entre `card_buttons` (heredado, de la sección) y el estilo de tarjeta"), 'prioridad documentada en ProductCard')
check(tarjeta.includes("if (estiloTarjeta && contadorCantidadActivo(estiloTarjeta.add) && !effectiveButtons.some((b) => b.action === 'add_to_cart'))"), 'con el contador, se agrega «Agregar» si card_buttons no lo trae')

// ── Secciones de la portada: con el contador encendido no pasan su addToCart ──
// La tarjeta solo pinta la píldora sin onAddToCart externo; FeaturedProducts («Lo más vendido»),
// ProductsGrid, OffersGrid y sus carruseles siempre pasaban el suyo, así que la píldora nunca salía ahí.
// Misma decisión que la sección: contadorCantidadActivo(resolverTarjetaProducto(sitio, sección).add).
const decide = (sitio, seccion) => contadorCantidadActivo(resolverTarjetaProducto(sitio, seccion)?.add)
const PILDORA = { add: { button_style: 'icon_only', button_shape: 'circle', button_position: 'over_image_corner', quantity_stepper: true } }
check(decide(null, PILDORA) === true, 'sección con quantity_stepper + icon_only + circle: no se pasa onAddToCart')
check(decide(null, { add: { button_style: 'icon_only', button_shape: 'circle' } }) === false, 'sección sin la clave: se pasa onAddToCart, como hoy')
check(decide(null, undefined) === false, 'sección sin estilo de tarjeta: se pasa onAddToCart, como hoy')
check(decide(PILDORA, undefined) === true, 'estilo del sitio con el contador y sección sin estilo: no se pasa onAddToCart')
check(decide(null, { add: { button_style: 'solid', button_shape: 'pill', quantity_stepper: true } }) === false, 'quantity_stepper sin icon_only + circle: se pasa onAddToCart')
for (const [ruta, tarjetas] of [
  ['components/sections/products/FeaturedProducts.tsx', 2],
  ['components/sections/products/ProductsGrid.tsx', 1],
  ['components/sections/retail/OffersGrid.tsx', 1],
  // Variante «carousel» de featured_products y products_grid (SectionRenderer).
  ['components/sections/products/FeaturedProductsCarousel.tsx', 2],
  ['components/sections/products/ProductsCarousel.tsx', 2],
]) {
  const src = await readFile(join(ROOT, ruta), 'utf8')
  check(/const estiloSeccion = useEstiloTarjeta\(content\.product_card_style\)/.test(src), `${ruta}: resuelve el estilo de la sección una vez`)
  check(/const usarContador = contadorCantidadActivo\(estiloSeccion\?\.add\)/.test(src), `${ruta}: decide el contador con contadorCantidadActivo`)
  const condicionados = (src.match(/onAddToCart=\{usarContador \? undefined : addToCart\}/g) || []).length
  check(condicionados === tarjetas, `${ruta}: ${condicionados} de ${tarjetas} tarjetas omiten onAddToCart con el contador`)
  check(!/onAddToCart=\{addToCart\}/.test(src), `${ruta}: queda una tarjeta con onAddToCart fijo (sin contador)`)
}

if (problemas.length) {
  console.error(`verify-contador-cantidad: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-contador-cantidad: ${casos} casos`)
