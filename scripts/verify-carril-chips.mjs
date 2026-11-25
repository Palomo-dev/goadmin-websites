/**
 * verify-carril-chips.mjs — carril horizontal de chips (subcategorías y filtros de productos).
 *
 *   npm run verify:carril-chips
 *
 * 1. Reglas puras (lib/site/carrilChips.ts): desborde, lados con chips ocultos, paso de flecha,
 *    rueda del mouse (no atrapa el scroll de la página en los bordes ni pisa el trackpad) y llevar
 *    el chip elegido a la vista.
 * 2. Componente: sin barra gris, máscara de degradado, flechas solo en computador y si desborda,
 *    arrastre sin abrir el chip, sin bucle ni avance automático.
 * 3. Uso: la página de categoría y la barra de filtros con «Todas» / «Todos» fijo, aria-pressed y los
 *    estilos de chip del editor.
 * 4. Una sola pieza (2026-11-25, captura del dueño: «Precios que bajan esta semana» sobre fondo
 *    oscuro, recortada, sin flechas y seleccionando texto al arrastrar): ofertas, listado, rejilla
 *    editorial, filtros y subcategorías de la plantilla de categoría y la rejilla vieja usan
 *    CarrilChips; ninguna conserva su fila propia con `overflow-x-auto`. Arrastre con umbral, sin
 *    seleccionar texto y con captura del puntero; Shift+rueda y rueda en líneas; foco al tabular.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const c = await import('../lib/site/carrilChips.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, e, msg) => check(JSON.stringify(a) === JSON.stringify(e), `${msg}: esperado ${JSON.stringify(e)}, obtenido ${JSON.stringify(a)}`)

// 1. Reglas
igual([c.desborda(500, 500), c.desborda(501, 500), c.desborda(600, 500)], [false, false, true], 'desborda con holgura de redondeo')
igual(c.ladosOcultos(0, 400, 500), { izquierda: false, derecha: false }, 'cabe todo: sin degradado ni flechas')
igual(c.ladosOcultos(0, 900, 500), { izquierda: false, derecha: true }, 'al inicio: solo a la derecha')
igual(c.ladosOcultos(200, 900, 500), { izquierda: true, derecha: true }, 'en medio: a los dos lados')
igual(c.ladosOcultos(400, 900, 500), { izquierda: true, derecha: false }, 'al final: solo a la izquierda')
igual([c.pasoFlecha(500), c.pasoFlecha(50)], [400, 80], 'la flecha avanza el 80 % (mínimo 80 px)')
igual(c.desplazamientoRueda(0, 900, 500, 0, 40), 40, 'rueda hacia abajo: avanza a la derecha')
igual(c.desplazamientoRueda(0, 900, 500, 0, -40), null, 'rueda hacia arriba al inicio: la página sube')
igual(c.desplazamientoRueda(400, 900, 500, 0, 40), null, 'rueda hacia abajo al final: la página baja')
igual(c.desplazamientoRueda(200, 900, 500, 0, -40), -40, 'rueda hacia arriba en medio: vuelve')
igual(c.desplazamientoRueda(100, 900, 500, 30, 5), null, 'trackpad horizontal: lo maneja el navegador')
igual(c.desplazamientoRueda(0, 400, 500, 0, 40), null, 'sin desborde: la rueda es de la página')
igual(c.desplazamientoParaMostrar(100, 80, 0, 500, 900), null, 'chip visible: no se mueve')
igual(c.desplazamientoParaMostrar(700, 80, 0, 500, 900), 400, 'chip a la derecha: queda a la vista (sin pasar del final)')
igual(c.desplazamientoParaMostrar(500, 80, 0, 500, 1400), 290, 'chip fuera: centrado')
igual(c.desplazamientoParaMostrar(20, 80, 300, 500, 900), 0, 'chip a la izquierda: vuelve sin pasar del inicio')

igual(c.desplazamientoParaMostrar(420, 60, 0, 500, 900), null, 'sin margen: el chip pegado al borde cuenta como visible')
igual(c.desplazamientoParaMostrar(420, 60, 0, 500, 900, c.MARGEN_FOCO), 200, 'con margen (foco): el chip debajo de la flecha se trae al centro')
igual(c.desplazamientoParaMostrar(10, 60, 0, 500, 900, c.MARGEN_FOCO), null, 'con margen al inicio: sin flecha izquierda, no se mueve')
igual([c.esArrastre(0), c.esArrastre(c.UMBRAL_ARRASTRE), c.esArrastre(-c.UMBRAL_ARRASTRE), c.esArrastre(c.UMBRAL_ARRASTRE + 1), c.esArrastre(-(c.UMBRAL_ARRASTRE + 1))], [false, false, false, true, true], 'umbral de arrastre: hasta el umbral sigue siendo clic')
igual([c.pixelesRueda(3, 1, 500), c.pixelesRueda(1, 2, 500), c.pixelesRueda(40, 0, 500)], [48, 500, 40], 'rueda en líneas o páginas (Firefox) → px')
igual(c.desplazamientoRueda(100, 900, 500, 0, 48), 48, 'Shift+rueda sin convertir (deltaY) mueve la barra')

// 2. Componente
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
const comp = fuente('components/site/carrusel/CarrilChips.tsx')
check(/overflow-x-auto scrollbar-hide/.test(comp) && /scrollbarWidth: 'none'/.test(comp), 'sin barra gris del sistema')
check(/maskImage: mascara, WebkitMaskImage: mascara/.test(comp), 'degradado con máscara (sirve sobre cualquier fondo)')
check(/lados\.izquierda && \(\s*<FlechaCarrusel/.test(comp) && /lados\.derecha && \(\s*<FlechaCarrusel/.test(comp) && /md:!flex/.test(comp), 'flechas solo si desborda y solo en computador')
check(/addEventListener\('wheel', rueda, \{ passive: false \}\)/.test(comp), 'rueda del mouse')
check(/pointerType !== 'mouse'/.test(comp) && /onClickCapture=\{alClic\}/.test(comp), 'arrastre con el mouse sin abrir el chip')
check(/\[aria-pressed="true"\]/.test(comp), 'el chip elegido se trae a la vista')
check(!/setInterval|autoplay|loop/i.test(comp.replace(/Sin bucle ni avance automático[^\n]*/g, '')), 'sin bucle ni avance automático')
check(/prefers-reduced-motion: reduce/.test(comp), 'respeta prefers-reduced-motion')
check(/role="group" aria-label=\{etiqueta\}/.test(comp), 'grupo con nombre accesible')

