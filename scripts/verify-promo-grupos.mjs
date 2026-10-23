/**
 * verify-promo-grupos.mjs — la misma regla de promociones que el POS.
 *
 *   npm run verify:promo-grupos
 *
 * Sin base de datos. Importa el motor real de la tienda
 * (`lib/promotions.ts`). Los importes son los de
 * `motorPromociones.test.ts` en el ERP: dos no combinables de productos
 * distintos se aplican las dos; la del mismo producto sigue siendo una; la
 * prioridad gana; con prioridad 0 gana la que más descuenta; una línea
 * excluida queda a precio completo.
 */
import { calculatePromotions } from '../lib/promotions.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

let seq = 0
function promo(extra) {
  seq += 1
  return {
    id: extra.id || `p${seq}`,
    name: extra.name || extra.id || `p${seq}`,
    description: null,
    promotion_type: 'percentage',
    discount_value: 10,
    buy_quantity: null,
    get_quantity: null,
    min_purchase_amount: 0,
    min_purchase_scope: null,
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
    created_at: '2026-01-01T00:00:00Z',
    branches: null,
    applies_to_web: true,
    applicable_days: null,
    promotion_rules: [],
    ...extra,
  }
}

function deProducto(productId, extra) {
  return promo({
    applies_to: 'products',
    promotion_rules: [{ rule_type: 'include_product', product_id: productId, category_id: null }],
    ...extra,
  })
}

function item(id, productId, price, extra) {
  return {
    id: String(id),
    product_id: productId,
    parent_product_id: null,
    category_id: null,
    name: `producto ${productId}`,
    price,
    quantity: 1,
    ...extra,
  }
}

function evaluar(promos, items) {
  return calculatePromotions(promos, items, { applyFilters: false })
}

function ids(resultado) {
  return resultado.promotions.map((p) => p.id).sort()
}

const cuenta = [item('a', 1, 10000), item('b', 2, 10000)]
const distintas = evaluar(
  [deProducto(1, { id: 'a10' }), deProducto(2, { id: 'b10' })],
  cuenta,
)
check(distintas.totalDiscount === 2000, `A y B distintos debían descontar 2000 y descontaron ${distintas.totalDiscount}`)
check(ids(distintas).join(',') === 'a10,b10', `A y B distintos debían aplicar las dos: ${ids(distintas).join(',')}`)
check(distintas.itemDiscounts.a === 1000 && distintas.itemDiscounts.b === 1000, 'cada línea distinta lleva 1000')

const mismo = evaluar(
  [deProducto(1, { id: 'chica', discount_value: 10 }), deProducto(1, { id: 'grande', discount_value: 20 })],
  [item('a', 1, 10000), item('b', 2, 10000)],
)
check(mismo.totalDiscount === 2000, `mismo producto debía descontar 2000 y descontó ${mismo.totalDiscount}`)
check(ids(mismo).join(',') === 'grande', `mismo producto debía quedar solo la grande: ${ids(mismo).join(',')}`)
check(mismo.itemDiscounts.b === undefined, 'la línea del otro producto no entra')

const deCuenta = evaluar(
  [
    promo({ id: 'cuenta', discount_value: 15, applies_to: 'all' }),
    deProducto(1, { id: 'a10b' }),
    deProducto(2, { id: 'b10b' }),
  ],
  cuenta,
)
check(deCuenta.totalDiscount === 3000, `la de cuenta debía ganar con 3000 y dio ${deCuenta.totalDiscount}`)
check(ids(deCuenta).join(',') === 'cuenta', 'la de cuenta sigue compitiendo con todas')

const minimaCuenta = evaluar(
  [
    deProducto(1, { id: 'min', discount_value: 5, min_purchase_scope: 'cart', min_purchase_amount: 1 }),
    deProducto(2, { id: 'otra', discount_value: 10 }),
  ],
  cuenta,
)
check(ids(minimaCuenta).join(',') === 'otra', `la mínima de cuenta debía dejar solo la otra: ${ids(minimaCuenta).join(',')}`)
check(minimaCuenta.totalDiscount === 1000, `la mínima de cuenta debía descontar 1000 y descontó ${minimaCuenta.totalDiscount}`)

