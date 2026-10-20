/**
 * verify-estilo-tarjeta.mjs — el sitio público honra lo que el editor guarda
 * en tarjeta, banners, etiquetas, precio, filtros, fondo alterno y enlaces.
 *
 *   npm run verify:estilo-tarjeta
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function aMjs(ts) {
  return stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/^import\s+type[^\n]*\n/gm, '')
    .replace(/from\s+'\.\/([A-Za-z]+)'/g, (_, nombre) => `from './${nombre}.mjs'`)
}

const MODULOS = {
  presentacionTienda: 'lib/website/presentacionTienda.ts',
  limiteListado: 'lib/products/limiteListado.ts',
  colorMarca: 'lib/website/v2/colorMarca.ts',
  fuenteTema: 'lib/website/v2/fuenteTema.ts',
  estiloSeccion: 'lib/website/v2/estiloSeccion.ts',
}

const dir = join(ROOT, '.verify-estilo-tarjeta-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
const m = {}
try {
  for (const [nombre, ruta] of Object.entries(MODULOS)) {
    await writeFile(join(dir, `${nombre}.mjs`), aMjs(await readFile(join(ROOT, ruta), 'utf8')))
  }
  for (const nombre of Object.keys(MODULOS)) {
    m[nombre] = await import(pathToFileURL(join(dir, `${nombre}.mjs`)).href)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const p = m.presentacionTienda
const lista = m.limiteListado
const e = m.estiloSeccion

check(p.hrefDeSlug('/rastreo') === '/rastreo', 'una barra al inicio no se duplica')
check(p.hrefDeSlug('//rastreo') === '/rastreo', 'doble barra colapsa')
check(p.hrefDeSlug('https://ejemplo.test/a') === 'https://ejemplo.test/a', 'https se conserva')
check(p.hrefDeSlug('mailto:hola@ejemplo.test') === 'mailto:hola@ejemplo.test', 'mailto se conserva')
check(p.hrefDeSlug('home') === '/', 'home es la portada')
check(p.hrefDeSlug('#envio') === '#envio', 'ancla se conserva')
check(p.hrefDeSlug('sede/menu') === '/sede/menu', 'slug con prefijo de sede')

check(p.clasesColumnasBanner(undefined, 'grid').includes('lg:grid-cols-2'), 'sin columnas sigue en 2')
check(p.clasesColumnasBanner(undefined, 'grid').includes('min-h') === false, 'las columnas no meten altura')
check(p.clasesColumnasBanner({ desktop: 4, tablet: 2, mobile: 1 }, 'grid').includes('lg:grid-cols-4'), '4 columnas de escritorio')
check(p.clasesColumnasBanner({ desktop: 4 }, 'grid').includes('grid-cols-1'), 'móvil sin valor queda en 1')
check(p.clasesColumnasBanner(4, 'grid').includes('lg:grid-cols-4'), 'un número es el escritorio')
check(p.clasesColumnasBanner(4, 'stack') === 'grid grid-cols-1 gap-6', 'apilado ignora las columnas')
check(p.claseAspectoBanner('3/4') === 'aspect-[3/4]', 'proporción 3:4')
check(p.claseAspectoBanner('16/9') === 'aspect-video', 'proporción 16:9')
check(p.claseAspectoBanner('auto') === 'min-h-[200px]', 'automática conserva la altura')
check(p.claseAspectoBanner(undefined) === 'min-h-[200px]', 'sin proporción conserva la altura')
const tailwind = await readFile(join(ROOT, 'tailwind.config.ts'), 'utf8')
check(
  tailwind.includes("'./lib/**/*.{js,ts,jsx,tsx,mdx}'"),
  'tailwind escanea lib: si no, min-h-[200px] no llega al CSS y el banner se aplasta',
)
check(p.claseAspectoBanner('3/1') === 'aspect-[3/1]', 'proporción 3:1')
check(p.claseAspectoBanner('3/4', '3/1') === 'aspect-[3/1] md:aspect-[3/4]', 'el celular puede usar otra proporción')
check(p.claseAspectoBanner(undefined, '3/1') === 'aspect-[3/1] md:aspect-auto md:min-h-[200px]', 'escritorio automático y celular 3:1')
check(p.claseAspectoBanner('16/9', 'auto') === 'aspect-video', 'proporción de celular vacía no cambia el escritorio')
check(p.clasesColumnasBanner(4, 'grid').includes('grid-cols-1'), 'sin columnas de celular sigue en una')
check(p.clasesColumnasBanner(4, 'grid', 2).includes('grid-cols-2') && p.clasesColumnasBanner(4, 'grid', 2).includes('lg:grid-cols-4'), 'dos columnas en el celular')
check(p.clasesColumnasBanner({ desktop: 4, mobile: 1 }, 'grid', 2).includes('grid-cols-2'), 'la columna del celular gana a la pestaña')
check(p.claseImagenBanner(undefined, undefined) === 'absolute inset-0 w-full h-full object-cover object-center', 'la imagen se cubre centrada si no hay ajuste')
check(p.claseImagenBanner('contain', 'left') === 'absolute inset-0 w-full h-full object-contain object-left', 'se puede mostrar completa y anclada a la izquierda')
check(p.enlaceDeImagen({ cta_url: '/ofertas' }, {}, true) === '', 'con el botón visible la imagen no reutiliza su URL')
check(p.enlaceDeImagen({ cta_url: '/ofertas' }, {}, false) === '/ofertas', 'sin botón, la imagen usa la URL del botón')
check(p.enlaceDeImagen({ link_url: 'https://ejemplo.test/a' }, { cta_url: '/x' }, false) === 'https://ejemplo.test/a', 'el enlace de la imagen gana')
check(p.enlaceDeImagen({}, { link_url: '//rastreo' }, true) === '/rastreo', 'el enlace de la sección colapsa la doble barra')
check(p.clasesColumnasProductos(undefined) === 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6', 'la rejilla de productos no cambia si no hay columnas')
check(p.clasesColumnasProductos(1) === 'grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 gap-3 sm:gap-6', 'una columna de productos se honra')
check(lista.topeProductos({ max_items: 4, rows: 1 }) === 4, 'cantidad 4 y una fila dejan 4')
check(lista.topeProductos({ rows: 1, columns: 4 }) === 4, 'una fila por cuatro columnas deja 4')
check(lista.topeProductos({ max_items: 4, rows: 2, columns: 4 }) === 4, 'gana el tope más chico')
check(lista.topeProductos({ rows: 1 }) === 4, 'una fila sin columnas usa las 4 de escritorio')
check(lista.topeProductos({}) === null, 'sin tope no recorta')
const cuatro = lista.recorteListado(40, 1, { max_items: 4, rows: 1 })
check(cuatro.paginas === 1 && cuatro.hasta === 4, 'cuatro productos no paginan')
const sinPagina = lista.recorteListado(40, 1, { show_pagination: false })
check(sinPagina.paginas === 1 && sinPagina.hasta === 40, 'sin paginación se ve todo lo cargado')
const pagina2 = lista.recorteListado(40, 2, {})
check(pagina2.desde === 12 && pagina2.paginas === 4, 'sin tope se mantiene el corte de 12')
const apagada = lista.recorteListado(40, 1, { show_pagination: false, max_items: 4 })
check(apagada.paginas === 1 && apagada.hasta === 4, 'apagada y con cantidad, solo esa cantidad')
const nuevos = lista.ordenarListado(
  [{ id: 1, created_at: '2020-01-01' }, { id: 2 }, { id: 3, created_at: '2024-05-01' }],
  'newest',
).map((p) => p.id).join(',')
check(nuevos === '3,1,2', 'más nuevos primero y sin fecha al final')
check(p.mismoId(12, '12') === true, 'id de categoría texto o número')
check(p.mismoId(12, '') === false, 'id vacío no coincide')

const descuento = p.coloresEtiqueta('discount', {}, { badge_discount_bg: '#111111', badge_discount_text: '#EEEEEE' }, '#000', '#fff')
check(descuento.bg === '#111111' && descuento.text === '#EEEEEE', 'color de la sección para el descuento')
const item = p.coloresEtiqueta('new', { bg_color: '#123456', text_color: '#ABCDEF' }, { badge_new_bg: '#000000' }, '#000', '#fff')
check(item.bg === '#123456' && item.text === '#ABCDEF', 'el color del ítem gana')
const fijo = p.coloresEtiqueta('free_shipping', {}, {}, '#000', '#fff')
check(fijo.bg === '#3B82F6' && fijo.text === '#FFFFFF', 'envío gratis sigue azul si no hay color')

const precio = p.estiloPrecio({ price_color: '#AA0000', price_weight: '500' }, '#00FF00')
check(precio.color === '#AA0000' && precio.fontWeight === 500, 'color y grosor del precio')
check(p.estiloPrecio({}, '#00FF00').fontWeight === 700, 'sin grosor sigue en 700')
check(p.estiloPrecio({}, '#00FF00').color === '#00FF00', 'sin color usa el acento')
check(p.colorPrecioAnterior({ compare_price_color: '#999999' }) === '#999999', 'precio tachado')
check(p.colorPrecioAnterior({}) === undefined, 'sin color el tachado sigue gris')

const activo = p.estiloChipFiltro(true, '#112233', { filter_active_bg: '#010101', filter_active_text: '#F0F0F0' })
check(activo.style.backgroundColor === '#010101' && activo.style.color === '#F0F0F0', 'filtro activo')
const inactivo = p.estiloChipFiltro(false, '#112233', {})
check(inactivo.style.backgroundColor === undefined && inactivo.className.includes('text-gray-600'), 'filtro inactivo sin color')

check(p.elegirLogo('/logo.svg', '/claro.svg', true) === '/claro.svg', 'fondo oscuro usa el logo claro')
check(p.elegirLogo('/logo.svg', '/claro.svg', false) === '/logo.svg', 'fondo claro usa el logo normal')
check(p.elegirLogo('/logo.svg', null, true) === '/logo.svg', 'sin logo claro se queda el normal')
check(p.pieUsaLogoClaro('dark', null, '#fff', false) === true, 'pie oscuro')
check(p.pieUsaLogoClaro('light', null, '#000', true) === false, 'pie claro')
check(p.pieUsaLogoClaro('tema', null, '#fff', true) === true, 'pie del tema oscuro')
check(p.encabezadoUsaLogoClaro('#111111', false) === true, 'encabezado con fondo oscuro')
check(p.encabezadoUsaLogoClaro('#F5F3EF', false) === false, 'encabezado con fondo claro')
check(p.encabezadoUsaLogoClaro(null, true) === true, 'encabezado transparente sobre la portada')

const alterno = e.leerEstiloSeccion({ estilo: { fondo: 'alterno', colorAlterno: '#f5f3ef' } })
check(alterno.colorAlterno === '#F5F3EF', 'fondo alterno en mayúsculas')
check(e.variablesCssSeccion(alterno)['--seccion-fondo-alterno'] === '#F5F3EF', 'variable del fondo alterno')
check(e.variablesCssSeccion({ v: 1, fondo: 'tema', colorAlterno: '#F5F3EF' })['--seccion-fondo-alterno'] === undefined, 'la variable solo con fondo alterno')

const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
check(css.includes('var(--seccion-fondo-alterno,'), 'el CSS usa el color propio del fondo alterno')

if (problemas.length) {
  console.error(`verify:estilo-tarjeta ${problemas.length} fallos de ${casos}`)
  for (const msg of problemas) console.error(' -', msg)
  process.exit(1)
}
console.log(`verify:estilo-tarjeta ok (${casos})`)
