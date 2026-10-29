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
let m, ep, estilo, espacio, contraste, colores
try {
  m = await cargar('lib/website/v2/mapeoAjustes.ts', 'mapeoAjustes.mjs')
  ep = await cargar('lib/website/encabezadoPie.ts', 'encabezadoPie.mjs', [["from './v2/mapeoAjustes'", "from './mapeoAjustes.mjs'"]])
  estilo = await cargar('lib/website/encabezadoEstilo.ts', 'encabezadoEstilo.mjs')
  espacio = await cargar('lib/website/espacioHeader.ts', 'espacioHeader.mjs')
  contraste = await cargar('lib/website/v2/contrasteColor.ts', 'contrasteColor.mjs')
  colores = await cargar('lib/headerColors.ts', 'headerColors.mjs', [
    ["from './website/v2/contrasteColor'", "from './contrasteColor.mjs'"],
    ["from './website/encabezadoEstilo'", "from './encabezadoEstilo.mjs'"],
  ])
} finally {
  // los módulos ya están en memoria
}
await rm(dir, { recursive: true, force: true })

// ─── 1. Contrato ─────────────────────────────────────────────────────────────────────────────
const nuevas = Object.entries(m.OPCIONES_SHELL).filter(([, d]) => d.nueva)
// JSON del documento, sin columna ni regla escalar: un objeto se conserva tal cual.
const JSON_SIN_REGLA = new Set(['header_menu2_links', 'header_menu3_links', 'header_menu4_links', 'header_icons_box', 'mobile_header', 'header_builder'])
check(nuevas.length === 69, `se esperaban 69 opciones nuevas y hay ${nuevas.length}`)
for (const [col, def] of nuevas) {
  check(!!def.regla || JSON_SIN_REGLA.has(col), `${col} no declara regla`)
  if (def.regla && def.porDefecto !== null) check(m.cumpleRegla(def.regla, def.porDefecto), `${col}: su default no cumple su regla`)
  check(!m.COLUMNAS_IMPORTADAS.includes(col), `${col} está en COLUMNAS_IMPORTADAS (rompe el select legacy sin migración)`)
  igual(m.normalizarOpcionShell(col, undefined), def.porDefecto, `${col} ausente`)
  igual(m.normalizarOpcionShell(col, null), def.porDefecto, `${col} nulo`)
  if (def.regla) igual(m.normalizarOpcionShell(col, { basura: 1 }), def.porDefecto, `${col} con un objeto`)
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
igual(n('mobile_menu_text_color', '#fff'), '#fff', 'color de menú corto')
igual(n('mobile_menu_text_color', 'red; x'), null, 'color de menú con CSS inyectado')
igual(n('mobile_menu_text_color', 'expression(alert(1))'), null, 'color de menú con expresión')
igual(n('header_mobile_icon_color', '#101010;background:url(//x)'), null, 'ícono móvil con CSS inyectado')
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
  header_divider: ['components/site/header/HeaderShared.tsx', 'header_divider'],
  header_divider_color: ['components/site/header/HeaderShared.tsx', 'header_divider_color'],
  header_hover_color: ['components/site/header/HeaderShared.tsx', 'header_hover_color'],
  header_icons_weight: ['components/site/header/HeaderShared.tsx', 'header_icons_weight'],
  header_cart_glyph: ['components/site/header/HeaderShared.tsx', 'header_cart_glyph'],
  header_icons_circle: ['components/site/header/HeaderShared.tsx', 'header_icons_circle'],
  mobile_sticky_header: ['components/site/header/HeaderShared.tsx', 'mobile_sticky_header'],
  mobile_breakpoint: ['components/site/SiteHeader.tsx', 'mobile_breakpoint'],
  header_icons_circle_bg: ['lib/website/colorCirculoIconos.ts', 'header_icons_circle_bg'],
  header_icons_circle_fg: ['lib/website/colorCirculoIconos.ts', 'header_icons_circle_fg'],
  mobile_logo_position: ['lib/website/logoEncabezado.ts', 'mobile_logo_position'],
  mobile_search_bar_categories: ['lib/website/opcionUnica.ts', 'mobile_search_bar_categories'],
  header_layout: ['components/site/SiteHeader.tsx', 'header_layout'],
  header_scroll: ['components/site/SiteHeader.tsx', 'header_scroll'],
  mobile_header: ['lib/website/menuMovil.ts', 'mobile_header'],
  header_builder: ['lib/website/constructorEncabezado.ts', 'header_builder'],
  header_cta3_text: ['lib/website/constructorEncabezado.ts', 'header_cta3_text'],
  header_cta3_url: ['lib/website/constructorEncabezado.ts', 'header_cta3_url'],
  header_cta4_text: ['lib/website/constructorEncabezado.ts', 'header_cta4_text'],
  header_cta4_url: ['lib/website/constructorEncabezado.ts', 'header_cta4_url'],
  header_cta5_text: ['lib/website/constructorEncabezado.ts', 'header_cta5_text'],
  header_cta5_url: ['lib/website/constructorEncabezado.ts', 'header_cta5_url'],
  header_cta6_text: ['lib/website/constructorEncabezado.ts', 'header_cta6_text'],
  header_cta6_url: ['lib/website/constructorEncabezado.ts', 'header_cta6_url'],
  header_menu2_label: ['lib/website/constructorEncabezado.ts', 'header_menu2_label'],
  header_menu2_links: ['lib/website/constructorEncabezado.ts', 'header_menu2_links'],
  header_menu3_label: ['lib/website/constructorEncabezado.ts', 'header_menu3_label'],
  header_menu3_links: ['lib/website/constructorEncabezado.ts', 'header_menu3_links'],
  header_menu4_label: ['lib/website/constructorEncabezado.ts', 'header_menu4_label'],
  header_menu4_links: ['lib/website/constructorEncabezado.ts', 'header_menu4_links'],
  header_extra_buttons_style: ['lib/website/constructorEncabezado.ts', 'header_extra_buttons_style'],
  header_icons_box: ['lib/website/constructorEncabezado.ts', 'header_icons_box'],
  header_transparent_over_hero: ['lib/website/espacioHeader.ts', 'header_transparent_over_hero'],
  first_section_offset_px: ['lib/website/espacioHeader.ts', 'first_section_offset_px'],
  mobile_menu_bg_color: ['lib/headerColors.ts', 'mobile_menu_bg_color'],
  mobile_menu_text_color: ['lib/headerColors.ts', 'mobile_menu_text_color'],
  mobile_menu_link_hover_color: ['lib/headerColors.ts', 'mobile_menu_link_hover_color'],
  mobile_menu_link_active_color: ['lib/headerColors.ts', 'mobile_menu_link_active_color'],
  mobile_menu_title_color: ['lib/headerColors.ts', 'mobile_menu_title_color'],
  mobile_menu_divider_color: ['lib/headerColors.ts', 'mobile_menu_divider_color'],
  mobile_menu_currency_text_color: ['lib/headerColors.ts', 'mobile_menu_currency_text_color'],
  mobile_menu_currency_border_color: ['lib/headerColors.ts', 'mobile_menu_currency_border_color'],
  mobile_menu_currency_bg_color: ['lib/headerColors.ts', 'mobile_menu_currency_bg_color'],
  mobile_menu_login_bg_color: ['lib/headerColors.ts', 'mobile_menu_login_bg_color'],
  mobile_menu_login_text_color: ['lib/headerColors.ts', 'mobile_menu_login_text_color'],
  mobile_menu_register_border_color: ['lib/headerColors.ts', 'mobile_menu_register_border_color'],
  mobile_menu_register_text_color: ['lib/headerColors.ts', 'mobile_menu_register_text_color'],
  mobile_menu_logout_color: ['lib/headerColors.ts', 'mobile_menu_logout_color'],
  header_mobile_icon_color: ['lib/headerColors.ts', 'header_mobile_icon_color'],
  footer_text_color: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.pie.colorTexto'],
  footer_show_dividers: ['components/site/OrganizationLayoutCliente.tsx', 'opcionesShell.pie.separadores'],
}
// El editor la guarda. El default `icono` es el encabezado de hoy y ninguna pantalla lee otro valor.
const SIN_PINTOR = new Set(['header_actions_style'])
for (const [col, def] of nuevas) {
  if (SIN_PINTOR.has(col)) {
    check(def.porDefecto === 'icono', `${col} cambió su default; hace falta quien lo pinte`)
    continue
  }
  const c = CONSUMIDORES[col]
  if (!c) {
    problemas.push(`${col}: opción nueva sin consumidor registrado en este verify`)
    continue
  }
  check((await fuente(c[0])).includes(c[1]), `${col}: ${c[0]} ya no contiene «${c[1]}» (¿quién la pinta?)`)
}
const encabezado = await fuente('components/site/header/HeaderShared.tsx')
check(encabezado.includes('header_text_color') && encabezado.includes("'--header-fg'") && encabezado.includes('text-current'), 'el encabezado lee header_text_color y pinta con --header-fg')
check(encabezado.includes('const heredarColor = Boolean(headerTextColor(settings))'), 'el celular hereda el color: la barra usa el mismo fondo que el computador')
check(encabezado.includes('export function BloqueMonedaMovil') && encabezado.includes('!opcionesShell.moneda'), 'el menú móvil no pinta «Moneda» si el encabezado la apagó')
check(!encabezado.includes('hover:bg-gray-50') || !encabezado.slice(encabezado.indexOf('function MobileCurrencyChips')).includes('hover:bg-gray-50'), 'el selector de moneda móvil no usa bg-gray: eso le quita el color del encabezado')
check(encabezado.includes("'--header-hover'") && encabezado.includes('header_hover_color'), 'el encabezado define --header-hover')
check(encabezado.includes('header_divider') && encabezado.includes("'--header-divider'"), 'el encabezado define --header-divider')
check(encabezado.includes('divisorEncendido'), 'con el divisor apagado se quita el borde')
igual(estilo.lavadoSegunFondo('#101010'), estilo.LAVADO_OSCURO, 'fondo oscuro')
igual(estilo.lavadoSegunFondo('#ffffff'), estilo.LAVADO_CLARO, 'fondo claro')
igual(estilo.lavadoSegunFondo('#fff'), estilo.LAVADO_CLARO, 'fondo claro corto')
igual(estilo.lavadoSegunFondo(null), null, 'sin fondo, lo decide el CSS')
igual(estilo.lavadoSegunFondo('red;x'), null, 'fondo inválido')
igual(estilo.colorHoverEfectivo('#abc', '#101010'), '#abc', 'hover guardado gana')
igual(estilo.colorHoverEfectivo(null, '#101010'), estilo.LAVADO_OSCURO, 'hover por luminancia')
igual(estilo.colorDivisorEfectivo('', '#ffffff'), estilo.LAVADO_CLARO, 'divisor por luminancia')
check(estilo.divisorEncendido(undefined) === true && estilo.divisorEncendido(false) === false, 'divisor ausente encendido y false apagado')
igual(estilo.estiloIconosEncabezado(null), { relleno: false, circulo: false, forma: null }, 'sin estilo de iconos se queda el contorno y cart_icon')
igual(
  estilo.estiloIconosEncabezado({ header_icons_weight: 'relleno', header_cart_glyph: 'carrito', header_icons_circle: true }),
  { relleno: true, circulo: true, forma: 'carrito' },
  'relleno, carrito y círculo',
)
igual(estilo.estiloIconosEncabezado({ header_cart_glyph: 'otro' }).forma, null, 'una forma desconocida no pisa cart_icon')
igual(estilo.estiloIconosEncabezado({ header_icons_weight: 'contorno', header_cart_glyph: 'bolsa' }), { relleno: false, circulo: false, forma: 'bolsa' }, 'bolsa en contorno')
const cssVars = await fuente('app/globals.css')
check(cssVars.includes('--header-hover') && cssVars.includes('--header-divider') && cssVars.includes('--mm-bg') && cssVars.includes('--hdr-mobile-icon'), 'el CSS declara el hover, el divisor y los colores del menú móvil')
check(!cssVars.includes(':not(.bg-white *)'), 'la regla rota que dependía de no estar dentro de .bg-white sigue en el CSS')
for (const ruta of [
  'components/site/header/HeaderCentered.tsx',
  'components/site/header/HeaderMega.tsx',
  'components/site/header/HeaderClassic.tsx',
  'components/site/header/HeaderSplit.tsx',
  'components/site/header/HeaderMinimal.tsx',
]) {
  const src = await fuente(ruta)
  check(src.includes('estiloDivisor(settings') && src.includes('variablesEncabezado(settings)'), `${ruta} no usa el divisor configurable`)
  check(!src.includes('border-b border-gray-200'), `${ruta} sigue con el borde gris fijo`)
}
for (const ruta of [
  'components/site/header/mobile/MobileDrawer.tsx',
  'components/site/header/mobile/MobileFullscreen.tsx',
  'components/site/header/mobile/MobileTabs.tsx',
  'components/site/header/mobile/MobileBottomSheet.tsx',
]) {
  const src = await fuente(ruta)
  check(src.includes('estiloBarraEncabezado(settings') && src.includes('variablesEncabezado(settings') && src.includes('estiloPanelMenu(settings'), `${ruta} no pinta el fondo del encabezado ni el contraste del menú`)
  check(!src.includes('bg-white'), `${ruta} sigue con fondo blanco fijo`)
}
for (const ruta of ['components/site/ProductSearch.tsx', 'components/site/CartIndicator.tsx']) {
  const src = await fuente(ruta)
  check(src.includes('hover:bg-[var(--header-hover)]') && !src.includes('hover:bg-gray-100'), `${ruta} sigue con el círculo gris del hover`)
}
// Las reglas CSS de las opciones del panel existen.
const css = await fuente('app/globals.css')
for (const atributo of ['data-encabezado-transparente', 'data-encabezado-no-fijo', 'data-encabezado-texto', 'data-pie-texto', 'data-pie-sin-separadores']) {
  check(css.includes(atributo), `app/globals.css sin reglas para [${atributo}]`)
}

