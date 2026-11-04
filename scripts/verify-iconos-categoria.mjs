/**
 * verify-iconos-categoria.mjs — íconos automáticos y color del ícono de las categorías.
 *
 *   npm run verify:iconos-categoria
 *
 * 1. Cada ícono del mapa de palabras clave existe en lucide-react (la versión instalada, 0.454.0).
 * 2. Palabras clave: sin tildes, en minúsculas, palabra completa, plural; frases antes que palabras.
 * 3. `icon_color` y `icon_bg_mode`: valores del contrato; ausente o inválido = lo de hoy (null).
 * 4. Los tres lugares que pintan el ícono (EstilosCategoria, CategoryCard, ListCard de
 *    CategoriesGrid) usan IconoCategoria y las dos claves.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'
import { icons } from 'lucide-react'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

// Módulos puros a .mjs (dentro del repo para que `zod` resuelva desde node_modules).
const dir = join(ROOT, '.verify-iconos-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
let ic, contrato
try {
  const strip = async (ruta) => stripTypeScriptTypes(await readFile(join(ROOT, ruta), 'utf8'), { mode: 'strip' })
  await writeFile(join(dir, 'documentoSitio.mjs'), await strip('lib/website/v2/contrato/documentoSitio.ts'))
  const src = (await strip('lib/website/iconosCategoria.ts')).replace(/^import\s+type[^\n]*\n/gm, '')
  check(/from '\.\/v2\/contrato\/documentoSitio'/.test(src), 'iconosCategoria.ts solo importa el contrato')
  await writeFile(join(dir, 'iconosCategoria.mjs'), src.replace("from './v2/contrato/documentoSitio'", "from './documentoSitio.mjs'"))
  contrato = await import(pathToFileURL(join(dir, 'documentoSitio.mjs')).href)
  ic = await import(pathToFileURL(join(dir, 'iconosCategoria.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

const { version } = JSON.parse(await readFile(join(ROOT, 'node_modules/lucide-react/package.json'), 'utf8'))
check(version === '0.454.0', `lucide-react instalado ${version} (se validó contra 0.454.0)`)

// ── 1. Íconos del mapa existen en lucide ──
const nombresMapa = [...new Set(ic.ICONOS_POR_PALABRA.map(([, n]) => n)), 'Tag']
for (const n of nombresMapa) check(Boolean(icons[n]), `el ícono «${n}» no existe en lucide-react ${version}`)
for (const [claves] of ic.ICONOS_POR_PALABRA) {
  for (const c of claves) check(c === ic.normalizarTexto(c), `la clave «${c}» debe ir normalizada`)
}

// ── 2. Palabras clave ──
const casosNombre = {
  // Pedido, uno por regla
  'Celulares': 'Smartphone', 'Smartphones': 'Smartphone', 'Portátiles': 'Laptop', 'Laptops gamer': 'Laptop',
  'Tablets': 'Tablet', 'Audífonos': 'Headphones', 'Parlantes': 'Speaker', 'Relojes': 'Watch', 'Smartwatch': 'Watch',
  'Monitores': 'Monitor', 'TV y video': 'Tv', 'Televisores': 'Tv', 'Consolas': 'Gamepad2', 'Zona gamer': 'Gamepad2',
  'Cámaras': 'Camera', 'Impresoras': 'Printer', 'Cables': 'Cable', 'Cargadores': 'Cable', 'Mouse': 'Mouse',
  'Teclados': 'Mouse', 'Hogar': 'House', 'Casa y jardín': 'House', 'Ollas': 'CookingPot', 'Sartenes': 'CookingPot',
  'Cuchillos': 'UtensilsCrossed', 'Cubiertos': 'UtensilsCrossed', 'Licuadoras': 'Blend', 'Neveras': 'Refrigerator',
  'Lavadoras': 'WashingMachine', 'Ventiladores': 'Fan', 'Clima': 'Fan', 'Colchones': 'BedDouble',
  'Almohadas': 'BedDouble', 'Muebles': 'Sofa', 'Cuidado personal': 'Sparkles', 'Zapatillas': 'Footprints',
  'Tenis': 'Footprints', 'Camisetas': 'Shirt', 'Ropa': 'Shirt', 'Gorras': 'Crown', 'Mascotas': 'PawPrint',
  'Perros': 'PawPrint', 'Gatos': 'Cat', 'Gym': 'Dumbbell', 'Pesas': 'Dumbbell', 'Oficina': 'Armchair',
  'Sillas': 'Armchair', 'Papelería': 'PenLine', 'Agricultura': 'Sprout', 'Semillas': 'Sprout',
  'Seguridad': 'Cctv', 'Cámaras IP': 'Cctv',
  // Normalización y orden
  'CELULARES': 'Smartphone', 'cámara ip wifi': 'Cctv', 'Ollas para el hogar': 'CookingPot',
  'Alimento para gatos y perros': 'Cat', 'Sillas de oficina': 'Armchair', 'Pañuelos/Ropa': 'Shirt',
  // Palabra completa: no coincide dentro de otra palabra
  'Gatorade': null, 'Tvbox': null, 'Casamiento': null, 'Celularmente': null, 'Climatización': null,
  // Sin coincidencia
  'Ofertas': null, 'Varios': null, '': null, '   ': null,
}
for (const [nombre, esperado] of Object.entries(casosNombre)) igual(ic.iconoPorNombre(nombre), esperado, `iconoPorNombre(«${nombre}»)`)
igual(ic.iconoPorNombre(undefined), null, 'iconoPorNombre(undefined)')
igual(ic.iconoPorNombre(42), null, 'iconoPorNombre(42)')

// Candidatos: propio primero, luego el automático; sin duplicados
igual(ic.candidatosIconoCategoria({ icon: 'Bike', name: 'Celulares' }), ['Bike', 'Smartphone'], 'propio y automático')
igual(ic.candidatosIconoCategoria({ icon: '', name: 'Celulares' }), ['Smartphone'], 'sin propio: automático')
igual(ic.candidatosIconoCategoria({ icon: '  ', name: 'Varios' }), [], 'sin propio ni automático')
igual(ic.candidatosIconoCategoria({ icon: 'Smartphone', name: 'Celulares' }), ['Smartphone'], 'sin duplicados')
check(ic.tieneIconoCategoria({ name: 'Neveras' }) && !ic.tieneIconoCategoria({ name: 'Varios' }), 'tieneIconoCategoria')
// Nombre inexistente en lucide: el componente pasa al siguiente candidato y al final a Tag
const elegir = (cat) => ic.candidatosIconoCategoria(cat).find((n) => icons[n]) ?? 'Tag'
igual(elegir({ icon: 'NoExiste', name: 'Celulares' }), 'Smartphone', 'ícono propio inexistente → automático')
igual(elegir({ icon: 'NoExiste', name: 'Varios' }), 'Tag', 'ícono propio inexistente y sin automático → Tag')
igual(elegir({ icon: 'smartphone', name: '' }), 'Tag', 'nombre en minúsculas no existe en lucide → Tag')

// ── 3. icon_color e icon_bg_mode ──
const cols = { categoria: '#6366f1', primario: '#ff0000' }
igual(ic.colorIconoCategoria({}, cols), null, 'icon_color ausente: lo de hoy')
igual(ic.colorIconoCategoria(undefined, cols), null, 'sin contenido: lo de hoy')
igual(ic.colorIconoCategoria({ icon_color: 'category' }, cols), '#6366f1', 'category')
igual(ic.colorIconoCategoria({ icon_color: 'category' }, { categoria: '', primario: '#ff0000' }), '#ff0000', 'category sin color: primario')
igual(ic.colorIconoCategoria({ icon_color: 'primary' }, cols), '#ff0000', 'primary')
igual(ic.colorIconoCategoria({ icon_color: 'secondary' }, cols), 'var(--secondary-color, #1E40AF)', 'secondary')
igual(ic.colorIconoCategoria({ icon_color: '#00AA11' }, cols), '#00AA11', 'hex')
igual(ic.colorIconoCategoria({ icon_color: '#0a1' }, cols), '#0a1', 'hex corto')
for (const malo of ['rojo', '#12345', 'url(x)', 'red;background:x', 5, true]) igual(ic.colorIconoCategoria({ icon_color: malo }, cols), null, `icon_color inválido ${JSON.stringify(malo)}`)
igual(ic.fondoIconoCategoria({}), null, 'icon_bg_mode ausente: lo de hoy')
for (const m of ['soft', 'solid', 'none']) igual(ic.fondoIconoCategoria({ icon_bg_mode: m }), m, `icon_bg_mode ${m}`)
igual(ic.fondoIconoCategoria({ icon_bg_mode: 'SOLID' }), null, 'icon_bg_mode inválido')
igual(ic.estiloFondoIcono('soft', '#ff0000'), { fondo: 'color-mix(in srgb, #ff0000 14%, white)', colorIcono: '#ff0000' }, 'soft')
igual(ic.estiloFondoIcono('soft', '#ff0000', '#eeeeee'), { fondo: '#eeeeee', colorIcono: '#ff0000' }, 'soft con image_bg')
igual(ic.estiloFondoIcono('solid', '#ff0000'), { fondo: '#ff0000', colorIcono: '#FFFFFF' }, 'solid')
igual(ic.estiloFondoIcono('solid', '#ff0000', '#111111'), { fondo: '#111111', colorIcono: '#FFFFFF' }, 'solid con image_bg')
igual(ic.estiloFondoIcono('none', '#ff0000', '#111111'), { fondo: 'transparent', colorIcono: '#ff0000' }, 'none ignora image_bg')
igual(ic.estiloFondoIcono('soft', 'var(--secondary-color, #1E40AF)').fondo, 'color-mix(in srgb, var(--secondary-color, #1E40AF) 14%, white)', 'soft con el secundario (variable CSS)')

// Contrato
igual([...contrato.COLORES_ICONO_CATEGORIA], ['category', 'primary', 'secondary'], 'COLORES_ICONO_CATEGORIA')
igual([...contrato.FONDOS_ICONO_CATEGORIA], ['soft', 'solid', 'none'], 'FONDOS_ICONO_CATEGORIA')
const seccion = { id: 's1', tipo: 'categories_grid', variante: null, version: 1, contenido: { icon_color: 'loquesea', icon_bg_mode: 9 }, diseno: {} }
check(contrato.esquemaSeccion.safeParse(seccion).success, 'un valor inválido no rechaza la sección')

// ── 4. Fuentes ──
const leer = (r) => readFile(join(ROOT, r), 'utf8')
const comp = await leer('components/sections/products/IconoCategoria.tsx')
check(comp.includes("candidatosIconoCategoria(cat).find((n) => mapa[n]) ?? respaldo") && comp.includes('?? mapa.Tag'), 'IconoCategoria: primer candidato que exista, si no Tag')
const estilos = await leer('components/sections/products/EstilosCategoria.tsx')
check(estilos.includes('const hayIcono = tieneIconoCategoria(cat)'), 'EstilosCategoria: el ícono automático cuenta como ícono')
const tarjeta = await leer('components/sections/products/CategoryCard.tsx')
const grid = await leer('components/sections/products/CategoriesGrid.tsx')
for (const [ruta, src] of [['EstilosCategoria', estilos], ['CategoryCard', tarjeta], ['CategoriesGrid', grid]]) {
  check(/<IconoCategoria\s+cat=\{cat\}/.test(src) && !src.includes('<DynamicLucideIcon'), `${ruta}: pinta con IconoCategoria`)
  check(src.includes('colorIconoCategoria(') && src.includes('fondoIconoCategoria(') && src.includes('estiloFondoIcono('), `${ruta}: usa icon_color e icon_bg_mode`)
}
check(grid.includes('if (extra.icon_color) style.icon_color = extra.icon_color') && grid.includes('if (extra.icon_bg_mode) style.icon_bg_mode = extra.icon_bg_mode'), 'CategoriesGrid pasa las claves a la tarjeta')
// Sin las claves, el color de hoy en cada lugar
check(estilos.includes('?? (cat.color || color)'), 'EstilosCategoria: sin icon_color, cat.color o el primario (hoy)')
check(tarjeta.includes("?? (cat.color || accent)"), 'CategoryCard: sin icon_color, cat.color o el acento (hoy)')
check(grid.includes("primario: primaryColor || '#6366f1' }) ?? accent"), 'ListCard: sin icon_color, el acento (hoy)')

if (problemas.length) {
  console.error(`verify-iconos-categoria: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-iconos-categoria: ${casos} casos`)
