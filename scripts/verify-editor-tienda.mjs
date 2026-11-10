/**
 * verify-editor-tienda.mjs — tres decisiones del dueño (2026-11-10) para que el editor del ERP
 * ofrezca las plantillas de tienda:
 *   1. Categorías · estilo «Lista de texto» (`category_style: 'text_list'`).
 *   2. Antes/Después: etiquetas editables (`before_label` / `after_label` en transformation · slider).
 *   3. Bloques de color como UNA sección con repetidor (`blocks` en image_text · color_block).
 *
 *   npm run verify:editor-tienda
 *   EDITOR_TIENDA_BASE=<commit> npm run verify:editor-tienda   (otra base para «sin claves = hoy»)
 *
 * Qué comprueba (sin dependencias nuevas: transpila TS/TSX con `typescript`, como verify-botones):
 * 1. Lectura: estiloCategoria, etiquetasAntesDespues, bloquesColor y columnasBloquesColor con
 *    valores buenos, ausentes y basura.
 * 2. Sin NINGUNA clave nueva el HTML de EstilosCategoria (cada estilo), CategoriesGrid,
 *    AntesDespues e ImageTextColor es IDÉNTICO al del commit base (`main`, con `git archive`).
 * 3. Con cada clave aparece lo que la pinta y el manifiesto (CONTENT_KEYS) la declara.
 */
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { register } from 'node:module'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.NODE_ENV = 'production'

