/**
 * verify-contador-cantidad.mjs — «Contador de cantidad» de la tarjeta (add.quantity_stepper).
 *
 *   npm run verify:contador-cantidad
 *
 * - La clave es booleana, false por defecto, y solo cuenta con icon_only + circle.
 * - getLineQty / setLineQty: qty <= 0 quita la línea, siempre dispara `cart-updated`.
 * - Bajar la cantidad no es un AddToCart (CartEventTracker solo cuenta lo que sube).
 * - ProductCard sin la clave no usa el contador.
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import { aplicarEstiloTarjeta, contadorCantidadActivo } from '../lib/website/tarjetaProducto.ts'

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
check(/contadorCantidadActivo\(estiloTarjeta\.add\) && !onAddToCart && !isParent && !outOfStock/.test(tarjeta), 'el contador exige la clave, sin onAddToCart externo, no padre y con stock')
check(/useCartLineQty\(subCarrito, branchId, product\.id, conContador\)/.test(tarjeta), 'apagado no escucha el carrito')

if (problemas.length) {
  console.error(`verify-contador-cantidad: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-contador-cantidad: ${casos} casos`)
