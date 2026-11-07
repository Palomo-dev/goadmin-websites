/**
 * verify-cafe.mjs — plantilla «Café de especialidad» en el sitio público, sin dependencias nuevas.
 *
 *   npm run verify:cafe
 *   ERP_REPO=/ruta/a/go-admin-erp npm run verify:cafe              (compara con el ERP)
 *   CAFE_MAIN=/ruta/a/una/copia/de/main npm run verify:cafe        (HTML idéntico a main)
 *   node --env-file=.env.local … scripts/verify-cafe.mjs            (además, RPC contra la base real)
 *
 * Qué comprueba:
 * 1. Contrato (lib/website/v2/contrato/seccionesCafe.ts, copia del ERP): defaults de las láminas,
 *    claves ausentes / basura → default, modo de reserva (E1), mensaje de WhatsApp (lámina 05 · A).
 * 2. Plano (lib/restaurant/planoMesas.ts): lectura de la RPC, tamaños iguales a los del editor del
 *    ERP, estados sin consulta, nota con la mesa y qué sedes entran.
 * 3. Registro: SECTION_MAP (hero.carousel_editorial, how_it_works.chapters, menu_full.dotted,
 *    reservation.floor_plan), CONTENT_KEYS en el manifiesto y la precarga del plano en la página
 *    solo con `floor_plan` (con su else).
 * 4. Render de cada variante con datos sintéticos (react-dom/server), incluido «sin datos ⇒ no se
 *    pinta» de la carta y «sin plano ⇒ stepper» de la reserva.
 * 5. Sin las variantes nuevas, el HTML de las variantes de siempre es IDÉNTICO al de main (si hay una
 *    copia de main: CAFE_MAIN, o `git worktree`/`git archive` de origin/main en un temporal).
 * 6. Esquema: RPC y parámetros que llama el sitio = los de las migraciones del ERP (si está al lado)
 *    y, con las variables de Supabase, una llamada real a cada RPC (como verify-tracking).
 *
 * Transpila TS/TSX al vuelo con `typescript` (ya instalado) mediante un cargador de módulos.
 */
import { readFile, mkdtemp, rm, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { register } from 'node:module'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'go-admin-erp'))
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
const existe = (p) => access(p).then(() => true, () => false)
const leer = (rel, raiz = ROOT) => readFile(join(raiz, rel), 'utf8')

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
const html = (el) => renderToStaticMarkup(el)

const contrato = await importar('lib/website/v2/contrato/seccionesCafe.ts')
const plano = await importar('lib/restaurant/planoMesas.ts')

