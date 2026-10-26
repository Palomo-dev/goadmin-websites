/**
 * verify-populares.mjs — las sugerencias salen de la organización.
 *
 *   npm run verify:populares
 */
import { terminosOCategorias, terminosPopulares } from '../lib/products/populares.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const FIJOS = ['Tenis', 'Accesorios', 'Ofertas', 'Nuevo']
check(terminosPopulares([]).length === 0, 'sin ventas no inventa términos')
check(!FIJOS.some((f) => terminosPopulares([]).includes(f)), 'la lista vacía no trae términos de otra tienda')

const ventas = [
  { product_name: 'Bandeja', quantity: 2, status: 'ready' },
  { product_name: 'Bandeja', quantity: 1, status: 'ready' },
  { product_name: 'Jugo', quantity: 1, status: 'cancelled' },
  { product_name: 'Postre', quantity: 4, order_status: 'canceled' },
  { product_name: 'Arepa', quantity: 1, status: 'ready' },
]
const nombres = terminosPopulares(ventas)
check(nombres[0] === 'Bandeja', 'manda el más vendido')
check(!nombres.includes('Jugo') && !nombres.includes('Postre'), 'lo cancelado no entra')
check(terminosOCategorias([], ['Entradas', 'Entradas', 'Bebidas'])[0] === 'Entradas', 'sin ventas usa categorías')
check(terminosOCategorias(ventas, ['Entradas'])[0] === 'Bandeja', 'si hay ventas no cae a categorías')
check(terminosOCategorias([], []).length === 0, 'sin ventas ni categorías no hay sugerencias')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`populares ok (${casos})`)