// ─── 3b. Contraste del menú móvil ──────────────────────────────────────────────────────────────
{
  const razon = (a, b) => contraste.contraste(a, b)
  const pasa = (a, b, msg) => check((razon(a, b) ?? 0) >= 4.5, `${msg}: ${razon(a, b)} (${a} sobre ${b})`)
  const temaClaro = { fondo: '#ffffff', oscuro: false, primario: '#111827' }
  const hoy = colores.resolverColoresMenuMovil(null, temaClaro)
  const varsHoy = colores.variablesMenuMovil(null, temaClaro)
  check(hoy.fijar === false, 'sin colores ni fondo propio no se fijan variables')
  igual(hoy.texto, '#374151', 'texto claro = gray-700')
  igual(hoy.titulo, '#111827', 'título claro = gray-900')
  igual(hoy.textoSuave, '#4b5563', 'enlace hijo = gray-600')
  igual(hoy.divisor, '#f3f4f6', 'divisor claro = gray-100')
  igual(hoy.monedaTexto, '#6b7280', 'rótulo Moneda = gray-500')
  igual(hoy.monedaValor, '#111827', 'select de moneda = gray-900')
  igual(hoy.iconoBarra, '#374151', 'ícono de la barra = gray-700')
  igual(varsHoy, {}, 'sin colores el CSS conserva los grises (el modo oscuro puede cambiarlos)')
  const otra = colores.variablesMenuMovil(null, temaClaro)
  igual(varsHoy, otra, 'el resolvedor es estable')

  const oscuro = colores.resolverColoresMenuMovil({ header_bg_color: '#101010', header_opacity: 95 }, temaClaro)
  check(oscuro.fijar === true, 'encabezado #101010 fija el menú')
  pasa(oscuro.texto, oscuro.fondo, 'texto sobre #101010')
  pasa(oscuro.titulo, oscuro.fondo, 'título sobre #101010')
  pasa(oscuro.textoSuave, oscuro.fondo, 'enlace hijo sobre #101010')
  pasa(oscuro.monedaTexto, oscuro.fondo, 'Moneda sobre #101010')
  pasa(oscuro.monedaValor, oscuro.fondo, 'select sobre #101010')
  pasa(oscuro.iconoBarra, oscuro.fondoBarra, 'hamburguesa sobre la barra')
  pasa(oscuro.loginTexto, oscuro.loginFondo, 'entrar sobre su botón')
  pasa(oscuro.registroTexto, oscuro.fondo, 'registrarse sobre el menú')
  pasa(oscuro.salir, oscuro.fondo, 'cerrar sesión sobre el menú')
  const varsOscuro = colores.variablesMenuMovil({ header_bg_color: '#101010' }, temaClaro)
  check(typeof varsOscuro['--mm-fg'] === 'string' && typeof varsOscuro['--hdr-mobile-icon'] === 'string', 'el encabezado oscuro publica --mm-fg y --hdr-mobile-icon')

  const inyectado = colores.resolverColoresMenuMovil({ header_bg_color: '#101010', mobile_menu_text_color: 'red; x' }, temaClaro)
  igual(inyectado.texto, oscuro.texto, 'CSS inyectado no pinta el texto')
  const verde = colores.resolverColoresMenuMovil({ header_bg_color: '#101010', mobile_menu_text_color: '#00ff00' }, temaClaro)
  pasa(verde.texto, verde.fondo, 'un verde pedido sigue legible')
  check(verde.texto.toUpperCase() !== oscuro.texto.toUpperCase(), 'un color pedido no se ignora')

  const claro = colores.resolverColoresMenuMovil({ header_bg_color: '#ffffff' }, temaClaro)
  pasa(claro.texto, claro.fondo, 'encabezado blanco')
  check(!esOscuroTexto(claro.texto, claro.fondo), 'encabezado blanco no invierte a texto claro')

  const opaco = colores.resolverColoresMenuMovil({ header_bg_color: '#101010', header_opacity: 40 }, { fondo: '#ffffff', primario: '#111827' })
  pasa(opaco.texto, opaco.fondo, 'encabezado oscuro al 40 %')
  const lavado = colores.resolverColoresMenuMovil({ header_bg_color: '#000000', header_opacity: 0 }, { fondo: '#ffffff', primario: '#111827' })
  pasa(lavado.texto, lavado.fondo, 'opacidad 0 queda sobre el fondo claro')

  const temaOscuro = colores.variablesMenuMovil(null, { fondo: '#0E0E0E', oscuro: true, primario: '#C8A97E' })
  check(!('--mm-fg' in temaOscuro), 'el tema oscuro sin encabezado propio lo pinta el CSS')
  pasa(temaOscuro['--mm-login-text'] || '#FFFFFF', '#C8A97E', 'entrar sobre un acento claro')

  const menuClaro = colores.resolverColoresMenuMovil({ header_bg_color: '#101010', mobile_menu_bg_color: '#ffffff', mobile_menu_text_color: '#111827' }, temaClaro)
  pasa(menuClaro.texto, menuClaro.fondo, 'menú claro sobre barra oscura')
  pasa(menuClaro.iconoBarra, menuClaro.fondoBarra, 'la hamburguesa sigue la barra, no el menú')
}
function esOscuroTexto(texto, fondo) {
  const r = contraste.contraste(texto, fondo) ?? 0
  const lumTexto = estilo.luminanciaHex(texto) ?? 1
  const lumFondo = estilo.luminanciaHex(fondo) ?? 1
  return r >= 4.5 && lumTexto > lumFondo && lumFondo > 0.5
}