const prioridadCero = evaluar(
  [
    deProducto(1, { id: 'pct', discount_value: 10, priority: 0 }),
    deProducto(1, { id: 'fija', promotion_type: 'fixed_amount', discount_value: 500, priority: 0 }),
  ],
  [item('a', 1, 2000)],
)
check(prioridadCero.totalDiscount === 500, `prioridad 0 debía dejar los 500 y dejó ${prioridadCero.totalDiscount}`)
check(ids(prioridadCero).join(',') === 'fija', 'con prioridad 0 gana la que más descuenta')

const prioridad = evaluar(
  [
    deProducto(1, { id: 'fija2', promotion_type: 'fixed_amount', discount_value: 500, priority: 0 }),
    deProducto(1, { id: 'pct2', discount_value: 10, priority: 10 }),
  ],
  [item('a', 1, 2000)],
)
check(prioridad.totalDiscount === 200, `prioridad 10 debía descontar 200 y descontó ${prioridad.totalDiscount}`)
check(ids(prioridad).join(',') === 'pct2', 'la de prioridad 10 gana aunque descuente menos')

const empateMonto = evaluar(
  [
    deProducto(1, { id: 'pct3', discount_value: 10, priority: 4 }),
    deProducto(1, { id: 'fija3', promotion_type: 'fixed_amount', discount_value: 500, priority: 4 }),
  ],
  [item('a', 1, 2000)],
)
check(ids(empateMonto).join(',') === 'fija3', 'prioridades iguales: gana la que más descuenta')

const antiguaPrimero = evaluar(
  [
    deProducto(1, { id: 'nueva', discount_value: 10, priority: 3, created_at: '2026-06-01T00:00:00Z' }),
    deProducto(1, { id: 'vieja', discount_value: 10, priority: 3, created_at: '2026-01-01T00:00:00Z' }),
  ],
  [item('a', 1, 2000)],
)
const antiguaDespues = evaluar(
  [
    deProducto(1, { id: 'vieja', discount_value: 10, priority: 3, created_at: '2026-01-01T00:00:00Z' }),
    deProducto(1, { id: 'nueva', discount_value: 10, priority: 3, created_at: '2026-06-01T00:00:00Z' }),
  ],
  [item('a', 1, 2000)],
)
check(ids(antiguaPrimero).join(',') === 'vieja' && ids(antiguaDespues).join(',') === 'vieja', 'mismo monto: gana la más antigua')

const combinables = evaluar(
  [
    deProducto(1, { id: 'sola', discount_value: 15, priority: 9 }),
    deProducto(1, { id: 'c1', discount_value: 10, is_combinable: true }),
    deProducto(1, { id: 'c2', discount_value: 10, is_combinable: true }),
  ],
  [item('a', 1, 10000)],
)
check(combinables.totalDiscount === 2000, `las combinables debían sumar 2000 y sumaron ${combinables.totalDiscount}`)
check(ids(combinables).join(',') === 'c1,c2', 'la no combinable sigue perdiendo contra la suma de las combinables')

const excluida = evaluar(
  [deProducto(1, { id: 'diez' })],
  [item('a', 1, 10000, { promo_excluded: true }), item('b', 2, 10000)],
)
check(excluida.totalDiscount === 0 && excluida.promotions.length === 0, 'la línea excluida no recibe ni cuenta la promoción de su producto')

const sinFlag = evaluar(
  [promo({ id: 'todas', discount_value: 10, applies_to: 'all' })],
  [item('a', 1, 10000), item('b', 2, 10000, { promo_excluded: true })],
)
check(sinFlag.totalDiscount === 1000 && sinFlag.itemDiscounts.a === 1000 && sinFlag.itemDiscounts.b === undefined, 'la línea sin flag calcula igual y la excluida queda en 0')

const dosPorUno = evaluar(
  [deProducto(1, { id: 'dos', promotion_type: 'buy_x_get_y', buy_quantity: 1, get_quantity: 1, discount_value: 0 })],
  [item('a', 1, 12000), item('b', 1, 12000, { promo_excluded: true })],
)
check(dosPorUno.totalDiscount === 0, 'la línea excluida no completa el 2x1')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify-promo-grupos: ${casos} casos en verde`)
