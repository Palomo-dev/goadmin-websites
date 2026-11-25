/**
 * verify-datos-cabecera.mjs — la cabecera recibe lo mismo en todas las rutas de la tienda.
 *
 *   npm run verify:datos-cabecera            (con --tabla imprime qué pasa cada ruta)
 *
 * El bug (2026-11-25, computador, org 338): en /consultar-pedido desaparecía el botón «☰ Todas las
 * categorías ▾» y el menú mostraba «Categorías» como enlace. Cada página pasaba sus datos de
 * cabecera a OrganizationLayout y solo la comodín ([[...slug]]) los pasaba todos; consultar
 * pedido, favoritos, carrito, pedido, mi cuenta, auth, agendar, reservas, pases, viajes… pasaban
 * solo `headerNav`. Medido en producción antes del arreglo: la cabecera de /consultar-pedido y de
 * /favoritos salía sin el botón; /, /productos, /ofertas, /contacto, /categorias y /search, con él.
 *
 * Qué comprueba:
 * 1. completarDatosCabecera: lo de la página manda; lo que falta sale del contexto (misma
 *    organización); otra organización nunca presta sus datos.
 * 2. OrganizationLayout lee getOrgContext() solo si faltan datos y pasa a la cabecera los
 *    completados (después de `{...props}`, para que ganen).
 * 3. Por ruta: ninguna página fuerza una cabecera vacía (`menuCategories={[]}`, `headerNavTree={[]}`)
 *    y toda página con OrganizationLayout queda cubierta por la completación. El checkout (/checkout)
 *    tiene su cabecera propia (CheckoutEncabezado) y no monta OrganizationLayout.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const leer = (r) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n')
const problemas = []
let casos = 0
const check = (c, m) => { casos++; if (!c) problemas.push(m) }

// ─── 1. La regla ────────────────────────────────────────────────────────────────────────────────
const { completarDatosCabecera, faltanDatosCabecera, CLAVES_DATOS_CABECERA } = await import('../lib/website/datosCabecera.ts')
const ctx = { organizationId: 338, headerNav: ['nav'], headerNavTree: ['arbol'], menuCategories: ['cat'], megaMenuItems: ['mega'] }
{
  const r = completarDatosCabecera({ organizationId: 338, headerNav: ['nav-pagina'] }, ctx)
  check(r.headerNav[0] === 'nav-pagina' && r.headerNavTree[0] === 'arbol' && r.menuCategories[0] === 'cat' && r.megaMenuItems[0] === 'mega',
    'consultar-pedido (solo headerNav): completa árbol, categorías y menú mega del contexto')
}
{
  const r = completarDatosCabecera({ organizationId: 338, headerNav: ['a'], headerNavTree: ['b'], menuCategories: [], megaMenuItems: undefined }, ctx)
  check(r.menuCategories.length === 0 && r.headerNavTree[0] === 'b', 'lo que pasa la página manda (también una lista vacía a propósito)')
}
{
  const r = completarDatosCabecera({ organizationId: 338 }, { ...ctx, megaMenuItems: null })
  check(r.megaMenuItems === undefined && r.menuCategories[0] === 'cat', 'sin menú mega nombrado: undefined (la cabecera usa las categorías, como en la comodín)')
}
{
  const r = completarDatosCabecera({ organizationId: 120 }, ctx)
  check(r.menuCategories === undefined && r.headerNavTree === undefined, 'otra organización nunca presta sus datos de cabecera')
}
check(completarDatosCabecera({ organizationId: 338 }, null).menuCategories === undefined, 'sin contexto: lo de la página (nada)')
check(faltanDatosCabecera({}) && faltanDatosCabecera({ menuCategories: [] }) && !faltanDatosCabecera({ menuCategories: [], headerNavTree: [] }),
  'faltan datos si la página no pasa categorías o árbol (la comodín pasa los dos y no relee el contexto)')
check(CLAVES_DATOS_CABECERA.join() === 'headerNav,headerNavTree,menuCategories,megaMenuItems', 'las cuatro piezas de la cabecera')

// ─── 2. OrganizationLayout ──────────────────────────────────────────────────────────────────────
const layout = leer('components/site/OrganizationLayout.tsx')
check(/faltanDatosCabecera\(props\) \? getOrgContext\(\)\.catch\(\(\) => null\) : Promise\.resolve\(null\)/.test(layout), 'OrganizationLayout: lee getOrgContext() (react.cache) solo si faltan datos')
check(/completarDatosCabecera\(/.test(layout), 'OrganizationLayout: completa con la regla única')
{
  const i = layout.indexOf('{...props}')
  const bloque = i >= 0 ? layout.slice(i, layout.indexOf('>', layout.indexOf('categoriasBusqueda=', i))) : ''
  for (const clave of CLAVES_DATOS_CABECERA) {
    check(new RegExp(`${clave}=\\{cabecera\\.${clave}\\}`).test(bloque), `OrganizationLayout: pasa \`${clave}\` completado después de {...props}`)
  }
}
const cliente = leer('components/site/OrganizationLayoutCliente.tsx')
check(/menuCategories=\{menuCategories\}/.test(cliente) && /megaMenuItems=\{megaMenu\}|megaMenuItems=\{megaMenuItems\}/.test(cliente) && /headerNavTree=\{arbolEncabezado\}|headerNavTree=\{headerNavTree\}/.test(cliente),
  'OrganizationLayoutCliente: la cabecera recibe categorías, menú mega y árbol')

// ─── 3. Por ruta ────────────────────────────────────────────────────────────────────────────────
function paginas(dir) {
  const out = []
  for (const n of readdirSync(join(raiz, dir))) {
    const r = join(dir, n)
    if (statSync(join(raiz, r)).isDirectory()) { if (n !== 'api') out.push(...paginas(r)) }
    else if (/^(page|layout)\.tsx$/.test(n)) out.push(relative(raiz, join(raiz, r)).replace(/\\/g, '/'))
  }
  return out
}
const tabla = []
for (const ruta of paginas('app')) {
  const src = leer(ruta)
  for (const m of src.matchAll(/<OrganizationLayout\b([\s\S]*?)>/g)) {
    const attrs = m[1]
    const pasa = Object.fromEntries(CLAVES_DATOS_CABECERA.map((c) => [c, new RegExp(`\\b${c}=`).test(attrs)]))
    tabla.push({ ruta: ruta.replace(/^app\//, '/').replace(/\/(page|layout)\.tsx$/, '') || '/', ...pasa })
    check(!/menuCategories=\{\[\]\}|headerNavTree=\{\[\]\}/.test(attrs), `${ruta}: fuerza una cabecera sin categorías o sin menú (la cabecera sería distinta a la de la home)`)
  }
}
check(tabla.length >= 20, `se esperaban 20+ montajes de OrganizationLayout (hay ${tabla.length}; ¿cambió la forma de montarlo?)`)
check(tabla.some((t) => t.ruta.includes('consultar-pedido')) && tabla.some((t) => t.ruta.includes('favoritos')), 'consultar-pedido y favoritos montan OrganizationLayout (quedan cubiertas)')
check(!/<OrganizationLayout\b/.test(leer('app/checkout/page.tsx')), 'checkout: cabecera propia (no monta OrganizationLayout); no se cambia')
if (process.argv.includes('--tabla')) {
  console.log('ruta                               headerNav headerNavTree menuCategories megaMenuItems  (sin ✓ = lo completa el layout)')
  for (const t of tabla) console.log(`${t.ruta.padEnd(36)}${(t.headerNav ? '✓' : '·').padEnd(10)}${(t.headerNavTree ? '✓' : '·').padEnd(14)}${(t.menuCategories ? '✓' : '·').padEnd(15)}${t.megaMenuItems ? '✓' : '·'}`)
}

if (problemas.length) {
  console.error(`✗ verify-datos-cabecera: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-datos-cabecera: ${casos} comprobaciones (${tabla.length} montajes de OrganizationLayout)`)
