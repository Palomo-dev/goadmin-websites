/**
 * verify-altura-hero.mjs — el alto del hero no cambia si no hay claves nuevas.
 *
 *   npm run verify:altura-hero
 */
import { cssAltura, planAlturaPortada, proporcionImagen, puntoFocal } from '../lib/website/alturaHero.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const hoy = planAlturaPortada(undefined, undefined, false, null, null)
check(hoy.clase === 'min-h-[50vh] md:min-h-[70vh]', `auto ausente debe ser el alto de hoy, fue «${hoy.clase}»`)
check(hoy.proporcion == null, 'auto no fuerza aspect-ratio')

const reserva = planAlturaPortada('auto', undefined, true, null, null)
check(reserva.clase === 'min-h-[auto] py-20 md:min-h-[720px] md:py-0', 'con reserva se conserva el alto de la reserva')

check(planAlturaPortada('100vh', undefined, false, null, null).clase === 'min-h-[100dvh]', '100vh se queda en 100vh')
check(planAlturaPortada('50vh', undefined, false, null, null).clase === 'min-h-[50vh]', '50vh no se mezcla con el auto')

const imagen = planAlturaPortada('image', undefined, false, '1600 / 900', null)
check(imagen.proporcion === '1600 / 900', 'image usa la proporción guardada')
check(imagen.clase === '', 'con proporción, image no impone vh')
check(cssAltura('hero-x', imagen).includes('aspect-ratio:1600 / 900'), 'el css publica el aspect-ratio')

const movil = planAlturaPortada('auto', '60vh', false, null, null)
check(movil.clase === 'min-h-[60vh] md:min-h-[70vh]', `60vh en celular fue «${movil.clase}»`)
check(planAlturaPortada('auto', 'auto', false, null, null).clase === 'min-h-[50vh] md:min-h-[70vh]', 'mobile auto = el alto de hoy')

check(puntoFocal(undefined) == null, 'sin punto focal no hay object-position')
check(puntoFocal('top') === 'top', 'top es un punto focal')
check(puntoFocal({ x: 20, y: 80 }) === '20% 80%', 'el punto focal acepta x/y')
check(proporcionImagen(undefined, undefined) == null, 'sin medidas no hay proporción')
check(proporcionImagen(800, 400) === '800 / 400', 'las medidas guardadas arman la proporción')

if (problemas.length) {
  console.error(`verify-altura-hero: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-altura-hero: ${casos} casos`)
