/**
 * verify-buscador-movil.mjs — «Categorías en el buscador del celular» apagado por defecto.
 *
 *   npm run verify:buscador-movil
 */
import { readFileSync } from 'node:fs'
import { categoriasEnBuscadorMovil } from '../lib/website/opcionUnica.ts'
import { OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }

check(categoriasEnBuscadorMovil(undefined) === false, 'sin ajustes: la barra de siempre')
check(categoriasEnBuscadorMovil({}) === false, 'clave ausente: la barra de siempre')
check(categoriasEnBuscadorMovil({ mobile_search_bar_categories: false }) === false, 'false: la barra de siempre')
check(categoriasEnBuscadorMovil({ mobile_search_bar_categories: 'true' }) === false, 'solo el booleano true la enciende')
check(categoriasEnBuscadorMovil({ mobile_search_bar_categories: true }) === true, 'true: buscador con categorías')
const op = OPCIONES_SHELL.mobile_search_bar_categories
check(op && op.zona === 'header' && op.porDefecto === false && op.regla?.tipo === 'booleano', 'registrada en OPCIONES_SHELL con default false')

for (const f of ['HeaderMovilConfigurable', 'MobileDrawer', 'MobileTabs', 'MobileBottomSheet', 'MobileFullscreen']) {
  const src = readFileSync(new URL(`../components/site/header/mobile/${f}.tsx`, import.meta.url), 'utf8')
  check(src.includes('categoriasEnBuscadorMovil(') && src.includes('<BuscadorCromoCompacto'), `${f} respeta la clave`)
  check(src.includes('<SearchBarInline'), `${f} conserva la barra de siempre`)
}

if (problemas.length) {
  console.error(`verify-buscador-movil: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-buscador-movil: ${casos} casos`)
