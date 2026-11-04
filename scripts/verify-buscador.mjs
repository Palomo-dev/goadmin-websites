/**
 * verify-buscador.mjs — buscador del encabezado: búsquedas populares y reglas comunes.
 *
 *   npm run verify:buscador
 *
 * 1. `search_popular` (shell.header.opciones): lista de textos validada (regla `listaTextos`);
 *    sin valor, las primeras categorías del menú; nunca la lista genérica de antes.
 * 2. Desplegable con ancho propio (mín. 360px; la lupa 384px) y dentro de la pantalla.
 * 3. Un solo comportamiento (buscador/comportamiento.ts) para la barra y la lupa.
 * 4. La barra nunca se aplasta: min-w 240px en la fila o baja a una segunda fila (useBarraAbajo).
 * 5. El menú que no cabe pasa a «Más» (NavList): nunca texto cortado.
 * 6. «Barra compacta» se abre encima del menú sin empujar la fila.
 */
import { readFileSync } from 'node:fs'
import { normalizarOpcionShell, OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'
import { busquedasPopulares, categoriasVisibles, MAX_BUSQUEDAS_POPULARES_CATEGORIAS } from '../lib/website/busquedasPopulares.ts'
import { ANCHO_MINIMO_PANEL, posicionPanel } from '../lib/website/posicionPanelBuscador.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8')

