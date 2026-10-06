/**
 * verify-busqueda-org.mjs — el buscador de productos no lee la organización de la query.
 *
 *   npm run verify:busqueda
 *
 * `/api/products/search` aceptaba `?organizationId=` cuando getOrgContext no resolvía la
 * organización, y con service role eso abría el catálogo de cualquier organización cambiando
 * el número. Este script falla si vuelve a pasar:
 *
 * 1. Lógica pura (lib/products/organizacionBusqueda.ts): sin contexto no hay organización; un
 *    `organizationId` que no coincide con el del contexto (o sin contexto) es 403.
 * 2. Fuente del route: la organización sale de getOrgContext y el parámetro `organizationId`
 *    solo se lee como argumento de `resolverOrganizacionBusqueda` (o para el registro del 403);
 *    nada de parseInt/Number sobre él ni de asignarlo a `orgId`.
 * 3. Los componentes del buscador ya no mandan `organizationId`.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

// ─── 1. Lógica pura ─────────────────────────────────────────────────────────────────────────
const dir = join(ROOT, '.verify-busqueda-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
let m
try {
  const ts = await readFile(join(ROOT, 'lib/products/organizacionBusqueda.ts'), 'utf8')
  const js = stripTypeScriptTypes(ts, { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  if (/^import\s/m.test(js)) throw new Error('lib/products/organizacionBusqueda.ts dejó de ser puro (import con valor)')
  await writeFile(join(dir, 'organizacionBusqueda.mjs'), js)
  m = await import(pathToFileURL(join(dir, 'organizacionBusqueda.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}
const r = m.resolverOrganizacionBusqueda
igual(r(120, null), { tipo: 'ok', organizationId: 120 }, 'contexto sin parámetro')
igual(r(120, '120'), { tipo: 'ok', organizationId: 120 }, 'parámetro igual al contexto')
igual(r(120, ' 120 '), { tipo: 'ok', organizationId: 120 }, 'parámetro igual con espacios')
igual(r(120, '121'), { tipo: 'prohibido', motivo: 'no_coincide' }, 'parámetro de otra organización')
igual(r(120, ''), { tipo: 'prohibido', motivo: 'no_coincide' }, 'parámetro vacío')
igual(r(120, '120abc'), { tipo: 'prohibido', motivo: 'no_coincide' }, 'parámetro con basura (parseInt lo aceptaría)')
igual(r(120, '0120'), { tipo: 'ok', organizationId: 120 }, 'ceros a la izquierda, mismo número')
igual(r(120, '1.2e2'), { tipo: 'prohibido', motivo: 'no_coincide' }, 'notación científica')
igual(r(null, '120'), { tipo: 'prohibido', motivo: 'sin_contexto' }, 'sin contexto con parámetro (el fallback antiguo)')
igual(r(undefined, '120'), { tipo: 'prohibido', motivo: 'sin_contexto' }, 'contexto undefined con parámetro')
igual(r(null, null), { tipo: 'sin_organizacion' }, 'sin contexto ni parámetro')
igual(r(0, null), { tipo: 'sin_organizacion' }, 'contexto inválido')

// ─── 2. Fuente del route ────────────────────────────────────────────────────────────────────
const RUTA = 'app/api/products/search/route.ts'
const fuente = (await readFile(join(ROOT, RUTA), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
check(/await getOrgContext\(/.test(fuente), `${RUTA}: ya no llama a getOrgContext()`)
check(/resolverOrganizacionBusqueda\(\s*ctx\?\.organization\.id/.test(fuente), `${RUTA}: la organización debe resolverse con resolverOrganizacionBusqueda(ctx?.organization.id, …)`)
check(/const orgId = resolucion\.organizationId\b/.test(fuente), `${RUTA}: orgId debe salir solo de resolverOrganizacionBusqueda`)
check(/status:\s*403/.test(fuente) && /console\.warn\(/.test(fuente), `${RUTA}: el desacuerdo debe responder 403 y registrarse con console.warn`)

// Cada lectura de `organizationId` de la query va al comparador o al registro del 403.
const lecturas = [...fuente.matchAll(/^.*\.get\(\s*['"`]organizationId['"`]\s*\).*$/gm)].map((x) => x[0].trim())
check(lecturas.length > 0, `${RUTA}: no se encontró la lectura de organizationId (¿cambió la forma? revisa este script)`)
for (const linea of lecturas) {
  const permitida = /resolverOrganizacionBusqueda\(/.test(linea) || /^organizacionQuery:/.test(linea)
  check(permitida, `${RUTA}: lectura de organizationId fuera del comparador: «${linea}»`)
}
check(!/(parseInt|Number|parseFloat)\([^)]*organizationId/i.test(fuente), `${RUTA}: convierte organizationId de la query a número`)
check(!/(parseInt|Number|parseFloat)\([^)]*orgIdParam/i.test(fuente), `${RUTA}: vuelve a usar orgIdParam`)
check(!/\borgId\s*=(?!=)/.test(fuente.replace(/const orgId = resolucion\.organizationId/, '')), `${RUTA}: orgId se asigna desde otra fuente`)
// Ninguna otra variable puede guardar el parámetro para usarlo después.
check(!/(const|let|var)\s+\w+\s*=\s*searchParams\.get\(\s*['"`]organizationId/.test(fuente), `${RUTA}: guarda organizationId de la query en una variable`)

// Visibilidad del catálogo público en cada consulta de productos.
check(/\.eq\('status', 'active'\)/.test(fuente) && /\.is\('parent_product_id', null\)/.test(fuente), `${RUTA}: falta el filtro de productos activos sin variantes`)
check(/getAllowedCategoryIds\(/.test(fuente) && /excluirNoListados\(/.test(fuente), `${RUTA}: falta la regla de categorías visibles o de ocultos de la carta`)
const consultasDirectas = (fuente.match(/\.from\('products'\)/g) || []).length
check(consultasDirectas === 1, `${RUTA}: hay ${consultasDirectas} consultas a products; todas deben pasar por productosVisibles()`)

// ─── 3. Componentes ─────────────────────────────────────────────────────────────────────────
for (const c of ['components/site/ProductSearch.tsx', 'components/site/SearchBarInput.tsx', 'lib/products/urlBusqueda.ts']) {
  const s = await readFile(join(ROOT, c), 'utf8')
  check(!/organizationId=/.test(s), `${c}: vuelve a mandar organizationId al buscador`)
}

// ─── Resultado ──────────────────────────────────────────────────────────────────────────────
if (problemas.length) {
  console.error(`✗ verify-busqueda-org: ${problemas.length} de ${casos} comprobaciones fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-busqueda-org: ${casos} comprobaciones`)
