/**
 * verify-ficha-editable.mjs — Figma «16 Sitio web», «Páginas de detalle: todo lo que se ve se
 * edita» (aprobado por el dueño el 2026-11-25), bloques 1 a 6 (el 2 con la opción B del dueño: dato real o texto editable).
 *
 *   npm run verify:ficha-editable
 *
 * Dos caras, como las demás verificaciones de la ficha:
 * 1. Sin claves nuevas, la tienda de hoy: primera talla elegida, galería cuadrada sin zoom, las 4
 *    partes de Información, la barra de categoría con sus seis órdenes, 4 columnas y números.
 * 2. Con cada clave, lo prometido: «Que el cliente elija», proporción y zoom, partes y orden,
 *    filas de especificaciones, orden al entrar, columna lateral, «Ver más», URL que conserva lo
 *    elegido, orden real por precio.
 * Nada aquí toca reseñas (las de ejemplo quedan como están), carrito, checkout ni pasarelas.
 */
import { readFileSync } from 'node:fs'
import {
  normalizarSelectorFicha,
  textoElegirOpcion,
  normalizarGaleriaFicha,
  normalizarInfoFicha,
  normalizarOrdenFiltrosCategoria,
  normalizarProductosCategoria,
  CLAVES_AJUSTE_TIENDA,
} from '../lib/website/v2/contrato/seccionesTienda.ts'
import { normalizarEspecificacionesFicha } from '../lib/website/v2/seccionesFicha.ts'
import { filasEnvioFicha } from '../components/sections/product-detail/filasEnvio.ts'
import { esFiltrosLaterales, filtrosActivos, planColumnasCategoria, urlListadoCategoria } from '../components/sections/category-detail/columnasCategoria.ts'

let casos = 0
const problemas = []
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')

// ── 1. Selector de talla (bloque 1) ──
igual(normalizarSelectorFicha({}).inicial, 'first_available', 'talla: sin claves, la primera disponible')
igual(normalizarSelectorFicha({ button_hint: 'auto' }).inicial, 'first_available', 'talla: la pista de antes no cambia nada')
igual(normalizarSelectorFicha({ initial_variant: 'customer' }).inicial, 'customer', 'talla: que el cliente elija')
igual(textoElegirOpcion('Elige tu {opción}', 'Talla'), 'Elige tu talla', 'talla: texto del botón')
const sel = leer('components/site/VariantSelector.tsx')
check(sel.includes('if (clienteElige) return') && sel.includes('{cfg.cabecera && (') && sel.includes('selectedVariant && cfg.recuadro &&'), 'talla: el selector lee preselección, cabecera y recuadro')
const barra = leer('components/site/barraFija/useCompraBarraFija.ts')
check(barra.includes('if (isParent && variants.length > 0 && !selectedVariant) {'), 'talla: la barra fija nunca agrega el padre sin talla')

// ── 1b. Envío y devoluciones (bloque 2, opción B) ──
igual(filasEnvioFicha({}, null).map((f) => f.texto), ['24-48 horas hábiles', 'Calculado al finalizar la compra', '30 días para devoluciones', 'Envíos a todo el país'], 'envío: sin datos ni textos, las frases de siempre')
igual(filasEnvioFicha({ delivery_time_text: 'Llega en 3 días', show_coverage: false }, null).map((f) => f.clave), ['entrega', 'costo', 'devoluciones'], 'envío: la cobertura se puede apagar')
igual(filasEnvioFicha({ delivery_time_text: 'Llega en 3 días' }, { llega: 'Llega en 2 a 4 días', umbral: 150000, envioGratis: null })[0].texto, '2 a 4 días', 'envío: el tiempo real de las zonas manda sobre el texto')
check(filasEnvioFicha({}, { llega: null, umbral: 150000, envioGratis: null })[1].texto.startsWith('Gratis en compras desde $ 150'), 'envío: «envío gratis desde» real en el costo')
igual(filasEnvioFicha({ delivery_time_text: 'Llega en 3 días' }, null)[0].texto, 'Llega en 3 días', 'envío: sin dato real, el texto del comercio')
check(!leer('components/sections/product-detail/ProductShipping.tsx').includes("'24-48 horas hábiles'") && !leer('components/sections/product-detail/ProductDescription.tsx').includes("'24-48 horas hábiles'"), 'envío: ya no hay frases fijas en el bloque ni en la Descripción')

// ── 2. Galería (bloque 3) ──
igual(normalizarGaleriaFicha({}), { proporcion: 'square', zoom: 'none', miniatura: 64, puntos: true, columnas: 3, sigueVariante: false }, 'galería: sin claves = hoy')
const gal = leer('components/site/ProductImageGallery.tsx')
check(gal.includes("if (zoom === 'none') return <img src={src} alt={alt} className={clases} />"), 'galería: sin zoom, la foto de siempre')
check(gal.includes("square: 'aspect-square'") && gal.includes("'4/5': 'aspect-[4/5]'"), 'galería: proporciones con clases literales')