// ─── 1. Contrato ─────────────────────────────────────────────────────────────────────────────
igual(contrato.VARIANTES_CAFE, { hero: 'carousel_editorial', how_it_works: 'chapters', menu_full: 'dotted', reservation: 'floor_plan' }, 'cuatro variantes de tipos existentes')
igual(contrato.normalizarPortadaEditorial({}), contrato.DEFAULT_PORTADA_EDITORIAL, 'portada: sin contenido = defaults de la lámina 12')
igual(contrato.normalizarPortadaEditorial({ height: 'gigante', interval_ms: 50, dot_style: 'x', content_position: 'arriba' }), contrato.DEFAULT_PORTADA_EDITORIAL, 'portada: basura = defaults')
const p374 = contrato.normalizarPortadaEditorial({
  slides: [{ image_url: 'https://x.supabase.co/a.jpg', alt: 'Salón' }, { image_url: 'javascript:alert(1)' }, { image_url_mobile: '/m.jpg' }],
  buttons: [{ url: '/reservas-mesa', label: 'Reservar mesa', variant: 'solid' }, { url: '/carta', label: 'Ver carta', variant: 'outline' }, { url: '/a', label: 'A' }, { url: '/b', label: 'B' }, { url: '', label: 'Sin enlace' }],
  subtitle_style: 'italic',
})
check(p374.fotos.length === 2 && p374.fotos[1].imageUrl === '/m.jpg', 'portada: fotos sin enlaces inseguros; solo celular = todos los anchos')
check(p374.botones.length === 3 && p374.subtitleStyle === 'italic', 'portada: hasta 3 botones y subtítulo en cursiva')
const hist = contrato.normalizarHistoriaCapitulos({})
check(hist.capitulos.length === 3 && hist.capitulos[0].numero === '01' && hist.title === 'Nuestra historia', 'capítulos: tres de ejemplo numerados 01-03')
check(contrato.normalizarHistoriaCapitulos({ show_numbers: false, items: [{ step: 7, title: 'Uno' }] }).capitulos[0].numero === '7', 'capítulos: sin numerar usa el paso del dueño')
igual(contrato.normalizarCartaPuntos({}), contrato.DEFAULT_CARTA_PUNTOS, 'carta: sin contenido = defaults de la lámina 14')
check(contrato.normalizarCartaPuntos({ view_all_url: 'javascript:alert(1)' }).viewAllUrl === '/carta', 'carta: enlace del botón inseguro = /carta')
check(contrato.textoContador('Café', 12, 'preparaciones') === 'Café · 12 preparaciones', 'carta: contador')
check(contrato.selectorSedeVisible({ showBranchSelector: true }, { esPaginaDeSede: false, sedes: 1 }) === false, 'carta: con una sede no hay selector')
igual(contrato.normalizarReservaPlano({}), contrato.DEFAULT_RESERVA_PLANO, 'reserva: sin contenido = defaults de la lámina 15')
check(contrato.resolverModoReserva({}, { reservasActivas: false }) === 'whatsapp' && contrato.resolverModoReserva({}, { reservasActivas: true }) === 'erp', 'reserva: modo sin elegir (E1)')
check(contrato.resolverModoReserva({ booking_mode: 'whatsapp' }, { reservasActivas: true }) === 'whatsapp', 'reserva: el modo guardado manda')
check(
  contrato.mensajeReservaWhatsapp({ sede: 'Sede Laureles', fecha: 'sábado 17 de octubre', hora: '10:30 a. m.', personas: 4, nombre: 'Laura Gómez', telefono: '+57 300 000 0000', mesa: 'Mesa 9', zona: 'Salón', notas: 'cumpleaños' }) ===
    'Hola, quiero reservar la Mesa 9 (Salón) en Sede Laureles el sábado 17 de octubre a las 10:30 a. m. para 4 personas. A nombre de Laura Gómez · +57 300 000 0000. Notas: cumpleaños',
  'reserva: mensaje de WhatsApp de la lámina 05 · A',
)
const contratoTs = await leer('lib/website/v2/contrato/seccionesCafe.ts')
check(!/^import /m.test(contratoTs), 'contrato sin imports (copia tal cual del ERP)')
const copiaErp = join(ERP, 'src/lib/website/contrato/seccionesCafe.ts')
if (await existe(copiaErp)) check((await readFile(copiaErp, 'utf8')) === contratoTs, 'contrato idéntico al del ERP')
else notas.push(`Sin el ERP en ${ERP}: no se compara la copia del contrato.`)

