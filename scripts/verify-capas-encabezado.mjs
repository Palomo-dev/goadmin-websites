/**
 * verify-capas-encabezado.mjs — lo que se despliega desde la cabecera flota sobre la página: una
 * sola escala de capas y ningún panel flotante atrapado dentro del <header>.
 *
 *   npm run verify:capas-encabezado
 *
 * El bug (2026-11-25, celular de una tienda con «Al bajar: encoger» y la barra de búsqueda
 * visible): al tocar la barra salían el teclado y el cursor, pero las sugerencias se abrían detrás
 * del banner. Se pintaban dentro del <header>: recortadas por el `overflow-x: clip` de la fila del
 * celular, apiladas con el `z-40` de la cabecera (su `z-[100]` no contaba), bajo el `transform` del
 * envoltorio de «Al bajar» y, sobre portada, con el texto blanco de la cabecera.
 *
 * Qué comprueba (en el fuente; tolera CRLF):
 * 1. La escala (lib/website/capasSitio.ts): contenido < cabecera ≤ desplegables ≤ barras de abajo
 *    < cajones < menú del encabezado < buscador a pantalla < diálogos; y el alto disponible
 *    termina antes del borde visible y de la barra inferior.
 * 2. SiteHeader deja la capa de desplegables justo después del encabezado (con y sin «Al bajar») y
 *    la da por contexto; CapaEncabezado la quita (los menús van por encima).
 * 3. PanelFlotanteEncabezado: portal a la capa, `position: fixed` con la z de la escala, medida en
 *    cada cuadro (getBoundingClientRect + visualViewport), alto hasta la barra inferior, variables
 *    y `data-capa-encabezado`/`data-hdr-bp` heredados, Tab en orden y foco de vuelta al campo.
 * 4. Los desplegables pegados a un campo de la cabecera (SearchBarInput, ProductSearch) van por
 *    PanelFlotanteEncabezado: ningún `absolute top-full` suelto con `data-panel-buscador`, y el clic
 *    adentro no los cierra (el panel está en `useCerrarBuscador`).
 * 5. Ningún z-index de 40 o más en una sección del contenido, salvo los fijos con motivo.
 * 6. CSS: el menú que se desliza quita su máscara con un submenú abierto; el chat se oculta con las
 *    sugerencias abiertas en el celular; la fila del celular sigue con su `overflow-x: clip` (por eso
 *    el panel no puede ir dentro).
 * 7. La confirmación «¿Cambiar de sede?» va en CapaEncabezado (antes, el `backdrop-blur` de la fila
 *    de escritorio la encerraba en la cabecera).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const leer = (r) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n')
const problemas = []
let casos = 0
const check = (c, m) => { casos++; if (!c) problemas.push(m) }

// ─── 1. La escala ───────────────────────────────────────────────────────────────────────────────
const escala = await import('../lib/website/capasSitio.ts')
const {
  CAPA_CONTENIDO_MAX, CAPA_CABECERA, CAPA_DESPLEGABLE_CABECERA, CAPA_BARRAS_INFERIORES, CAPA_CAJONES,
  CAPA_MENU_ENCABEZADO, CAPA_BUSCADOR_PANTALLA, CAPA_DIALOGOS, altoDisponible, ALTO_MINIMO_DESPLEGABLE,
} = escala
check(CAPA_CONTENIDO_MAX < CAPA_CABECERA, 'escala: el contenido va bajo la cabecera')
check(CAPA_CABECERA <= CAPA_DESPLEGABLE_CABECERA, 'escala: el desplegable no va bajo la cabecera')
check(CAPA_DESPLEGABLE_CABECERA <= CAPA_BARRAS_INFERIORES, 'escala: el desplegable no va sobre las barras de abajo')
check(CAPA_BARRAS_INFERIORES < CAPA_CAJONES && CAPA_CAJONES < CAPA_MENU_ENCABEZADO && CAPA_MENU_ENCABEZADO < CAPA_BUSCADOR_PANTALLA && CAPA_BUSCADOR_PANTALLA < CAPA_DIALOGOS,
  'escala: barras < cajones < menú del encabezado < buscador a pantalla < diálogos')
check(CAPA_CABECERA === 40, 'escala: la cabecera es z-40 (sticky top-0 z-40 en todas las variantes)')
// Alto disponible: celular de 812 con barra inferior en 740 y el panel desde 110.
check(altoDisponible(110, 812, [740]) === 740 - 110 - 12, 'alto: termina 12 px antes de la barra inferior')
check(altoDisponible(110, 420, [740]) === 420 - 110 - 12, 'alto: con el teclado abierto termina antes del borde visible')
check(altoDisponible(110, 812, [50]) === 812 - 110 - 12, 'alto: una barra por encima del panel no cuenta')
check(altoDisponible(700, 760, []) === ALTO_MINIMO_DESPLEGABLE, 'alto: nunca menos del mínimo (se desplaza por dentro)')

// ─── 2. SiteHeader y CapaEncabezado ─────────────────────────────────────────────────────────────
const siteHeader = leer('components/site/SiteHeader.tsx')
check(/<div ref=\{setCapaDesplegables\} className="contents" data-capa-desplegables-encabezado="" \/>/.test(siteHeader), 'SiteHeader: pinta la capa de desplegables (sin caja)')
{
  const i = siteHeader.indexOf('function envolverScroll(')
  const cuerpo = i >= 0 ? siteHeader.slice(i, siteHeader.indexOf('\n  }\n', i)) : ''
  check(/if \(!scroll\.activo\) \{\s*return \(\s*<>\s*\{contenido\}\s*\{capaDeDesplegables\}\s*<\/>/.test(cuerpo), 'SiteHeader: sin «Al bajar», la capa va justo después del encabezado')
  const envoltorio = cuerpo.indexOf("'sticky top-0 z-40'")
  const capa = cuerpo.indexOf('{capaDeDesplegables}', envoltorio)
  const fija = cuerpo.indexOf('data-capa-fija-encabezado', envoltorio)
  check(envoltorio > 0 && capa > envoltorio && fija > capa, 'SiteHeader: con «Al bajar», la capa va después del envoltorio con transform (no dentro) y antes de la capa fija')
}
check(/envolverScroll\(<ProveedorCapaDesplegables value=\{capaDesplegables\}>\{nodo\}<\/ProveedorCapaDesplegables>\)/.test(siteHeader), 'SiteHeader: da la capa por contexto a todo el encabezado')
const capaEnc = leer('components/site/header/CapaEncabezado.tsx')
check(/<ProveedorCapaDesplegables value=\{null\}>\{children\}<\/ProveedorCapaDesplegables>/.test(capaEnc), 'CapaEncabezado: quita la capa de desplegables a los menús (van por encima, z 60)')

// ─── 3. PanelFlotanteEncabezado ─────────────────────────────────────────────────────────────────
const panel = leer('components/site/header/PanelFlotanteEncabezado.tsx')
check(/createPortal\(/.test(panel) && /destino\.capa,?\s*\)/.test(panel), 'Panel: portal a la capa de desplegables')
check(/position: 'fixed'/.test(panel) && /zIndex: CAPA_DESPLEGABLE_CABECERA/.test(panel), 'Panel: fijo a la pantalla con la z de la escala (no un número suelto)')
check(/el\?\.closest\('header'\)/.test(panel), 'Panel: solo sale del campo si el campo está dentro de un <header>')
check(/getBoundingClientRect\(\)/.test(panel) && /requestAnimationFrame\(medir\)/.test(panel) && /cancelAnimationFrame\(marco\)/.test(panel), 'Panel: mide el campo en cada cuadro mientras está abierto (scroll, «encoger», teclado)')
check(/window\.visualViewport/.test(panel) && /SELECTOR_BARRAS_INFERIORES/.test(panel) && /altoDisponible\(/.test(panel), 'Panel: el alto termina antes del teclado y de la barra inferior')
check(/'--alto-panel'/.test(panel), 'Panel: pasa el alto disponible al contenido (--alto-panel)')
check(/data-capa-encabezado=""/.test(panel) && /data-hdr-bp=\{destino\.bp\}/.test(panel) && /heredadoDelEncabezado\(/.test(panel), 'Panel: hereda variables, reglas del tema y punto de corte de la cabecera')
check(/p\.startsWith\('--'\)/.test(panel), 'Panel: copia solo variables CSS del <header> (sin position ni transform)')
check(/e\.key !== 'Tab'/.test(panel) && /enPanel\[0\]\.focus\(\)/.test(panel) && /DOCUMENT_POSITION_FOLLOWING/.test(panel), 'Panel: el Tab sigue el orden de siempre (campo → panel → lo que sigue)')
check(/focoDentro &&/.test(panel) && /querySelector<HTMLElement>\('input, button'\)\?\.focus\(\{ preventScroll: true \}\)/.test(panel), 'Panel: al cerrar con el foco dentro, vuelve al campo')
check(/setAttribute\('data-buscador-abierto'/.test(panel), 'Panel: marca <html> para ocultar el chat en el celular')
check(/r\.bottom > 0/.test(panel), 'Panel: con «ocultar» el panel no queda flotando sin su campo')
check(/className=\{\[className, enLinea\.className\]/.test(panel), 'Panel: fuera de una cabecera se pinta donde siempre (absolute bajo el campo)')

// ─── 4. Los desplegables de los campos de la cabecera ───────────────────────────────────────────
for (const [ruta, nombre] of [['components/site/SearchBarInput.tsx', 'SearchBarInput'], ['components/site/ProductSearch.tsx', 'ProductSearch']]) {
  const src = leer(ruta)
  check(/<PanelFlotanteEncabezado\b/.test(src), `${nombre}: el desplegable va por PanelFlotanteEncabezado`)
  // Ningún panel marcado `data-panel-buscador` fuera del componente.
  const sueltos = [...src.matchAll(/<div\b[^>]*data-panel-buscador/g)]
  check(sueltos.length === 0, `${nombre}: hay un <div data-panel-buscador> suelto dentro de la cabecera (debe ir en PanelFlotanteEncabezado)`)
  check(/refPanel=\{panelRef\}/.test(src) && /useCerrarBuscador\(.*panelRef\]\)/.test(src), `${nombre}: el clic dentro del panel (fuera del <header>) no lo cierra`)
  check(/max-h-\[min\(\d+vh,var\(--alto-panel,\d+vh\)\)\]/.test(src), `${nombre}: el contenido respeta el alto disponible`)
}
check(/className="hidden md:block"/.test(leer('components/site/ProductSearch.tsx')), 'ProductSearch: el panel de escritorio conserva `hidden md:block` también fuera del <header>')
{
  const barra = leer('components/site/SearchBarInput.tsx')
  check(/role="combobox"/.test(barra) && /aria-expanded=\{abiertoPanel\}/.test(barra) && /aria-controls=\{abiertoPanel \? panelId : undefined\}/.test(barra) && /id=\{panelId\}/.test(barra), 'SearchBarInput: combobox con aria-expanded/aria-controls al panel')
  check(/<div className="p-4 space-y-5 overflow-y-auto">/.test(barra), 'SearchBarInput: recientes y populares se desplazan si el alto no alcanza')
}

// ─── 5. Ningún z-index ≥ 40 dentro de las secciones ─────────────────────────────────────────────
function archivos(dir) {
  const out = []
  for (const n of readdirSync(join(raiz, dir))) {
    const r = join(dir, n)
    if (statSync(join(raiz, r)).isDirectory()) out.push(...archivos(r))
    else if (/\.tsx$/.test(n)) out.push(relative(raiz, join(raiz, r)).replace(/\\/g, '/'))
  }
  return out
}
// Con motivo: barras fijas de abajo (van después en el DOM), cajones y modales (por encima de todo).
const PERMITIDO_SECCIONES = /(^|\s)fixed(\s|$)/
// Excepciones con motivo: archivo → cuántas clases con z ≥ 40 se aceptan. Si cambian, revisar.
const EXCEPCIONES_SECCIONES = {
  // Selector de huéspedes del hero de hotel: desplegable propio de la sección que se abre con clic
  // y cierra al tocar fuera; necesita quedar sobre las tarjetas del hero. Solo pisa la cabecera si
  // se desplaza la página con él abierto. Pendiente: llevarlo a la escala (z-30) con prueba visual.
  'components/sections/hero/HeroBookingWidget.tsx': 1,
}
const vistosExcepcion = {}
for (const ruta of archivos('components/sections')) {
  const src = leer(ruta)
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const clase = m[1] ?? m[2] ?? m[3] ?? ''
    const z = clase.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/)
    const valor = z ? Number(z[1] ?? z[2]) : 0
    if (valor < 40 || PERMITIDO_SECCIONES.test(clase)) continue
    if (EXCEPCIONES_SECCIONES[ruta]) { vistosExcepcion[ruta] = (vistosExcepcion[ruta] ?? 0) + 1; continue }
    const linea = src.slice(0, m.index).split('\n').length
    check(false, `${ruta}:${linea}: z-${valor} en una sección no fija tapa la cabecera y sus desplegables (máximo z-${CAPA_CONTENIDO_MAX})`)
  }
}

for (const [ruta, n] of Object.entries(EXCEPCIONES_SECCIONES)) {
  check(vistosExcepcion[ruta] === n, `${ruta}: la excepción de z-index ya no coincide (${vistosExcepcion[ruta] ?? 0} en vez de ${n}); revisa EXCEPCIONES_SECCIONES`)
}

// ─── 6. CSS ─────────────────────────────────────────────────────────────────────────────────────
const css = leer('app/globals.css')
check(/header nav\[data-nav-desliza\]\[data-nav-oculto\]:has\(\.absolute\.top-full\) \{\s*-webkit-mask-image: none;\s*mask-image: none;/.test(css), 'CSS: el menú que se desliza quita la máscara con un submenú abierto')
check(/@media \(max-width: 767px\) \{\s*html\[data-buscador-abierto\] \[data-gochat-widget\] \{\s*display: none !important;/.test(css), 'CSS: el chat no tapa las sugerencias en el celular')
check(/\.px-4:has\(> \[data-fila-movil\]\)[\s\S]{0,200}overflow-x: clip;/.test(css), 'CSS: la fila del celular sigue recortando (si cambió, revisa el comentario de capasSitio.ts)')

// ─── 7. Selector de sede ────────────────────────────────────────────────────────────────────────
{
  const sede = leer('components/site/header/SelectorSede.tsx')
  const i = sede.indexOf('<CapaEncabezado abierta={!!destino}')
  const j = sede.indexOf('</CapaEncabezado>')
  const k = sede.indexOf('fixed inset-0 z-[60]')
  check(i > 0 && k > i && j > k, 'SelectorSede: la confirmación «¿Cambiar de sede?» va en CapaEncabezado')
}

if (problemas.length) {
  console.error(`✗ verify-capas-encabezado: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-capas-encabezado: ${casos} comprobaciones`)
