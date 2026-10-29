/**
 * verify-buscador-movil.mjs — «Buscador del celular igual al de escritorio» apagado por defecto.
 *
 *   npm run verify:buscador-movil
 */
import { readFileSync } from 'node:fs'
import { buscadorIgualEscritorio, buscadorMovil, buscadorMovilEfectivo } from '../lib/website/opcionUnica.ts'
import { OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const K = 'mobile_search_same_as_desktop'

check(buscadorIgualEscritorio(undefined) === false && buscadorIgualEscritorio({}) === false, 'ausente: como hoy')
check(buscadorIgualEscritorio({ [K]: 'true' }) === false && buscadorIgualEscritorio({ [K]: true }) === true, 'solo true la enciende')
// Apagada: exactamente buscadorMovil de hoy para los 7 estilos
for (const st of ['icon', 'bar', 'mini', 'icon_overlay', 'mega', 'pill_floating', 'hidden', undefined]) {
  for (const m of [undefined, null, 'icon', 'bar']) {
    const a = { search_style: st, mobile_search_style: m }
    check(buscadorMovilEfectivo(a) === buscadorMovil(a), `apagada = hoy (${st}/${m})`)
  }
}
const esp = { icon: 'icon', bar: 'bar', mini: 'bar', icon_overlay: 'icon', mega: 'bar', pill_floating: 'bar', hidden: 'hidden' }
for (const [st, e] of Object.entries(esp)) check(buscadorMovilEfectivo({ search_style: st, mobile_search_style: 'icon', [K]: true }) === e, `encendida: ${st} → ${e}`)
const op = OPCIONES_SHELL[K]
check(op && op.zona === 'header' && op.porDefecto === false && op.regla?.tipo === 'booleano', 'registrada en OPCIONES_SHELL con default false')
check(!OPCIONES_SHELL.mobile_search_bar_categories, 'la clave de prueba anterior no queda')

for (const f of ['HeaderMovilConfigurable', 'MobileDrawer', 'MobileTabs', 'MobileBottomSheet', 'MobileFullscreen']) {
  const src = readFileSync(new URL(`../components/site/header/mobile/${f}.tsx`, import.meta.url), 'utf8')
  check(src.includes('buscadorIgualEscritorio(') && src.includes('<BuscadorMovilComoEscritorio') && src.includes('buscadorMovilEfectivo('), `${f} respeta la clave`)
  check(src.includes('<SearchBarInline'), `${f} conserva la barra de siempre`)
}
const cromo = readFileSync(new URL('../components/site/header/BuscadorCromo.tsx', import.meta.url), 'utf8')
check(cromo.includes("cromo?.tipo === 'mega'") && cromo.includes('<BuscadorCromoCompacto'), 'Buscador grande usa el compacto con Todas')

if (problemas.length) {
  console.error(`verify-buscador-movil: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-buscador-movil: ${casos} casos`)
