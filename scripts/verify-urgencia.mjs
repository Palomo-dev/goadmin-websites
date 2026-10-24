/**
 * verify-urgencia.mjs — el aviso de interés nace apagado y el número es estable.
 * La alineación del buscador no enciende el cromo.
 *
 *   npm run verify:urgencia
 */
import { leerAvisoViendo, personasEstables, textoConNumero } from '../lib/website/urgenciaSeccion.ts'
import { alineacionBuscador, leerConstructor } from '../lib/website/constructorEncabezado.ts'
import { avisoStock } from '../lib/website/conversion.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(leerAvisoViendo(null) === null, 'sin opción no hay aviso')
check(leerAvisoViendo({ activo: false }) === null, 'apagado no se pinta')
check(leerAvisoViendo({ activo: true })?.plantilla === '{n} personas viendo', 'prendido usa la plantilla')
check(personasEstables('plato-9') === personasEstables('plato-9'), 'el mismo producto da el mismo número')
check(personasEstables('plato-9') !== personasEstables('plato-10'), 'otro producto puede diferir')
check(personasEstables('a') >= 3 && personasEstables('a') <= 18, 'el número cabe en 3..18')
check(textoConNumero('Quedan {n} mirando', 4) === 'Quedan 4 mirando', 'sustituye {n}')
check(avisoStock(2, 5, 'Quedan {n} unidades') === 'Quedan 2 unidades', 'el stock real se escribe')
check(avisoStock(null, 5, 'Quedan {n}') === null, 'sin stock no inventa unidades')
check(alineacionBuscador({ search_style: 'bar' }) === null, 'la barra de hoy no se mueve')
check(alineacionBuscador({ header_builder: { search: { align: 'left' } } }) === 'left', 'izquierda se lee')
check(leerConstructor({ search_style: 'bar', header_builder: { search: { align: 'center' } } }) === null, 'solo la posición no cambia el cromo')
check(leerConstructor({ search_style: 'icon' }) === null, 'el ícono de hoy sigue igual')
const pill = leerConstructor({ search_style: 'bar', header_builder: { search: { type: 'bar', variant: 'pill' } } })
check(pill?.buscador?.variante === 'pill' && pill.buscador.radius === 'pill', 'la píldora se distingue de la barra')
const outline = leerConstructor({ search_style: 'bar', header_builder: { search: { type: 'bar', variant: 'outline', shadow: false } } })
check(outline?.buscador?.shadow === false && outline.buscador.border === 'thin', 'un borde fino sin sombra se respeta')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`urgencia ok (${casos})`)
