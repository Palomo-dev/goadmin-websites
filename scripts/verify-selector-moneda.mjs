/**
 * verify-selector-moneda.mjs — panel del selector de moneda del encabezado.
 *
 *   npm run verify:selector-moneda
 *
 * 1. Orden: la moneda base primero y las demás por código (`lib/site/ordenMonedas.ts`).
 * 2. El panel tiene colores propios: fondo blanco, código #111827, país #4B5563; no hereda el
 *    texto del encabezado ni usa variantes `dark:`; filas de 40 px, alto máximo de 320 px con
 *    scroll fino y z-index alto; la elegida con el primario del sitio y un check.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

const fuenteOrden = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/site/ordenMonedas.ts'), 'utf8'), { mode: 'strip' })
const { ordenarMonedas } = await import(`data:text/javascript;base64,${Buffer.from(fuenteOrden).toString('base64')}`)

const m = (...codigos) => codigos.map((code) => ({ code, country: code }))
const codigos = (l) => l.map((x) => x.code)
igual(codigos(ordenarMonedas(m('USD', 'EUR', 'COP', 'MXN'), 'COP')), ['COP', 'EUR', 'MXN', 'USD'], 'COP primero y el resto alfabético')
igual(codigos(ordenarMonedas(m('USD', 'EUR', 'COP'), 'cop')), ['COP', 'EUR', 'USD'], 'la base sin importar mayúsculas')
igual(codigos(ordenarMonedas(m('USD', 'EUR'), 'COP')), ['EUR', 'USD'], 'sin la base en la lista: alfabético')
igual(codigos(ordenarMonedas(m('PEN', 'ARS', 'MXN'), 'MXN')), ['MXN', 'ARS', 'PEN'], 'otra base (MXN) primero')
igual(codigos(ordenarMonedas([], 'COP')), [], 'lista vacía')
const original = m('USD', 'COP')
ordenarMonedas(original, 'COP')
igual(codigos(original), ['USD', 'COP'], 'no muta la lista')

const comp = (await readFile(join(ROOT, 'components/site/CurrencySelector.tsx'), 'utf8')).replace(/\r\n/g, '\n')
const panel = comp.slice(comp.indexOf('role="listbox"'))
check(comp.includes('role="listbox"'), 'el panel es un listbox')
check(/bg-white/.test(panel) && /text-\[#111827\]/.test(panel), 'panel blanco con texto #111827 propio')
check(!/dark:/.test(panel), 'el panel no usa variantes dark:')
check(/'#4B5563'/.test(panel), 'el país en #4B5563')
check(/\bh-10\b/.test(panel), 'filas de 40 px')
check(/max-h-\[320px\]/.test(panel) && /overflow-y-auto/.test(panel), 'alto máximo 320 px con scroll')
check(/scrollbar-width:thin/.test(panel), 'scroll fino')
check(/z-\[1000\]/.test(panel), 'z-index alto')
check(/ordenarMonedas\(availableCurrencies, baseCurrency\)/.test(comp), 'usa el orden con la moneda base')
check(/<Check\b/.test(panel) && /aria-selected=\{elegida\}/.test(panel), 'la elegida lleva check y aria-selected')
check(/COLOR_MARCA = 'var\(--primary-color/.test(comp), 'la elegida usa el primario del sitio')
check(!/primaryColor/.test(panel), 'el panel no usa primaryColor (en HeaderPorZonas es el color del ícono)')
check(/e\.key === 'Escape'/.test(comp), 'Escape cierra el panel')
check(/aria-expanded=\{open\}/.test(comp), 'el botón anuncia si está abierto')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ selector de moneda: ${casos} comprobaciones`)