let fallos = 0
let total = 0
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}
const igual = (a, b, msg) => check(isDeepStrictEqual(a, b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)

// ─── Cargador TS/TSX: `@/` → raíz pedida; paquetes desde node_modules de este repo ────────────
const CARGADOR = `
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
let ts, raizPaquetes
export async function initialize(d) {
  raizPaquetes = d.raizPaquetes
  ts = createRequire(join(raizPaquetes, 'package.json'))('typescript')
}
const EXT = ['.tsx', '.ts', '.mjs', '.js', '/index.tsx', '/index.ts', '/index.js']
function archivo(base) {
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const e of EXT) if (existsSync(base + e)) return base + e
  return null
}
function raizDe(url) {
  // La raíz del árbol que importa: la carpeta con package.json o con app/ y components/.
  let d = dirname(fileURLToPath(url))
  while (d !== dirname(d)) {
    if (existsSync(join(d, 'components')) && existsSync(join(d, 'lib'))) return d
    d = dirname(d)
  }
  return raizPaquetes
}
export async function resolve(esp, ctx, next) {
  const padre = ctx.parentURL && ctx.parentURL.startsWith('file:') ? ctx.parentURL : null
  if (esp.endsWith('.css')) return { url: 'data:text/javascript,export default new Proxy({}, { get: (_, k) => String(k) })', shortCircuit: true }
  if (esp.startsWith('@/') && padre) {
    const f = archivo(join(raizDe(padre), esp.slice(2)))
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
  }
  if ((esp.startsWith('./') || esp.startsWith('../')) && padre) {
    const f = archivo(join(dirname(fileURLToPath(padre)), esp))
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
  }
  if (!esp.startsWith('.') && !esp.startsWith('/') && !esp.startsWith('node:') && !esp.startsWith('data:') && !esp.startsWith('file:')) {
    const padreRaiz = pathToFileURL(join(raizPaquetes, 'package.json')).href
    try {
      return await next(esp, { ...ctx, parentURL: padreRaiz })
    } catch (e) {
      // Subrutas sin «exports» (next/link): la resolución de CommonJS.
      return { url: pathToFileURL(createRequire(padreRaiz).resolve(esp)).href, shortCircuit: true }
    }
  }
  return next(esp, ctx)
}
export async function load(url, ctx, next) {
  if (url.startsWith('file:') && /\\.(tsx?|mts)$/.test(url)) {
    const fuente = readFileSync(fileURLToPath(url), 'utf8')
    const { outputText } = ts.transpileModule(fuente, {
      fileName: fileURLToPath(url),
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, verbatimModuleSyntax: false, isolatedModules: true },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  }
  return next(url, ctx)
}
`
register(`data:text/javascript,${encodeURIComponent(CARGADOR)}`, { parentURL: import.meta.url, data: { raizPaquetes: ROOT } })

const importar = (rel, raiz = ROOT) => import(pathToFileURL(join(raiz, rel)).href)
const React = (await import(pathToFileURL(join(ROOT, 'node_modules/react/index.js')).href)).default
const { renderToStaticMarkup } = (await import(pathToFileURL(join(ROOT, 'node_modules/react-dom/server.node.js')).href)).default
const h = React.createElement
const errorOriginal = console.error
console.error = (...args) => {
  const t = String(args[0] ?? '')
  if (t.includes('useLayoutEffect does nothing on the server') || t.includes('fetchPriority')) return
  errorOriginal(...args)
}
const pintar = (nombre, nodo) => {
  try {
    return renderToStaticMarkup(nodo)
  } catch (e) {
    check(false, `${nombre}: revienta al pintar — ${e instanceof Error ? e.message : e}`)
    return ''
  }
}
const cuenta = (html, aguja) => html.split(aguja).length - 1

// ─── 1. Lectura ──────────────────────────────────────────────────────────────────────────────
const ec = await importar('lib/website/estiloCategoria.ts')
const op = await importar('lib/website/opcionesEditorTienda.ts')
for (const v of ['circle', 'card_bottom', 'pill', 'bento', 'minimal_icon', 'title_top', 'text_list']) igual(ec.estiloCategoria(v), v, `estiloCategoria(${v})`)
for (const v of [undefined, null, '', 'overlay', 'lista', 'TEXT_LIST', 3]) igual(ec.estiloCategoria(v), null, `estiloCategoria(${JSON.stringify(v)}) = la superpuesta de hoy`)
igual(op.ESTILO_CATEGORIA_LISTA_TEXTO, 'text_list', 'nombre del estilo')
check(op.clasesListaTexto(undefined).includes('md:justify-center'), 'lista de texto centrada por defecto')
check(!op.clasesListaTexto('left').includes('justify-center'), 'lista de texto a la izquierda con align left')

const DEF = { antes: 'Antes', despues: 'Después' }
for (const c of [undefined, null, {}, { before_label: '', after_label: '   ' }, { before_label: 3, after_label: {} }]) igual(op.etiquetasAntesDespues(c), DEF, `etiquetas ${JSON.stringify(c)} = las de hoy`)
igual(op.etiquetasAntesDespues({ before_label: '  Ayer ', after_label: 'Hoy' }), { antes: 'Ayer', despues: 'Hoy' }, 'etiquetas propias (recortadas)')
igual(op.etiquetasAntesDespues({ before_label: 'x'.repeat(40) }).antes.length, op.MAX_ETIQUETA_ANTES_DESPUES, 'etiqueta larga se recorta')
igual([...op.CLAVES_ETIQUETAS_ANTES_DESPUES], ['before_label', 'after_label'], 'claves de las etiquetas')

for (const c of [undefined, {}, { blocks: null }, { blocks: 'x' }, { blocks: {} }, { blocks: [] }, { blocks: [{}, null, 3, [], { phrase: 'solo frase' }] }]) igual(op.bloquesColor(c), [], `bloques ${JSON.stringify(c)} = bloque único de hoy`)
const B = (i) => ({ number: `0${i}`, title: `Bloque ${i}`, phrase: 'Frase', image_url: `https://ejemplo.test/${i}.jpg`, bg_color: '#D6C4AA', text_color: '', cta_url: '/categorias/uno' })
igual(op.bloquesColor({ blocks: [B(1), {}, B(2)] }).map((b) => b.title), ['Bloque 1', 'Bloque 2'], 'bloques vacíos fuera, orden conservado')
igual(op.bloquesColor({ blocks: Array.from({ length: 8 }, (_, i) => B(i + 1)) }).length, 5, 'máximo 5 bloques')
igual(op.bloquesColor({ blocks: [{ ...B(1), bg_color: 'rojo', cta_url: 'javascript:alert(1)' }] })[0].bgColor, '', 'color inválido = el del tema')
igual(op.bloquesColor({ blocks: [{ ...B(1), cta_url: 'javascript:alert(1)' }] })[0].ctaUrl, '', 'destino peligroso fuera')
for (const [n, c] of [[1, ''], [2, 'md:grid-cols-2'], [3, 'md:grid-cols-3'], [4, 'md:grid-cols-2 lg:grid-cols-4'], [5, 'md:grid-cols-3 lg:grid-cols-5']]) igual(op.columnasBloquesColor(n), c, `columnas con ${n}`)

// ─── 2. Sin claves = el commit base ──────────────────────────────────────────────────────────
const BASE = process.env.EDITOR_TIENDA_BASE || 'main'
let base = null
let temporal = null
try {
  temporal = await mkdtemp(join(tmpdir(), 'verify-editor-tienda-base-'))
  execFileSync('bash', ['-c', `git -C "${ROOT}" archive ${BASE} components lib types | tar -x -C "${temporal}"`], { stdio: 'ignore' })
  base = temporal
} catch {
  check(false, `no se pudo extraer ${BASE} (EDITOR_TIENDA_BASE=…): sin la base no se prueba «sin claves = hoy»`)
}

const CATS = [
  { id: 1, name: 'Sillas', slug: 'sillas', product_count: 18, color: '#B08D6A', image_url: 'https://ejemplo.test/sillas.jpg', description: 'Para sentarse sin prisa.' },
  { id: 2, name: 'Mesas', slug: 'mesas', product_count: 12, color: '#7A8566', image_url: null },
  { id: 3, name: 'Iluminación', slug: 'iluminacion', product_count: 9, color: null, image_url: 'https://ejemplo.test/luz.jpg' },
]
const CONTENIDOS_CAT = [{}, { show_count: true }, { title: 'Categorías', subtitle: 'Explora', desktop_columns: 3, mobile_layout: 'grid', show_count: true, category_card_color: 'per_item', category_cta_icon: 'arrow_circle', category_text_position: 'top' }]
const ACT = {
  ec: await importar('components/sections/products/EstilosCategoria.tsx'),
  cg: await importar('components/sections/products/CategoriesGrid.tsx'),
  ad: await importar('components/sections/tienda/AntesDespues.tsx'),
  ic: await importar('components/sections/image-text/ImageTextColor.tsx'),
}
const BAS = base
  ? {
      ec: await importar('components/sections/products/EstilosCategoria.tsx', base),
      cg: await importar('components/sections/products/CategoriesGrid.tsx', base),
      ad: await importar('components/sections/tienda/AntesDespues.tsx', base),
      ic: await importar('components/sections/image-text/ImageTextColor.tsx', base),
    }
  : null

const PARES = [{ name: 'Sala', before_url: 'https://ejemplo.test/a1.jpg', after_url: 'https://ejemplo.test/d1.jpg' }, { name: '', before_url: 'https://ejemplo.test/a2.jpg', after_url: 'https://ejemplo.test/d2.jpg' }]
const ORG = { website_settings: { accent_color: '#B4583A' } }
const casosSinClaves = []
for (const estilo of ['circle', 'card_bottom', 'pill', 'bento', 'minimal_icon', 'title_top']) {
  for (const c of CONTENIDOS_CAT) {
    casosSinClaves.push([`EstilosCategoria ${estilo} ${JSON.stringify(c)}`, (m) => h(m.ec.EstilosCategoria, { categorias: CATS, estilo, primaryColor: '#1C1A18', content: { ...c, category_style: estilo } })])
  }
}
for (const c of [...CONTENIDOS_CAT, { category_style: 'overlay' }, { category_style: 'pill', show_count: true }]) {
  casosSinClaves.push([`CategoriesGrid ${JSON.stringify(c)}`, (m) => h(m.cg.CategoriesGrid, { content: c, primaryColor: '#1C1A18', data: { categories: CATS } })])
}
for (const c of [{ items: PARES }, { title: 'Así cambia una sala', subtitle: 'Mismo espacio', items: PARES.slice(0, 1), start_position: 30, handle_color: 'blanco' }, { items: [] }]) {
  casosSinClaves.push([`AntesDespues ${JSON.stringify(c)}`, (m) => h(m.ad.AntesDespues, { content: c, primaryColor: '#1C1A18', organization: ORG, data: { esVistaPrevia: true } })])
}
for (const c of [B(1), { title: 'Solo título' }, {}, { ...B(2), blocks: 'no es lista' }, { ...B(3), blocks: [{}] }]) {
  casosSinClaves.push([`ImageTextColor ${JSON.stringify(c)}`, (m) => h(m.ic.ImageTextColor, { content: c, primaryColor: '#1C1A18', data: {} })])
}
if (BAS) {
  for (const [nombre, nodo] of casosSinClaves) {
    const a = pintar(`${nombre} (rama)`, nodo(ACT))
    const b = pintar(`${nombre} (base)`, nodo(BAS))
    check(a !== '' || nombre.includes('[]') || nombre.includes('{}'), `${nombre}: no pintó nada`)
    check(a === b, `${nombre}: sin claves nuevas el HTML cambió respecto de ${BASE}`)
  }
}

// ─── 3. Cada clave pintada ───────────────────────────────────────────────────────────────────
for (const c of [{}, { show_count: true, title: 'Categorías', align: 'left' }]) {
  const html = pintar('lista de texto', h(ACT.ec.EstilosCategoria, { categorias: CATS, estilo: 'text_list', primaryColor: '#1C1A18', content: { ...c, category_style: 'text_list' } }))
  check(html.includes('data-categorias-texto'), 'lista de texto: la fila')
  igual(cuenta(html, '<a '), CATS.length, 'lista de texto: un enlace por categoría')
  for (const cat of CATS) check(html.includes(`href="/categorias/${cat.slug}"`) && html.includes(`>${cat.name}<`), `lista de texto: ${cat.name}`)
  check(!html.includes('<img'), 'lista de texto: sin fotos')
  check(html.includes('>18<') === Boolean(c.show_count), 'lista de texto: conteo solo con show_count')
  check(html.includes('md:justify-center') === (c.align !== 'left'), 'lista de texto: alineación')
}
const grid = pintar('CategoriesGrid text_list', h(ACT.cg.CategoriesGrid, { content: { category_style: 'text_list' }, primaryColor: '#1C1A18', data: { categories: CATS } }))
check(grid.includes('data-categorias-texto'), 'CategoriesGrid enruta text_list a la lista de texto')

const conEtiquetas = pintar('antes/después con etiquetas', h(ACT.ad.AntesDespues, { content: { items: PARES, before_label: 'Ayer', after_label: 'Hoy' }, primaryColor: '#1C1A18', organization: ORG }))
check(conEtiquetas.includes('>Ayer<') && conEtiquetas.includes('>Hoy<'), 'antes/después: las etiquetas propias se pintan')
check(!conEtiquetas.includes('>Antes<') && !conEtiquetas.includes('>Después<'), 'antes/después: sin los rótulos de siempre')
check(conEtiquetas.includes('alt="Ayer: Sala"') && conEtiquetas.includes('alt="Hoy: Sala"'), 'antes/después: texto alternativo con las etiquetas')
check(conEtiquetas.includes('50 % ayer, 50 % hoy'), 'antes/después: valor accesible con las etiquetas')
for (const k of ['before_label', 'after_label']) check(ACT.ad.AntesDespues.CONTENT_KEYS.includes(k), `AntesDespues.CONTENT_KEYS declara ${k}`)

for (const n of [1, 2, 3, 5]) {
  const html = pintar(`bloques ${n}`, h(ACT.ic.ImageTextColor, { content: { ...B(9), blocks: Array.from({ length: n }, (_, i) => B(i + 1)) }, primaryColor: '#1C1A18', data: {} }))
  check(html.includes(`data-bloques-color="${n}"`), `bloques ${n}: el repetidor`)
  igual(cuenta(html, 'data-bloque-color=""'), n, `bloques ${n}: uno por bloque`)
  check(!html.includes('Bloque 9'), `bloques ${n}: el bloque único no se pinta con repetidor`)
  check(cuenta(html, 'Ver la colección') === n, `bloques ${n}: enlace por bloque`)
}
check(ACT.ic.ImageTextColor.CONTENT_KEYS.includes('blocks'), 'ImageTextColor.CONTENT_KEYS declara blocks')
const fuenteOp = await readFile(join(ROOT, 'lib/website/opcionesEditorTienda.ts'), 'utf8')
for (const clase of ['md:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5']) check(fuenteOp.includes(`'${clase}`) || fuenteOp.includes(` ${clase}'`), `clase literal ${clase} (Tailwind)`)

if (temporal) await rm(temporal, { recursive: true, force: true })
if (fallos > 0) {
  console.error(`✗ verify-editor-tienda: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-editor-tienda: ${total} comprobaciones (lectura, sin claves = ${BASE} en ${casosSinClaves.length} casos, lista de texto, etiquetas y bloques)`)
