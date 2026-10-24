/**
 * verify-cascaron-listado.mjs — sin claves nuevas no hay encabezado, fondo ni listado aparte.
 *
 *   npm run verify:cascaron-listado
 */
import { combinarEncabezado, leerEncabezado, leerFondo, leerLista, listaDelInspector, estilosFondo } from '../lib/website/cascaronSeccion.ts'
import { expandirCategorias, pedidoServidor, leerPresentacion, clasesColumnasListado, recortePresentacion } from '../lib/products/fuenteListado.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(leerEncabezado({}) === null, 'sin encabezado no hay cascarón')
check(leerEncabezado({ title: 'Hoy' }) === null, 'el título de hoy no es el encabezado nuevo')
check(leerEncabezado({ section_header: {} }) === null, 'un encabezado vacío no cambia nada')
check(leerEncabezado({ section_header: { title: 'Nuevos', align: 'left', layout: 'inline' } })?.layout === 'inline', 'la fila título y botón se lee')
check(leerEncabezado({ section_header: { title_color: 'red' } }) === null, 'un color inválido no cuenta')
check(leerFondo({}) === null, 'sin fondo nuevo')
check(leerFondo({ bg_color: '#fff' }) === null, 'el fondo viejo no es section_background')
check(estilosFondo(leerFondo({ section_background: { gradient_1: '#111111', gradient_2: '#eeeeee', gradient_angle: 90 } })).backgroundImage?.includes('90deg'), 'el degradado lleva el ángulo')
check(leerFondo({ section_background: { separator: 'none' } }) === null, 'separador ninguno no cambia el fondo')
check(leerFondo({ section_background: { image_url: 'javascript:alert(1)' } }) === null, 'una imagen insegura no se pinta')

check(pedidoServidor({}) === null, 'sin fuente se queda el listado de 500')
check(pedidoServidor({ product_source: 'all' }) === null, 'todos, sin tope, sigue en el cliente')
check(pedidoServidor({ selected_category_ids: [1] }) === null, 'las categorías de hoy no piden consulta nueva')
check(pedidoServidor({ product_source: 'categories', selected_category_ids: [10], include_subcategories: true })?.includeSubcategories === true, 'categorías con hijos')
check(pedidoServidor({ product_source: 'manual', selected_product_ids: '4, 8' })?.productIds.join(',') === '4,8', 'la selección manual acepta una lista')
check(pedidoServidor({ product_source: 'new', new_days: 14 })?.days === 14, 'nuevos usa los días')
check(pedidoServidor({ products_limit: 12 })?.limit === 12, 'un tope entre 4 y 100 consulta en el servidor')
check(pedidoServidor({ products_limit: 2 }) === null, 'un tope menor de 4 no se acepta')
check(pedidoServidor({ exclude_out_of_stock: true }) === null, 'excluir agotados, solo, no cambia la consulta')
check(pedidoServidor({ pagination: 'pages', per_page: 8 })?.limit === 8, 'las páginas piden el tamaño al servidor')
check(pedidoServidor({ pagination: 'none' }) === null, '«solo el límite» sin tope sigue en el cliente')

const arbol = [
  { id: 1, parent_id: null },
  { id: 2, parent_id: 1 },
  { id: 3, parent_id: 2 },
  { id: 9, parent_id: null },
]
check(expandirCategorias([1], arbol, false).join(',') === '1', 'sin hijos solo el id')
check(expandirCategorias([1], arbol, true).sort((a, b) => a - b).join(',') === '1,2,3', 'con hijos baja todo el árbol')

check(leerPresentacion({}) === null, 'sin presentación nueva')
check(leerPresentacion({ display_mode: 'grid' }) === null, 'cuadrícula es la de hoy')
check(leerPresentacion({ display_mode: 'carousel' })?.displayMode === 'carousel', 'el carrusel sí cambia')
check(clasesColumnasListado(null) === null, 'sin columnas nuevas no hay clase')
check(clasesColumnasListado({ columnsDesktop: 4, columnsMobile: 2 })?.includes('lg:grid-cols-4'), 'cuatro columnas de escritorio')
check(recortePresentacion(40, 2, { pagination: 'pages', perPage: 8 })?.desde === 8, 'la página 2 empieza en el octavo')
check(recortePresentacion(40, 1, { pagination: 'none' })?.paginas === 1, 'sin páginas se ve el universo')
check(recortePresentacion(40, 1, null) === null, 'sin paginación nueva sigue el corte de hoy')
check(leerPresentacion({ chip_source: 'manual', chip_category_ids: '3, 1' })?.chipCategoryIds?.join(',') === '3,1', 'la barra manual conserva el orden')
check(leerPresentacion({ chip_mobile: 'scroll' })?.chipMobile === 'scroll', 'el scroll de chips se lee')
check(estilosFondo(leerFondo({ section_background: { image_url_mobile: 'https://cdn.ejemplo/a.jpg' } }))['--fondo-movil']?.includes('https://cdn.ejemplo/a.jpg'), 'el fondo de celular queda en la variable')
check(combinarEncabezado({ title: 'Hoy' }, null) === null, 'sin estilo global el título de hoy sigue')
check(combinarEncabezado({}, { align: 'left', layout: 'inline' })?.layout === 'inline', 'el global alinea cuando la sección no trae encabezado')
check(combinarEncabezado({ section_header: { align: 'center' } }, { align: 'left' })?.align === 'center', 'la sección pisa la alineación global')
check(combinarEncabezado({ section_header: { align: 'inherit', title: 'X' } }, { align: 'right' })?.align === 'right', 'heredar toma la alineación global')
check(leerEncabezado({ section_header: { section_action: { text: 'Ver todas', href: '/categorias', kind: 'link', position: 'inline' } } })?.action?.kind === 'link', 'la acción es un enlace')
check(leerEncabezado({ section_header: { section_action: { text: 'Ver', href: '/x' } } })?.action?.kind === 'link', 'sin tipo, la acción es enlace')
check(leerEncabezado({ section_header: { view_all: true, view_all_url: '/ofertas', layout: 'inline' } })?.action?.position === 'inline', 'ver todo sigue siendo la acción de la fila')
check(leerLista({}) === null, 'sin modo de lista no hay renderer nuevo')
check(leerLista({ display_mode: 'grid' }) === null, 'la cuadrícula de hoy no cambia')
check(leerLista({ display_mode: 'masonry', pagination: 'full' })?.pagination === 'full', 'masonry y mostrar todo')
check(leerLista({ section_display: { display_mode: 'carousel', arrow_position: 'top', autoplay: true } })?.arrows === 'top', 'las flechas pueden ir arriba')
check(listaDelInspector({ autoplay: true }) === null, 'el autoplay de las marcas no cambia el listado')
check(listaDelInspector({ section_display: { display_mode: 'list' } })?.mode === 'list', 'el inspector lee section_display')
check(leerEncabezado({ section_header: { section_action: { text: 'Ver', href: 'perros', dest: 'category', kind: 'link' } } })?.action?.href === '/categorias/perros', 'un slug de categoría se vuelve ruta')
check(leerFondo({ section_background: { overlay_opacity: 0 } })?.overlay_opacity === 0, 'una capa en cero se lee y no tapa')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