// ─── 2. Plano ────────────────────────────────────────────────────────────────────────────────
const RPC_SINTETICA = {
  branch_id: 9001,
  has_layout: true,
  zones: [{ zone_name: 'Salón', position_x: null, position_y: null, width: null, height: null, color: null, sort_order: 0 }],
  tables: [
    { id: 'm1', name: 'Mesa 1', zone: 'Salón', shape: 'square', size: 'm', capacity: 2, position_x: 40, position_y: 40, rotation: 0, is_web_bookable: true, web_min_party: null, web_max_party: null },
    { id: 'm2', name: 'Mesa 2', zone: 'Salón', shape: 'round', size: 'm', capacity: 4, position_x: 200, position_y: 40, rotation: 0, is_web_bookable: true, web_min_party: null, web_max_party: null },
    { id: 'm3', name: 'Mesa 3', zone: 'Salón', shape: 'long', size: 'l', capacity: 6, position_x: 360, position_y: 40, rotation: 90, is_web_bookable: false, web_min_party: null, web_max_party: null },
    { id: 'm4', name: 'Mesa 4', zone: 'Salón', shape: null, size: null, capacity: 8, position_x: null, position_y: null, rotation: 0, is_web_bookable: true, web_min_party: 5, web_max_party: null },
  ],
  elements: [
    { id: 'e1', zone_name: 'Salón', kind: 'column', label: 'Columna', position_x: 120, position_y: 220, width: 40, height: 80, rotation: 0, sort_order: 0 },
    { id: 'e2', zone_name: 'Salón', kind: 'nave espacial', label: null, position_x: 0, position_y: 0, width: 10, height: 10, rotation: 0, sort_order: 1 },
  ],
}
const leido = plano.leerPlanoPublico(RPC_SINTETICA, 9001)
check(leido && leido.hayPlano && leido.mesas.length === 4 && leido.elementos.length === 1, 'plano: lee mesas y descarta elementos de tipo desconocido')
check(leido.mesas[3].forma === 'larga' && leido.mesas[3].x === null, 'plano: forma por capacidad y mesa sin posición')
igual(plano.cajaMesa(leido.mesas[2]), { x: 360, y: 40, w: 128, h: 230 }, 'plano: caja de la mesa girada 90°')
check(plano.leerPlanoPublico(null, 1) === null && plano.leerPlanoPublico({ has_layout: true, tables: [] }, 1).hayPlano === false, 'plano: respuesta vacía = sin plano')
check(plano.estadoSinConsulta(leido.mesas[2], 2) === 'no_web' && plano.estadoSinConsulta(leido.mesas[0], 3) === 'no_alcanza' && plano.estadoSinConsulta(leido.mesas[3], 4) === 'no_alcanza' && plano.estadoSinConsulta(leido.mesas[1], 4) === 'libre', 'plano: estados sin consulta (no_web, capacidad, rango web)')
igual(plano.leerDisponibilidadMesas([{ table_id: 'm1', estado: 'ocupada' }, { table_id: 'm2', estado: 'raro' }]), { m1: 'ocupada' }, 'plano: filas de disponibilidad')
check(plano.notaConMesa(leido.mesas[1], ' cumpleaños ') === 'Mesa elegida en el plano: Mesa 2 (Salón) · cumpleaños', 'plano: la mesa viaja en la nota')
check(plano.notaConMesa(null, '', contrato.NOTA_SOLICITUD_WHATSAPP) === 'Solicitud por WhatsApp', 'plano: nota de la solicitud por WhatsApp')
check(plano.planoConZonas(leido, ['Terraza']).hayPlano === false && plano.planoConZonas(leido, []).mesas.length === 4, 'plano: filtro de zonas de la sección')
check(plano.lienzoDelPlano(leido) !== null && plano.recuadrosDeZona(leido).length === 1, 'plano: lienzo y recuadro de zona calculado')
const erpPlano = join(ERP, 'src/components/pos/mesas/plano/estadoMesaPlano.ts')
if (await existe(erpPlano)) {
  const fuenteErp = await readFile(erpPlano, 'utf8')
  const cuerpo = (src, nombre) => (src.match(new RegExp(`function ${nombre}\\([^\\n]*\\{\\n([\\s\\S]*?)\\n\\}`)) || [])[1]?.replace(/;/g, '').replace(/\s+/g, ' ').trim()
  const local = await leer('lib/restaurant/planoMesas.ts')
  check(cuerpo(fuenteErp, 'tamanoEnPlanoBase') === cuerpo(local, 'tamanoMesa'), 'plano: tamaños de mesa iguales a los del editor del ERP (tamanoEnPlanoBase)')
  check(cuerpo(fuenteErp, 'formaPorCapacidad') === cuerpo(local, 'formaPorCapacidad'), 'plano: forma por capacidad igual a la del ERP')
} else notas.push('Sin el ERP: no se comparan los tamaños del plano.')
const SEDES = {
  sedes: [
    { id: 1, nombre: 'Principal', mesas: 4, ajustes: null, esPrincipal: true, publicada: false, slug: null, horario: null, zonaHoraria: 'America/Bogota', foto: null, direccion: null, ciudad: null, telefono: null, lat: null, lng: null },
    { id: 2, nombre: 'Norte', mesas: 0, ajustes: null, esPrincipal: false, publicada: true, slug: 'norte', horario: null, zonaHoraria: 'America/Bogota', foto: null, direccion: null, ciudad: null, telefono: null, lat: null, lng: null },
    { id: 3, nombre: 'Sur', mesas: 3, ajustes: { habilitada: false }, esPrincipal: false, publicada: true, slug: 'sur', horario: null, zonaHoraria: 'America/Bogota', foto: null, direccion: null, ciudad: null, telefono: null, lat: null, lng: null },
  ],
  ajustesOrganizacion: null,
  mesasSinSede: 0,
  zonaOrganizacion: 'America/Bogota',
}
igual(plano.sedesDeReservaPlano(SEDES, { sedePagina: null, elegidas: [], modoGuardado: undefined }).map((s) => s.id), [1, 3], 'sedes: con mesas (la apagada entra en modo WhatsApp)')
igual(plano.sedesDeReservaPlano(SEDES, { sedePagina: null, elegidas: [], modoGuardado: 'erp' }).map((s) => s.id), [1], 'sedes: «Directo al ERP» solo las que aceptan reservas')
igual(plano.sedesDeReservaPlano(SEDES, { sedePagina: 3, elegidas: [], modoGuardado: undefined }).map((s) => s.id), [3], 'sedes: en la página de una sede, solo esa')

