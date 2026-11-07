/**
 * verify-botones.mjs — segundo botón del encabezado (header_cta2_*) y botones de las secciones con
 * el estilo del tema (buttons_theme_active + tema.tokens.boton). Contrato 2026-11-07, Figma
 * «Editor · Encabezado píldora, menú inferior y botones».
 *
 *   npm run verify:botones
 *   BOTONES_BASE=<commit> npm run verify:botones     (otra base para «sin claves = hoy»)
 *
 * Qué comprueba (sin dependencias nuevas: transpila TS/TSX con `typescript`, como verify-pildora):
 * 1. Lectura: opcionesBoton(…, 'header_cta2') y segundoBotonConOpciones; botonesTemaActivo y
 *    atributosBotonesTema (lib/website/v2/botonesTema.ts) para cada forma, relleno y tamaño.
 * 2. Sin NINGUNA clave nueva el HTML de HeaderCTA2, HeaderCTA y SiteHeader (cada composición,
 *    con y sin tema, con los botones 3 a 6) es IDÉNTICO al del commit base (`claude/botones-tema`,
 *    extraído con `git archive`). `atributosTema` sin el interruptor (o en false) da lo mismo que
 *    la base para los 9 sitios publicados que guardan `tokens.boton` (orgs 340, 341, 342, 345,
 *    346, 347, 348, 349 y 358, tal como están en la base el 2026-11-07) y para los 7 presets de
 *    presetsDiseno.ts (forma, relleno y tamaño).
 * 3. Con cada clave aparece lo que la pinta; el principal y los botones 3 a 6 no cambian.
 * 4. app/globals.css: cada selector parsea, ninguna etiqueta después de un atributo, las reglas
 *    nuevas existen y todas cuelgan de [data-botones-tema].
 */
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { register, createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
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

// ─── 1. Lectura ──────────────────────────────────────────────────────────────────────────────
const p = await importar('lib/website/pildora.ts')
const bt = await importar('lib/website/v2/botonesTema.ts')
const NULO = { forma: null, tamano: null, ancho: null, alto: null, estilo: null, icono: null, ladoIcono: null, mayusculas: null }
const CTA2 = {
  header_cta2_shape: 'rounded', header_cta2_size: 'lg', header_cta2_style: 'vidrio', header_cta2_icon: 'phone',
  header_cta2_icon_side: 'derecha', header_cta2_uppercase: true,
}
const CTA2_BASURA = {
  header_cta2_shape: 'triangulo', header_cta2_size: 'xl', header_cta2_style: 'neon', header_cta2_icon: '<b>',
  header_cta2_icon_side: 'abajo', header_cta2_uppercase: 'si',
}
for (const [nombre, a] of [['sin ajustes', null], ['vacío', {}], ['basura', CTA2_BASURA], ['claves del principal', { header_cta_shape: 'pill', header_cta_size: 'lg', header_cta_width: 120 }]]) {
  igual(p.opcionesBoton(a, 'header_cta2'), NULO, `segundo botón ${nombre}: todo ausente`)
  check(!p.segundoBotonConOpciones(p.opcionesBoton(a, 'header_cta2')), `segundo botón ${nombre}: el de hoy`)
}
igual(p.opcionesBoton(CTA2, 'header_cta2'), { forma: 'rounded', tamano: 'lg', ancho: null, alto: null, estilo: 'vidrio', icono: 'phone', ladoIcono: 'derecha', mayusculas: true }, 'segundo botón: cada clave')
igual(p.opcionesBoton(CTA2), NULO, 'las claves del segundo no tocan al principal')
igual(p.opcionesBoton({ header_cta_width: 120, header_cta_height: 40 }, 'header_cta2'), NULO, 'el segundo no tiene ancho ni alto')
for (const [k, v] of Object.entries(CTA2)) check(p.segundoBotonConOpciones(p.opcionesBoton({ [k]: v }, 'header_cta2')), `${k} sola activa el segundo botón nuevo`)
check(p.segundoBotonConOpciones(p.opcionesBoton({ header_cta2_shape: 'circle' }, 'header_cta2')), 'circle también activa (el segundo no tenía círculo de hoy)')

for (const [a, esperado] of [[null, false], [{}, false], [{ buttons_theme_active: false }, false], [{ buttons_theme_active: 'true' }, false], [{ buttons_theme_active: 1 }, false], [{ buttons_theme_active: true }, true]]) {
  igual(bt.botonesTemaActivo(a), esperado, `botonesTemaActivo(${JSON.stringify(a)})`)
}
const v = (value) => ({ mode: 'value', value })
const tok = (forma, relleno, tamano, extra = {}) => ({ boton: { ...(forma ? { forma: v(forma) } : {}), ...(relleno ? { relleno: v(relleno) } : {}), ...(tamano ? { tamano: v(tamano) } : {}), ...extra } })
igual(bt.atributosBotonesTema(tok('pildora', 'contorno', 'l'), false), { variables: {}, datos: {} }, 'apagado: nada aunque haya tokens')
igual(bt.atributosBotonesTema(null, true), { variables: {}, datos: {} }, 'prendido sin tokens: nada')
igual(bt.atributosBotonesTema({ boton: { mayusculas: v(true) } }, true), { variables: {}, datos: {} }, 'prendido solo con mayúsculas: nada (eso es buttons_uppercase_active)')
igual(bt.atributosBotonesTema(tok('ovalo', 'neon', 'xl'), true), { variables: {}, datos: {} }, 'valores desconocidos: nada')
igual(bt.atributosBotonesTema({ boton: { forma: { mode: 'clear' } } }, true), { variables: {}, datos: {} }, 'mode clear: nada')
for (const [forma, radio] of [['cuadrado', '0px'], ['redondeado', '12px'], ['pildora', '999px']]) {
  igual(bt.atributosBotonesTema(tok(forma), true), { variables: { '--boton-radio': radio }, datos: { 'data-boton-forma': forma, 'data-botones-tema': 'activo' } }, `forma ${forma}`)
}
for (const relleno of ['solido', 'contorno', 'fantasma', 'sombra_dura']) {
  igual(bt.atributosBotonesTema(tok(null, relleno), true), { variables: {}, datos: { 'data-boton-relleno': relleno, 'data-botones-tema': 'activo' } }, `relleno ${relleno}`)
}
for (const [tamano, alto, letra, inter, x, y] of [['s', 36, 13, 20, 16, 6], ['m', 44, 14, 20, 20, 10], ['l', 52, 16, 24, 28, 12]]) {
  igual(bt.atributosBotonesTema(tok(null, null, tamano), true), {
    variables: { '--boton-alto': `${alto}px`, '--boton-letra': `${letra}px`, '--boton-interlinea': `${inter}px`, '--boton-relleno-x': `${x}px`, '--boton-relleno-y': `${y}px` },
    datos: { 'data-boton-tamano': tamano, 'data-botones-tema': 'activo' },
  }, `tamaño ${tamano}`)
  check(inter + 2 * (y + bt.BORDE_CONTORNO) === alto, `tamaño ${tamano}: interlínea + 2 × (relleno + borde) = alto`)
}

// ─── 2. Sin claves = el commit base ──────────────────────────────────────────────────────────
const BASE = process.env.BOTONES_BASE || 'claude/botones-tema'
let base = null
let temporal = null
try {
  temporal = await mkdtemp(join(tmpdir(), 'verify-botones-base-'))
  execFileSync('bash', ['-c', `git -C "${ROOT}" archive ${BASE} components lib types | tar -x -C "${temporal}"`], { stdio: 'ignore' })
  base = temporal
} catch {
  check(false, `no se pudo extraer ${BASE} (BOTONES_BASE=…): sin la base no se prueba «sin claves = hoy»`)
}

// Tema: los 9 sitios publicados con tokens.boton (SQL 2026-11-07: solo forma, y mayúsculas en 5;
// el radio del tema de cada uno) y los 7 presets (forma, relleno y tamaño).
const SITIOS_9 = [
  ['org 340', 'cuadrado', 'ninguno', true], ['org 341', 'pildora', 'muy_redondeado', false], ['org 342', 'redondeado', 'sutil', false],
  ['org 345', 'pildora', 'suave', true], ['org 346', 'cuadrado', 'ninguno', true], ['org 347', 'pildora', 'ninguno', true],
  ['org 348', 'redondeado', 'redondeado', false], ['org 349', 'pildora', 'muy_redondeado', false], ['org 358', 'redondeado', 'suave', false],
].map(([n, forma, radio, may]) => [n, { radio: v(radio), boton: { forma: v(forma), ...(may ? { mayusculas: v(true) } : {}) } }])
const presets = (await importar('lib/website/v2/presetsDiseno.ts')).PRESETS_DISENO
const TOKENS = [...SITIOS_9, ...presets.filter((x) => x.id !== 'actual').map((x) => [`preset ${x.id}`, x.tokens])]
check(TOKENS.length === 16, `se esperaban 9 sitios + 7 presets y hay ${TOKENS.length}`)
const temaR = await importar('lib/website/v2/temaPublico.ts')
const temaB = base ? await importar('lib/website/v2/temaPublico.ts', base) : null
const TEMAS = (tokens) => [
  { fondo: '#F4EFE6', texto: '#2E3328', fuenteTitulos: 'Fraunces', fuenteCuerpo: 'Inter', radio: 12, estiloBoton: 'solido', movimiento: 'bajo', tokens, tarjetaProducto: null, paginacion: null, carrusel: null },
  { fondo: null, texto: null, fuenteTitulos: null, fuenteCuerpo: null, radio: null, estiloBoton: 'contorno', movimiento: null, tokens, tarjetaProducto: null, paginacion: null, carrusel: null },
  { fondo: '#0E0E0E', texto: '#F2EDE4', fuenteTitulos: null, fuenteCuerpo: null, radio: 0, estiloBoton: 'sombra_dura', movimiento: null, tokens: { ...tokens, hover: v('sutil') }, tarjetaProducto: null, paginacion: null, carrusel: null },
]
if (temaB) {
  for (const [nombre, tokens] of TOKENS) {
    for (const [i, t] of TEMAS(tokens).entries()) {
      for (const op of [undefined, {}, { mayusculasActivas: true }, { mayusculasActivas: true, cursiva: true }]) {
        const hoy = temaB.atributosTema(t, op)
        igual(temaR.atributosTema(t, op), hoy, `${nombre} tema ${i} ${JSON.stringify(op)}: sin el interruptor, el tema de hoy`)
        igual(temaR.atributosTema(t, { ...op, botonesTemaActivos: false }), hoy, `${nombre} tema ${i}: interruptor en false = hoy`)
      }
    }
  }
}
// Con el interruptor: los 9 sitios pintan su forma (y nada más: no guardan relleno ni tamaño).
for (const [nombre, tokens] of SITIOS_9) {
  const a = temaR.atributosTema(TEMAS(tokens)[0], { botonesTemaActivos: true })
  const forma = tokens.boton.forma.value
  igual(a.datos['data-botones-tema'], 'activo', `${nombre} con el interruptor: data-botones-tema`)
  igual(a.datos['data-boton-forma'], forma, `${nombre} con el interruptor: su forma`)
  igual(a.variables['--boton-radio'], bt.RADIO_FORMA_BOTON[forma], `${nombre} con el interruptor: su radio`)
  check(!('data-boton-relleno' in a.datos) && !('data-boton-tamano' in a.datos), `${nombre}: sin relleno ni tamaño guardados no se marcan`)
  check(a.variables['--radio-boton'] === '12px', `${nombre}: --radio-boton del tema sigue (la regla nueva manda por especificidad)`)
}
// Token ausente con el interruptor: ese aspecto cae a lo de hoy (radio del tema / estiloBoton).
{
  const t = { ...TEMAS(tok('pildora'))[1], radio: 12 }
  const a = temaR.atributosTema(t, { botonesTemaActivos: true })
  igual(a.datos['data-estilo-boton'], 'contorno', 'solo forma: el estilo de botón del tema sigue (data-estilo-boton)')
  check(!('data-boton-relleno' in a.datos) && !('data-boton-tamano' in a.datos), 'solo forma: sin relleno ni tamaño propios')
  check(!Object.keys(a.variables).some((k) => k.startsWith('--boton-alto') || k.startsWith('--boton-relleno')), 'solo forma: sin variables de tamaño')
  const b = temaR.atributosTema({ ...t, tokens: tok(null, 'fantasma') }, { botonesTemaActivos: true })
  igual([b.variables['--radio-boton'], b.datos['data-radio-boton'], b.variables['--boton-radio']], ['12px', 'propio', undefined], 'solo relleno: el radio del tema, sin radio propio')
  const c = temaR.atributosTema({ ...t, tokens: tok(null, null, 'l') }, { botonesTemaActivos: true })
  igual([c.datos['data-estilo-boton'], c.datos['data-boton-relleno'], c.datos['data-boton-forma']], ['contorno', undefined, undefined], 'solo tamaño: estilo y radio del tema')
}
const jug = temaR.atributosTema(TEMAS(presets.find((x) => x.id === 'jugueton').tokens)[0], { botonesTemaActivos: true })
igual([jug.datos['data-boton-forma'], jug.datos['data-boton-relleno'], jug.datos['data-boton-tamano'], jug.variables['--boton-alto']], ['pildora', 'sombra_dura', 'l', '52px'], 'preset juguetón con el interruptor')
igual(temaR.atributosTema(null, { botonesTemaActivos: true }), { variables: {}, datos: {} }, 'legacy: nada aunque llegue el interruptor')
const layout = await readFile(join(ROOT, 'components/site/OrganizationLayoutCliente.tsx'), 'utf8')
check(layout.includes('botonesTemaActivos: botonesTemaActivo(settings)'), 'OrganizationLayoutCliente pasa buttons_theme_active a atributosTema')

// HTML del encabezado.
async function arbol(raiz) {
  return {
    Shared: await importar('components/site/header/HeaderShared.tsx', raiz),
    SiteHeader: (await importar('components/site/SiteHeader.tsx', raiz)).default,
    Tema: (await importar('components/site/TemaColoresContext.tsx', raiz)).TemaColoresProvider,
    Botones: (await importar('components/site/BotonesTemaContext.tsx', raiz)).BotonesTemaProvider,
    EP: await importar('components/site/EncabezadoPieContext.tsx', raiz).catch(() => null),
    ep: await importar('lib/website/encabezadoPie.ts', raiz),
  }
}
const R = await arbol(ROOT)
const B = base ? await arbol(base) : null
const ORG = { id: 9001, name: 'Tienda de muestra', subdomain: 'muestra', logo_url: null, primary_color: '#2E3328', website_settings: {} }
const pagina = (id, title, slug) => ({ id, organization_id: ORG.id, title, slug, children: [], level: 0, is_published: true, show_in_header: true })
const NAV = [pagina(1, 'Inicio', 'home'), pagina(2, 'Carta', 'carta'), pagina(3, 'Contacto', 'contacto')]
const DOS = { header_cta_text: 'Reservar', header_cta_url: '/reservas', header_cta2_text: 'Eventos', header_cta2_url: '/eventos' }
// HeaderCTA2 lee el segundo botón del contexto del encabezado (como en el sitio: SiteHeader lo
// arma con opcionesEncabezadoPie). Fuera de SiteHeader se le pasa el mismo valor.
const conContexto = (A, ajustes, nodo, { tema = true, marca = false } = {}) => {
  let n = nodo
  if (A.EP?.EncabezadoPieProvider) n = h(A.EP.EncabezadoPieProvider, { value: { ...A.EP.VALOR_POR_DEFECTO, opciones: A.ep.opcionesEncabezadoPie(ajustes) } }, n)
  if (marca) n = h(A.Botones, { value: true }, n)
  return tema ? h(A.Tema, { value: true }, n) : n
}
const VISTAS = {
  segundo: (A, a) => conContexto(A, a, h(A.Shared.HeaderCTA2, { settings: a })),
  segundoSinTema: (A, a) => conContexto(A, a, h(A.Shared.HeaderCTA2, { settings: a }), { tema: false }),
  segundoMarca: (A, a) => conContexto(A, a, h(A.Shared.HeaderCTA2, { settings: a }), { marca: true }),
  principal: (A, a) => conContexto(A, a, h(A.Shared.HeaderCTA, { text: 'Reservar', href: '/reservas', primaryColor: '#2E3328', settings: a })),
  encabezado: (A, a) => conContexto(A, a, h(A.SiteHeader, { organization: { ...ORG, website_settings: a }, primaryColor: '#2E3328', headerNavTree: NAV, menuCategories: [] })),
  encabezadoSinTema: (A, a) => conContexto(A, a, h(A.SiteHeader, { organization: { ...ORG, website_settings: a }, primaryColor: '#2E3328', headerNavTree: NAV, menuCategories: [] }), { tema: false }),
}
const AJUSTES_HOY = []
for (const header_style of ['default', 'centered', 'split', 'minimal', 'mega', 'pill']) {
  AJUSTES_HOY.push({ ...DOS, header_style })
  AJUSTES_HOY.push({ ...DOS, header_style, header_cta_shape: 'circle', cta_padding_x: 24, cta_padding_y: 12, cta_border_radius: 999, cta_bg_color: '#C8A97E' })
}
AJUSTES_HOY.push(
  { ...DOS, header_cta3_text: 'Tienda', header_cta3_url: '/productos', header_cta4_text: 'Llámanos', header_cta4_url: 'tel:+573000000000' },
  { ...DOS, header_cta3_text: 'Tienda', header_cta3_url: '/productos', header_extra_buttons_style: 'solid' },
  { ...DOS, header_cta2_url: 'https://ejemplo.co/eventos', buttons_uppercase_active: true, buttons_theme_active: false },
  { ...DOS, header_cta2_url: 'whatsapp' },
  { ...DOS, ...CTA2_BASURA },
  { header_cta_text: 'Reservar', header_cta_url: '/reservas', header_cta2_text: 'Sin enlace', ...CTA2 },
)
if (B) {
  check(!!R.EP?.EncabezadoPieProvider, 'EncabezadoPieContext exporta EncabezadoPieProvider')
  for (const [vista, pinta] of Object.entries(VISTAS)) {
    for (const a of AJUSTES_HOY) {
      const nombre = `${vista} ${JSON.stringify(a)}`
      const hoy = pintar(`${nombre} (base)`, pinta(B, a))
      const ahora = pintar(nombre, pinta(R, a))
      check(hoy.length > 0 || vista === 'segundo' || vista.startsWith('segundo'), `${nombre}: la base no pinta nada`)
      check(hoy === ahora, `${nombre}: el HTML cambió sin claves nuevas`)
    }
  }
  const s0 = pintar('segundo hoy', VISTAS.segundo(R, DOS))
  check(s0.includes('data-boton-secundario') && s0.includes('>Eventos<'), 'la comparación pinta de verdad el segundo botón')
} else notas.push('Sin la base: no se compara el HTML de hoy.')

// ─── 3. Con cada clave, lo que la pinta ──────────────────────────────────────────────────────
const s = (a, vista = 'segundo') => pintar(`${vista} ${JSON.stringify(a)}`, VISTAS[vista](R, { ...DOS, ...a }))
const hoy2 = s({})
check(!hoy2.includes('data-cta-estilo'), 'segundo sin claves: sin data-cta-estilo')
const forma = s({ header_cta2_shape: 'pill' })
check(forma.includes('border-radius:9999px') && forma.includes('data-boton-secundario=""') && forma.includes('data-cta-estilo="contorno"'), 'forma pill: radio total, contorno (su aspecto de hoy) y la marca del segundo')
check(forma.includes('border:1.5px solid currentColor') && forma.includes('text-gray-900 dark:text-white'), 'contorno del segundo: color del texto del encabezado')
check(!forma.includes('margin-top'), 'el segundo no hereda los márgenes del principal')
// Lo que el editor del ERP asume (aviso del integrador, 2026-11-07): sin estilo = contorno; sin
// forma ni tamaño = el radio y el relleno de hoy del segundo; el círculo sin ícono guardado no pone
// el calendario.
const estiloHoy = (html) => /style="([^"]*)"/.exec(html.slice(html.indexOf('data-boton-secundario') - 400))?.[1] ?? ''
const hoyEstilo = estiloHoy(pintar('hoy', VISTAS.segundo(R, { ...DOS })))
check(hoyEstilo === 'padding:7px 15px;border-radius:8px', `el estilo de hoy del segundo es el esperado («${hoyEstilo}»)`)
check(forma.includes('padding:7px 15px'), 'forma sin tamaño: el relleno de hoy del segundo (cta_padding − 1)')
const conPad = s({ header_cta2_style: 'contorno', cta_padding_x: 24, cta_padding_y: 12, cta_border_radius: 4 })
check(conPad.includes('border-radius:4px') && conPad.includes('padding:11px 23px'), 'sin forma ni tamaño: cta_border_radius y cta_padding_* como hoy')
check(s({ header_cta2_style: 'solido' }).includes('border-radius:8px;padding:7px 15px'), 'sólido sin forma ni tamaño: radio y relleno de hoy')
check(s({ header_cta2_icon_side: 'derecha' }).includes('data-cta-estilo="contorno"'), 'sin estilo guardado: contorno, no sólido')
const circSinIcono = pintar('círculo', VISTAS.segundo(R, { ...DOS, header_cta2_url: '/reservas', header_cta2_shape: 'circle' }))
check(circSinIcono.includes('data-boton-circular') && !circSinIcono.includes('<svg'), 'círculo del segundo que lleva a reservas sin header_cta2_icon: sin calendario')
check(pintar('círculo', VISTAS.segundo(R, { ...DOS, header_cta2_url: '/reservas', header_cta2_shape: 'circle', header_cta2_icon: 'calendar-days' })).includes('<svg'), 'círculo del segundo con ícono guardado: lo pinta')
check(pintar('principal círculo', VISTAS.principal(R, { header_cta_shape: 'circle', header_cta_size: 'md' })).includes('<svg'), 'el principal en círculo hacia reservas conserva su calendario')
check(s({ header_cta2_shape: 'rounded' }).includes('border-radius:12px'), 'forma rounded → 12')
check(s({ header_cta2_shape: 'square' }).includes('border-radius:0px'), 'forma square → 0')
const circ = s({ header_cta2_shape: 'circle', header_cta2_size: 'sm' })
check(circ.includes('data-boton-circular') && circ.includes('width:56px;height:56px') && circ.includes('data-boton-secundario'), 'círculo sm → 56 con la marca del segundo')
check(s({ header_cta2_shape: 'circle' }).includes('width:76px'), 'círculo sin tamaño → 76')
check(s({ header_cta2_size: 'sm' }).includes('height:36px;padding:0 14px'), 'tamaño sm → 36 y 14')
check(s({ header_cta2_size: 'md' }).includes('height:44px;padding:0 18px'), 'tamaño md → 44 y 18')
check(s({ header_cta2_size: 'lg' }).includes('height:50px;padding:0 22px'), 'tamaño lg → 50 y 22')
const sol = s({ header_cta2_style: 'solido' })
check(sol.includes('data-cta-estilo="solido"') && sol.includes('background-color:var(--primary-color, #111827)') && sol.includes('color:#ffffff') && !sol.includes('text-gray-900'), 'sólido: el primario del sitio con texto claro')
check(s({ header_cta2_style: 'solido', cta_bg_color: '#C8A97E' }).includes('background-color:#C8A97E;color:#111111'), 'sólido con cta_bg_color: ese color y el texto por contraste')
check(s({ header_cta2_style: 'tema' }).includes('var(--radio-boton, 8px)') && s({ header_cta2_style: 'tema' }).includes('data-cta-estilo="tema"'), 'tema: radio del sitio')
check(s({ header_cta2_style: 'vidrio' }).includes('backdrop-filter:blur(16px)'), 'vidrio: desenfoque 16')
const tex = s({ header_cta2_style: 'texto' })
check(tex.includes('hover:underline') && tex.includes('border:0 solid transparent') && tex.includes('text-gray-900'), 'texto: sin borde, subrayado al pasar, color del encabezado')
const icD = s({ header_cta2_icon: 'phone', header_cta2_icon_side: 'derecha' })
check(icD.includes('<svg') && icD.indexOf('<svg') > icD.indexOf('Eventos</span>'), 'ícono a la derecha')
const icI = s({ header_cta2_icon: 'calendar-days' })
check(icI.includes('<svg') && icI.indexOf('<svg') < icI.indexOf('Eventos'), 'ícono (izquierda por defecto)')
check(!s({ header_cta2_icon: 'no-existe', header_cta2_shape: 'pill' }).includes('<svg'), 'ícono desconocido = sin ícono')
check(s({ header_cta2_shape: 'circle', header_cta2_icon: 'phone' }).includes('flex-col'), 'círculo: ícono encima')
check(s({ header_cta2_uppercase: true }).includes('text-transform:uppercase'), 'mayúsculas sí')
check(s({ header_cta2_uppercase: false }).includes('text-transform:none'), 'mayúsculas no')
check(s({ header_cta2_shape: 'pill' }, 'segundoMarca').includes('data-boton-tema=""'), 'con mayúsculas/hover del tema conserva data-boton-tema')
check(!s({ header_cta2_shape: 'pill' }, 'segundoSinTema').includes('data-boton-tema'), 'sin tema: sin marca del tema')
const ext = s({ header_cta2_url: 'https://ejemplo.co', header_cta2_shape: 'pill' })
check(ext.includes('target="_blank"') && ext.includes('href="https://ejemplo.co"'), 'externo en pestaña nueva')
check(s({ header_cta2_url: 'tel:+573000000000', header_cta2_shape: 'pill' }).includes('href="tel:+573000000000"'), 'tel: se conserva')
// El principal y los botones 3 a 6 no cambian con las claves del segundo.
for (const a of AJUSTES_HOY.slice(0, 4)) {
  igual(pintar('principal', VISTAS.principal(R, { ...a, ...CTA2 })), pintar('principal', VISTAS.principal(R, a)), `principal ${a.header_style}: las claves del segundo no lo tocan`)
}
const extras = { header_cta3_text: 'Tienda', header_cta3_url: '/productos', header_cta4_text: 'Sedes', header_cta4_url: '/sedes', header_extra_buttons_style: 'solid' }
const trozoExtras = (html) => html.slice(html.indexOf('data-boton-extra') - 200)
const sinC = s(extras)
const conC = s({ ...extras, ...CTA2 })
check(sinC.includes('data-boton-extra="3"') && conC.includes('data-boton-extra="4"'), 'los botones 3 a 6 se pintan')
igual(conC.slice(conC.indexOf('<a', conC.indexOf('Eventos'))), sinC.slice(sinC.indexOf('<a', sinC.indexOf('Eventos'))), 'botones 3 a 6 idénticos con las claves del segundo')
void trozoExtras
const enc = pintar('SiteHeader cta2', VISTAS.encabezado(R, { ...DOS, header_style: 'pill', ...CTA2 }))
check(enc.includes('data-boton-secundario') && enc.includes('border-radius:12px') && enc.includes('data-cta-estilo="vidrio"'), 'SiteHeader (pill) pinta el segundo botón con sus claves')
for (const header_style of ['default', 'centered', 'split', 'minimal', 'mega']) {
  const html = pintar(`SiteHeader ${header_style}`, VISTAS.encabezado(R, { ...DOS, header_style, header_cta2_shape: 'square' }))
  check(html.includes('data-boton-secundario') && html.includes('data-cta-estilo="contorno"') && html.includes('border-radius:0px'), `${header_style}: el segundo botón con sus claves`)
}

