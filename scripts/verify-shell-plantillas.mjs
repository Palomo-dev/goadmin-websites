/**
 * verify-shell-plantillas.mjs — encabezado, pie y tema de las 7 plantillas de tienda (paquete W1,
 * PLANO §5) y la garantía de que sin las opciones nuevas el sitio de hoy no cambia.
 *
 *   npm run verify:shell-plantillas                  (sin red ni base)
 *   VERIFY_RED=1 npm run verify:shell-plantillas     (además pide cada hoja a Google Fonts)
 *   BASE_REF=main (por defecto) — contra qué versión se compara «lo de hoy».
 *
 * Sin dependencias nuevas: transpila los componentes REALES con `typescript` (como
 * verify-interruptores), los de esta rama y los de BASE_REF (leídos con `git show`), cambia
 * next/link, next/image y next/navigation por equivalentes mínimos y los pinta con react-dom/server.
 *
 * 1. Google Fonts (decisión D6): sin variantes, la URL de cada familia que hoy funciona es la de
 *    BASE_REF; Instrument Serif pide solo 400. Las 7 plantillas piden exactamente su hoja (cursiva
 *    de Cormorant con enlaces «display», 800/900 de Archivo con la marca gigante). Con VERIFY_RED=1
 *    cada hoja responde 200 y trae las caras que se pidieron.
 * 2. Tema: `atributosTema` sin opciones = el de BASE_REF, también con `tokens.boton.mayusculas`
 *    (orgs que ya lo guardan por un preset); las mayúsculas solo con `buttons_uppercase_active`;
 *    `data-tema-hover` solo con `tokens.hover`. El CSS de cada atributo existe.
 * 3. HTML de hoy: SiteHeader (cada composición de escritorio) y SiteFooter (las 5 composiciones
 *    legacy y el pie con tema) pintan EXACTAMENTE el HTML de BASE_REF con los ajustes de hoy.
 *    `pill` ya no cae en el clásico: pinta HeaderPill.
 * 4. Con las opciones encendidas aparece lo que piden (tarjeta, marca, figura, enlaces display,
 *    botón circular) y nada más.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_REF = process.env.BASE_REF || 'main'
// Dentro del repo para que react, react-dom y lucide-react resuelvan desde node_modules.
const TMP = join(ROOT, '.verify-shell-plantillas-tmp')

const STUBS = {
  'next/link': `import { createElement } from 'react'
export default function Link({ href, children, prefetch, scroll, replace, ...resto }) {
  return createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname ?? ''), ...resto }, children)
}`,
  'next/image': `import { createElement } from 'react'
export default function Image({ src, alt, fill, sizes, priority, quality, placeholder, ...resto }) {
  return createElement('img', { src: typeof src === 'string' ? src : '', alt, ...resto })
}`,
  'next/navigation': `export function useSearchParams() { return new URLSearchParams() }
export function usePathname() { return '/' }
export function useRouter() { return { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} } }`,
}

/** Fuente de los archivos: la rama (disco) o BASE_REF (git show). */
function fuenteDe(arbol) {
  if (arbol === 'rama') {
    return {
      existe: (rel) => existsSync(join(ROOT, rel)),
      leer: (rel) => readFile(join(ROOT, rel), 'utf8'),
    }
  }
  const cache = new Map()
  const existe = (rel) => {
    if (!cache.has(rel)) {
      try {
        execFileSync('git', ['cat-file', '-e', `${BASE_REF}:${rel}`], { cwd: ROOT, stdio: 'ignore' })
        cache.set(rel, true)
      } catch {
        cache.set(rel, false)
      }
    }
    return cache.get(rel)
  }
  return {
    existe,
    leer: async (rel) => execFileSync('git', ['show', `${BASE_REF}:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
  }
}

function crearCompilador(arbol) {
  const fuente = fuenteDe(arbol)
  const salidaRaiz = join(TMP, arbol)
  const compilados = new Map()
  function resolverLocal(especificador, desdeRel) {
    const base = especificador.startsWith('@/') ? especificador.slice(2) : relative(ROOT, resolve(ROOT, dirname(desdeRel), especificador))
    for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const p = base + ext
      if ((p.endsWith('.ts') || p.endsWith('.tsx')) && fuente.existe(p)) return p
    }
    throw new Error(`[${arbol}] no encuentro ${especificador} (desde ${desdeRel})`)
  }
  async function compilar(rel) {
    if (compilados.has(rel)) return compilados.get(rel)
    const salida = join(salidaRaiz, rel).replace(/\.tsx?$/, '.mjs')
    compilados.set(rel, salida)
    const { outputText } = ts.transpileModule(await fuente.leer(rel), {
      fileName: rel,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    })
    const especificadores = new Set()
    for (const m of outputText.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) especificadores.add(m[1])
    let codigo = outputText
    for (const esp of especificadores) {
      let destino = null
      if (STUBS[esp]) destino = join(TMP, '__stubs', `${esp.replace(/\//g, '_')}.mjs`)
      else if (esp.startsWith('.') || esp.startsWith('@/')) destino = await compilar(resolverLocal(esp, rel))
      if (!destino) continue
      let r = relative(dirname(salida), destino)
      if (!r.startsWith('.')) r = `./${r}`
      codigo = codigo.split(`'${esp}'`).join(`'${r}'`).split(`"${esp}"`).join(`"${r}"`)
    }
    await mkdir(dirname(salida), { recursive: true })
    await writeFile(salida, codigo)
    return salida
  }
  return async (rel) => import(pathToFileURL(await compilar(rel)).href)
}

const fallos = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) fallos.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

await rm(TMP, { recursive: true, force: true })
await mkdir(join(TMP, '__stubs'), { recursive: true })
for (const [nombre, codigo] of Object.entries(STUBS)) await writeFile(join(TMP, '__stubs', `${nombre.replace(/\//g, '_')}.mjs`), codigo)

try {
  const rama = crearCompilador('rama')
  const base = crearCompilador('base')
  const temaR = await rama('lib/website/v2/temaPublico.ts')
  const temaB = await base('lib/website/v2/temaPublico.ts')
  const tokensR = await rama('lib/website/v2/tokensDiseno.ts')
  const ep = await rama('lib/website/encabezadoPie.ts')

  // ─── 1. Google Fonts ───────────────────────────────────────────────────────────────────────
  {
    const pares = Object.values(tokensR.PARES_TIPOGRAFICOS).flatMap((p) => [p.titulos, p.cuerpo])
    const presets = await readFile(join(ROOT, 'lib/templates/presets.ts'), 'utf8')
    const dePresets = [...presets.matchAll(/(?:heading|body):\s*'([^']+)'/g)].map((m) => m[1])
    const familias = Array.from(new Set([...pares, ...dePresets, 'Cormorant Garamond', 'Archivo', 'Syne', 'Outfit', 'Inter']))
    for (const f of familias) {
      if (f === 'Instrument Serif') continue
      igual(temaR.urlGoogleFonts([f]), temaB.urlGoogleFonts([f]), `la URL de «${f}» cambió sin variantes`)
    }
    for (const par of Object.keys(tokensR.PARES_TIPOGRAFICOS)) igual(temaR.urlGoogleFonts([par]), temaB.urlGoogleFonts([par]), `la URL del par ${par} cambió`)
    igual(temaR.urlGoogleFonts(['Playfair Display', 'Lato', 'Lato']), temaB.urlGoogleFonts(['Playfair Display', 'Lato', 'Lato']), 'varias familias como hoy')
    igual(temaR.urlGoogleFonts([]), null, 'sin familias no hay hoja')
    // Sin variantes pedidas, la cursiva y los pesos extra no se piden aunque la familia los tenga.
    igual(temaR.urlGoogleFonts(['Cormorant Garamond'], { cursiva: false, pesosExtra: false }), temaB.urlGoogleFonts(['Cormorant Garamond']), 'Cormorant con variantes apagadas = hoy')
    igual(temaR.urlGoogleFonts(['Archivo'], {}), temaB.urlGoogleFonts(['Archivo']), 'Archivo con variantes vacías = hoy')

    const G = 'https://fonts.googleapis.com/css2?'
    const HOY = 'wght@400;500;600;700'
    /** Las 7 plantillas: [nombre, títulos, cuerpo, opciones del shell, URL esperada]. */
    const PLANTILLAS = [
      ['Panorama', 'Inter', 'Inter', { footer_inset: true }, `${G}family=Inter:${HOY}&display=swap`],
      ['Atelier', 'Cormorant Garamond', 'Inter', { footer_links_style: 'display' }, `${G}family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:${HOY}&display=swap`],
      ['Radiante', 'Instrument Serif', 'Inter', { footer_brand_display: 'giant' }, `${G}family=Instrument+Serif:wght@400&family=Inter:${HOY}&display=swap`],
      ['Roble', 'Inter', 'Inter', { footer_brand_display: 'giant' }, `${G}family=Inter:${HOY}&display=swap`],
      ['Marea', 'Archivo', 'Archivo', { footer_brand_display: 'giant', footer_brand_figure_url: null }, `${G}family=Archivo:wght@400;500;600;700;800;900&display=swap`],
      ['Contraste', 'Syne', 'Inter', { buttons_uppercase_active: true }, `${G}family=Syne:${HOY}&family=Inter:${HOY}&display=swap`],
      ['Hogar', 'Outfit', 'Outfit', { footer_inset: true }, `${G}family=Outfit:${HOY}&display=swap`],
    ]
    const hojas = []
    for (const [nombre, titulos, cuerpo, opciones, esperada] of PLANTILLAS) {
      const v = ep.variantesFuenteTienda(ep.opcionesPlantillaTienda(opciones))
      const url = temaR.urlGoogleFonts([titulos, cuerpo], v)
      igual(url, esperada, `hoja de fuentes de ${nombre}`)
      hojas.push([nombre, url])
    }
    igual(temaR.urlGoogleFonts(['Instrument Serif']), `${G}family=Instrument+Serif:wght@400&display=swap`, 'Instrument Serif solo 400')
    igual(temaR.urlGoogleFonts(['Instrument Serif'], { cursiva: true }), `${G}family=Instrument+Serif:ital,wght@0,400;1,400&display=swap`, 'Instrument Serif con cursiva')

    if (process.env.VERIFY_RED === '1') {
      const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
      const extra = [
        ['Instrument Serif con cursiva', temaR.urlGoogleFonts(['Instrument Serif', 'Inter'], { cursiva: true })],
        ['Cormorant de hoy (org con el par cormorant_montserrat)', temaR.urlGoogleFonts(['cormorant_montserrat'])],
      ]
      for (const [nombre, url] of [...hojas, ...extra]) {
        try {
          const r = await fetch(url, { headers: { 'user-agent': UA } })
          const css = await r.text()
          check(r.status === 200, `${nombre}: Google Fonts respondió ${r.status}`)
          // Cada eje pedido trae su cara: estilo y peso.
          const pedidas = [...url.matchAll(/family=([^:&]+):([^&]+)/g)].flatMap(([, fam, ejes]) => {
            const familia = decodeURIComponent(fam.replace(/\+/g, ' '))
            const [tipo, lista] = ejes.split('@')
            return lista.split(';').map((v) => {
              const partes = v.split(',')
              const italica = tipo.startsWith('ital') ? partes[0] === '1' : false
              return { familia, estilo: italica ? 'italic' : 'normal', peso: partes[partes.length - 1] }
            })
          })
          for (const c of pedidas) {
            const hay = css.split('@font-face').some((b) => b.includes(`font-family: '${c.familia}'`) && b.includes(`font-style: ${c.estilo};`) && b.includes(`font-weight: ${c.peso};`))
            check(hay, `${nombre}: la hoja no trae ${c.familia} ${c.estilo} ${c.peso}`)
          }
        } catch (e) {
          fallos.push(`${nombre}: no se pudo pedir la hoja (${e instanceof Error ? e.message : e})`)
        }
      }
    }
  }

  // ─── 2. Tema ───────────────────────────────────────────────────────────────────────────────
  {
    const t = {
      fondo: '#FFFFFF', texto: '#161616', fuenteTitulos: 'Syne', fuenteCuerpo: 'Inter', radio: 0, estiloBoton: 'solido', movimiento: 'medio',
      tokens: { boton: { mayusculas: { mode: 'value', value: true } } }, tarjetaProducto: null, paginacion: null, carrusel: null,
    }
    igual(temaR.atributosTema(t), temaB.atributosTema(t), 'mayúsculas guardadas por un preset, sin la opción: el tema de hoy')
    igual(temaR.atributosTema(t, {}), temaB.atributosTema(t), 'opciones vacías = hoy')
    igual(temaR.atributosTema(t, { mayusculasActivas: false, cursiva: false }), temaB.atributosTema(t), 'opciones apagadas = hoy')
    igual(temaR.atributosTema(null, { mayusculasActivas: true, cursiva: true }), { variables: {}, datos: {} }, 'legacy: nada aunque lleguen opciones')
    const sinTokens = { ...t, tokens: null }
    igual(temaR.atributosTema(sinTokens, { mayusculasActivas: true }), temaB.atributosTema(sinTokens), 'la opción sin el token no hace nada')
    const con = temaR.atributosTema(t, { mayusculasActivas: true })
    igual(con.variables['--gw-btn-case'], 'uppercase', 'Contraste: mayúsculas')
    igual(con.variables['--gw-btn-tracking'], '.08em', 'Contraste: espaciado')
    igual(con.datos['data-botones-mayusculas'], 'propio', 'Contraste: atributo de mayúsculas')
    check(!('data-tokens-diseno' in con.datos), 'las mayúsculas no prenden data-tokens-diseno')
    for (const [hover, esperado] of [['sutil', 'sutil'], ['expresivo', 'expresivo'], ['ninguno', undefined], ['otro', undefined]]) {
      const a = temaR.atributosTema({ ...t, tokens: { hover: { mode: 'value', value: hover } } })
      igual(a.datos['data-tema-hover'], esperado, `tokens.hover ${hover}`)
    }
    const atelier = { ...t, fuenteTitulos: 'Cormorant Garamond', tokens: null }
    igual(temaR.atributosTema(atelier, { cursiva: true }).variables['--font-heading-italic'], 'italic', 'Atelier: cursiva de títulos')
    check(!('--font-heading-italic' in temaR.atributosTema(atelier).variables), 'sin enlaces display no hay cursiva')
    check(!('--font-heading-italic' in temaR.atributosTema(t, { cursiva: true }).variables), 'Syne no trae cursiva pedida: no se sintetiza')

    const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
    for (const sel of [
      '[data-botones-mayusculas] section[data-section-id] [data-boton]',
      "[data-tema-hover='sutil'] section[data-section-id] [data-boton]:hover",
      "[data-tema-hover='expresivo'] section[data-section-id] [data-boton]:hover",
      '[data-pie-tarjeta] > footer',
      'header[data-encabezado-pildora] [data-nav-pildora] > nav',
    ]) check(css.includes(sel), `app/globals.css sin la regla «${sel}»`)
    check(css.includes('text-transform: var(--gw-btn-case, none)') && css.includes('letter-spacing: var(--gw-btn-tracking, normal)'), 'el botón usa las variables de mayúsculas con su respaldo')
    // Sin el atributo, ninguna regla nueva alcanza un botón: no hay regla suelta sobre [data-boton].
    check(!/^\s*(section\[data-section-id\]\s*)?\[data-boton\][^{]*\{[^}]*text-transform/m.test(css), 'una regla de mayúsculas sin atributo de raíz cambiaría botones de hoy')
  }

  // ─── 3 y 4. HTML del encabezado y del pie ──────────────────────────────────────────────────
  const errorOriginal = console.error
  console.error = (...args) => {
    const t = String(args[0] ?? '')
    if (t.includes('useLayoutEffect does nothing on the server') || t.includes('fetchPriority')) return
    errorOriginal(...args)
  }
  const { createElement: h } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const pintar = (nombre, nodo) => {
    try {
      return renderToStaticMarkup(nodo)
    } catch (e) {
      fallos.push(`${nombre}: revienta al pintar — ${e instanceof Error ? e.stack : String(e)}`)
      return ''
    }
  }

  const ORG = {
    id: 9001, name: 'Tienda de Prueba', subdomain: 'prueba', logo_url: null, logo_oscuro_url: null, logo_fondo_claro_url: null,
    description: 'Tienda sintética para la prueba.', address: 'Calle 1 # 2-3', city: 'Medellín', phone: '+57 300 000 0000', email: 'hola@ejemplo.co',
    primary_color: '#111111', secondary_color: '#222222', website_settings: {},
  }
  const pagina = (id, title, slug) => ({ id, organization_id: ORG.id, title, slug, children: [], level: 0, is_published: true, show_in_header: true })
  const NAV = [pagina(1, 'Inicio', 'home'), pagina(2, 'Tienda', 'productos'), pagina(3, 'Contacto', 'contacto')]
  const MENUS = [
    { id: 1, name: 'Ayuda', footer_column: 1, items: [{ item_type: 'custom', custom_label: 'Envíos', custom_url: '/envios', children: [] }, { item_type: 'custom', custom_label: 'Cambios', custom_url: '/cambios', children: [] }] },
    { id: 2, name: 'Legal', footer_column: 2, items: [{ item_type: 'custom', custom_label: 'Términos', custom_url: '/terminos', children: [] }] },
  ]
  const BASE_AJUSTES = { social_links: { instagram: 'https://instagram.com/ejemplo' }, footer_text: '© Tienda de Prueba' }

  async function cargarArbol(compilar) {
    return {
      SiteHeader: (await compilar('components/site/SiteHeader.tsx')).default,
      SiteFooter: (await compilar('components/site/SiteFooter.tsx')).SiteFooter,
      TemaColoresProvider: (await compilar('components/site/TemaColoresContext.tsx')).TemaColoresProvider,
    }
  }
  const R = await cargarArbol(rama)
  const B = await cargarArbol(base)

  const pie = (A, ajustes, tema) => {
    const nodo = h(A.SiteFooter, { organization: { ...ORG, website_settings: ajustes }, settings: ajustes, primaryColor: '#111111', footerNavTree: NAV, menus: MENUS, menuCategories: [] })
    return tema ? h(A.TemaColoresProvider, { value: true }, nodo) : nodo
  }
  const encabezado = (A, ajustes, tema) => {
    const nodo = h(A.SiteHeader, { organization: { ...ORG, website_settings: ajustes }, primaryColor: '#111111', headerNavTree: NAV, menuCategories: [] })
    return tema ? h(A.TemaColoresProvider, { value: true }, nodo) : nodo
  }

  const COMPOSICIONES_PIE = ['default', 'minimal', 'centered', 'three_columns', 'split']
  for (const tema of [false, true]) {
    for (const footer_style of COMPOSICIONES_PIE) {
      for (const extra of [{}, { footer_background: 'light' }, { footer_show_newsletter: true, footer_show_categories: true }]) {
        const ajustes = { ...BASE_AJUSTES, footer_style, ...extra }
        const nombre = `pie ${footer_style}${tema ? ' con tema' : ''} ${JSON.stringify(extra)}`
        const hoy = pintar(`${nombre} (base)`, pie(B, ajustes, tema))
        const ahora = pintar(nombre, pie(R, ajustes, tema))
        check(hoy.length > 0 && hoy === ahora, `${nombre}: el HTML cambió sin opciones nuevas`)
        // Valores por defecto escritos explícitamente: tampoco cambian nada.
        const conDefaults = pintar(nombre, pie(R, { ...ajustes, footer_brand_display: 'none', footer_inset: false, footer_links_style: 'normal', footer_brand_figure_url: null }, tema))
        check(conDefaults === hoy, `${nombre}: los defaults explícitos cambian el HTML`)
      }
    }
  }

  const COMPOSICIONES_ENCABEZADO = ['default', 'centered', 'split', 'minimal', 'mega', 'transparent']
  for (const tema of [false, true]) {
    for (const header_style of COMPOSICIONES_ENCABEZADO) {
      for (const extra of [{}, { header_cta_text: 'Comprar', header_cta_url: '/productos' }]) {
        const ajustes = { ...BASE_AJUSTES, header_style, ...extra }
        const nombre = `encabezado ${header_style}${tema ? ' con tema' : ''} ${JSON.stringify(extra)}`
        const hoy = pintar(`${nombre} (base)`, encabezado(B, ajustes, tema))
        const ahora = pintar(nombre, encabezado(R, ajustes, tema))
        check(hoy.length > 0 && hoy === ahora, `${nombre}: el HTML cambió sin opciones nuevas`)
        const conDefaults = pintar(nombre, encabezado(R, { ...ajustes, header_cta_shape: 'pill', buttons_uppercase_active: false }, tema))
        check(conDefaults === hoy, `${nombre}: los defaults explícitos cambian el HTML`)
      }
    }
  }

  // pill: hoy caía en el clásico; ahora es HeaderPill.
  {
    const ajustes = { ...BASE_AJUSTES, header_style: 'pill', header_cta_text: 'Reservar', header_cta_url: '/reservas' }
    const html = pintar('encabezado pill', encabezado(R, ajustes, true))
    check(html.includes('data-encabezado-pildora') && html.includes('data-nav-pildora'), 'pill pinta HeaderPill')
    check(!html.includes('data-encabezado-transparente'), 'pill sin header_transparent_over_hero va siempre con fondo')
    check(html.includes('>Tienda<') && html.includes('>Reservar<'), 'pill pinta el menú y el botón')
    check(!html.includes('data-boton-circular'), 'pill: el botón de hoy sin header_cta_shape')
    const sobre = pintar('encabezado pill sobre la portada', encabezado(R, { ...ajustes, header_transparent_over_hero: true }, true))
    check(sobre.includes('data-encabezado-transparente="solido"'), 'pill sobre la portada arranca sólido (se mide en el navegador)')
    const circulo = pintar('encabezado pill circular', encabezado(R, { ...ajustes, header_cta_shape: 'circle' }, true))
    check(circulo.includes('data-boton-circular') && circulo.includes('rounded-full'), 'header_cta_shape circle pinta el botón circular')
    const clasicoCirculo = pintar('encabezado clásico circular', encabezado(R, { ...BASE_AJUSTES, header_cta_text: 'Reservar', header_cta_url: '/reservas', header_cta_shape: 'circle' }, true))
    check(clasicoCirculo.includes('data-boton-circular'), 'el botón circular también en el clásico')
    const { enlaceActivo } = await rama('components/site/header/HeaderPill.tsx')
    check(enlaceActivo('/', '/') && !enlaceActivo('/', '/productos'), 'la portada solo está activa en /')
    check(enlaceActivo('/productos', '/productos/12') && !enlaceActivo('/productos', '/productosx'), 'una sección activa sus subrutas')
    check(enlaceActivo('/productos?orden=1', '/productos/'), 'consulta y barra final no cuentan')
  }

  // Opciones del pie encendidas.
  for (const tema of [false, true]) {
    for (const footer_style of COMPOSICIONES_PIE) {
      const nombre = `pie ${footer_style}${tema ? ' con tema' : ''}`
      const ajustes = { ...BASE_AJUSTES, footer_style }
      const tarjeta = pintar(`${nombre} tarjeta`, pie(R, { ...ajustes, footer_inset: true }, tema))
      check(tarjeta.startsWith('<div class="px-4 pb-4" data-pie-tarjeta=""><footer'), `${nombre}: footer_inset envuelve el pie en la tarjeta`)
      const hoy = pintar(nombre, pie(R, ajustes, tema))
      check(tarjeta === `<div class="px-4 pb-4" data-pie-tarjeta="">${hoy}</div>`, `${nombre}: la tarjeta no cambia el pie de adentro`)
      const marca = pintar(`${nombre} marca`, pie(R, { ...ajustes, footer_brand_display: 'giant', footer_brand_figure_url: 'https://cdn.ejemplo.co/figura.png' }, tema))
      check(marca.includes('data-pie-marca') && marca.includes('>Tienda de Prueba</span>'), `${nombre}: marca gigante con el nombre`)
      check(marca.includes('src="https://cdn.ejemplo.co/figura.png"'), `${nombre}: la figura sobre la marca`)
      const sinFigura = pintar(`${nombre} marca sin figura`, pie(R, { ...ajustes, footer_brand_display: 'giant' }, tema))
      check(sinFigura.includes('data-pie-marca') && !sinFigura.includes('figura.png'), `${nombre}: marca sin figura`)
      const figuraSola = pintar(`${nombre} figura sola`, pie(R, { ...ajustes, footer_brand_figure_url: 'https://cdn.ejemplo.co/figura.png' }, tema))
      check(figuraSola === hoy, `${nombre}: la figura sin marca gigante no cambia nada`)
    }
  }
  {
    const ajustes = { ...BASE_AJUSTES, footer_style: 'minimal', footer_links_style: 'display' }
    const display = pintar('pie display', pie(R, ajustes, true))
    check(display.includes('data-pie-enlaces-display') && display.includes('>Envíos</a>') && display.includes('>Términos</a>'), 'enlaces display: todos los enlaces de los menús juntos')
    check(display.includes('font-style:var(--font-heading-italic, normal)'), 'enlaces display: cursiva solo si la hoja la trae')
    check(!display.includes('>Ayuda</h3>'), 'enlaces display: los menús ya no van en columnas')
    for (const footer_style of COMPOSICIONES_PIE) {
      const html = pintar(`pie display ${footer_style}`, pie(R, { ...ajustes, footer_style }, true))
      check(html.includes('data-pie-enlaces-display'), `enlaces display en la composición ${footer_style} con tema`)
    }
  }
} finally {
  await rm(TMP, { recursive: true, force: true })
}

if (fallos.length > 0) {
  console.error(`✗ verify-shell-plantillas: ${fallos.length} problema(s) en ${casos} casos`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-shell-plantillas: ${casos} casos (fuentes, tema y HTML de hoy contra ${BASE_REF})`)
