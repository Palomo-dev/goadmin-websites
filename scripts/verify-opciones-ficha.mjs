/**
 * verify-opciones-ficha.mjs — opciones por bloque de la ficha (PDP personalizable, fases 1 y 2).
 *
 *   npm run verify:opciones-ficha
 *
 * - `leerOpcionesBloqueFicha(tipo, contenido)` devuelve solo lo válido de `contenido.ficha`, campo
 *   por campo; lo inválido queda fuera (= lo de hoy) y nunca lanza.
 * - Las opciones NO están dentro de `esquemaSeccion`: una página con opciones inválidas sigue
 *   siendo un documento válido.
 * - `buildDefaultProductDetailSections(page_settings)` arma el orden y la visibilidad del layout
 *   monolítico de antes (la equivalencia al píxel la prueba verify:ficha-diff).
 */
import {
  CLAVE_OPCIONES_FICHA,
  OPCIONES_FICHA_POR_DEFECTO,
  TIPOS_BLOQUE_FICHA,
  esquemaPagina,
  esTipoBloqueFicha,
  leerOpcionesBloqueFicha,
} from '../lib/website/v2/contrato/documentoSitio.ts'
import { buildDefaultProductDetailSections, TIPO_URGENCIA_FICHA } from '../lib/defaultProductDetailSections.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const leer = (tipo, ficha) => leerOpcionesBloqueFicha(tipo, { [CLAVE_OPCIONES_FICHA]: ficha })

// ─── Entradas que no son objeto: {} y sin lanzar ─────────────────────────────────────────────
for (const contenido of [undefined, null, 0, 'x', [], [1], true]) {
  for (const tipo of TIPOS_BLOQUE_FICHA) {
    check(igual(leerOpcionesBloqueFicha(tipo, contenido), {}), `${tipo}: contenido ${JSON.stringify(contenido)} → {}`)
  }
}
for (const ficha of [undefined, null, 3, 'grilla', [], [{ layout: 'grilla' }]]) {
  check(igual(leer('product_gallery', ficha), {}), `ficha ${JSON.stringify(ficha)} → {}`)
}
check(igual(leerOpcionesBloqueFicha('hero', { ficha: { layout: 'grilla' } }), {}), 'tipo ajeno a la ficha → {}')
check(igual(leerOpcionesBloqueFicha('product_specs', { ficha: { modo: 'acordeon' } }), {}), 'bloque sin opciones de fase 2 → {}')
check(esTipoBloqueFicha('product_gallery') && !esTipoBloqueFicha('product_urgency'), 'esTipoBloqueFicha')
// Las claves viejas del contenido (fuera de `ficha`) no se leen como opciones.
check(igual(leerOpcionesBloqueFicha('product_gallery', { layout: 'grilla', zoom: 'hover' }), {}), 'claves viejas fuera de `ficha` no cuentan')

// ─── Galería ─────────────────────────────────────────────────────────────────────────────────
for (const layout of ['izquierda', 'derecha', 'miniaturas_abajo', 'miniaturas_lateral', 'grilla', 'scroll']) {
  check(igual(leer('product_gallery', { layout }), { layout }), `galería layout ${layout}`)
}
check(igual(leer('product_gallery', { layout: 'carousel', ancho: 55, sticky: false, flechas: 'no', puntos: true, zoom: 1, otra: 1 }),
  { ancho: 55, sticky: false, puntos: true }), 'galería: inválidos y desconocidos fuera, válidos dentro')
check(igual(leer('product_gallery', { ancho: 29 }), {}) && igual(leer('product_gallery', { ancho: 71 }), {}) && igual(leer('product_gallery', { ancho: 50.5 }), {}), 'galería: ancho entero 30-70')
check(igual(leer('product_gallery', { ancho: 30, zoom: true }), { ancho: 30, zoom: true }), 'galería: límites')

// ─── Información ─────────────────────────────────────────────────────────────────────────────
check(igual(leer('product_info', { mostrarSku: false, mostrarRating: true, mostrarMarca: true, mostrarPrecioComparado: false, mostrarAvisoStock: false }),
  { mostrarSku: false, mostrarRating: true, mostrarMarca: true, mostrarPrecioComparado: false, mostrarAvisoStock: false }), 'info: los cinco interruptores')