// ── 1. search_popular ──
const op = OPCIONES_SHELL.search_popular
check(op && op.zona === 'header' && op.porDefecto === null && op.nueva === true && op.regla?.tipo === 'listaTextos' && op.regla.max === 8 && op.regla.largo === 30, 'search_popular registrada (header, null, listaTextos 8×30)')
igual(normalizarOpcionShell('search_popular', ['  Sillas  ergonómicas ', 'Escritorios']), ['Sillas ergonómicas', 'Escritorios'], 'recorta y normaliza espacios')
for (const malo of [[], 'Ofertas', ['a', 'A'], ['x'.repeat(31)], ['ok', 3], ['   '], Array.from({ length: 9 }, (_, i) => `b${i}`)]) {
  igual(normalizarOpcionShell('search_popular', malo), null, `inválido ${JSON.stringify(malo).slice(0, 40)} → null`)
}
const cats = [{ name: 'Sillas' }, { name: 'Escritorios' }, { name: ' sillas ' }, { name: '' }, { name: 'Archivadores' }, { name: 'Papelería' }, { name: 'Tecnología' }]
igual(busquedasPopulares(['Ofertas'], cats), ['Ofertas'], 'configuradas mandan')
igual(busquedasPopulares(null, cats), ['Sillas', 'Escritorios', 'Archivadores', 'Papelería'], 'sin configurar: primeras categorías del menú (sin repetir ni vacías)')
check(MAX_BUSQUEDAS_POPULARES_CATEGORIAS === 4, 'hasta 4 categorías')
igual(busquedasPopulares(null, []), [], 'sin categorías: nada (nunca la lista genérica)')
igual(busquedasPopulares([], undefined), [], 'lista vacía y sin categorías: nada')
igual(categoriasVisibles({ show_categories_in_header: false, footer_show_categories: false }, cats), [], 'sin ajustes de mostrarlas: no se muestran en encabezado ni pie')
igual(categoriasVisibles(null, cats), [], 'sin ajustes: no se muestran')
igual(categoriasVisibles({ show_categories_in_header: true }, cats).length, cats.length, 'encabezado: se muestran')
igual(categoriasVisibles({ footer_show_categories: true }, cats).length, cats.length, 'pie: se muestran')
igual(busquedasPopulares(null, cats).length, 4, 'las populares no dependen de esos ajustes: 4 categorías')
for (const f of ['components/site/SearchBarInput.tsx', 'components/site/ProductSearch.tsx']) {
  const src = leer(f)
  check(!/'Ofertas', 'Nuevo', 'Tenis', 'Accesorios'/.test(src) && !src.includes("'Tenis'"), `${f}: sin la lista genérica`)
  check(src.includes('const { busquedasPopulares: popularSearches } = useEncabezadoPie()'), `${f}: lee las populares del contexto`)
  check(src.includes('popularSearches.length > 0 && ('), `${f}: sin populares no pinta el bloque`)
}
const layout = leer('components/site/OrganizationLayoutCliente.tsx')
check(layout.includes('busquedasPopulares: busquedasPopulares(opcionesShell.busquedasPopulares, categoriasBusqueda && categoriasBusqueda.length > 0 ? categoriasBusqueda : menuCategories),'), 'el layout resuelve configuradas o las categorías de la tienda (no las que se muestran)')
const layoutServidor = leer('components/site/OrganizationLayout.tsx')
check(/props\.categoriasBusqueda \?\? getMenuCategories\(props\.organization\.id, /.test(layoutServidor) && layoutServidor.includes('categoriasBusqueda={nombresBusqueda}') && layoutServidor.includes('categoriasBusqueda.slice(0, 8).map((c) => ({ name: c.name }))'), 'OrganizationLayout carga las categorías del buscador sin depender de los ajustes de mostrarlas')
const ctxOrg = leer('lib/get-org-context.ts')
check(ctxOrg.includes('const categoriasTienda = await getMenuCategories(organization.id, branchId)') && ctxOrg.includes('const menuCategories = categoriasVisibles(settings, categoriasTienda)'), 'getOrgContext: categorías de la tienda siempre; las visibles según los ajustes')
{
  const mod = leer('lib/website/busquedasPopulares.ts')
  check(mod.includes('export function categoriasVisibles<T>('), 'categoriasVisibles existe')
}
check(leer('lib/website/encabezadoPie.ts').includes("busquedasPopulares: leer(ajustes, 'search_popular') as string[] | null,"), 'opcionesEncabezadoPie lee search_popular validado')
check(leer('components/site/useAjustesVivosPreview.ts').includes("'search_popular'"), 'la vista previa del editor la aplica en vivo')

// ── 2. Posición del desplegable ──
check(ANCHO_MINIMO_PANEL === 360, 'mínimo 360px')
const vw = 1024
const angosto = posicionPanel({ left: 600, right: 715, width: 115 }, vw)
check(angosto.width === 360 && 600 + angosto.left + 360 <= vw - 8, `input de 115px a 1024: panel de 360 dentro de la pantalla (${JSON.stringify(angosto)})`)
const ancho = posicionPanel({ left: 300, right: 876, width: 576 }, 1440)
check(ancho.width === 576 && ancho.left === 0, 'input ancho: el panel lo sigue (como hoy)')
const celular = posicionPanel({ left: 16, right: 374, width: 358 }, 390)
check(celular.width === 358 && celular.left === 0, `celular 390 con barra a todo el ancho: el panel la sigue, sin descuadrarse (${JSON.stringify(celular)})`)
const celularAngosto = posicionPanel({ left: 16, right: 216, width: 200 }, 390)
check(celularAngosto.width === 358 && 16 + celularAngosto.left + celularAngosto.width <= 382, `celular 390 con barra angosta: panel de 358 dentro de la pantalla (${JSON.stringify(celularAngosto)})`)
const muyAngosto = posicionPanel({ left: 10, right: 300, width: 290 }, 340)
check(muyAngosto.width === 308 && 10 + muyAngosto.left >= 8 && 10 + muyAngosto.left + 308 <= 332, `pantalla de 340: el panel nunca se sale (${JSON.stringify(muyAngosto)})`)
const megaCelular = posicionPanel({ left: 110, right: 328, width: 218 }, 390)
check(megaCelular.width === 358 && 110 + megaCelular.left + 358 <= 382, `celular 390 con «Buscador grande» (campo tras el selector): panel de 358 dentro de la pantalla (${JSON.stringify(megaCelular)})`)
const lupaIzq = posicionPanel({ left: 20, right: 60, width: 40 }, 1024, { ancho: 384, minimo: 320, alinear: 'derecha' })
check(lupaIzq.width === 384 && 20 + lupaIzq.left === 8, 'lupa cerca del borde izquierdo: el panel se corre adentro')
const lupaDer = posicionPanel({ left: 960, right: 1000, width: 40 }, 1024, { ancho: 384, minimo: 320, alinear: 'derecha' })
check(lupaDer.width === 384 && 960 + lupaDer.left + 384 === 1000, 'lupa a la derecha: el panel termina en la lupa (como hoy)')

// ── 3. Un solo comportamiento ──
const barra = leer('components/site/SearchBarInput.tsx')
const lupa = leer('components/site/ProductSearch.tsx')
for (const [n, src] of [['SearchBarInput', barra], ['ProductSearch', lupa]]) {
  check(src.includes('useResultadosBusqueda(') && src.includes('useBusquedasRecientes(') && src.includes('useCerrarBuscador(') && src.includes('usePosicionPanel('), `${n}: usa el comportamiento común`)
  check(!src.includes("document.addEventListener('mousedown'") && !src.includes('fetch('), `${n}: sin lógica propia de cierre ni de búsqueda`)
  check(src.includes('data-panel-buscador'), `${n}: el desplegable se marca para las pruebas`)
}
check(barra.includes('style={posicion ? { left: posicion.left, width: posicion.width } : undefined}') && !barra.includes('<div className="absolute left-0 right-0 top-full mt-2 z-[100]">'), 'la barra: el desplegable no hereda el ancho del input')
check(lupa.includes("usePosicionPanel(!!isOpen && !pantallaCompleta, containerRef, { ancho: 384, minimo: 320, alinear: 'derecha' })"), 'la lupa: panel de 384 dentro de la pantalla')
check(lupa.includes('window.location.href = ruta(urlResultadosBusqueda(term.trim()))'), 'Enter en la lupa lleva a /search, como la barra')
const comp = leer('components/site/buscador/comportamiento.ts')
check(comp.includes("if (e.key === 'Escape') cerrarRef.current()") && comp.includes("document.addEventListener('keydown', alTecla)"), 'Escape cierra en todo el documento')
check(comp.includes('export const MINIMO_SUGERENCIAS = 2'), 'sugerencias desde 2 caracteres (la lupa buscaba desde 1)')

// ── 4. La barra en la fila ──
check(leer('components/site/header/barraEnFila.ts').includes('export const ANCHO_MINIMO_BARRA = 240'), 'mínimo 240px')
for (const f of ['HeaderClassic', 'HeaderSplit', 'HeaderMinimal', 'HeaderMega']) {
  const src = leer(`components/site/header/${f}.tsx`)
  check(src.includes('const barraAbajo = useBarraAbajo(filaRef, hayBarra);') && src.includes('ref={filaRef}'), `${f}: mide la fila`)
  check(/barra\('[^']*min-w-\[240px\]'\)/.test(src), `${f}: la barra en la fila no baja de 240px`)
  check(src.includes(`{barraAbajo && <div className="hidden md:flex justify-center pb-3" data-barra-abajo="">{barra('w-full max-w-3xl', false)}</div>}`), `${f}: segunda fila de ancho completo (mini como barra normal)`)
  check(src.includes('const barra = (clase: string, enFila = true) => barraSiCromo(') && src.includes('className: clase, enFila })'), `${f}: la segunda fila pasa enFila={false} al cromo`)
}
{
  const src = leer('components/site/header/HeaderCentered.tsx')
  check(src.includes('const barraAbajo = useBarraAbajo(filaRef, hayBarra);') && src.includes('ref={filaRef}') && src.includes("{!barraAbajo && barra('w-64')}"), 'HeaderCentered: la barra junto a los íconos (w-64, como hoy) y mide la fila')
  check(src.includes(`{barraAbajo && <div className="hidden md:flex justify-center pb-3" data-barra-abajo="">{barra('w-full max-w-3xl', false)}</div>}`), 'HeaderCentered: segunda fila de ancho completo')
}
const fila = leer('components/site/header/barraEnFila.ts')
check(fila.includes("const barraChica = !mini &&") && fila.includes("const navRecorta = !mini &&"), 'mini: solo baja si la fila desborda')
check(fila.includes("barra?.dataset.buscador === 'mega' ? (barra.querySelector('input')"), 'mega: cuenta el campo, no el selector')
check(fila.includes('for (const c of Array.from(fila.children)) ro.observe(c)') && fila.includes('document.fonts?.ready'), 'vuelve a medir si un hijo cambia de ancho o llega la fuente')
const cromoSel = leer('components/site/header/BuscadorCromo.tsx')
check(cromoSel.includes('max-w-[9rem] shrink-0 rounded-l-md border border-gray-200 bg-white px-2 text-sm text-gray-900'), 'mega: el selector tiene tope de ancho y texto oscuro')
check(leer('components/site/header/HeaderShared.tsx').includes('<div className={className} data-buscador="bar">'), 'la barra simple se marca para la medida')

// ── 5. Menú con «Más» ──
const shared = leer('components/site/header/HeaderShared.tsx')
check(shared.includes("nav.toggleAttribute('data-nav-recorta', n < anchos.length)") && shared.includes("item={{ name: 'Más', href: '', children:"), 'NavList: los enlaces que no caben van a «Más»')
check(shared.includes('data-medida-nav=""') && !/data-medida-nav[\s\S]{0,400}<NavLink/.test(shared), 'el medidor no duplica enlaces enfocables')
check(leer('components/site/header/menuDeslizable.ts').includes("!c.hasAttribute('data-medida-nav')"), 'el deslizamiento no cuenta el medidor')
check(leer('components/site/header/NavDropdown.tsx').includes('{!sinVerTodo && ('), '«Más» sin «Ver todo»')

// ── 6. Barra compacta ──
const cromo = leer('components/site/header/BuscadorCromo.tsx')
check(cromo.includes("const compacta = presentacion.tipo === 'mini' && enFila") && cromo.includes('focus-within:w-96') && cromo.includes('absolute right-0'), 'mini: se abre encima, hacia la izquierda, sin empujar')
check(cromo.includes('lupaEnCampo enFila={false} />'), 'mini en el celular: barra normal')

if (problemas.length) {
  console.error(`verify-buscador: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-buscador: ${casos} casos`)
