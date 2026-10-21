/**
 * verify-promo-minimo.mjs — el mínimo legado de buy_quantity.
 *
 *   npm run verify:promo-minimo
 *
 * Sin base de datos. Importa el motor real de la tienda. Una promo de monto
 * fijo con buy_quantity=2 y min_quantity vacía no descuenta 1 unidad y sí
 * descuenta 2. min_quantity=3 manda. Compra X Lleva Y no cambia.
 */
import { calculatePromotions } from '../lib/promotions.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

function promo(extra) {
  return {
    id: 'p1',
    name: 'fija',
    description: null,
    promotion_type: 'fixed_amount',
    discount_value: 7000,
    buy_quantity: 2,
    get_quantity: 1,
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
    ...extra,
  }
}

function item(quantity, price) {
  return {
    id: '1',
    product_id: 1,
    parent_product_id: null,
    category_id: null,
    name: 'producto',
    price,
    quantity,
  }
}

function descuento(p, quantity, price) {
  return calculatePromotions([p], [item(quantity, price)], { applyFilters: false }).totalDiscount
}

const legado = promo({ min_purchase_amount: 14000 })
check(descuento(legado, 1, 14000) === 0, '1 unidad de monto fijo con buy_quantity=2 no descuenta')
check(descuento(legado, 2, 14000) === 7000, '2 unidades de monto fijo con buy_quantity=2 descuentan 7000')

const tres = promo({ discount_value: 1000, min_quantity: 3, min_purchase_amount: 0 })
check(descuento(tres, 2, 4000) === 0, 'min_quantity=3 no deja pasar 2 unidades')
check(descuento(tres, 3, 4000) === 1000, 'min_quantity=3 descuenta a las 3 unidades')

const diez = promo({ promotion_type: 'percentage', discount_value: 10, buy_quantity: '2', min_quantity: null })
check(descuento(diez, 1, 10000) === 0, 'el porcentaje tampoco descuenta 1 unidad')
check(descuento(diez, 2, 10000) === 2000, 'el porcentaje descuenta las 2 unidades')

const lleva = promo({
  promotion_type: 'buy_x_get_y',
  buy_quantity: 2,
  get_quantity: 1,
  min_quantity: null,
  discount_value: 0,
})
check(descuento(lleva, 1, 4000) === 0, 'compra 2 lleva 1 no regala con 1 unidad')
check(descuento(lleva, 2, 4000) === 4000, 'compra 2 lleva 1 sigue regalando una unidad')

const ignora = promo({
  promotion_type: 'buy_x_get_y',
  buy_quantity: 2,
  get_quantity: 1,
  min_quantity: 99,
  discount_value: 0,
})
check(descuento(ignora, 2, 4000) === 4000, 'compra X lleva Y ignora min_quantity')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify-promo-minimo: ${casos} casos en verde`)