// ─── 3. Registro ─────────────────────────────────────────────────────────────────────────────
const renderer = await leer('components/sections/SectionRenderer.tsx')
const bloque = (tipo) => (renderer.match(new RegExp(`\\n  ${tipo}: \\{([\\s\\S]*?)\\n  \\},`)) || [])[1] || ''
check(/carousel_editorial: SeccionPortadaEditorial/.test(bloque('hero')), 'SECTION_MAP: hero.carousel_editorial')
check(/chapters: SeccionHistoriaCapitulos/.test(bloque('how_it_works')), 'SECTION_MAP: how_it_works.chapters')
check(/dotted: SeccionCartaPuntos/.test(bloque('menu_full')), 'SECTION_MAP: menu_full.dotted')
check(/floor_plan: SeccionReservaPlano/.test(bloque('reservation')), 'SECTION_MAP: reservation.floor_plan')
const secciones = await importar('components/sections/cafe/secciones.tsx')
const claves = (C) => new Set(C.CONTENT_KEYS || [])
for (const [tipo, comp] of [['hero', secciones.SeccionPortadaEditorial], ['how_it_works', secciones.SeccionHistoriaCapitulos], ['menu_full', secciones.SeccionCartaPuntos], ['reservation', secciones.SeccionReservaPlano]]) {
  const k = claves(comp)
  for (const c of [...contrato.CLAVES_SECCION_CAFE[tipo], ...contrato.CLAVES_DISENO_SECCION_CAFE[tipo]]) check(k.has(c), `manifiesto: ${tipo} declara «${c}»`)
}
const pagina = await leer('app/[[...slug]]/page.tsx')
check(/s\.section_type === 'reservation' && s\.section_variant === VARIANTE_RESERVA_PLANO/.test(pagina), 'page.tsx: el plano solo se lee con `reservation` · `floor_plan`')
check(/data\.planosMesas = await getPlanosMesas\([\s\S]{0,80}\} else \{\s*\/\/ Sin plano en la página/.test(pagina), 'page.tsx: precarga del plano con su else (sin la variante, nada nuevo)')

// ─── 4. Render con datos sintéticos ──────────────────────────────────────────────────────────
const ORG = { id: 999, name: 'Café de muestra', subdomain: 'muestra', timezone: 'America/Bogota', website_settings: { header_transparent_over_hero: true } }
const render = (C, content, data = {}, variante) => html(h(C, { content, organization: ORG, data, sectionVariant: variante, sectionId: 'abcdef12-0000' }))

const hHero = render(secciones.SeccionPortadaEditorial, {
  title: 'Un lugar para quedarse', subtitle: 'Café de origen', eyebrow: 'Medellín · Café de especialidad', subtitle_style: 'italic',
  slides: [{ image_url: 'https://x.co/1.jpg', alt: 'Barra' }, { image_url: 'https://x.co/2.jpg', alt: 'Terraza' }],
  buttons: [{ url: '/reservas-mesa', label: 'Reservar mesa', variant: 'solid' }, { url: '/carta', label: 'Ver carta', variant: 'outline' }, { url: '/sedes', label: 'Explorar sedes', variant: 'outline' }, { url: '/x', label: 'Cuarto' }],
})
check(hHero.includes('Medellín · Café de especialidad') && hHero.includes('<h1') && /italic/.test(hHero), 'portada: antetítulo, título y subtítulo en cursiva')
check((hHero.match(/data-boton=/g) || []).length === 3 && !hHero.includes('Cuarto'), 'portada: tres botones fijos (el cuarto no)')
check((hHero.match(/<img /g) || []).length === 2 && hHero.includes('aria-roledescription="carrusel"'), 'portada: dos fotos en carrusel')
check(hHero.includes('padding-top:var(--header-h'), 'portada: reserva el alto del encabezado transparente')
const hSinFotos = render(secciones.SeccionPortadaEditorial, { title: 'Sin fotos' })
check(!hSinFotos.includes('<img') && hSinFotos.includes('linear-gradient'), 'portada: sin fotos ni portada de sede, el degradado del tema')

const hHist = render(secciones.SeccionHistoriaCapitulos, { eyebrow: 'Nuestra historia', title: 'Del grano a la taza', show_numbers: true, items: [{ label: 'El origen', title: 'Una finca', description: 'Todo empezó…' }, { label: 'El oficio', title: 'Tostar', description: 'Despacio', image_url: 'https://x.co/t.jpg', image_alt: 'Tostadora' }] })
check(hHist.includes('01') && hHist.includes('02') && hHist.includes('El origen') && hHist.includes('alt="Tostadora"'), 'capítulos: etiqueta, número e imagen')
check((hHist.match(/<li /g) || []).length === 2, 'capítulos: uno por ítem')

const CATS = [{ id: 10, name: 'Café', slug: 'cafe', description: null, parent_id: null, display_order: 1, rank: 1 }, { id: 11, name: 'Panadería', slug: 'pan', description: null, parent_id: null, display_order: 2, rank: 2 }]
const prod = (id, name, cat, price, extra = {}) => ({ id, uuid: `u${id}`, name, description: `${name} de la casa`, category_id: cat, sku: null, track_stock: false, is_parent: false, organization_id: 999, product_prices: [{ id, price, compare_price: null, effective_to: null }], product_images: [], stock_levels: [], ...extra })
const PRODS = [prod(1, 'Espresso', 10, 7000), prod(2, 'Capuchino', 10, 12000), prod(3, 'Tinto', 10, 5000), prod(4, 'Croissant', 11, 6000), prod(5, 'Agotado', 11, 9000, { track_stock: true, stock_levels: [{ branch_id: 1, qty_on_hand: 0, qty_reserved: 0 }] })]
const datosCarta = { menuProducts: PRODS, categories: CATS, productTags: [], branchId: null, pageSlug: 'carta' }
const hCarta = render(secciones.SeccionCartaPuntos, { title: 'Nuestra carta' }, datosCarta, 'dotted')
check(hCarta.includes('role="tablist"') && hCarta.includes('Panadería') && hCarta.includes('Café · 3 preparaciones'), 'carta: pestañas y contador')
check(hCarta.includes('border-dotted') && hCarta.includes('Espresso') && !hCarta.includes('Croissant'), 'carta: línea de puntos; solo la pestaña activa')
check(!render(secciones.SeccionCartaPuntos, { title: 'x' }, { ...datosCarta, menuProducts: [prod(5, 'Agotado', 11, 9000, { track_stock: true, stock_levels: [{ branch_id: 1, qty_on_hand: 0, qty_reserved: 0 }] })] }, 'dotted'), 'carta: sin platos con precio y existencias no se pinta nada')
check(render(secciones.SeccionCartaPuntos, {}, { categories: CATS }, 'dotted') === '', 'carta: sin datos no se pinta nada')
const hDest = render(secciones.SeccionCartaPuntos, { title: 'Lo que más se pide', only_featured: true, featured_limit: 2, carta_platos: { destacados: [4, 2] } }, datosCarta, 'dotted')
check(!hDest.includes('tablist') && hDest.indexOf('Croissant') < hDest.indexOf('Capuchino') && !hDest.includes('Espresso') && hDest.includes('Ver la carta completa'), 'carta: solo destacados en su orden, con «Ver la carta completa»')
const hPrimeros = render(secciones.SeccionCartaPuntos, { only_featured: true, featured_limit: 2 }, datosCarta, 'dotted')
check(hPrimeros.includes('Capuchino') && hPrimeros.includes('Espresso') && !hPrimeros.includes('Tinto'), 'carta: sin destacados marcados, los primeros platos')

const sedesReserva = { ...SEDES, sedes: [SEDES.sedes[0]] }
const planoSede = plano.leerPlanoPublico({ ...RPC_SINTETICA, branch_id: 1 }, 1)
const contRes = { title: 'Elige tu mesa', eyebrow: 'Reservas', anchor_id: 'reservar' }
const hPlano = render(secciones.SeccionReservaPlano, contRes, { sedesRestaurante: sedesReserva, planosMesas: { 1: planoSede }, branchId: null }, 'floor_plan')
check(hPlano.includes('<svg') && (hPlano.match(/data-mesa=/g) || []).length === 3 && hPlano.includes('data-reserva-plano="erp"'), 'reserva: plano con las mesas colocadas (modo ERP)')
check(hPlano.includes('Solicitar reserva') && hPlano.includes('id="reservar"') && hPlano.includes('data-estado="no_web"'), 'reserva: botón por defecto, ancla y mesa que no se reserva en línea')
const { Reservation } = await importar('components/sections/restaurant/Reservation.tsx')
const hSinPlano = render(secciones.SeccionReservaPlano, contRes, { sedesRestaurante: sedesReserva, planosMesas: {}, branchId: null }, 'floor_plan')
const hStepper = render(Reservation, contRes, { sedesRestaurante: sedesReserva, planosMesas: {}, branchId: null }, 'stepper')
check(hSinPlano === hStepper && !hSinPlano.includes('<svg'), 'reserva: sin plano dibujado = la misma sección como «stepper»')
const hWa = render(secciones.SeccionReservaPlano, { ...contRes, booking_mode: 'whatsapp' }, { sedesRestaurante: sedesReserva, planosMesas: { 1: planoSede }, branchId: null }, 'floor_plan')
// Sin número de WhatsApp en el sitio cae a ERP; el modo guardado sí llega a la vista.
check(hWa.includes('data-reserva-plano='), 'reserva: modo WhatsApp renderiza')

// ─── 5. Sin variantes nuevas = main ──────────────────────────────────────────────────────────
// Base = main justo antes del café (a13b1b3). Ya fusionado, origin/main trae las cuatro variantes y
// la comparación «solo se suman» quedaría vacía. CAFE_BASE=<ref> para otra base.
const BASE_CAFE = process.env.CAFE_BASE || 'a13b1b3c4224f2f0f0da7f6a3a34402f40092f75'
let main = process.env.CAFE_MAIN ? resolve(process.env.CAFE_MAIN) : null
let temporal = null
if (!main) {
  try {
    temporal = await mkdtemp(join(tmpdir(), 'verify-cafe-main-'))
    execFileSync('bash', ['-c', `git -C "${ROOT}" archive ${BASE_CAFE} components lib types | tar -x -C "${temporal}"`], { stdio: 'ignore' })
    main = temporal
  } catch {
    notas.push(`Sin ${BASE_CAFE} en el clon: no se compara el HTML con main de antes del café (CAFE_MAIN=… o CAFE_BASE=…).`)
  }
}
if (main) {
  const CASOS = [
    ['components/sections/restaurant/Reservation.tsx', 'Reservation', contRes, { sedesRestaurante: sedesReserva, branchId: null }, 'stepper'],
    ['components/sections/restaurant/MenuFull.tsx', 'MenuFull', { title: 'Carta' }, datosCarta, 'tabs'],
    ['components/sections/saas/HowItWorksSteps.tsx', 'HowItWorksSteps', { title: 'Pasos', steps: [{ title: 'Uno', description: 'a' }] }, {}, 'steps'],
    ['components/sections/hero/HeroFullscreen.tsx', 'HeroFullscreen', { title: 'Hola', subtitle: 'Mundo', image_url: 'https://x.co/h.jpg' }, {}, 'fullscreen'],
  ]
  for (const [ruta, nombre, content, data, variante] of CASOS) {
    try {
      const aqui = (await importar(ruta))[nombre]
      const alla = (await importar(ruta, main))[nombre]
      check(render(aqui, content, data, variante) === render(alla, content, data, variante), `${nombre} (${variante}): HTML idéntico a main`)
    } catch (e) {
      check(false, `${nombre}: no se pudo renderizar para comparar con main (${e.message})`)
    }
  }
  // El mapa de secciones solo SUMA las cuatro variantes del café.
  const rendererMain = await readFile(join(main, 'components/sections/SectionRenderer.tsx'), 'utf8')
  const mapa = (src) => (src.match(/export const SECTION_MAP[\s\S]*?\n\}\n/) || [''])[0].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
  const nuevas = mapa(renderer).filter((l) => !mapa(rendererMain).includes(l))
  igual(nuevas.sort(), ['carousel_editorial: SeccionPortadaEditorial,', 'chapters: SeccionHistoriaCapitulos,', 'dotted: SeccionCartaPuntos,', 'floor_plan: SeccionReservaPlano,'], 'SECTION_MAP: solo se suman las cuatro variantes')
  check(mapa(rendererMain).every((l) => mapa(renderer).includes(l)), 'SECTION_MAP: no se quita ni cambia ninguna entrada de main')
}
if (temporal) await rm(temporal, { recursive: true, force: true })