// ── 3. Información del producto (bloque 4) ──
igual(normalizarInfoFicha({}).partes, ['sku', 'title', 'rating', 'price'], 'información: sin lista, las 4 de siempre')
igual(normalizarInfoFicha({ blocks: [{ id: 'price' }, { id: 'stock' }, { id: 'title' }, { id: 'share' }] }).partes, ['sku', 'rating', 'price', 'stock', 'title'], 'información: orden del editor; las de siempre no nombradas, en su lugar; las que no pinta se ignoran')
const info = leer('components/sections/product-detail/ProductInfo.tsx')
check(!info.includes("'N/A'"), 'información: sin SKU ya no dice «SKU: N/A»')

// ── 4. Especificaciones «Por defecto» (bloque 5) ──
igual(normalizarEspecificacionesFicha({}).filas.length, 6, 'especificaciones: sin lista, las seis columnas')
const specs = leer('components/sections/product-detail/ProductSpecs.tsx')
check(!specs.includes('product.product_attributes') && specs.includes('leerFilasPropias(product?.specifications)'), 'especificaciones: lee la ficha técnica real, no una tabla inexistente')

// ── 5. Categoría (bloque 6) ──
const f0 = normalizarOrdenFiltrosCategoria({})
igual([f0.posicion, f0.ordenes.length, f0.ordenInicial, f0.mostrarConteo], ['top', 6, 'best_selling', true], 'categoría: sin claves, la barra de hoy')
igual(normalizarOrdenFiltrosCategoria({ sort_options: [{ id: 'price_asc', visible: false }], default_sort: 'price_asc' }).ordenInicial, 'best_selling', 'categoría: el orden al entrar siempre está entre las opciones')
igual(normalizarProductosCategoria({}), { columnas: 4, columnasCelular: 2, porPagina: null, paginacion: 'numbers' }, 'categoría: sin claves, la rejilla de hoy')
igual(normalizarProductosCategoria({ columns: '4' }).columnas, 4, 'categoría: las 4 columnas guardadas siguen igual')
igual(urlListadoCategoria('sala', { orden: 'best_selling', vista: 'grid' }), '/categorias/sala', 'url: defaults fuera')
igual(urlListadoCategoria('sala', { orden: 'price_asc', sub: 'sofas', vista: 'list', page: 3 }), '/categorias/sala?orden=price_asc&sub=sofas&vista=list&page=3', 'url: la paginación conserva orden, subcategoría y vista')
igual(urlListadoCategoria('sala', { orden: 'best_selling' }, 'newest'), '/categorias/sala?orden=best_selling', 'url: con otro orden al entrar, «Más vendidos» va en la URL')
igual(filtrosActivos('', 'newest', 'newest'), 0, 'filtros activos: el orden al entrar no cuenta')
const lateral = { section_type: 'category_filters', section_variant: 'default', is_visible: true, content: { filter_position: 'sidebar' } }
check(esFiltrosLaterales(lateral) && !esFiltrosLaterales({ ...lateral, content: {} }), 'categoría: «Columna lateral» arma la columna; sin la clave, no')
check(planColumnasCategoria([lateral, { section_type: 'category_products', section_variant: 'default' }]) !== null, 'categoría: la columna lateral envuelve el listado')
const productos = leer('components/sections/category-detail/CategoryProducts.tsx')
check(productos.includes("4: 'lg:grid-cols-3 xl:grid-cols-4'") && productos.includes("rejilla.columnasCelular === 1 ? 'grid-cols-1' : 'grid-cols-2'"), 'categoría: 4 columnas = la rejilla de siempre')
const consultas = leer('lib/supabase/queries.ts')
check(consultas.includes("if (sort === 'price_asc' || sort === 'price_desc') {") && consultas.includes(".select('product_id, price')"), 'categoría: el orden por precio ordena por precio')
for (const tipo of ['product_actions', 'product_gallery', 'product_info', 'category_filters', 'category_products']) {
  check(Array.isArray(CLAVES_AJUSTE_TIENDA[tipo]), `contrato: ${tipo} declara sus claves de ajuste`)
}

// ── 6. Lo que no se toca ──
for (const ruta of ['components/sections/product-detail/ProductGallery.tsx', 'components/sections/product-detail/ProductInfo.tsx', 'components/sections/product-detail/ProductSpecs.tsx', 'components/sections/category-detail/CategoryProducts.tsx']) {
  const src = leer(ruta)
  check(!/\/api\/orders|CheckoutWizard|wompi/i.test(src), `${ruta}: no toca pedidos, checkout ni pasarelas`)
}

if (problemas.length > 0) {
  console.error(`✗ verify-ficha-editable: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-ficha-editable: ${casos} comprobaciones (sin claves = la tienda de hoy; cada opción hace lo que dice)`)
