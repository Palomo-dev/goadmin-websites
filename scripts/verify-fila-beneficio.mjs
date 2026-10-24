/**
 * verify-fila-beneficio.mjs — sin item_layout la rejilla de beneficios no cambia.
 *
 *   npm run verify:fila-beneficio
 */
import { clasesGridCaracteristicas } from '../lib/website/presentacionTienda.ts'
import {
  alineacionTexto,
  clasesRejillaBeneficios,
  colorIconoBeneficio,
  disposicionBeneficio,
  estiloTarjetaBeneficio,
  hayTarjetaBeneficio,
  tamanoIconoBeneficio,
} from '../lib/website/filaBeneficio.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(disposicionBeneficio(undefined) === 'stacked', 'sin disposición es apilado')
check(disposicionBeneficio('stacked') === 'stacked', 'stacked es apilado')
check(disposicionBeneficio('icon_left') === 'icon_left', 'icon_left se reconoce')
const hoy = clasesGridCaracteristicas(undefined)
check(clasesRejillaBeneficios(undefined, 'stacked') === hoy, `apilado debe ser «${hoy}»`)
check(clasesRejillaBeneficios(3, 'stacked') === clasesGridCaracteristicas(3), 'las columnas de hoy se conservan')
check(clasesRejillaBeneficios(undefined, 'icon_left').includes('grid-cols-1'), 'a la izquierda, el celular es una columna')
check(clasesRejillaBeneficios({ desktop: 4, mobile: 2 }, 'icon_left').includes('md:grid-cols-4'), 'escritorio llega a 4')
check(clasesRejillaBeneficios({ mobile: 2 }, 'icon_left').includes('grid-cols-2'), 'el celular puede ser 2')
check(!clasesRejillaBeneficios(8, 'icon_left').includes('md:grid-cols-8'), 'icon_left no pasa de 4')
check(tamanoIconoBeneficio(undefined, 'icon_left').icono === 32, 'icon_left vacío es 32 px')
check(tamanoIconoBeneficio('sm', 'icon_left').icono === 24, 'sm es 24')
check(tamanoIconoBeneficio('lg', 'icon_left').caja === 56, 'lg cabe en 56')
check(colorIconoBeneficio(undefined, '#111', '#222') === '#111', 'sin color usa la marca')
check(colorIconoBeneficio('accent', '#111', '#222') === '#222', 'accent usa el acento')
check(colorIconoBeneficio('#abcdef', '#111', '#222') === '#abcdef', 'un hex manda')
check(alineacionTexto(undefined, 'icon_left') === 'left', 'icon_left alinea a la izquierda')
check(alineacionTexto(undefined, 'stacked') === 'center', 'apilado sigue centrado')
check(hayTarjetaBeneficio({}) === false, 'sin card_* no hay tarjeta')
check(Object.keys(estiloTarjetaBeneficio({})).length === 0, 'sin card_* no hay estilo')
check(estiloTarjetaBeneficio({ card_radius: 16, card_padding: 24 }).borderRadius === 16, 'el radio se aplica')

if (problemas.length) {
  console.error(`verify-fila-beneficio: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-fila-beneficio: ${casos} casos`)
