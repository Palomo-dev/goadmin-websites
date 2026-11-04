/**
 * verify-buscador.mjs — buscador del encabezado: búsquedas populares y reglas comunes.
 *
 *   npm run verify:buscador
 *
 * 1. `search_popular` (shell.header.opciones): lista de textos validada (regla `listaTextos`);
 *    sin valor, las primeras categorías del menú; nunca la lista genérica de antes.
 */
import { readFileSync } from 'node:fs'
import { normalizarOpcionShell, OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'
import { busquedasPopulares, MAX_BUSQUEDAS_POPULARES_CATEGORIAS } from '../lib/website/busquedasPopulares.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8')

// ── 1. search_popular ──
const op = OPCIONES_SHELL.search_popular
check(op && op.zona === 'header' && op.porDefecto === null && op.nueva === true && op.regla?.tipo === 'listaTextos' && op.regla.max === 8 && op.regla.largo === 30, 'search_popular registrada (header, null, listaTextos 8×30)')
igual(normalizarOpcionShell('search_popular', ['  Sillas  ergonómicas ', 'Escritorios']), ['Sillas ergonómicas', 'Escritorios'], 'recorta y normaliza espacios')
for (const malo of [[], 'Ofertas', ['a', 'A'], ['x'.repeat(31)], ['ok', 3], ['   '], Array.from({ length: 9 }, (_, i) => `b${i}`)]) {
  igual(normalizarOpcionShell('search_popular', malo), null, `inválido ${JSON.stringify(malo).slice(0, 40)} → null`)
}
const cats = [{ name: 'Sillas' }, { name: 'Escritorios' }, { name: ' sillas ' }, { name: '' }, { name: 'Archivadores' }, { name: 'Papelería' }, { name: 'Tecnología' }]
igual(busquedasPopulares(['Ofertas'], cats), ['Ofertas'], 'configuradas mandan')
igual(busquedasPopulares(null, cats), ['Sillas', 'Escritorios', 'Archivadores', 'Papelería'], 'sin configurar: primeras categorías del menú (sin repetir ni vacías)')
check(MAX_BUSQUEDAS_POPULARES_CATEGORIAS === 4, 'hasta 4 categorías')
igual(busquedasPopulares(null, []), [], 'sin categorías: nada (nunca la lista genérica)')
igual(busquedasPopulares([], undefined), [], 'lista vacía y sin categorías: nada')
for (const f of ['components/site/SearchBarInput.tsx', 'components/site/ProductSearch.tsx']) {
  const src = leer(f)
  check(!/'Ofertas', 'Nuevo', 'Tenis', 'Accesorios'/.test(src) && !src.includes("'Tenis'"), `${f}: sin la lista genérica`)
  check(src.includes('const { busquedasPopulares: popularSearches } = useEncabezadoPie()'), `${f}: lee las populares del contexto`)
  check(src.includes('popularSearches.length > 0 && ('), `${f}: sin populares no pinta el bloque`)
}
const layout = leer('components/site/OrganizationLayoutCliente.tsx')
check(layout.includes('busquedasPopulares: busquedasPopulares(opcionesShell.busquedasPopulares, menuCategories),'), 'el layout resuelve configuradas o categorías del menú')
check(leer('lib/website/encabezadoPie.ts').includes("busquedasPopulares: leer(ajustes, 'search_popular') as string[] | null,"), 'opcionesEncabezadoPie lee search_popular validado')
check(leer('components/site/useAjustesVivosPreview.ts').includes("'search_popular'"), 'la vista previa del editor la aplica en vivo')

if (problemas.length) {
  console.error(`verify-buscador: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-buscador: ${casos} casos`)
