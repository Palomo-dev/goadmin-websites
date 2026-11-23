/**
 * verify-menu-inferior-pintado.mjs — el menú inferior pintado con react-dom/server (Figma 2836:69391
 * «Menú inferior: propuestas de mejora», aprobado 2026-11-23).
 *
 *   npm run verify:menu-inferior-pintado
 *   MENU_BASE=<commit> npm run verify:menu-inferior-pintado   (otra base para «sin claves = hoy»)
 *
 * 1. Sin NINGUNA clave nueva, MenuInferior (pestañas, acciones y píldora flotante, con y sin
 *    destacado, textos, vidrio, ancho e indicador) pinta el MISMO HTML que la base (HEAD por
 *    defecto, extraída con `git archive` en un temporal). Se ignoran solo marcas invisibles que se
 *    agregaron para los efectos y el lector de pantalla: `data-mi-*`, `aria-current` y variables
 *    `--mi-*`.
 * 2. Páginas especiales: en checkout, carrito y pedido no hay menú (todas las tiendas).
 * 3. Cada clave nueva se pinta: Solo íconos, Isla con botón aparte, muesca, colores claros, marca
 *    que se desliza, efectos del activo y al tocar, velocidad.
 * 4. «No repetir arriba»: apagado, la cabecera del celular sigue con su carrito; encendido, no.
 * 5. app/globals.css: los selectores nuevos parsean y las reglas existen.
 *
 * Sin dependencias nuevas: transpila los componentes reales con `typescript`, como verify-pildora.
 */
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { register, createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.NODE_ENV = 'production'

let fallos = 0
let total = 0
const notas = []
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}

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
/** Marcas invisibles nuevas (efectos y lector de pantalla): no cuentan como cambio. */
const sinMarcas = (html) => html
  .replace(/ data-mi-[a-z]+="[^"]*"/g, '')
  .replace(/ aria-current="page"/g, '')
  .replace(/--mi-[a-z]+:[^;"]*;?/g, '')
  .replace(/;"/g, '"')
  .replace(/style=";/g, 'style="')
  .replace(/ style=""/g, '')

// ─── Base ────────────────────────────────────────────────────────────────────────────────────
const BASE = process.env.MENU_BASE || 'HEAD'
let base = null
let temporal = null
try {
  temporal = await mkdtemp(join(tmpdir(), 'verify-menu-base-'))
  const tar = join(temporal, 'base.tar')
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', tar, BASE, 'components', 'lib', 'types'], { stdio: 'ignore' })
  // Rutas relativas: el tar de Git Bash lee «C:» como un servidor remoto.
  execFileSync('tar', ['-xf', 'base.tar'], { cwd: temporal, stdio: 'ignore' })
  base = temporal
} catch {
  check(false, `no se pudo extraer ${BASE} (MENU_BASE=…): sin la base no se prueba «sin claves = hoy»`)
}

const ORG = { id: 9001, name: 'Tienda de muestra', subdomain: 'muestra', logo_url: null, primary_color: '#2563EB', website_settings: {} }
async function arbol(raiz) {
  return {
    MenuInferior: (await importar('components/site/MenuInferior.tsx', raiz)).MenuInferior,
    Tabs: (await importar('components/site/header/mobile/MobileTabs.tsx', raiz)).default,
    Tema: (await importar('components/site/TemaColoresContext.tsx', raiz)).TemaColoresProvider,
  }
}
const R = await arbol(ROOT)
const B = base ? await arbol(base) : null
const conTema = (A, nodo) => h(A.Tema, { value: true }, nodo)
const props = (ajustes) => ({ organization: { ...ORG, website_settings: ajustes }, primaryColor: '#2563EB', navTree: [], settings: ajustes, menuCategories: [], showCart: true })
const ITEMS = [
  { id: 'a', action: 'home', label: 'Inicio', icon: 'home', visible: true },
  { id: 'b', action: 'categories_modal', label: 'Categorías', icon: 'grid', visible: true },
  { id: 'c', action: 'search', label: 'Buscar', icon: 'search', visible: true },
  { id: 'd', action: 'cart', label: 'Carrito', icon: 'bag', visible: true },
  { id: 'e', action: 'account', label: 'Cuenta', icon: 'user', visible: true },
]
const MENU = (variant, style = { labels: 'always' }, items = ITEMS) => ({ v: 2, enabled: true, variant, style, items: variant === 'actions' ? items.slice(0, 4) : items })
const DEST = { llamar: null, whatsapp: null, comoLlegar: null, reservar: '/reservas', pedir: null }
const menu = (A, m, extra = {}) => conTema(A, h(A.MenuInferior, { menu: m, destinos: DEST, ...props({}), rutaAdmiteAcciones: true, ...extra }))

// ─── 1. Sin claves nuevas = el HTML de la base ───────────────────────────────────────────────
const HOY = [
  MENU('tabs'), MENU('tabs', { labels: 'never' }), MENU('tabs', { labels: 'always', centerId: 'd' }),
  MENU('tabs', { labels: 'always', background: '#111827', active: '#F59E0B', inactive: '#E5E7EB' }),
  MENU('actions'), MENU('actions', { labels: 'always', primaryId: 'b' }), MENU('actions', { labels: 'never', active: '#16A34A' }),
  MENU('floating'), MENU('floating', { labels: 'never', centerId: 'd' }), MENU('floating', { labels: 'always', glass: false, offset: 8 }),
  MENU('floating', { labels: 'always', width: 'full', indicator: 'dot' }), MENU('floating', { labels: 'always', indicator: 'line', active: '#DC2626' }),
]
if (B) {
  for (const m of HOY) {
    for (const pagina of [undefined, 'normal', 'ficha']) {
      const nombre = `MenuInferior ${m.variant} ${JSON.stringify(m.style)} ${pagina ?? '(sin página)'}`
      const hoy = sinMarcas(pintar(`${nombre} (base)`, menu(B, m)))
      const ahora = sinMarcas(pintar(nombre, menu(R, m, pagina ? { pagina } : {})))
      check(hoy.length > 0 && hoy === ahora, `${nombre}: el HTML cambió sin claves nuevas`)
      if (hoy !== ahora && process.env.MENU_DIFF) {
        console.error('  base :', hoy.slice(0, 4000))
        console.error('  ahora:', ahora.slice(0, 4000))
      }
    }
  }
} else notas.push('Sin la base: no se compara el HTML de hoy.')

// ─── 2. Páginas especiales (todas las tiendas) ───────────────────────────────────────────────
for (const m of [MENU('tabs'), MENU('floating'), MENU('actions'), MENU('icons'), MENU('split')]) {
  check(pintar('sin-menu', menu(R, m, { pagina: 'sin-menu' })) === '', `${m.variant}: sin menú en checkout, carrito y pedido`)
}

// ─── 3. Cada clave nueva se pinta ────────────────────────────────────────────────────────────
const p = (variant, style, extra) => pintar(`${variant} ${JSON.stringify(style)}`, menu(R, MENU(variant, { labels: 'always', ...style }), extra))
const iconos = p('icons', {})
check(iconos.includes('data-menu-inferior="iconos"'), 'Solo íconos: su marca')
check(iconos.includes('>Inicio</span>') && !iconos.includes('>Buscar</span>'), 'Solo íconos: solo el activo (Inicio) lleva texto')
check(iconos.includes('aria-label="Buscar"'), 'Solo íconos: los demás con aria-label')
const isla = p('split', {})
check(isla.includes('data-menu-inferior="isla"') && isla.includes('h-14 w-14'), 'Isla: el carrito sale aparte en su círculo')
check(isla.indexOf('aria-label="Carrito"') > isla.lastIndexOf('</ul>'), 'Isla: el aparte va después de la isla')
const islaB = p('split', { splitId: 'c' })
check(islaB.indexOf('aria-label="Buscar"') > islaB.lastIndexOf('</ul>'), 'Isla: botón aparte elegido')
check(p('tabs', { centerId: 'd', centerShape: 'notch' }).includes('h-16 w-16'), 'Muesca: círculo de 64 px')
check(!p('tabs', { centerId: 'd' }).includes('h-16 w-16'), 'Sin muesca: el círculo de hoy')
const claro = p('tabs', { theme: 'light' })
check(!claro.includes('header-bg-light') && claro.includes('var(--background-color, #ffffff)'), 'Colores claros: fondo del tema, no el del encabezado')
check(p('floating', { theme: 'header' }).includes('header-bg-light'), 'Píldora con colores del encabezado')
const desliza = p('tabs', { indicator: 'slide' })
check(desliza.includes('data-mi-marca') && desliza.includes('grid h-14 relative'), 'Desliza: marca medible y contenedor relativo')
check(p('tabs', { activeEffect: 'pill' }).includes('color-mix(in srgb, #2563EB 10%, transparent)'), 'Efecto píldora: fondo suave del color de la marca en el activo')
check(p('tabs', { activeEffect: 'dot' }).includes('h-1 w-1 rounded-full'), 'Efecto punto')
check(p('tabs', { activeEffect: 'underline' }).includes('h-0.5 w-4'), 'Efecto subrayado')
check(p('tabs', { activeEffect: 'fill' }).includes('fill="currentColor"'), 'Efecto relleno')
check(p('tabs', { activeEffect: 'bounce' }).includes('mi-rebote-activo'), 'Efecto rebote')
check(p('tabs', { activeEffect: 'glow' }).includes('0 0 16px'), 'Efecto halo')
const etiqueta = p('tabs', { activeEffect: 'label' })
check(etiqueta.includes('>Inicio</span>') && !etiqueta.includes('>Buscar</span>'), 'Etiqueta solo en el activo')
check(p('tabs', { activeEffect: 'color' }).includes('color:#2563EB'), 'Efecto color: el activo con el color de la marca')
for (const t of ['darken', 'scale', 'bounce', 'ripple', 'tilt']) check(p('tabs', { pressEffect: t }).includes(`data-mi-toque="${t}"`), `Al tocar ${t}`)
check(!p('tabs', { pressEffect: 'none' }).includes('data-mi-toque'), 'Al tocar ninguno: sin marca')
check(p('tabs', { fxSpeed: 'slow' }).includes('--mi-dur:360ms'), 'Velocidad suave: 360 ms')
check(p('floating', { activeEffect: 'pill' }) === p('floating', {}), 'Píldora: «pill» es el relleno de hoy')

// ─── 4. «No repetir arriba» ──────────────────────────────────────────────────────────────────
const conMenu = (dedupe) => ({ mobile_menu_style: 'tabs', mobile_header: { bottom_nav: { ...MENU('tabs'), style: { labels: 'always', ...(dedupe ? { dedupeHeader: true } : {}) } } } })
const cab = (a) => pintar(`cabecera ${JSON.stringify(a)}`, conTema(R, h(R.Tabs, props(a))))
check(cab(conMenu(false)).includes('data-icono-carrito'), 'Sin «No repetir»: la cabecera del celular conserva el carrito (como hoy)')
check(!cab(conMenu(true)).includes('data-icono-carrito'), 'Con «No repetir»: el carrito solo queda abajo')

// ─── 5. app/globals.css ──────────────────────────────────────────────────────────────────────
const requerir = createRequire(join(ROOT, 'package.json'))
const postcss = requerir('postcss')
const parser = requerir('postcss-selector-parser')
const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
let nuevas = 0
postcss.parse(css).walkRules((regla) => {
  if (!/data-mi-|mi-onda|mi-rebote|data-pagina-menu|data-menu-apilado|data-menu-inferior/.test(regla.selector)) return
  try {
    parser().processSync(regla.selector)
    nuevas++
  } catch (e) {
    check(false, `globals.css: selector que no parsea «${regla.selector.slice(0, 120)}» (${e.message})`)
  }
})
check(nuevas >= 15, `globals.css: reglas del menú inferior (${nuevas})`)
for (const r of ['html[data-pagina-menu="sin-menu"]', 'html[data-pagina-menu="ficha"][data-barra-fija-celular="visible"]', 'html[data-menu-apilado][data-barra-fija-celular="visible"] [data-barra-fija-celular]', 'nav[data-menu-inferior][data-oculto]', 'prefers-reduced-motion: no-preference']) {
  check(css.includes(r), `globals.css: ${r}`)
}

if (temporal) await rm(temporal, { recursive: true, force: true })
for (const n of notas) console.log('·', n)
console.log(fallos ? `✗ verify-menu-inferior-pintado: ${fallos} de ${total} comprobaciones fallaron` : `verify-menu-inferior-pintado: ${total} comprobaciones OK`)
process.exit(fallos ? 1 : 0)
