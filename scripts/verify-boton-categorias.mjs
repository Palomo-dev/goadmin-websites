/**
 * verify-boton-categorias.mjs — botón «Todas las categorías» del encabezado (Figma 2689:57377).
 *
 *   npm run verify:boton-categorias
 *
 * 1. Opción del editor: sin clave = encendido con «Todas las categorías»; `false` apaga; el texto se
 *    recorta y, vacío o de más de 40 caracteres, vuelve al de siempre.
 * 2. Qué lista: el mega menú del editor si tiene ítems; si no, las categorías cuando
 *    `show_categories_in_header` está encendido; apagado o sin nada, no hay botón.
 * 3. Celular y encabezado mínimo: encendido = las categorías de primeras y con el texto del botón;
 *    apagado = al final como «Categorías» (lo de antes).
 * 4. Texto del botón legible sobre el primario (blanco u oscuro según el contraste).
 * 5. Contrato: las claves nuevas están en la copia de la tienda (y la del ERP es idéntica, si existe).
 * 6. Los encabezados con barra lo usan; el «Categorías ⌄» de Mega solo queda con el botón apagado.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const b = await import('../lib/website/botonCategorias.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, e, msg) => check(JSON.stringify(a) === JSON.stringify(e), `${msg}: esperado ${JSON.stringify(e)}, obtenido ${JSON.stringify(a)}`)

// 1. Opción
igual(b.opcionBotonCategorias(null), { activo: true, texto: 'Todas las categorías' }, 'sin ajustes: encendido')
igual(b.opcionBotonCategorias({}), { activo: true, texto: 'Todas las categorías' }, 'sin clave: encendido')
igual(b.opcionBotonCategorias({ header_categories_button: false }).activo, false, 'false apaga')
igual(b.opcionBotonCategorias({ header_categories_button: 'no' }).activo, true, 'basura = default (encendido)')
igual(b.opcionBotonCategorias({ header_categories_button_text: '  Departamentos  ' }).texto, 'Departamentos', 'texto recortado')
igual(b.opcionBotonCategorias({ header_categories_button_text: '   ' }).texto, 'Todas las categorías', 'texto vacío = el de siempre')
igual(b.opcionBotonCategorias({ header_categories_button_text: 'x'.repeat(41) }).texto, 'Todas las categorías', 'más de 40 = el de siempre')

// 2. Qué lista
const CATS = [
  { id: 1, name: 'Celulares', slug: 'celulares', icon: 'smartphone', color: '#2563EB', image_url: null, children: [{ id: 11, name: 'Gama alta', slug: 'gama-alta', icon: null, color: null, image_url: null, children: [] }] },
  { id: 2, name: 'Portátiles', slug: 'portatiles', icon: null, color: null, image_url: 'https://x/y.png', children: [] },
]
const ITEMS = [{ name: 'Ofertas', href: '/ofertas', icon: 'tag', children: [{ name: 'Hoy', href: '/ofertas/hoy' }] }]
const ruta = (p) => `/sede-norte${p}`
check(b.botonCategoriasBarra({}, CATS, null) === null, 'categorías sin show_categories_in_header: sin botón (como antes)')
const conCats = b.botonCategoriasBarra({ show_categories_in_header: true }, CATS, null, ruta)
igual(conCats?.entradas.map((e) => e.href), ['/sede-norte/categorias/celulares', '/sede-norte/categorias/portatiles'], 'categorías con la ruta de la sede, en su orden')
igual(conCats?.entradas[0].hijos, [{ clave: 'c11', nombre: 'Gama alta', href: '/sede-norte/categorias/gama-alta' }], 'subcategorías')
igual([conCats?.entradas[0].icono, conCats?.entradas[0].color, conCats?.entradas[1].imagen], ['smartphone', '#2563EB', 'https://x/y.png'], 'ícono, color e imagen de cada categoría')
const conMega = b.botonCategoriasBarra({ show_categories_in_header: true }, CATS, ITEMS)
igual(conMega?.entradas.map((e) => [e.nombre, e.href, e.hijos.length]), [['Ofertas', '/ofertas', 1]], 'el mega menú del editor manda (como el «Categorías ⌄» de antes)')
check(b.botonCategoriasBarra({ header_categories_button: false, show_categories_in_header: true }, CATS, ITEMS) === null, 'apagado: sin botón')
check(b.botonCategoriasBarra({ show_categories_in_header: true }, [], []) === null, 'sin nada que listar: sin botón')
igual(b.botonCategoriasBarra({ show_categories_in_header: true, header_categories_button_text: 'Departamentos' }, CATS, null)?.texto, 'Departamentos', 'texto propio')

// 3. Menú del celular
const NAV = [{ name: 'Inicio' }, { name: 'Contacto' }]
const CAT = { name: 'Categorías', href: '/categorias' }
igual(b.menuConCategorias(NAV, CAT, {}).map((i) => i.name), ['Todas las categorías', 'Inicio', 'Contacto'], 'encendido: de primeras con el texto')
igual(b.menuConCategorias(NAV, CAT, { header_categories_button_text: 'Departamentos' })[0].name, 'Departamentos', 'con el texto propio')
igual(b.menuConCategorias(NAV, CAT, { header_categories_button: false }).map((i) => i.name), ['Inicio', 'Contacto', 'Categorías'], 'apagado: al final como antes')
igual(b.menuConCategorias(NAV, null, {}).map((i) => i.name), ['Inicio', 'Contacto'], 'sin categorías: el menú tal cual')
check(b.menuConCategorias(NAV, CAT, {})[0].href === '/categorias', 'conserva el enlace y los hijos del ítem')

// 4. Contraste
igual(b.colorTextoSobre('#2254F8'), '#FFFFFF', 'azul: texto blanco')
igual(b.colorTextoSobre('#111827'), '#FFFFFF', 'oscuro: texto blanco')
igual(b.colorTextoSobre('#FACC15'), '#111827', 'amarillo: texto oscuro')
igual(b.colorTextoSobre('#fff'), '#111827', 'blanco corto: texto oscuro')
igual(b.colorTextoSobre('rgb(1,2,3)'), '#FFFFFF', 'otro formato: blanco')

// 5. Contrato
const tienda = readFileSync(join(ROOT, 'lib/website/v2/mapeoAjustes.ts'), 'utf8').replace(/\r\n/g, '\n')
check(tienda.includes("header_categories_button: { zona: 'header', porDefecto: true, regla: BOOL, nueva: true },"), 'interruptor en el contrato de la tienda')
check(tienda.includes("header_categories_button_text: { zona: 'header', porDefecto: null, regla: { tipo: 'texto', max: 40 }, nueva: true },"), 'texto en el contrato de la tienda')
const erp = join(ROOT, '..', 'CascadeProjects', 'go-admin-erp', 'src', 'lib', 'website', 'v2', 'mapeoAjustes.ts')
if (existsSync(erp)) check(readFileSync(erp, 'utf8').replace(/\r\n/g, '\n') === tienda, 'la copia del ERP es idéntica')

// 6. Encabezados
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
for (const h of ['HeaderMega', 'HeaderClassic', 'HeaderCentered', 'HeaderSplit']) {
  const s = fuente(`components/site/header/${h}.tsx`)
  check(/botonCategoriasBarra\(/.test(s) && /<BotonTodasCategorias\b/.test(s), `${h} pinta el botón`)
}
check(/showCategories && !boton &&/.test(fuente('components/site/header/HeaderMega.tsx')), 'Mega: «Categorías ⌄» solo con el botón apagado')
for (const m of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/mobile/MobileFullscreen.tsx', 'components/site/header/HeaderMinimal.tsx']) {
  check(/menuConCategorias\(navItems, categoriesItem/.test(fuente(m)), `${m}: categorías de primeras con el botón`)
}
const comp = fuente('components/site/header/BotonTodasCategorias.tsx')
check(/role="menu"/.test(comp) && /aria-expanded=\{abierto\}/.test(comp) && /e\.key === 'Escape'/.test(comp), 'accesible: menú, aria-expanded y Escape')
check(/bg-white/.test(comp) && !/dark:/.test(comp), 'panel con colores propios, sin dark:')
check(/Ver todas las categorías/.test(comp), '«Ver todas las categorías» al final')
check(!/animate-in|fade-in/.test(comp), 'panel opaco desde el primer cuadro (sin desvanecerse)')

// 7. Subcategorías en el celular (parent_id): la padre se despliega dentro del menú
const sub = fuente('components/site/header/mobile/SubmenuCategoria.tsx')
check(/<details/.test(sub) && /Ver todo/.test(sub), 'SubmenuCategoria: acordeón con «Ver todo» y sus hijas')
for (const m of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/mobile/MobileFullscreen.tsx', 'components/site/header/HeaderMinimal.tsx']) {
  const s = fuente(m)
  check(/cat\.children && cat\.children\.length > 0/.test(s) && /children: cat\.children\.map/.test(s), `${m}: las categorías llevan sus subcategorías`)
  check(/child\.children && child\.children\.length > 0 \? \(\s*<SubmenuCategoria/.test(s), `${m}: la padre se despliega con SubmenuCategoria`)
}
check(/menuCategories\.map\(\(cat\) => cat\.children && cat\.children\.length > 0 \? \(/.test(fuente('components/site/header/mobile/MobileTabs.tsx')), 'barra de pestañas: la hoja de categorías despliega las padres')

// 8. Buscador en una sola barra (Figma 2689:57377) con las opciones del editor
const cromo = fuente('components/site/header/BuscadorCromo.tsx')
check(/data-barra-unificada=""/.test(cromo), 'BuscadorCromo: barra unificada')
check(/backgroundColor: presentacion\.background \|\| '#FFFFFF'/.test(cromo) && /borderColor: presentacion\.borderColor/.test(cromo) && /RADIO\[presentacion\.radius\]/.test(cromo) && /maxWidth: presentacion\.width/.test(cromo), 'la barra respeta fondo, borde, esquinas y ancho del editor')
check(/const campo = compacta \? campoSuelto : unificada/.test(cromo), 'la «barra compacta» sigue como antes')
check(/enBarra: true/.test(cromo) && /cromo\?\.enBarra/.test(fuente('components/site/SearchBarInput.tsx')), 'el campo va sin borde propio dentro de la barra')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ botón «Todas las categorías»: ${casos} comprobaciones`)