// ─── 6. Esquema ──────────────────────────────────────────────────────────────────────────────
const servidor = await leer('lib/restaurant/planoMesas.server.ts')
const ruta = await leer('app/api/restaurant-reservations/mesas/route.ts')
const params = (src, rpc) => {
  const i = src.indexOf(`rpc(${rpc}`)
  return i < 0 ? [] : [...src.slice(i, src.indexOf('})', i)).matchAll(/(p_[a-z_]+):/g)].map((m) => m[1])
}
const usados = {
  get_restaurant_floor_plan_public: params(servidor, 'RPC_PLANO_PUBLICO'),
  get_restaurant_table_availability: params(ruta, 'RPC_DISPONIBILIDAD_MESAS'),
}
igual(usados.get_restaurant_floor_plan_public, ['p_organization_id', 'p_branch_id'], 'RPC del plano: parámetros que manda el sitio')
igual(usados.get_restaurant_table_availability, ['p_organization_id', 'p_branch_id', 'p_date', 'p_time', 'p_party_size', 'p_validar_reglas'], 'RPC de disponibilidad: parámetros que manda el sitio')
check(servidor.includes("'get_restaurant_floor_plan_public'") && ruta.includes("'get_restaurant_table_availability'"), 'nombres de las RPC')
const migraciones = join(ERP, 'supabase/migrations')
if (await existe(migraciones)) {
  const sql = execFileSync('bash', ['-c', `cat "${migraciones}"/*plano_publico_rpc.sql "${migraciones}"/*plano_disponibilidad_por_mesa.sql 2>/dev/null`]).toString()
  for (const [rpc, lista] of Object.entries(usados)) {
    const firma = (sql.match(new RegExp(`function public\\.${rpc}\\(([\\s\\S]*?)\\)\\s*returns`, 'i')) || [])[1] || ''
    const enSql = [...firma.matchAll(/(p_[a-z_]+)\s/g)].map((m) => m[1])
    igual(enSql, lista, `${rpc}: mismos parámetros que la migración del ERP`)
  }
  for (const clave of ['has_layout', 'zone_name', 'is_web_bookable', 'web_min_party', 'web_max_party', 'shape', 'size', 'rotation', 'kind', 'label']) {
    check(sql.includes(`'${clave}'`), `plano público: la RPC devuelve «${clave}»`)
  }
} else notas.push('Sin el ERP: no se comparan las RPC con las migraciones.')
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (URL_BASE && KEY) {
  const llamar = (rpc, cuerpo) => fetch(`${URL_BASE}/rest/v1/rpc/${rpc}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const ORG_REAL = Number(process.env.CAFE_ORG_ID || 374)
  const SEDE_REAL = Number(process.env.CAFE_BRANCH_ID || 585)
  const r1 = await llamar('get_restaurant_floor_plan_public', { p_organization_id: ORG_REAL, p_branch_id: SEDE_REAL })
  const j1 = await r1.json().catch(() => null)
  check(r1.ok && plano.leerPlanoPublico(j1, SEDE_REAL) !== null, `RPC real del plano (org ${ORG_REAL}): ${r1.status}`)
  const r2 = await llamar('get_restaurant_table_availability', { p_organization_id: ORG_REAL, p_branch_id: SEDE_REAL, p_date: '2030-01-07', p_time: '10:00', p_party_size: 2, p_validar_reglas: false })
  const j2 = await r2.json().catch(() => null)
  check(r2.ok || /^(DESHABILITADA|SEDE):/.test(j2?.message || ''), `RPC real de disponibilidad (org ${ORG_REAL}): ${r2.status} ${j2?.message || ''}`)
} else notas.push('Sin NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY: no se llaman las RPC reales (firmas verificadas por MCP el 2026-11-07).')

for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-cafe: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-cafe: ${total} comprobaciones (contrato, plano, registro, render, main y esquema)`)