// ─── 4. Hojas del menú del celular ─────────────────────────────────────────────────────────────
// Producción (org 140, «Menú en el celular = Hoja inferior»): el `Drawer.Content` de vaul sin
// `Drawer.Portal` ni posición fija se pintaba EN LÍNEA dentro de la fila del encabezado al abrir
// la hoja: encabezado altísimo con el logo y los botones en el medio, la hoja recortada a la
// derecha y el buscador abajo. Toda hoja de vaul del sitio va en un portal y es `fixed`.
{
  const archivos = ['components/site/header/mobile/MobileBottomSheet.tsx']
  for (const ruta of archivos) {
    const src = await fuente(ruta)
    const aperturas = [...src.matchAll(/<Drawer\.Content\b[^>]*>/g)]
    check(aperturas.length > 0, `${ruta}: no se encontró <Drawer.Content> (¿cambió la hoja? actualiza este verify)`)
    for (const a of aperturas) {
      const antes = src.slice(0, a.index)
      const abre = antes.lastIndexOf('<Drawer.Portal')
      const cierra = antes.lastIndexOf('</Drawer.Portal>')
      check(abre > cierra, `${ruta}: <Drawer.Content> fuera de <Drawer.Portal> (se pinta en línea dentro del encabezado)`)
      const clase = /className="([^"]*)"/.exec(a[0])?.[1] ?? ''
      check(/(^|\s)fixed(\s|$)/.test(clase) && /(^|\s)bottom-0(\s|$)/.test(clase), `${ruta}: <Drawer.Content> sin «fixed … bottom-0» (la hoja no queda abajo)`)
    }
    check(/<Drawer\.Overlay\b/.test(src), `${ruta}: la hoja no tiene <Drawer.Overlay>`)
    // El portal va al propio <header>: así heredan el tema V2 y el modo oscuro de la raíz.
    check(/<Drawer\.Portal\s+container=\{headerEl\}/.test(src) && /<header\s+ref=\{setHeaderEl\}/.test(src),
      `${ruta}: el portal de la hoja ya no va al <header> (perdería el tema V2 y el modo oscuro)`)
    // Abierta, por encima de las barras fijas del celular (BarraMovilGiro / MobileCTABar, z-40).
    check(src.includes("open ? 'z-[60]' : 'z-40'"), `${ruta}: abierta, la hoja queda bajo la barra fija del celular`)
  }
}

