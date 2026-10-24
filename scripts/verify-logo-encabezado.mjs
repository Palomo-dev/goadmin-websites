/**
 * verify-logo-encabezado.mjs — el logo del celular hereda, y solo se centra si corresponde.
 *
 *   npm run verify:logo-encabezado
 */
import { logoEfectivo, logoMovil } from '../lib/website/logoEncabezado.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(logoEfectivo(undefined) === 'left', 'sin ajustes el logo queda a la izquierda')
check(logoEfectivo({ logo_position: 'left', header_style: 'centered' }) === 'left', 'izquierda explícita no se pisa')
check(logoEfectivo({ header_style: 'centered' }) === 'center', 'centered sin posición centra')
check(logoEfectivo({ header_style: 'split' }) === 'center', 'split sin posición centra')
check(logoEfectivo({ header_style: 'default' }) === 'left', 'clásico sin posición queda a la izquierda')
check(logoMovil({ logo_position: 'center' }) === 'center', 'el celular hereda el centro')
check(logoMovil({ logo_position: 'center', mobile_logo_position: 'inherit' }) === 'center', 'inherit usa el computador')
check(logoMovil({ logo_position: 'center', mobile_logo_position: 'left' }) === 'left', 'el celular puede ir a la izquierda')
check(logoMovil({ header_style: 'centered', mobile_logo_position: 'inherit' }) === 'center', 'inherit y centered, sin posición, centra')

if (problemas.length) {
  console.error(`verify-logo-encabezado: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-logo-encabezado: ${casos} casos`)
