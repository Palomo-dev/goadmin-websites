/**
 * verify-tarjeta-beneficio.mjs — beneficios sin claves siguen sin tarjeta.
 *
 *   npm run verify:tarjeta-beneficio
 */
import { claseTarjetaBeneficio, esTarjeta, estiloTarjetaBeneficio, iconoBeneficio } from '../lib/website/tarjetaBeneficio.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(esTarjeta({}) === false, 'sin claves no es tarjeta')
check(claseTarjetaBeneficio({}) === 'flex flex-col items-center text-center', 'la clase de hoy se conserva')
check(Object.keys(estiloTarjetaBeneficio({})).length === 0, 'sin claves no hay estilo inline')

const preset = estiloTarjetaBeneficio({ card_preset: 'tarjetas' })
check(preset.borderRadius === 16, 'el preset usa radio 16')
check(preset.backgroundColor === '#ffffff', 'el preset usa fondo blanco')
check(preset.padding === 24, 'el preset usa padding 24')
check(claseTarjetaBeneficio({ card_preset: 'tarjetas' }).includes('shadow-sm'), 'el preset usa sombra suave')

const pisado = estiloTarjetaBeneficio({ card_preset: 'tarjetas', card_radius: 4 })
check(pisado.borderRadius === 4, 'un radio explícito pisa el preset')

const icono = iconoBeneficio({}, '#336699')
check(icono.clase === 'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl', 'el ícono de hoy se conserva')
check(icono.estilo.backgroundColor === '#33669915', 'el ícono suave usa la marca')
check(icono.estilo.color === '#336699', 'el trazo es la marca')

const solido = iconoBeneficio({ icon_style: 'solid', icon_color: '#111111' }, '#336699')
check(solido.estilo.backgroundColor === '#111111', 'el color fijo reemplaza la marca')
check(solido.estilo.color === '#ffffff', 'el sólido lleva trazo blanco')

if (problemas.length) {
  console.error(`verify-tarjeta-beneficio: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-tarjeta-beneficio: ${casos} casos`)
