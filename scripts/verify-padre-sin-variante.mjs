/**
 * verify-padre-sin-variante.mjs — un producto padre (`is_parent = true`) nunca va al carrito.
 *
 *   npm run verify:padre
 *
 * Sin red ni base. Carga los módulos PUROS reales (lib/products/datosTarjeta.ts y la cadena de
 * lib/products/precio-servidor.ts) con `module.stripTypeScriptTypes` de Node 22, como
 * verify-precios-pedido, y revisa en el fuente que cada botón de agregar consulte la regla.
 *
 * Caso real (org 338): el jean CB-FF-72125 (id 106000) es padre, perdió sus 6 tallas en la
 * restauración del 2026-11-03 y la tarjeta lo agregaba directo porque `variant_count = 0`
 * significaba «se vende como simple». Salían pedidos sin talla.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODULOS = {
  urlPublica: 'lib/storage/urlPublica.ts',
  datosTarjeta: 'lib/products/datosTarjeta.ts',
  'get-current-price': 'lib/get-current-price.ts',
  'carta-sede': 'lib/products/carta-sede.ts',
  'visibilidad-web': 'lib/products/visibilidad-web.ts',
  modificadores: 'lib/products/modificadores.ts',
  'precio-servidor': 'lib/products/precio-servidor.ts',
}
const aMjs = (ts) =>
  stripTypeScriptTypes(ts, { mode: 'strip' }).replace(/from\s+'@\/lib\/(?:[a-z]+\/)?([A-Za-z-]+)'/g, (_, n) => {
    if (!MODULOS[n]) throw new Error(`import no puro: ${n}`)
    return `from './${n}.mjs'`
  })

const dir = await mkdtemp(join(tmpdir(), 'verify-padre-'))
let tarjeta, servidor
try {
  for (const [n, r] of Object.entries(MODULOS)) await writeFile(join(dir, `${n}.mjs`), aMjs(await readFile(join(ROOT, r), 'utf8')))
  tarjeta = await import(pathToFileURL(join(dir, 'datosTarjeta.mjs')).href)
  servidor = await import(pathToFileURL(join(dir, 'precio-servidor.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

let n = 0
const eq = (a, b, msg) => { assert.equal(a, b, msg); n++ }
const ok = (c, msg) => { assert.ok(c, msg); n++ }

// ─── 1. Regla de la tarjeta (lib/products/datosTarjeta.ts) ─────────────────────────────────
const { isParentProduct, padreSinVariantes, requiereElegir } = tarjeta
const padre = (variant_count) => ({ id: 106000, is_parent: true, has_variants: true, variant_count })
eq(isParentProduct(padre(0)), true, 'padre con 0 variantes sigue siendo padre (antes: simple → «Agregar»)')
eq(isParentProduct(padre(6)), true, 'padre con variantes')
eq(isParentProduct(padre(undefined)), true, 'padre sin conteo')
eq(isParentProduct({ id: 1, is_parent: false }), false, 'simple')
eq(isParentProduct({ id: 1 }), false, 'sin campo is_parent')
eq(isParentProduct({ id: 1, has_variants: true }), true, 'has_variants del listado')
eq(requiereElegir(padre(0)), true, 'el botón nunca es «Agregar» para un padre')

eq(padreSinVariantes(padre(0)), true, '0 variantes confirmadas → «No disponible»')
eq(padreSinVariantes(padre('0')), true, '«0» como texto')
eq(padreSinVariantes(padre(6)), false, 'con variantes → «Elegir»')
eq(padreSinVariantes(padre(undefined)), false, 'sin conteo (consulta falló) → «Elegir», no se afirma nada')
eq(padreSinVariantes(padre(null)), false, 'conteo null → «Elegir»')
eq(padreSinVariantes({ id: 1, is_parent: false, variant_count: 0 }), false, 'un simple nunca es «padre sin variantes»')

// ─── 2. Servidor: /api/orders rechaza la línea del padre (lib/products/precio-servidor.ts) ──
const ORG = 338
const fila = (id, extra = {}) => ({
  id, organization_id: ORG, name: `Producto ${id}`, sku: `SKU-${id}`, status: 'active', parent_product_id: null,
  is_parent: false, track_stock: false, sale_mode: 'unit', qty_decimals: 0, min_sale_qty: null, padre: null, ...extra,
})
const precio = (product_id, price) => [{ id: product_id * 10, product_id, price, effective_from: '2026-01-01T00:00:00Z', effective_to: null }]
const datos = {
  productos: new Map([
    [106000, fila(106000, { is_parent: true })],
    [106001, fila(106001, { parent_product_id: 106000, padre: { status: 'active' } })],
    [200, fila(200)],
    [300, fila(300, { is_parent: null })],
  ]),
  precios: new Map([[106000, precio(106000, 89900)], [200, precio(200, 1000)], [300, precio(300, 500)]]),
  grupos: new Map(),
}
const resolver = (id) => servidor.resolverLineasPedido([{ id, price: undefined, quantity: 1 }], datos, { organizationId: ORG })

const rPadre = resolver(106000)
eq(rPadre.lineas.length, 0, 'el padre no se cobra')
eq(rPadre.problemas[0]?.motivo, 'no_disponible', 'motivo «no_disponible»: el checkout pide quitarlo')
ok(/talla|color/.test(rPadre.problemas[0]?.detalle || ''), 'el detalle dice que falta la talla o el color')

const rVariante = resolver(106001)
eq(rVariante.problemas.length, 0, 'la variante se cobra')
eq(rVariante.lineas[0]?.precioUnitario, 89900, 'con el precio heredado del padre')
eq(resolver(200).problemas.length, 0, 'simple: igual que antes')
eq(resolver(300).problemas.length, 0, 'is_parent NULL: igual que antes')

// ─── 3. Cada botón de agregar consulta la regla (fuente) ───────────────────────────────────
const fuente = async (r) => readFile(join(ROOT, r), 'utf8')
const tiene = async (r, patrones) => {
  const s = await fuente(r)
  for (const p of patrones) ok(p.test(s), `${r}: falta ${p}`)
}
await tiene('components/sections/products/ProductCard.tsx', [
  /const internalAddToCart = \(p: any\) => \{\s*\/\/[^\n]*\n\s*if \(isParentProduct\(p\)\) return/, // carrito interno
  /const handleAdd = isParentProduct\(product\)\s*\?\s*irAElegir/, // tarjeta externa y vista rápida
  /const handleBuy = isParentProduct\(product\)\s*\?\s*irAElegir/,
  /padreSinVariantes\(product\)\)\s*\{\s*return \(\s*<Button[\s\S]{0,200}disabled/, // botón «No disponible»
  /case 'buy_now':\s*if \(!isParent && !outOfStock\)/,
  /conContador = [^\n]*!isParent/, // contador «− 1 +» solo para simples
])
await tiene('components/site/ProductQuickView.tsx', [/if \(esPadre\) return/, /sinVariantes \?/])
await tiene('components/site/ProductGrid.tsx', [/const addToCart = \(product: Product\) => \{\s*\/\/[^\n]*\n\s*if \(isParentProduct\(product\)\) return/])
await tiene('app/productos/[id]/ProductDetailActions.tsx', [/if \(isParent && variants\.length > 0\)[\s\S]*?\n  if \(isParent\) \{/])
await tiene('app/productos/[id]/page.tsx', [/stickyPermitido && !\(isParent && variants\.length === 0\)/])
await tiene('app/carrito/CartPageClient.tsx', [/if \(isParentProduct\(product\)\) return/, /hayLineasPadre \?/])
await tiene('lib/products/precio-servidor-lectura.ts', [/SELECT_PRODUCTO_PRECIO =\s*`[^`]*\bis_parent\b/])

console.log(`verify-padre-sin-variante: ${n} comprobaciones OK`)
