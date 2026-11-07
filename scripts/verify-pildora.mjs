/**
 * verify-pildora.mjs — encabezado píldora, botón principal, celular en píldora y menú inferior
 * flotante (contrato 2026-11-07, Figma «Editor · Encabezado píldora, menú inferior y botones»).
 *
 *   npm run verify:pildora
 *   PILDORA_BASE=<commit> npm run verify:pildora     (otra base para «sin claves = hoy»)
 *
 * Qué comprueba (sin dependencias nuevas: transpila TS/TSX con `typescript`, como verify-cafe):
 * 1. Lectura de las claves (lib/website/pildora.ts): sin claves todo `null`/vacío; cada clave a su
 *    valor; basura = ausente; `isla` guardado = alias de `solido`.
 * 2. Sin NINGUNA clave nueva, el HTML de HeaderPill, HeaderCTA, HeaderCTAMovil, los cuatro menús
 *    del celular, MenuInferior (pestañas y acciones) y SiteHeader es IDÉNTICO al del commit base
 *    (`claude/pildora-editor`, extraído con `git archive` en un temporal).
 * 3. Con cada clave aparece el atributo, la variable o la clase que la pinta.
 * 4. app/globals.css: cada selector parsea (postcss + postcss-selector-parser), ningún compuesto
 *    lleva un nombre de etiqueta después de un atributo (`header[a]header[b]` es inválido: el
 *    navegador descarta la regla entera) y las reglas nuevas existen.
 */
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { register, createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

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

// ─── 1. Lectura de las claves ────────────────────────────────────────────────────────────────
const p = await importar('lib/website/pildora.ts')
const TODAS = {
  header_cta_shape: 'pill', header_cta_size: 'lg', header_cta_width: 120, header_cta_height: 40, header_cta_style: 'vidrio',
  header_cta_icon: 'calendar', header_cta_icon_side: 'derecha', header_cta_uppercase: true,
  header_pill_style: 'contorno', header_pill_glass_opacity: 25, header_pill_blur: 12, header_pill_border: false,
  header_pill_on_scroll: 'igual', header_pill_text_case: 'normal', header_float_offset: 20, header_pill_position: 'ambas',
}
const BASURA = {
  header_cta_shape: 'triangulo', header_cta_size: 'xl', header_cta_width: 9999, header_cta_height: 2, header_cta_style: 'neon',
  header_cta_icon: '<script>', header_cta_icon_side: 'abajo', header_cta_uppercase: 'si',
  header_pill_style: 'rosa', header_pill_glass_opacity: 90, header_pill_blur: -1, header_pill_border: 'no',
  header_pill_on_scroll: 'otro', header_pill_text_case: 'gritos', header_float_offset: 100, header_pill_position: 'lado',
}
const OP_NULAS = { opacidadVidrio: null, desenfoque: null, borde: null, alBajar: null, letras: null, separacion: null, posicion: null }
const BOTON_NULO = { forma: null, tamano: null, ancho: null, alto: null, estilo: null, icono: null, ladoIcono: null, mayusculas: null }
for (const [nombre, a] of [['sin ajustes', null], ['vacío', {}], ['basura', BASURA]]) {
  igual(p.opcionesPildora(a), OP_NULAS, `píldora ${nombre}: todo ausente`)
  igual(p.variablesPildora(a), {}, `píldora ${nombre}: sin variables`)
  igual(p.estiloPildora(a), 'vidrio', `píldora ${nombre}: vidrio`)
  igual(p.atributoAlBajar(a), undefined, `píldora ${nombre}: sin atributo de al bajar`)
  igual(p.opcionesBoton(a), BOTON_NULO, `botón ${nombre}: todo ausente`)
  check(!p.botonConOpcionesNuevas(p.opcionesBoton(a)), `botón ${nombre}: el de hoy`)
}
igual(p.estiloPildora({ header_pill_style: 'solido' }), 'isla', 'solido = la isla del tema')
igual(p.estiloPildora({ header_pill_style: 'isla' }), 'isla', 'isla guardado = alias de solido')
igual(p.estiloPildora({ header_pill_style: 'contorno' }), 'contorno', 'contorno')
igual(p.opcionesPildora(TODAS), { opacidadVidrio: 25, desenfoque: 12, borde: false, alBajar: 'igual', letras: 'normal', separacion: 20, posicion: 'ambas' }, 'píldora: cada clave')
igual(p.variablesPildora(TODAS), { '--pildora-vidrio': '0.25', '--pildora-desenfoque': '12px', '--pildora-borde': 'transparent', '--pildora-mayusculas': 'none', '--pildora-espaciado': 'normal', '--pildora-letra': '14px' }, 'píldora: variables')
igual(p.variablesPildora({ header_pill_border: true, header_pill_text_case: 'versalitas', header_pill_on_scroll: 'fondo_tema' }), {}, 'los valores de hoy escritos no ponen variables')
igual(p.atributoAlBajar({ header_pill_on_scroll: 'fondo_tema' }), undefined, 'fondo_tema = sin atributo')
igual(p.opcionesBoton(TODAS), { forma: 'pill', tamano: 'lg', ancho: 120, alto: 40, estilo: 'vidrio', icono: 'calendar', ladoIcono: 'derecha', mayusculas: true }, 'botón: cada clave')
check(!p.botonConOpcionesNuevas(p.opcionesBoton({ header_cta_shape: 'circle' })), 'solo circle = el círculo de hoy')
check(!p.botonConOpcionesNuevas(p.opcionesBoton({ header_cta_shape: 'circle', header_cta_icon: 'coffee' })), 'circle con ícono = el círculo de hoy (ya leía el ícono)')
for (const [k, v] of Object.entries(TODAS).filter(([k]) => k.startsWith('header_cta_') && k !== 'header_cta_shape')) {
  check(p.botonConOpcionesNuevas(p.opcionesBoton({ [k]: v })), `${k} sola activa el botón nuevo`)
}
for (const forma of ['pill', 'rounded', 'square']) check(p.botonConOpcionesNuevas(p.opcionesBoton({ header_cta_shape: forma })), `forma ${forma} activa el botón nuevo`)
igual(p.radioBoton(p.opcionesBoton({}), {}), '8px', 'radio de hoy')
igual(p.radioBoton(p.opcionesBoton({}), { cta_border_radius: 4 }), '4px', 'radio guardado')
igual(p.radioBoton(p.opcionesBoton({ header_cta_shape: 'rounded' }), { cta_border_radius: 4 }), '12px', 'rounded = 12')
igual(p.radioBoton(p.opcionesBoton({ header_cta_style: 'tema' }), {}), 'var(--radio-boton, 8px)', 'tema = radio del sitio')
igual(p.medidasBoton(p.opcionesBoton({ header_cta_size: 'md' }), {}), { alto: 44, rellenoX: 18, rellenoY: 8, ancho: null }, 'md = 44 con 18')
igual(p.medidasBoton(p.opcionesBoton({ header_cta_size: 'md', header_cta_height: 60 }), { cta_padding_x: 30 }), { alto: 60, rellenoX: 30, rellenoY: 8, ancho: null }, 'alto y cta_padding_x mandan')
igual(p.diametroCirculo(p.opcionesBoton({ header_cta_size: 'sm' })), 56, 'círculo sm 56')
igual(p.diametroCirculo(p.opcionesBoton({})), 76, 'círculo de hoy 76')
igual(p.pildoraMovil({}), { arriba: false, abajo: false }, 'celular sin pill: el de hoy')
igual(p.pildoraMovil({ header_style: 'default', header_pill_position: 'ambas' }), { arriba: false, abajo: false }, 'la posición sin pill no hace nada')
igual(p.pildoraMovil({ header_style: 'pill' }), { arriba: true, abajo: false }, 'pill sin posición = arriba (decisión del dueño)')
igual(p.pildoraMovil({ header_style: 'pill', header_pill_position: 'abajo' }), { arriba: false, abajo: true }, 'abajo')
igual(p.pildoraMovil({ header_style: 'pill', header_pill_position: 'ambas' }), { arriba: true, abajo: true }, 'ambas')
igual(p.pildoraMovil({ header_style: 'pill', header_layout: 'clasico' }), { arriba: false, abajo: false }, 'header_layout manda sobre header_style')
const ENL = [{ name: 'Inicio', href: '/' }, { name: 'Carta', href: '/carta' }, { name: 'Historia', href: '/historia' }, { name: 'Contacto', href: '/contacto' }, { name: 'Sedes', href: '/sedes' }, { name: 'Eventos', href: '/eventos' }]
const mf = p.menuFlotanteDesdeEncabezado(ENL, { texto: 'Reservar', href: '/reservas' })
igual(mf.items.map((b) => b.label), ['Inicio', 'Carta', 'Reservar', 'Historia', 'Contacto'], 'flotante: 4 enlaces y el botón al centro')
check(mf.variant === 'floating' && mf.style.centerId === 'pildora-cta' && mf.items[2].icon === 'calendar', 'flotante: botón destacado con calendario')
igual(mf.items.map((b) => b.icon), ['home', 'grid', 'calendar', 'heart', 'phone'], 'flotante: íconos por el enlace')
igual(p.menuFlotanteDesdeEncabezado(ENL, null).items.length, 5, 'flotante sin botón: 5 enlaces')
check(p.menuFlotanteDesdeEncabezado([], null) === null, 'flotante sin enlaces ni botón: nada')
igual(p.menuFlotanteDesdeEncabezado([{ name: 'X', href: '#ancla' }, { name: 'Y', href: 'https://x.co' }], { texto: 'Escríbenos', href: 'whatsapp' }).items.map((b) => b.action), ['whatsapp', 'url'], 'flotante: anclas fuera, whatsapp y externos')

// ─── 2. Sin claves = el HTML del commit base ─────────────────────────────────────────────────
const BASE = process.env.PILDORA_BASE || '5e3f6dfc7ab69b8eb92fe2bc61aba25b947acfa8'
let base = null
let temporal = null
try {
  temporal = await mkdtemp(join(tmpdir(), 'verify-pildora-base-'))
  execFileSync('bash', ['-c', `git -C "${ROOT}" archive ${BASE} components lib types | tar -x -C "${temporal}"`], { stdio: 'ignore' })
  base = temporal
} catch {
  check(false, `no se pudo extraer ${BASE} (PILDORA_BASE=…): sin la base no se prueba «sin claves = hoy»`)
}

const ORG = { id: 9001, name: 'Café de muestra', subdomain: 'muestra', logo_url: null, primary_color: '#2E3328', website_settings: {} }
const pagina = (id, title, slug) => ({ id, organization_id: ORG.id, title, slug, children: [], level: 0, is_published: true, show_in_header: true })
const NAV = [pagina(1, 'Inicio', 'home'), pagina(2, 'Carta', 'carta'), pagina(3, 'Historia', 'historia'), pagina(4, 'Contacto', 'contacto')]
const CTA = { header_cta_text: 'Reservar', header_cta_url: '/reservas' }
async function arbol(raiz) {
  return {
    HeaderPill: (await importar('components/site/header/HeaderPill.tsx', raiz)).default,
    Shared: await importar('components/site/header/HeaderShared.tsx', raiz),
    Drawer: (await importar('components/site/header/mobile/MobileDrawer.tsx', raiz)).default,
    Fullscreen: (await importar('components/site/header/mobile/MobileFullscreen.tsx', raiz)).default,
    BottomSheet: (await importar('components/site/header/mobile/MobileBottomSheet.tsx', raiz)).default,
    Tabs: (await importar('components/site/header/mobile/MobileTabs.tsx', raiz)).default,
    MenuInferior: (await importar('components/site/MenuInferior.tsx', raiz)).MenuInferior,
    SiteHeader: (await importar('components/site/SiteHeader.tsx', raiz)).default,
    Tema: (await importar('components/site/TemaColoresContext.tsx', raiz)).TemaColoresProvider,
  }
}
const R = await arbol(ROOT)
const B = base ? await arbol(base) : null
const conTema = (A, nodo) => h(A.Tema, { value: true }, nodo)
const props = (ajustes, extra = {}) => ({ organization: { ...ORG, website_settings: ajustes }, primaryColor: '#2E3328', navTree: NAV, settings: ajustes, menuCategories: [], showCart: true, ...extra })
const VISTAS = {
  pildora: (A, a) => conTema(A, h(A.HeaderPill, props(a))),
  boton: (A, a) => conTema(A, h(A.Shared.HeaderCTA, { text: 'Reservar', href: '/reservas', primaryColor: '#2E3328', settings: a })),
  botonSinTema: (A, a) => h(A.Shared.HeaderCTA, { text: 'Reservar', href: '/reservas', primaryColor: '#2E3328', settings: a }),
  botonMovil: (A, a) => conTema(A, h(A.Shared.HeaderCTAMovil, { settings: { ...CTA, ...a }, primaryColor: '#2E3328' })),
  drawer: (A, a) => conTema(A, h(A.Drawer, props(a))),
  fullscreen: (A, a) => conTema(A, h(A.Fullscreen, props(a))),
  hoja: (A, a) => conTema(A, h(A.BottomSheet, props(a))),
  tabs: (A, a) => conTema(A, h(A.Tabs, props(a))),
  encabezado: (A, a) => conTema(A, h(A.SiteHeader, { organization: { ...ORG, website_settings: a }, primaryColor: '#2E3328', headerNavTree: NAV, menuCategories: [] })),
}
const MENU = (variant, style = { labels: 'always' }) => ({
  v: 2, enabled: true, variant, style,
  items: [
    { id: 'a', action: 'home', label: 'Inicio', icon: 'home', visible: true },
    { id: 'b', action: 'page', label: 'Carta', icon: 'grid', visible: true, target: '/carta' },
    { id: 'c', action: 'booking', label: 'Reservar', icon: 'calendar', visible: true },
    { id: 'd', action: 'search', label: 'Buscar', icon: 'search', visible: true },
  ],
})
const DEST = { llamar: null, whatsapp: null, comoLlegar: null, reservar: '/reservas', pedir: null }
const menu = (A, m) => conTema(A, h(A.MenuInferior, { menu: m, destinos: DEST, ...props({}), rutaAdmiteAcciones: true }))

const AJUSTES_HOY = [
  { ...CTA },
  { ...CTA, header_style: 'pill' },
  { ...CTA, header_style: 'pill', header_transparent_over_hero: true },
  { ...CTA, header_style: 'pill', header_cta_shape: 'circle' },
  { ...CTA, header_style: 'pill', header_cta_shape: 'circle', cta_shadow: 'md', header_pill_style: 'isla' },
  { ...CTA, cta_padding_x: 24, cta_padding_y: 12, cta_border_radius: 999, cta_border_width: 1, cta_border_color: '#000000', cta_shadow: 'lg', cta_bg_color: '#C8A97E' },
  { ...CTA, cta_full_width: true, buttons_uppercase_active: true },
  { ...CTA, header_transparent_over_hero: true, mobile_menu_style: 'fullscreen' },
]
if (B) {
  for (const [vista, pinta] of Object.entries(VISTAS)) {
    for (const a of AJUSTES_HOY) {
      // El celular en píldora es la decisión del dueño para `pill` (cambia el celular de la org 374):
      // los menús del celular se comparan con las demás composiciones; con `pill` sin la prop, igual.
      const nombre = `${vista} ${JSON.stringify(a)}`
      const hoy = pintar(`${nombre} (base)`, pinta(B, a))
      const ahora = pintar(nombre, pinta(R, a))
      check(hoy.length > 0 && hoy === ahora, `${nombre}: el HTML cambió sin claves nuevas`)
    }
  }
  for (const m of [MENU('tabs'), MENU('tabs', { labels: 'never', centerId: 'c' }), MENU('actions'), MENU('actions', { labels: 'always', primaryId: 'b' })]) {
    const nombre = `MenuInferior ${m.variant} ${JSON.stringify(m.style)}`
    const hoy = pintar(`${nombre} (base)`, menu(B, m))
    check(hoy.length > 0 && hoy === pintar(nombre, menu(R, m)), `${nombre}: el HTML cambió`)
  }
} else notas.push('Sin la base: no se compara el HTML de hoy.')

// ─── 3. Con cada clave, lo que la pinta ──────────────────────────────────────────────────────
const PILL = { ...CTA, header_style: 'pill', header_transparent_over_hero: true }
const hp = (a) => pintar(`pildora ${JSON.stringify(a)}`, VISTAS.pildora(R, { ...PILL, ...a }))
check(hp({}).includes('data-pildora-estilo="vidrio"') && !hp({}).includes('--pildora-') && !hp({}).includes('data-pildora-al-bajar'), 'píldora sin claves: vidrio, sin variables')
check(hp({ header_pill_style: 'solido' }).includes('data-pildora-estilo="isla"'), 'header_pill_style solido → isla')
check(hp({ header_pill_style: 'contorno' }).includes('data-pildora-estilo="contorno"'), 'header_pill_style contorno')
check(hp({ header_pill_glass_opacity: 25 }).includes('--pildora-vidrio:0.25'), 'header_pill_glass_opacity → --pildora-vidrio')
check(hp({ header_pill_blur: 12 }).includes('--pildora-desenfoque:12px'), 'header_pill_blur → --pildora-desenfoque')
check(hp({ header_pill_border: false }).includes('--pildora-borde:transparent'), 'header_pill_border false → sin borde')
check(hp({ header_pill_on_scroll: 'igual' }).includes('data-pildora-al-bajar="igual"'), 'header_pill_on_scroll igual → atributo')
check(hp({ header_pill_text_case: 'normal' }).includes('--pildora-mayusculas:none'), 'header_pill_text_case normal → sin mayúsculas')
const sep = hp({ header_float_offset: 20 })
check(sep.includes('padding-top:20px') && !sep.includes('md:pt-2'), 'header_float_offset → separación superior en vez de la de hoy')
const hb = (a, vista = 'boton') => pintar(`${vista} ${JSON.stringify(a)}`, VISTAS[vista](R, a))
check(!hb({}).includes('data-cta-estilo'), 'botón sin claves: sin data-cta-estilo')
check(hb({ header_cta_shape: 'pill' }).includes('border-radius:9999px') && hb({ header_cta_shape: 'pill' }).includes('data-cta-estilo="solido"'), 'forma pill → radio total')
check(hb({ header_cta_shape: 'rounded' }).includes('border-radius:12px'), 'forma rounded → 12')
check(hb({ header_cta_shape: 'square' }).includes('border-radius:0px'), 'forma square → 0')
check(hb({ header_cta_shape: 'circle', header_cta_size: 'sm' }).includes('width:56px;height:56px') && hb({ header_cta_shape: 'circle', header_cta_size: 'sm' }).includes('data-boton-circular'), 'círculo sm → 56')
check(hb({ header_cta_size: 'lg' }).includes('height:50px;padding:0 22px'), 'tamaño lg → 50 y 22')
check(hb({ header_cta_size: 'sm', cta_padding_x: 30 }).includes('height:36px;padding:0 30px'), 'cta_padding_x manda sobre el tamaño')
check(hb({ header_cta_width: 120 }).includes('width:120px') && hb({ header_cta_width: 120 }).includes('justify-center'), 'ancho fijo con texto centrado')
check(hb({ header_cta_height: 40, header_cta_size: 'lg' }).includes('height:40px'), 'alto manda sobre el tamaño')
check(hb({ header_cta_style: 'contorno' }).includes('data-cta-estilo="contorno"') && hb({ header_cta_style: 'contorno' }).includes('border:1.5px solid #2E3328'), 'contorno: borde 1,5 del color del botón')
check(hb({ header_cta_style: 'vidrio' }).includes('backdrop-filter:blur(16px)'), 'vidrio: desenfoque 16')
check(hb({ header_cta_style: 'texto' }).includes('hover:underline'), 'texto: subrayado al pasar')
check(hb({ header_cta_style: 'tema' }).includes('var(--radio-boton, 8px)') && hb({ header_cta_style: 'tema' }).includes('data-cta-estilo="tema"'), 'tema: radio del sitio')
const icDer = hb({ header_cta_icon: 'calendar', header_cta_icon_side: 'derecha' })
check(icDer.includes('<svg') && icDer.indexOf('<svg') > icDer.indexOf('Reservar</span>'), 'ícono a la derecha')
const icIzq = hb({ header_cta_icon: 'coffee' })
check(icIzq.includes('<svg') && icIzq.indexOf('<svg') < icIzq.indexOf('Reservar'), 'ícono (izquierda por defecto)')
check(!hb({ header_cta_icon: 'no-existe', header_cta_shape: 'pill' }).includes('<svg'), 'ícono desconocido = sin ícono')
check(hb({ header_cta_shape: 'circle', header_cta_icon_side: 'izquierda' }).includes('flex-row'), 'círculo con ícono al lado')
// Los 16 íconos del editor del ERP (pildoraLogica.ts ICONOS_BOTON) se pintan; uno desconocido no.
for (const icono of ['calendar-days', 'calendar-check', 'phone', 'message-circle', 'map-pin', 'shopping-bag', 'shopping-cart', 'package', 'truck', 'tag', 'percent', 'star', 'heart', 'sparkles', 'user', 'search']) {
  check(hb({ header_cta_icon: icono, header_cta_shape: 'pill' }).includes('<svg'), `ícono del editor «${icono}» se pinta`)
}
const circuloDesconocido = (href) => pintar('círculo', conTema(R, h(R.Shared.HeaderCTA, { text: 'Ir', href, primaryColor: '#2E3328', settings: { header_cta_shape: 'circle', header_cta_icon: 'no-existe' } })))
check(!circuloDesconocido('/tienda').includes('<svg'), 'círculo con ícono desconocido que no lleva a reservas: sin ícono')
check(circuloDesconocido('/reservas').includes('<svg'), 'círculo con ícono desconocido que lleva a reservas: el calendario')
check(hb({ header_cta_uppercase: true }).includes('text-transform:uppercase'), 'mayúsculas sí')
check(hb({ header_cta_uppercase: false }).includes('text-transform:none'), 'mayúsculas no')
check(hb({ header_cta_shape: 'pill' }, 'botonMovil').includes('height:36px') && hb({ header_cta_shape: 'pill' }, 'botonMovil').includes('md:hidden'), 'celular: misma forma a 36 px')
check(hb({ header_cta_style: 'contorno' }, 'botonMovil').includes('data-cta-estilo="contorno"'), 'celular: mismo estilo')
check(!hb({}, 'botonMovil').includes('data-cta-estilo'), 'celular sin claves: el botón de hoy')
check(!hb({ header_cta_shape: 'pill' }, 'botonSinTema').includes('data-boton-tema'), 'legacy sin tema: sin marca del tema')
// Celular en píldora (la prop la decide SiteHeader con pildoraMovil()).
for (const vista of ['drawer', 'fullscreen', 'hoja', 'tabs']) {
  const A = { ...PILL }
  const sin = pintar(vista, VISTAS[vista](R, A))
  const con = pintar(`${vista} píldora`, conTema(R, h({ drawer: R.Drawer, fullscreen: R.Fullscreen, hoja: R.BottomSheet, tabs: R.Tabs }[vista], props(A, { pildoraMovil: true }))))
  check(!sin.includes('data-pildora-movil') && !sin.includes('data-pildora-menu'), `${vista}: sin la prop, el celular de hoy`)
  check(con.includes('data-pildora-movil="portada"') && con.includes('data-pildora-menu=""') && con.includes('>Menú</button>') && con.includes('aria-label="Abrir menú"'), `${vista}: logo + píldora «Menú» (abre el mismo menú)`)
  check(con.includes('data-cta-estilo="solido"') && con.includes('border-radius:9999px') && con.includes('height:36px'), `${vista}: botón principal en píldora de 36`)
  const conVars = pintar(`${vista} píldora vars`, conTema(R, h({ drawer: R.Drawer, fullscreen: R.Fullscreen, hoja: R.BottomSheet, tabs: R.Tabs }[vista], props({ ...A, header_pill_glass_opacity: 30, header_pill_style: 'contorno' }, { pildoraMovil: true }))))
  check(conVars.includes('--pildora-vidrio:0.3') && conVars.includes('data-pildora-estilo="contorno"'), `${vista}: la píldora del celular lee las mismas claves`)
}
const enc = pintar('SiteHeader pill', VISTAS.encabezado(R, { ...PILL }))
check(enc.includes('data-encabezado-pildora') && !enc.includes('data-pildora-movil'), 'SiteHeader en el computador (SSR): la píldora de escritorio')
// Menú inferior flotante.
const hf = (style) => pintar(`flotante ${JSON.stringify(style)}`, menu(R, MENU('floating', { labels: 'always', ...style })))
const f0 = hf({})
check(f0.includes('data-menu-inferior="flotante"') && f0.includes('bottom:calc(16px + env(safe-area-inset-bottom))') && f0.includes('data-menu-vidrio=""') && f0.includes('blur(20px)'), 'flotante: 16 px, área segura y vidrio por defecto')
check(f0.includes('height:calc(86px + env(safe-area-inset-bottom))'), 'flotante: reserva su alto al final de la página')
check(hf({ glass: false }).includes('0 10px 30px') && !hf({ glass: false }).includes('data-menu-vidrio'), 'flotante sin vidrio: fondo del tema con sombra')
check(hf({ offset: 8 }).includes('bottom:calc(8px'), 'flotante: separación')
check(hf({ width: 'full' }).includes('w-full'), 'flotante: casi todo el ancho')
check(hf({ centerId: 'c' }).includes('h-10 w-10 items-center justify-center rounded-full shadow-md'), 'flotante: botón destacado en círculo')
check(!hf({ labels: 'never' }).includes('>Inicio</span>'), 'flotante: sin textos')

// ─── 4. app/globals.css ──────────────────────────────────────────────────────────────────────
const requerir = createRequire(join(ROOT, 'package.json'))
const postcss = requerir('postcss')
const parser = requerir('postcss-selector-parser')
const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
check(!/\]header\[/.test(css), 'globals.css: «]header[» (selector inválido)')
let selectores = 0
postcss.parse(css).walkRules((regla) => {
  if (regla.parent?.type === 'atrule' && /keyframes/i.test(regla.parent.name)) return
  try {
    parser((raiz) => {
      raiz.walk((n) => {
        // Una etiqueta solo al inicio de un compuesto (después de un combinador o al principio).
        if (n.type === 'tag') {
          const prev = n.prev()
          if (prev && prev.type !== 'combinator') check(false, `globals.css: etiqueta «${n.value}» después de «${prev.toString()}» en «${regla.selector.slice(0, 120)}»`)
        }
      })
    }).processSync(regla.selector)
    selectores++
  } catch (e) {
    check(false, `globals.css: selector que no parsea «${regla.selector.slice(0, 120)}» (${e.message})`)
  }
})
check(selectores > 100, `globals.css: se esperaban más de 100 reglas y hay ${selectores}`)
for (const sel of [
  "header[data-encabezado-pildora][data-pildora-estilo='contorno'][data-pildora-estilo='contorno'] [data-nav-pildora] > nav",
  "header[data-encabezado-pildora][data-pildora-al-bajar='igual']",
  'header[data-pildora-movil] [data-pildora-menu][data-pildora-menu]',
  "[data-cta-estilo='vidrio'][data-cta-estilo='vidrio']",
  "[data-estilo-boton='contorno'] header [data-cta-estilo='tema']",
  'background-color: rgba(255, 255, 255, var(--pildora-vidrio, 0.1));',
]) check(css.includes(sel), `globals.css sin «${sel}»`)

if (temporal) await rm(temporal, { recursive: true, force: true })
for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-pildora: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-pildora: ${total} comprobaciones (claves, sin claves = base, cada clave pintada y selectores CSS)`)
