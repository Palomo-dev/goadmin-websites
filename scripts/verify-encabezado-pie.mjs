/**
 * verify-encabezado-pie.mjs — el encabezado y el pie por plantilla (Figma «16 Sitio web»
 * 2028:38223) tienen quien los pinte, y sus defaults no cambian los sitios de hoy.
 *
 *   npm run verify:encabezado-pie        (sin base: lógica pura y lectura del fuente)
 *
 * 1. Contrato (lib/website/v2/mapeoAjustes.ts, copia del ERP):
 *    - cada opción `nueva` tiene regla y su default cumple la regla (o es null);
 *    - las `nueva` están fuera de COLUMNAS_IMPORTADAS (el select legacy no se rompe sin migración);
 *    - normalizarOpcionShell: ausente / nulo / fuera de la regla → default; 'reservar' (una sola
 *      acción en la columna legacy) → ['reservar']; 'a,b' → lista; 'whatsapp'/'maps' especiales;
 *      '//otro.dominio' o 'javascript:' rechazados.
 * 2. Defaults = el sitio de hoy (lib/website/encabezadoPie.ts): con la fila nula, vacía, con los
 *    DEFAULT de las columnas o con valores basura, opcionesEncabezadoPie da exactamente lo de antes.
 *    El idioma no sale mientras IDIOMAS_DISPONIBLES sea solo español.
 * 3. Quién pinta cada cosa: cada composición de encabezado y de pie, cada fondo del pie y cada
 *    opción nueva tiene su consumidor en el código del sitio (se lee el fuente).
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'
import { isDeepStrictEqual } from 'node:util'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(isDeepStrictEqual(a, b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)

// ─── Carga de los módulos puros ──────────────────────────────────────────────────────────────
const dir = join(ROOT, '.verify-encabezado-pie-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
async function cargar(ruta, nombre, reemplazos = []) {
  let js = stripTypeScriptTypes(await readFile(join(ROOT, ruta), 'utf8'), { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  for (const [de, a] of reemplazos) js = js.replace(de, a)
  await writeFile(join(dir, nombre), js)
  return import(pathToFileURL(join(dir, nombre)).href)
}
let m, ep
try {
  m = await cargar('lib/website/v2/mapeoAjustes.ts', 'mapeoAjustes.mjs')
  ep = await cargar('lib/website/encabezadoPie.ts', 'encabezadoPie.mjs', [["from './v2/mapeoAjustes'", "from './mapeoAjustes.mjs'"]])
} finally {
  // los módulos ya están en memoria
}
await rm(dir, { recursive: true, force: true })

// ─── 1. Contrato ─────────────────────────────────────────────────────────────────────────────
const nuevas = Object.entries(m.OPCIONES_SHELL).filter(([, d]) => d.nueva)
check(nuevas.length === 19, `se esperaban 19 opciones nuevas y hay ${nuevas.length}`)
for (const [col, def] of nuevas) {
  check(!!def.regla, `${col} no declara regla`)
  if (def.regla && def.porDefecto !== null) check(m.cumpleRegla(def.regla, def.porDefecto), `${col}: su default no cumple su regla`)
  check(!m.COLUMNAS_IMPORTADAS.includes(col), `${col} está en COLUMNAS_IMPORTADAS (rompe el select legacy sin migración)`)
  igual(m.normalizarOpcionShell(col, undefined), def.porDefecto, `${col} ausente`)
  igual(m.normalizarOpcionShell(col, null), def.porDefecto, `${col} nulo`)
  igual(m.normalizarOpcionShell(col, { basura: 1 }), def.porDefecto, `${col} con un objeto`)
}
const n = m.normalizarOpcionShell
igual(n('mobile_bottom_bar', 'reservar'), ['reservar'], 'una sola acción en la columna legacy')
igual(n('mobile_bottom_bar', 'reservar,llamar'), ['reservar', 'llamar'], 'lista «a,b»')
igual(n('mobile_bottom_bar', m.barraMovilAColumna(['reservar'])), ['reservar'], 'ida y vuelta de una acción')
igual(n('mobile_bottom_bar', 'auto'), 'auto', 'auto')
igual(n('mobile_bottom_bar', 'ninguna'), 'ninguna', 'ninguna')
igual(n('mobile_bottom_bar', 'hackear'), 'auto', 'acción inválida')
igual(n('mobile_bottom_bar', 'reservar,reservar'), 'auto', 'acción repetida')
igual(n('mobile_bottom_bar', ['a', 'b', 'c', 'd', 'e']), 'auto', 'más de 4 acciones')
igual(n('header_cta2_url', 'whatsapp'), 'whatsapp', 'especial whatsapp')
igual(n('header_cta2_url', 'maps'), 'maps', 'especial maps')
igual(n('header_cta2_url', '/reservas'), '/reservas', 'ruta propia')
igual(n('header_cta2_url', '//otro.dominio'), null, 'protocolo relativo')
igual(n('header_cta2_url', 'javascript:alert(1)'), null, 'javascript:')
igual(n('header_cta2_url', 'http://x.co'), null, 'http sin TLS')
igual(n('site_locales', ['es-CO', 'en']), ['es-CO', 'en'], 'idiomas válidos')
igual(n('site_locales', ['de']), ['es-CO'], 'idioma desconocido')
igual(n('header_text_color', '#fff'), '#fff', 'color corto')
igual(n('header_text_color', 'red; x'), null, 'color con CSS inyectado')
igual(n('header_style', 'transparent'), 'transparent', 'header_style transparent')
igual(n('footer_background', 'tema'), 'tema', 'footer_background tema')
igual(n('footer_background', 'otro'), 'dark', 'footer_background desconocido')

// ─── 2. Defaults = el sitio de hoy ───────────────────────────────────────────────────────────
const HOY = {
  boton2: null,
  topbar: { estadoSede: false, envioGratis: false, cupos: false },
  selectorSedeEnEncabezado: false,
  idiomas: [],
  barraReserva: false,
  fuenteMenu: 'menu',
  barraMovil: 'auto',
  pie: { whatsapp: false, mapa: false, mediosPago: false, fondoTema: false, colorTexto: null, separadores: true },
  moneda: true,
  colorTextoEncabezado: null,
  fijo: true,
}
// Fila legacy con los DEFAULT de website_settings (verificados por MCP el 2026-10-06).
const FILA_DEFAULT = {
  header_cta2_text: null, header_cta2_url: null, topbar_show_branch_status: false, topbar_show_free_shipping: false,
  topbar_show_availability: false, header_show_branch_selector: false, header_show_language: false, site_locales: ['es-CO'],
  header_booking_bar: false, header_menu_source: 'menu', mobile_bottom_bar: 'auto', footer_show_whatsapp: false,
  footer_show_map: false, footer_show_payment_methods: false, header_show_currency: true, header_text_color: null,
  header_sticky: true, footer_text_color: null, footer_show_dividers: true, footer_background: 'dark',
}
igual(ep.opcionesEncabezadoPie(null), HOY, 'fila nula')
igual(ep.opcionesEncabezadoPie({}), HOY, 'fila sin las columnas (antes de la migración)')
igual(ep.opcionesEncabezadoPie(FILA_DEFAULT), HOY, 'fila con los DEFAULT')
igual(
  ep.opcionesEncabezadoPie(Object.fromEntries(Object.keys(FILA_DEFAULT).map((k) => [k, 'basura']))),
  { ...HOY, pie: { ...HOY.pie } },
  'valores basura',
)
igual(ep.IDIOMAS_DISPONIBLES, ['es-CO'], 'IDIOMAS_DISPONIBLES (cambiarlo es decisión de producto)')
igual(ep.opcionesEncabezadoPie({ header_show_language: true, site_locales: ['es-CO', 'en'] }).idiomas, [], 'idioma oculto sin traducciones')
igual(ep.opcionesEncabezadoPie({ header_cta2_text: 'Eventos' }).boton2, null, 'segundo botón sin enlace')
igual(ep.hrefBoton('whatsapp', { whatsapp: null, comoLlegar: null, llamar: null }), null, 'whatsapp sin número')
igual(ep.hrefBoton('/eventos', null), '/eventos', 'enlace normal')

// ─── 3. Quién pinta cada cosa ────────────────────────────────────────────────────────────────
const fuente = async (r) => readFile(join(ROOT, r), 'utf8')
const siteHeader = await fuente('components/site/SiteHeader.tsx')
const siteFooter = await fuente('components/site/SiteFooter.tsx')
for (const c of m.COMPOSICIONES_HEADER) {
  check(c === 'default' || siteHeader.includes(`case '${c}':`), `header_style '${c}' sin variante en SiteHeader`)
}
for (const c of m.COMPOSICIONES_FOOTER) {
  check(c === 'default' || siteFooter.includes(`footerStyle === '${c}'`), `footer_style '${c}' sin rama en SiteFooter`)
}
for (const f of m.FONDOS_PIE) {
  // dark y tema van por la rama por defecto de getFooterBgClass (el tema la repinta en app/globals.css)
  check(['dark', 'tema'].includes(f) || siteFooter.includes(`case '${f}':`), `footer_background '${f}' sin rama`)
}
/** opción → [archivo, texto que prueba que alguien la pinta] */
const CONSUMIDORES = {
  header_cta2_text: ['components/site/header/HeaderShared.tsx', 'opciones.boton2'],
  header_cta2_url: ['components/site/header/HeaderShared.tsx', 'hrefBoton(boton.url'],
  topbar_show_branch_status: ['components/site/header/TopbarExtras.tsx', 'opciones.topbar.estadoSede'],
  topbar_show_free_shipping: ['components/site/header/TopbarExtras.tsx', 'opciones.topbar.envioGratis'],
  topbar_show_availability: ['components/site/header/TopbarExtras.tsx', 'opciones.topbar.cupos'],
  header_show_branch_selector: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.selectorSedeEnEncabezado'],
  header_show_language: ['components/site/header/TopbarExtras.tsx', 'opciones.idiomas'],
  site_locales: ['components/site/header/TopbarExtras.tsx', 'opciones.idiomas'],
  header_booking_bar: ['components/site/header/BarraReservaHotel.tsx', 'opciones.barraReserva'],
  header_menu_source: ['components/site/SiteHeader.tsx', 'categoriasCarta'],
  mobile_bottom_bar: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.barraMovil'],
  footer_show_whatsapp: ['components/site/footer/PieExtras.tsx', 'opciones.pie.whatsapp'],
  footer_show_map: ['components/site/footer/PieExtras.tsx', 'opciones.pie.mapa'],
  footer_show_payment_methods: ['components/site/footer/PieExtras.tsx', 'opciones.pie.mediosPago'],
  header_show_currency: ['components/site/header/HeaderShared.tsx', 'opcionesShell.moneda'],
  header_text_color: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.colorTextoEncabezado'],
  header_sticky: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.fijo'],
  footer_text_color: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.pie.colorTexto'],
  footer_show_dividers: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.pie.separadores'],
}
for (const [col] of nuevas) {
  const c = CONSUMIDORES[col]
  if (!c) {
    problemas.push(`${col}: opción nueva sin consumidor registrado en este verify`)
    continue
  }
  check((await fuente(c[0])).includes(c[1]), `${col}: ${c[0]} ya no contiene «${c[1]}» (¿quién la pinta?)`)
}
// Las reglas CSS de las opciones del panel existen.
const css = await fuente('app/globals.css')
for (const atributo of ['data-encabezado-transparente', 'data-encabezado-no-fijo', 'data-encabezado-texto', 'data-pie-texto', 'data-pie-sin-separadores']) {
  check(css.includes(atributo), `app/globals.css sin reglas para [${atributo}]`)
}

if (problemas.length > 0) {
  console.error(`✗ verify-encabezado-pie: ${problemas.length} problema(s) en ${casos} casos`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-encabezado-pie: ${casos} casos (contrato, defaults = hoy y quién pinta cada opción)`)