check(/setPointerCapture\(e\.pointerId\)/.test(comp) && /esArrastre\(dx\)/.test(comp), 'arrastre con umbral y captura del puntero')
check(/r\.style\.userSelect = 'none'/.test(comp) && /removeAllRanges\(\)/.test(comp) && /r\.style\.userSelect = a\.seleccion/.test(comp), 'sin seleccionar texto durante el arrastre (y se devuelve al soltar)')
check(/window\.addEventListener\('pointerup', terminar\)/.test(comp), 'suelta bien aunque el mouse salga de la barra')
check(/cursor: arrastrando \? 'grabbing' : 'grab'/.test(comp), 'cursor de mano solo si desborda')
check(/pixelesRueda\(e\.deltaY, e\.deltaMode/.test(comp), 'rueda en líneas o páginas')
check(/onFocus=\{alFoco\}/.test(comp) && /:focus-visible/.test(comp) && /MARGEN_FOCO/.test(comp), 'al tabular, el chip con foco a la vista')
check(/\[&>\*:focus-visible\]:outline-2/.test(comp), 'anillo de foco de teclado visible en los chips')
check(!/bg-gradient-to|from-white|from-gray|to-transparent/.test(comp), 'sin degradado de color encima (solo máscara)')
check(/new MutationObserver/.test(comp) && /ro\.observe\(h\)/.test(comp), 're-mide cuando llegan o cambian los chips')
check(/aria-label=\{etiqueta \?\? /.test(fuente('components/site/carrusel/ControlesCarrusel.tsx')) && /etiqueta=\{`Ver más \$\{etiqueta\.toLowerCase\(\)\}`\}/.test(comp), 'flechas con nombre accesible')

// 3. Uso
const cat = fuente('app/categorias/[slug]/CategoryPageClient.tsx')
check(/<CarrilChips[\s\S]*etiqueta="Subcategorías"/.test(cat) && /chipFijo=\{/.test(cat) && /claveActivo=\{currentSubcategory \|\| ''\}/.test(cat), 'categoría: carril con «Todas» fijo')
check((cat.match(/aria-pressed=/g) || []).length >= 2, 'categoría: los chips dicen si están elegidos')
check(/IconoGuardado icono=\{sub\.icon\}/.test(cat) && /backgroundColor: primaryColor/.test(cat), 'categoría: conserva íconos y el primario')
check(!/className="mb-6 overflow-x-auto"/.test(cat), 'categoría: ya no queda el contenedor con barra gris')
const filtros = fuente('components/sections/products/BarraFiltrosProductos.tsx')
check(/<CarrilChips[\s\S]*etiqueta="Categorías"/.test(filtros) && /claveActivo=\{selectedCategory \?\? ''\}/.test(filtros), 'filtros: carril con «Todos» fijo')
check(/chip\(!selectedCategory\)\.className/.test(filtros) && /activo\.className/.test(filtros), 'filtros: los estilos de chip del editor (estiloChipFiltro)')

// 4. Una sola pieza para todas las filas de chips de categorías de las secciones de productos
const USAN = {
  'components/sections/products/BarraFiltrosProductos.tsx': 'destacados, nuevos, carrusel, lista y rejilla',
  'components/sections/retail/OffersGrid.tsx': 'ofertas («Precios que bajan»)',
  'components/sections/products/BarraListado.tsx': 'listado de la plantilla',
  'components/sections/tienda/RejillaEditorialVista.tsx': 'rejilla editorial',
  'components/sections/category-detail/CategoryFilters.tsx': 'filtros de la plantilla de categoría',
  'components/sections/category-detail/CategorySubcategories.tsx': 'subcategorías en fila',
  'components/site/ProductGrid.tsx': 'rejilla de /productos',
  'app/categorias/[slug]/CategoryPageClient.tsx': 'página de categoría',
}
for (const [ruta, que] of Object.entries(USAN)) {
  const f = fuente(ruta)
  check(/import \{ CarrilChips \} from '@\/components\/site\/carrusel\/CarrilChips'/.test(f) && /<CarrilChips\s/.test(f), `${que}: usa CarrilChips`)
  // Ninguna fila propia de chips con scroll: ni `flex gap-N overflow-x-auto` ni el contenedor viejo.
  check(!/className="[^"]*\bflex gap-\d[^"]*overflow-x-auto|className=\{?[`"][^`"]*overflow-x-auto[^`"]*pb-2/.test(f), `${que}: sin fila propia con overflow-x-auto`)
}
for (const ruta of ['components/sections/retail/OffersGrid.tsx', 'components/site/ProductGrid.tsx', 'components/sections/products/BarraListado.tsx', 'components/sections/category-detail/CategoryFilters.tsx']) {
  const f = fuente(ruta)
  check(/chipFijo=\{/.test(f) && /aria-pressed=\{/.test(f) && /claveActivo=\{/.test(f), `${ruta}: «Todos» fijo, aria-pressed y chip elegido a la vista`)
}
const ofertas = fuente('components/sections/retail/OffersGrid.tsx')
check(/estiloChipFiltro\(!selectedCategory, primaryColor, content\)\.className/.test(ofertas) && /activo\.className/.test(ofertas), 'ofertas: conserva los estilos de chip del editor')
check(/claseChip\(presentacion\.chipStyle/.test(fuente('components/sections/products/BarraListado.tsx')) && /hidden md:flex/.test(fuente('components/sections/products/BarraListado.tsx')), 'listado: conserva forma de chip y el desplegable en celular')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ carril de chips: ${casos} comprobaciones`)