check(igual(leer('product_info', { mostrarSku: 'false', mostrarMarca: 0 }), {}), 'info: solo booleanos')

// ─── Acciones ────────────────────────────────────────────────────────────────────────────────
check(igual(leer('product_actions', { disposicion: 'inline', estilo: 'pastilla', mostrarComprarAhora: false, variantes: 'swatches' }),
  { disposicion: 'inline', estilo: 'pastilla', mostrarComprarAhora: false, variantes: 'swatches' }), 'acciones: todo válido')
for (const estilo of ['heredar_tarjeta', 'tema', 'solido', 'contorno', 'pastilla']) check(leer('product_actions', { estilo }).estilo === estilo, `acciones: estilo ${estilo}`)
check(igual(leer('product_actions', { disposicion: 'split', estilo: 'fantasma', variantes: 'radio' }), {}), 'acciones: valores fuera del catálogo')

// ─── Beneficios ──────────────────────────────────────────────────────────────────────────────
check(igual(leer('product_benefits', {
  items: [
    { icono: 'Truck', titulo: 'Envío gratis', texto: 'Desde $150.000', color: '#16a34a' },
    { icono: 'Shield', titulo: 'Garantía', color: 'verde' }, // color inválido: se va el color, queda el ítem
    { icono: '', titulo: 'Sin ícono' }, // inválido: fuera
    { titulo: 'Sin ícono' }, // inválido: fuera
    'texto suelto', // inválido: fuera
    { icono: 'Star', titulo: 'Calidad', texto: 42, extra: true }, // texto inválido y clave extra: se ignoran
  ],
  columnas: 3,
  ocultar: false,
}), {
  items: [
    { icono: 'Truck', titulo: 'Envío gratis', texto: 'Desde $150.000', color: '#16a34a' },
    { icono: 'Shield', titulo: 'Garantía' },
    { icono: 'Star', titulo: 'Calidad' },
  ],
  columnas: 3,
  ocultar: false,
}), 'beneficios: ítems válidos, colores y textos inválidos descartados')
check(igual(leer('product_benefits', { items: [{ icono: '', titulo: '' }], columnas: 5 }), {}), 'beneficios: sin ítems válidos ni columnas válidas → {}')
check(igual(leer('product_benefits', { items: 'Truck' }), {}), 'beneficios: items no lista → fuera')
check(leer('product_benefits', { items: Array.from({ length: 12 }, (_, i) => ({ icono: 'Star', titulo: `B${i}` })) }).items?.length === 8, 'beneficios: máximo 8 ítems')
check(igual(leer('product_benefits', { ocultar: true }), { ocultar: true }), 'beneficios: ocultar')

// ─── Descripción, relacionados, reseñas ──────────────────────────────────────────────────────
for (const modo of ['expandible', 'pestanas', 'acordeon']) check(leer('product_description', { modo }).modo === modo, `descripción: ${modo}`)
check(igual(leer('product_description', { modo: 'tabs' }), {}), 'descripción: modo inválido')
check(igual(leer('related_products', { modo: 'grilla', cantidad: 12, titulo: 'También te puede gustar', fuente: 'etiqueta' }),
  { modo: 'grilla', cantidad: 12, titulo: 'También te puede gustar', fuente: 'etiqueta' }), 'relacionados: todo válido')
check(igual(leer('related_products', { modo: 'grid', cantidad: 0, titulo: '', fuente: 'manual' }), {}), 'relacionados: inválidos')
check(igual(leer('related_products', { cantidad: 25 }), {}) && leer('related_products', { cantidad: 24 }).cantidad === 24, 'relacionados: cantidad 1-24')
check(igual(leer('product_reviews', { histograma: false, filtros: false, orden: 'utiles', ocultarFormulario: true }),
  { histograma: false, filtros: false, orden: 'utiles', ocultarFormulario: true }), 'reseñas: todo válido')
check(igual(leer('product_reviews', { orden: 'helpful', histograma: 'no' }), {}), 'reseñas: inválidos')

