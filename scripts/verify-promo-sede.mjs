/**
 * verify-promo-sede.mjs — paquete con «repetir cada N» y sede del pedido web.
 *
 *   npm run verify:promo-sede
 *
 * Sin base de datos. Importa el motor real de la tienda y la misma función
 * que usan el carrito, /api/promotions/check y /api/orders para elegir sede.
 * Los importes son los del POS: 20 % cada 3 descuenta 6 de 7; sin N, las 7.
 */
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'
import { calculatePromotions, filterActivePromotions } from '../lib/promotions.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = mkdtempSync(join(tmpdir(), 'verify-promo-sede-'))
const horario = stripTypeScriptTypes(readFileSync(join(ROOT, 'lib/restaurant/horario.ts'), 'utf8'), { mode: 'strip' })
writeFileSync(join(dir, 'horario.mjs'), horario)
const pedidoSrc = stripTypeScriptTypes(readFileSync(join(ROOT, 'lib/orders/pedidoWeb.ts'), 'utf8'), { mode: 'strip' })
  .replaceAll("from '@/lib/restaurant/horario'", `from '${pathToFileURL(join(dir, 'horario.mjs')).href}'`)
  .replace(/^import\s+type[^\n]*\n/gm, '')
writeFileSync(join(dir, 'pedidoWeb.mjs'), pedidoSrc)
const { sedeDePedidoWeb } = await import(pathToFileURL(join(dir, 'pedidoWeb.mjs')).href)
rmSync(dir, { recursive: true, force: true })

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

function promo(extra) {
  return {
    id: 'p1',
    name: 'paquete',
    description: null,
    promotion_type: 'bundle',
    discount_value: 20,
    buy_quantity: null,
    get_quantity: null,
    min_purchase_amount: 0,
    min_quantity: null,
    max_discount_amount: null,
    applies_to: 'all',
    start_date: null,
    end_date: null,
    is_active: true,
    usage_limit: null,
    usage_count: 0,
    is_combinable: false,
    priority: 0,
    branches: null,
    applies_to_web: true,
    applicable_days: null,
    promotion_rules: [],
    bundle_price: null,
    repeat_every_quantity: null,
    ...extra,
  }
}

function item(quantity, price, extra = {}) {
  return {
    id: '1',
    product_id: 1,
    parent_product_id: null,
    category_id: null,
    name: 'producto',
    price,
    quantity,
    ...extra,
  }
}

function total(p, quantity, price) {
  return calculatePromotions([p], [item(quantity, price)], { applyFilters: false }).totalDiscount
}

const cadaTres = promo({ repeat_every_quantity: 3 })
check(total(cadaTres, 7, 1000) === 1200, 'paquete 20 % cada 3: 7 unidades descuentan 6 (1200)')
check(total(cadaTres, 2, 1000) === 0, 'paquete 20 % cada 3: 2 unidades descuentan 0')
check(total(promo({ repeat_every_quantity: null }), 7, 1000) === 1400, 'paquete 20 % sin N: las 7 unidades, igual que hoy')

const reglas = [{ rule_type: 'include_product', product_id: 1, category_id: null, quantity: 1 }]
const conPrecio = promo({
  bundle_price: 8000,
  discount_value: 0,
  applies_to: 'products',
  promotion_rules: reglas,
  repeat_every_quantity: 3,
})
check(total(conPrecio, 7, 10000) === 4000, 'precio de paquete y N=3: 2 paquetes, descuento 4000')
check(total(conPrecio, 2, 10000) === 0, 'precio de paquete y N=3: 2 unidades no arman el grupo')
check(
  total({ ...conPrecio, repeat_every_quantity: null }, 7, 10000) === 14000,
  'precio de paquete sin N: los 7 paquetes, igual que hoy',
)

const limitada = promo({
  promotion_type: 'percentage',
  discount_value: 10,
  branches: [1],
})
const global = promo({ promotion_type: 'percentage', discount_value: 10, branches: null })
const vacia = promo({ promotion_type: 'percentage', discount_value: 10, branches: [] })
const ahora = new Date('2026-10-22T18:00:00Z')

function vigentes(p, branchId) {
  return filterActivePromotions([p], { branchId, date: ahora, timeZone: 'America/Bogota' }).length
}

check(vigentes(limitada, 1) === 1, 'promo de la sede 1 aplica en la sede 1')
check(vigentes(limitada, 2) === 0, 'promo de la sede 1 no aplica en la sede 2')
check(vigentes(limitada, null) === 0, 'promo de una sede no aplica si el llamador no resolvió sede')
check(vigentes(global, null) === 1, 'promo sin sucursal aplica aunque no haya sede')
check(vigentes(global, 2) === 1, 'promo sin sucursal aplica en cualquier sede')
check(vigentes(vacia, null) === 1, 'sucursales vacías aplican en todas, igual que hoy')
check(vigentes(vacia, 2) === 1, 'sucursales vacías aplican también con sede')

const sedes = [
  { id: 2, is_main: true, is_web_stock_source: false, is_active: true },
  { id: 5, is_main: false, is_web_stock_source: true, is_active: true },
  { id: 9, is_main: false, is_web_stock_source: false, is_active: true },
]
check(sedeDePedidoWeb(sedes, { outletId: 9, sedeElegidaId: 2 }) === 9, 'el outlet gana sobre la sede elegida')
check(sedeDePedidoWeb(sedes, { sedeElegidaId: 2 }) === 2, 'la sede elegida gana sobre la fuente de inventario')
check(sedeDePedidoWeb(sedes) === 5, 'sin id, manda la fuente de inventario web')
check(sedeDePedidoWeb(sedes.filter((s) => s.id !== 5)) === 2, 'sin fuente web, la principal activa')
check(sedeDePedidoWeb([{ id: 9, is_active: true }]) === 9, 'si no hay principal ni fuente, la primera activa')
check(
  sedeDePedidoWeb([
    { id: 3, is_web_stock_source: true, is_active: false },
    { id: 8, is_main: true, is_active: true },
  ]) === 8,
  'una fuente web inactiva no es la sede del pedido',
)
check(sedeDePedidoWeb(undefined) === null, 'sin sedes ni id queda null y el servidor completa el paso')
check(sedeDePedidoWeb(undefined, { sedeElegidaId: 4 }) === 4, 'la sede elegida se usa aunque no haya lista')
check(sedeDePedidoWeb(sedes, { outletId: 0, sedeElegidaId: 1.5 }) === 5, 'un id que no es entero positivo no cuenta')

const orders = readFileSync(join(ROOT, 'app/api/orders/route.ts'), 'utf8')
const checkRoute = readFileSync(join(ROOT, 'app/api/promotions/check/route.ts'), 'utf8')
const wizard = readFileSync(join(ROOT, 'components/site/CheckoutWizard.tsx'), 'utf8')
check(orders.includes('sedeDePedidoWeb'), '/api/orders resuelve la sede con sedeDePedidoWeb')
check(
  orders.includes('branchId: Number.isFinite(Number(resolvedBranchId)) ? Number(resolvedBranchId) : null'),
  '/api/orders evalúa promociones con la sede en la que queda el pedido',
)
check(checkRoute.includes('return sedeDePedidoWeb(branches)'), '/api/promotions/check usa la misma sede por defecto')
check(!wizard.includes('cartItems[0].branchId'), 'el checkout no usa la sucursal del primer ítem')
check(wizard.includes('branchId: sedePromocion'), 'el checkout consulta promociones con la sede del pedido')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify-promo-sede: ${casos} casos en verde`)