// ─── 4. app/globals.css ──────────────────────────────────────────────────────────────────────
const requerir = createRequire(join(ROOT, 'package.json'))
const postcss = requerir('postcss')
const parser = requerir('postcss-selector-parser')
const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
check(!/\]header\[/.test(css), 'globals.css: «]header[» (selector inválido)')
let selectores = 0
const nuevas = []
postcss.parse(css).walkRules((regla) => {
  if (regla.parent?.type === 'atrule' && /keyframes/i.test(regla.parent.name)) return
  try {
    parser((raiz) => {
      raiz.walk((n) => {
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
  if (/data-boton-(forma|tamano)|data-boton-relleno='/.test(regla.selector)) nuevas.push(regla)
})
check(selectores > 100, `globals.css: se esperaban más de 100 reglas y hay ${selectores}`)
check(nuevas.length >= 5, `globals.css: se esperaban al menos 5 reglas de los botones del tema y hay ${nuevas.length}`)
for (const regla of nuevas) {
  for (const sel of regla.selector.split(',').map((x) => x.trim()).filter((x) => /data-boton-(forma|tamano)|data-boton-relleno='/.test(x))) {
    check(sel.startsWith('[data-botones-tema]') && sel.includes('section[data-section-id] [data-boton'), `globals.css: «${sel}» debe colgar de [data-botones-tema] y de los botones de las secciones`)
  }
}
for (const sel of [
  '[data-botones-tema][data-boton-forma] section[data-section-id] [data-boton]',
  "[data-botones-tema][data-boton-relleno='contorno'] section[data-section-id] [data-boton='primario']",
  "[data-botones-tema][data-boton-relleno='fantasma'] section[data-section-id] [data-boton='primario']:hover",
  "[data-botones-tema][data-boton-relleno='sombra_dura'] section[data-section-id] [data-boton='primario']",
  "[data-botones-tema][data-boton-tamano] section[data-section-id] [data-boton]:not([aria-label]):not([class*='underline'])",
  "[data-estilo-boton='contorno']:not([data-boton-relleno]) section[data-section-id] [data-boton='primario']",
  "[data-estilo-boton='sombra_dura']:not([data-boton-relleno]) section[data-section-id] [data-boton='primario']",
  'border-radius: var(--boton-radio) !important;',
  'padding: var(--boton-relleno-y) var(--boton-relleno-x);',
]) check(css.includes(sel), `globals.css sin «${sel}»`)
// Las dos reglas del estilo de botón del tema conservan su cuerpo de hoy.
if (base) {
  const cssBase = execFileSync('git', ['-C', ROOT, 'show', `${BASE}:app/globals.css`], { encoding: 'utf8' })
  const cuerpo = (c, sel) => {
    let r = null
    postcss.parse(c).walkRules((x) => { if (x.selector.split(',').map((y) => y.trim()).includes(sel)) r = x.nodes.map((d) => d.toString()).join(';') })
    return r
  }
  for (const [hoy, ahora] of [
    ["[data-estilo-boton='contorno'] section[data-section-id] [data-boton='primario']", "[data-estilo-boton='contorno']:not([data-boton-relleno]) section[data-section-id] [data-boton='primario']"],
    ["[data-estilo-boton='sombra_dura'] section[data-section-id] [data-boton='primario']", "[data-estilo-boton='sombra_dura']:not([data-boton-relleno]) section[data-section-id] [data-boton='primario']"],
  ]) {
    const b = cuerpo(cssBase, hoy)
    check(b !== null && b === cuerpo(css, ahora), `globals.css: «${ahora}» cambió su cuerpo respecto de la base`)
  }
}

if (temporal) await rm(temporal, { recursive: true, force: true })
for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-botones: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-botones: ${total} comprobaciones (claves, sin claves = base, 9 sitios con tokens.boton, cada clave pintada y selectores CSS)`)
