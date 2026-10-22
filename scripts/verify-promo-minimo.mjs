/**
 * verify-promo-minimo.mjs — el mínimo es solo min_quantity.
 *
 *   npm run verify:promo-minimo
 *
 * Sin base de datos. Importa el motor real de la tienda. Los importes son
 * los mismos que el POS: una unidad conserva el descuento si min_quantity
 * está vacía, aunque buy_quantity sea 2. min_quantity=3 manda. Compra X
 * Lleva Y no cambia.
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

const sinMinimo = promo({ min_purchase_amount: 14000 })
check(descuento(sinMinimo, 1, 14000) === 7000, '1 unidad conserva el descuento de 7000 si min_quantity está vacía')
check(descuento(sinMinimo, 2, 14000) === 7000, '2 unidades del mismo monto fijo siguen en 7000')

const tres = promo({ discount_value: 1000, min_quantity: 3, min_purchase_amount: 0 })
check(descuento(tres, 2, 4000) === 0, 'min_quantity=3 no deja pasar 2 unidades')
check(descuento(tres, 3, 4000) === 1000, 'min_quantity=3 descuenta a las 3 unidades')

const diez = promo({ promotion_type: 'percentage', discount_value: 10, buy_quantity: '2', min_quantity: null })
check(descuento(diez, 1, 10000) === 1000, 'el porcentaje de 1 unidad es 1000, igual que el POS')
check(descuento(diez, 2, 10000) === 2000, 'el porcentaje de 2 unidades es 2000, igual que el POS')

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

for (const buy of [1, 0, null, '', '1', '1.9']) {
  check(
    descuento(promo({ buy_quantity: buy, discount_value: 1000, min_purchase_amount: 0 }), 1, 4000) === 1000,
    `buy_quantity ${JSON.stringify(buy)} no inventa un mínimo`,
  )
}

const soloUno = promo({
  discount_value: 1000,
  min_purchase_amount: 4000,
  applies_to: 'products',
  promotion_rules: [{ rule_type: 'include_product', product_id: 1, category_id: null }],
})
const dosLineas = calculatePromotions(
  [soloUno],
  [item(1, 4000), { ...item(1, 4000), id: '2' }],
  { applyFilters: false },
).totalDiscount
const soloAjena = calculatePromotions(
  [soloUno],
  [{ ...item(5, 4000), id: '9', product_id: 2 }],
  { applyFilters: false },
).totalDiscount
check(descuento(soloUno, 1, 4000) === 1000, 'una sola línea ya descuenta si no hay min_quantity')
check(dosLineas === 1000, 'dos líneas del mismo producto no duplican el monto fijo')
check(soloAjena === 0, 'un producto que no entra no recibe el descuento')

const paquete = promo({
  promotion_type: 'bundle',
  bundle_price: 3000,
  discount_value: 0,
  buy_quantity: 2,
  min_quantity: null,
  applies_to: 'products',
  promotion_rules: [{ rule_type: 'include_product', product_id: 1, category_id: null, quantity: 1 }],
})
check(descuento(paquete, 1, 4000) === 1000, 'el paquete de 1 unidad descuenta 1000, igual que el POS')
check(descuento(paquete, 2, 4000) === 2000, 'el paquete de 2 unidades descuenta 2000, igual que el POS')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify-promo-minimo: ${casos} casos en verde`)