igual(espacio.offsetPrimeraPx(null), 0, 'sin ajustes el hueco de la primera sección es 0')
igual(espacio.offsetPrimeraPx({ first_section_offset_px: 16 }), 16, 'el offset en px se respeta')
igual(espacio.offsetPrimeraPx({ first_section_offset_px: 999 }), 0, 'un offset fuera de rango vuelve a 0')
check(espacio.heroSolapa(null, undefined) === false, 'sin claves el hero no solapa')
check(espacio.heroSolapa(null, true) === true, 'overlap_header true sigue siendo el alias')
check(espacio.heroSolapa({ header_transparent_over_hero: false }, true) === false, 'el interruptor en falso apaga el alias')
check(espacio.heroSolapa({ header_transparent_over_hero: true }, false) === false, 'la sección puede apagar el solape del sitio')
check(espacio.heroSolapa({ header_style: 'transparent' }, undefined) === true, 'la variante transparente sigue solapando')
check(espacio.heroSolapa({ header_style: 'transparent', header_transparent_over_hero: false }, undefined) === false, 'falso explícito apaga también la variante transparente')
check(espacio.headerSobreHero({ header_transparent_over_hero: true }) === true, 'el interruptor saca el header del flujo')
check(espacio.headerSobreHero({}) === false, 'sin interruptor el header sigue en el flujo')
check(! (await fuente('components/sections/hero/HeroFullscreen.tsx')).includes('marginTop:'), 'el hero ya no sube con margen negativo')
check((await fuente('components/sections/SectionWrapper.tsx')).includes('isFirst'), 'SectionWrapper recibe la primera sección')
check((await fuente('app/globals.css')).includes('data-header-sobre-hero') && (await fuente('app/globals.css')).includes('data-encabezado-no-fijo'), 'el CSS del header transparente no borra data-encabezado-no-fijo')

if (problemas.length > 0) {
  console.error(`✗ verify-encabezado-pie: ${problemas.length} problema(s) en ${casos} casos`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-encabezado-pie: ${casos} casos (contrato, defaults = hoy y quién pinta cada opción)`)