// ─── Defaults: cada valor por defecto es válido para su propio esquema ───────────────────────
for (const tipo of TIPOS_BLOQUE_FICHA) {
  const defecto = OPCIONES_FICHA_POR_DEFECTO[tipo]
  check(igual(leer(tipo, defecto), defecto), `defaults de ${tipo} válidos`)
}

// ─── Las opciones no entran en esquemaSeccion: el documento no se rechaza ────────────────────
const pagina = (contenido) => ({
  id: 'plantilla-product-detail', slug: 'plantillas/product-detail', tipo: 'product_detail', titulo: 'Ficha', publicada: true,
  secciones: [{ id: 'galeria', tipo: 'product_gallery', variante: 'default', version: 1, contenido }],
})
check(esquemaPagina.safeParse(pagina({ ficha: { layout: 'no-existe', ancho: 'mucho', zoom: [] } })).success, 'página con opciones inválidas sigue siendo válida')
check(esquemaPagina.safeParse(pagina({ ficha: 'cualquier cosa' })).success, 'página con `ficha` no objeto sigue siendo válida')

// ─── Bloques por defecto = layout monolítico de antes (orden y visibilidad) ──────────────────
const U = TIPO_URGENCIA_FICHA
const orden = (ps) => buildDefaultProductDetailSections(ps).filter((s) => s.is_visible).map((s) => s.section_type)
const BAJO = ['related_products', 'product_reviews']
const esperado = {
  base: [{}, ['product_gallery', 'product_info', 'product_description', U, 'product_actions', 'product_benefits', ...BAJO]],
  bajoPrecio: [{ description_position: 'below_price' }, ['product_gallery', 'product_info', U, 'product_description', 'product_actions', 'product_benefits', ...BAJO]],
  bajoBotones: [{ description_position: 'below_buttons' }, ['product_gallery', 'product_info', U, 'product_actions', 'product_description', 'product_benefits', ...BAJO]],
  sobreGaleria: [{ description_position: 'above_gallery' }, ['product_description', 'product_gallery', U, 'product_actions', 'product_benefits', ...BAJO]],
  desconocida: [{ description_position: 'x' }, ['product_gallery', 'product_info', U, 'product_actions', 'product_benefits', ...BAJO]],
  unaColumna: [{ columns: '1' }, ['product_gallery', 'product_info', U, 'product_actions', 'product_benefits', ...BAJO]],
  unaColumnaArriba: [{ columns: '1', description_position: 'above_gallery' }, ['product_description', 'product_gallery', 'product_info', U, 'product_actions', 'product_benefits', ...BAJO]],
  sinBeneficios: [{ show_benefits: false }, ['product_gallery', 'product_info', 'product_description', U, 'product_actions', ...BAJO]],
}
for (const [nombre, [ps, tipos]] of Object.entries(esperado)) {
  check(igual(orden(ps), tipos), `bloques por defecto (${nombre}): ${orden(ps).join(',')}`)
}
for (const ps of [{}, { columns: '1' }, { description_position: 'x' }, { show_benefits: false }]) {
  const todas = buildDefaultProductDetailSections(ps)
  check(todas.length === 8 && new Set(todas.map((s) => s.id)).size === 8, `bloques por defecto: siempre los 8 (ocultos con is_visible false) para ${JSON.stringify(ps)}`)
}
const conGaleria = buildDefaultProductDetailSections({ gallery_layout: 'grid', gallery_dots: false, buttons_layout: 'inline', related_products_layout: 'grid' })
check(igual(conGaleria.find((s) => s.section_type === 'product_gallery').content, { gallery_layout: 'grid', gallery_dots: false }), 'galería: solo las claves definidas de page_settings')
check(conGaleria.find((s) => s.section_type === 'product_actions').content.buttons_layout === 'inline', 'acciones: buttons_layout')
check(conGaleria.find((s) => s.section_type === 'related_products').content.related_products_layout === 'grid', 'relacionados: layout')
check(buildDefaultProductDetailSections(null).find((s) => s.section_type === 'product_actions').content.buttons_layout === 'stacked', 'acciones: stacked por defecto')

if (problemas.length) {
  console.error(`✗ verify:opciones-ficha: ${problemas.length} de ${casos} casos fallan`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify:opciones-ficha: ${casos} casos`)
