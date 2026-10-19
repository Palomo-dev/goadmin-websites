/**
 * verify-orden-tallas.mjs — los botones de talla no salen «L, M, S».
 *
 *   npm run verify:orden-tallas
 *
 * Sin base de datos. Importa la función real. El catálogo (`display_order`)
 * manda; si empata o falta, XS…XXXL y los números de menor a mayor.
 */
import { ordenarValoresAtributo } from '../lib/products/ordenAtributos.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (obtenido, esperado, msg) => {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  check(ok, `${msg}: esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`)
}

const ropa = ['L', 'M', 'S', 'XL', 'XS', 'XXL', 'XXXL']
igual(
  ordenarValoresAtributo('Talla', ropa, null),
  ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  'sin catálogo, la ropa no sale alfabética',
)

igual(
  ordenarValoresAtributo('Talla', ['2XL', 'XS', '3XL', 'S', 'M'], {}),
  ['XS', 'S', 'M', '2XL', '3XL'],
  '2XL y 3XL ocupan el puesto de XXL y XXXL',
)

igual(
  ordenarValoresAtributo('Talla', ['42', '41.5', '34', '36.5', '10', '8', '7.5 US'], null),
  ['7.5 US', '8', '10', '34', '36.5', '41.5', '42'],
  'los números van de menor a mayor, con decimales',
)

const catalogo = {
  talla: { xs: 1, s: 2, m: 3, l: 4, xl: 5, xxl: 6 },
}
igual(
  ordenarValoresAtributo('talla', ropa, catalogo),
  ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  'el display_order del catálogo ordena la ropa',
)

igual(
  ordenarValoresAtributo('Talla', ['L', 'M', 'S', 'XL', 'XS'], { talla: { l: 0, m: 0, s: 0, xl: 0, xs: 0 } }),
  ['XS', 'S', 'M', 'L', 'XL'],
  'display_order empatado en 0 cae al orden de talla',
)

igual(
  ordenarValoresAtributo('Talla', ['XS', 'S', 'M', 'L'], { talla: { l: 0, m: 1, s: 2, xs: 3 } }),
  ['L', 'M', 'S', 'XS'],
  'un orden distinto del catálogo gana a la escala',
)

igual(
  ordenarValoresAtributo('Talla', ['XL', 'S'], { talla: { s: 0, xl: 1 } }),
  ['S', 'XL'],
  '«Talla» encuentra el tipo «talla» del catálogo',
)
igual(
  ordenarValoresAtributo('Tamaño', ['Grande', 'Pequeño'], { tamano: { pequeno: 0, grande: 1 } }),
  ['Pequeño', 'Grande'],
  'la tilde no separa el tipo ni el valor del catálogo',
)
igual(
  ordenarValoresAtributo('Talla', ['XL', 'S'], { tallas: { xl: 0, s: 1 } }),
  ['S', 'XL'],
  'otro tipo no presta su orden; queda la escala',
)

const colores = ['Negro', 'Azul', 'Rojo']
igual(
  ordenarValoresAtributo('Color', colores, null),
  [...colores].sort(),
  'un color sin catálogo conserva el orden de texto',
)

igual(
  ordenarValoresAtributo('Color', colores, { color: { rojo: 0, azul: 1, negro: 2 } }),
  ['Rojo', 'Azul', 'Negro'],
  'el catálogo también ordena lo que no es talla',
)

igual(
  ordenarValoresAtributo('Talla', ['Única', 'M', 'S'], { talla: { s: 0, m: 1 } }),
  ['S', 'M', 'Única'],
  'un valor que no está en el catálogo va al final',
)

if (problemas.length) {
  console.error(`verify:orden-tallas ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify:orden-tallas ok (${casos})`)
