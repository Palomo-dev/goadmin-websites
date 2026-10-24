/** Regresión de bloques esenciales: render SSR compartido por preview/publicado, sin base ni red. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(ROOT, 'package.json'))
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const e = React.createElement
let preview = false
let live = null
let viewers = null
const stub = () => null
const generic = new Proxy({}, { get: (_, name) => name === '__esModule' ? true : stub })
const mocks = {
  'next/link': { default: ({ children, ...props }) => e('a', props, children), __esModule: true },
  '@/components/sections/PreviewBridge': { useIsPreviewMode: () => preview, PreviewBridge: ({ initialSections, children }) => children(live ?? initialSections) },
  '@/components/sections/SectionRenderer': { SectionRenderer: ({ section, data }) => e('article', { 'data-type': section.section_type },
    section.section_type === 'product_gallery' ? e('img', { alt: data.product.name }) :
    section.section_type === 'product_info' ? e('h1', null, data.product.name, ' ', data.price) :
    section.section_type === 'product_actions' ? e('button', null, 'Agregar al carrito') :
    section.section_type === 'category_products' ? e('div', { role: 'grid' }, data.products.map((p) => e('span', { key: p.id }, p.name))) : section.section_type) },
  '@/components/site/EnlaceSitio': { EnlaceSitio: ({ children }) => e('a', null, children) },
  '@/components/site/ProductImageGallery': { ProductImageGallery: () => e('img', { alt: 'galeria' }) },
  '@/components/site/CurrencyProvider': { Price: ({ value }) => e('span', null, value) },
  '@/components/site/UrgenciaDe': null,
  '@/lib/hooks/usePersonasViendo': { usePersonasViendo: (activo) => activo ? viewers : null },
  '@/lib/utils': { getCartKey: () => 'carrito-test' },
  './useAjustesVivosPreview': { useAjustesVivosPreview: () => null },
  '@/lib/outlet/RutaSitioContext': { useRutaSitio: () => ({ prefijo: '' }) },
}
for (const alias of ['StickyAddToCart','reviews/ProductReviews','RelatedProducts','ExpandableDescription','reviews/ReviewSummaryBadge','CountdownBanner']) mocks[`@/components/site/${alias}`] = generic
mocks['@/app/productos/[id]/ProductDetailActions'] = generic
mocks['@/app/categorias/[slug]/CategoryPageClient'] = generic
const cache = new Map()
function load(file) {
  const absoluto = path.resolve(ROOT, file)
  if (cache.has(absoluto)) return cache.get(absoluto).exports
  const module = { exports: {} }; cache.set(absoluto, module)
  const codigo = ts.transpileModule(fs.readFileSync(absoluto, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText
  function local(id) {
    if (mocks[id]) return mocks[id]
    if (id.startsWith('@/') || id.startsWith('.')) {
      let destino = id.startsWith('@/') ? path.join(ROOT, id.slice(2)) : path.resolve(path.dirname(absoluto), id)
      if (!path.extname(destino)) destino += fs.existsSync(destino + '.tsx') ? '.tsx' : '.ts'
      return load(destino)
    }
    return require(id)
  }
  new Function('require', 'module', 'exports', codigo)(local, module, module.exports)
  return module.exports
}
const { ProductDetailRenderer } = load('components/sections/product-detail/ProductDetailRenderer.tsx')
const { CategoryDetailRenderer } = load('components/sections/category-detail/CategoryDetailRenderer.tsx')
const { completarBloquesBase, BLOQUES_BASE_PRODUCTO } = load('lib/website/bloquesBaseDetalle.ts')
const section = (type, content = {}, settings = {}) => ({ id: type, section_type: type, section_variant: 'default', content, settings, is_visible: true })
const organization = { id: 140, subdomain: 'org-140', website_settings: {} }
const product = { id: 1, name: 'Producto prueba', sku: 'P-1', track_stock: true, stock_levels: [{ qty_on_hand: 8, qty_reserved: 5 }] }
const props = { organization, primaryColor: '#334455', product, price: { price: 42 }, variants: [], modifierGroups: [], relatedProducts: [], imageUrls: [], imageUrl: null, comparePrice: null, isParent: false }
let casos = 0
function check(cond, msg) { casos++; assert.ok(cond, msg) }
for (const modo of ['publicado', 'preview']) {
  preview = modo === 'preview'; live = null
  {
    for (const extras of [[section('product_benefits')], [section('countdown')], [section('product_gallery')]]) {
      const html = renderToStaticMarkup(e(ProductDetailRenderer, { ...props, templatePage: { website_page_sections: extras } }))
      for (const tipo of BLOQUES_BASE_PRODUCTO) check(html.includes(`data-type="${tipo}"`), `${modo}/${extras[0].section_type}: falta ${tipo}`)
      check(html.includes('Producto prueba') && html.includes('Agregar al carrito') && html.includes('42'), 'nombre/precio/acción permanecen visibles')
    }
    const cat = renderToStaticMarkup(e(CategoryDetailRenderer, { organization, primaryColor: '#334455', templatePage: { website_page_sections: [section('category_header')] }, category: { name: 'Categoría' }, products: [product], subcategories: [], total: 1, totalPages: 1, currentPage: 1, currentSort: '', currentSubcategory: '', currentView: 'grid', categorySlug: 'categoria' }))
    check(cat.includes('data-type="category_products"') && cat.includes('Producto prueba'), 'categoría con solo cabecera conserva grilla')
  }
}
for (const posicion of ['before', 'after']) {
  const categoria = renderToStaticMarkup(e(CategoryDetailRenderer, { organization, primaryColor: '#334455', templatePage: { website_page_sections: [section('category_header'), section('features_grid', { detail_position: posicion })] }, category: { name: 'Categoría' }, products: [product], subcategories: [], total: 1, totalPages: 1, currentPage: 1, currentSort: '', currentSubcategory: '', currentView: 'grid', categorySlug: 'categoria' }))
  check(posicion === 'before' ? categoria.indexOf('data-type="features_grid"') < categoria.indexOf('data-type="category_products"') : categoria.indexOf('data-type="features_grid"') > categoria.indexOf('data-type="category_products"'), `categoría respeta detail_position=${posicion}`)
}
preview = false
const completa = BLOQUES_BASE_PRODUCTO.map((t) => section(t))
const html = renderToStaticMarkup(e(ProductDetailRenderer, { ...props, templatePage: { website_page_sections: [...completa, section('product_benefits', { detail_position: 'before' })] } }))
check(html.indexOf('data-type="product_benefits"') < html.indexOf('data-product-base'), 'before funciona también con plantilla completa')
const despues = renderToStaticMarkup(e(ProductDetailRenderer, { ...props, templatePage: { website_page_sections: [...completa, section('product_benefits', { detail_position: 'after' })] } }))
check(despues.indexOf('data-type="product_benefits"') > despues.indexOf('data-type="product_actions"'), 'after funciona con plantilla completa')
check((html.match(/data-type="product_actions"/g) || []).length === 1, 'no duplica acción cuando ya existe')
const hidden = completarBloquesBase([section('product_gallery', {}, { visibilidad: { computador: false, celular: false, tableta: true } }), { ...section('product_actions'), is_visible: false }], BLOQUES_BASE_PRODUCTO)
check(hidden.find((s) => s.section_type === 'product_gallery').settings.visibilidad.celular === true, 'base no desaparece por viewport')
check(hidden.filter((s) => s.section_type === 'product_actions' && s.is_visible).length === 1, 'se recupera acción esencial oculta')
preview = true; live = [section('product_benefits')]
check(renderToStaticMarkup(e(ProductDetailRenderer, { ...props, templatePage: { website_page_sections: completa } })).includes('Agregar al carrito'), 'cambio de secciones del bridge conserva base')
// Render verdadero de urgencia: stock reservado se resta, ningún contador inventado.
mocks['@/components/site/UrgenciaDe'] = null
const { UrgenciaDe } = load('components/site/UrgenciaDe.tsx')
const { conversionDesdeColumnas } = load('lib/website/conversion.ts')
const conversion = conversionDesdeColumnas({ checkout_show_stock_warning: true, checkout_stock_warning_threshold: 5 })
conversion.urgencia.stockBajo.ubicaciones = ['producto']
conversion.urgencia.personasViendo = { activo: true, plantilla: '{n} personas viendo', ubicaciones: ['producto'] }
viewers = 7
const urgente = renderToStaticMarkup(e(UrgenciaDe, { settings: { conversion }, ubicacion: 'producto', primaryColor: '#334455', product }))
check(urgente.includes('Quedan 3'), 'stock verdadero resta reservas')
check(urgente.includes('7 personas viendo'), 'presencia muestra métrica real')
viewers = null
const sinMetrica = renderToStaticMarkup(e(UrgenciaDe, { settings: { conversion }, ubicacion: 'producto', primaryColor: '#334455', product: { track_stock: false } }))
check(!sinMetrica.includes('personas viendo') && !sinMetrica.includes('Quedan'), 'sin datos no inventa stock ni personas')
check(renderToStaticMarkup(e(UrgenciaDe, { settings: {}, ubicacion: 'producto', primaryColor: '#334455', product })) === '', 'sin conversion conserva el diseño anterior')
// El contador y los beneficios se renderizan de verdad: cada perilla modifica el DOM/CSS.
const { ContadorPublico } = load('components/site/ContadorPublico.tsx')
const contador = conversionDesdeColumnas({ countdown_enabled: true, countdown_mode: 'custom', countdown_end_date: '2099-12-31T23:59:00Z', countdown_show_in_product: true }).contadores[0]
const pintarContador = (c) => renderToStaticMarkup(e(ContadorPublico, { contador: c, finPromocion: null, primaryColor: '#334455', variante: 'inline' }))
const baseContador = pintarContador(contador)
for (const [clave, valor, evidencia] of [['forma', 'cuadrado', 'border-radius:0'], ['forma', 'redondo', 'border-radius:999px'], ['tamano', 'lg', 'text-2xl'], ['tamano', 'md', 'text-xl'], ['sombra', true, 'box-shadow:'], ['fondo', '#123456', 'background:#123456'], ['texto', '#abcdef', 'color:#abcdef'], ['borde', '#fedcba', 'border:1px solid #fedcba'], ['cajas', 'digito', 'rounded px-1.5']]) {
  const h = pintarContador({ ...contador, estilo: { ...contador.estilo, [clave]: valor } })
  check(h !== baseContador && h.includes(evidencia), `contador ${clave}=${valor} cambia su render`)
}
check(pintarContador({ ...contador, textoAntes: 'Empieza', textoDespues: 'Final' }).includes('Final'), 'texto posterior del contador se pinta')
check(pintarContador({ ...contador, formato: { ...contador.formato, dias: true } }).includes('días'), 'formato de días visible')
check(pintarContador({ ...contador, modo: { tipo: 'fecha', fin: '2000-01-01T00:00:00Z', zona: 'UTC' }, alTerminar: { tipo: 'mensaje', texto: 'Terminó' } }).includes('Terminó'), 'contador vencido muestra su mensaje')
check(pintarContador({ ...contador, modo: { tipo: 'fecha', fin: '2000-01-01T00:00:00Z', zona: 'UTC' }, alTerminar: { tipo: 'ocultar' } }) === '', 'contador vencido puede ocultarse')
const { FeaturesGridAlternating } = load('components/sections/saas/FeaturesGridAlternating.tsx')
const beneficios = { items: [{ icon: 'Star', title: 'Beneficio', description: 'Texto', image_url: '/foto.png' }] }
const dibujarBeneficios = (c) => renderToStaticMarkup(e(FeaturesGridAlternating, { content: c, primaryColor: '#334455' }))
const beneficiosDefault = dibujarBeneficios(beneficios)
check(beneficiosDefault.includes('object-cover'), 'beneficios sin cambios conservan imágenes grandes')
const fila = dibujarBeneficios({ ...beneficios, item_layout: 'icon_left', icon_shape: 'circle', icon_bg: true })
check(fila.includes('flex items-start gap-4') && !fila.includes('max-h-48'), 'ícono a izquierda es una fila con medio pequeño')
check(fila.includes('rounded-full'), 'forma circular cambia el contenedor')
check(dibujarBeneficios({ ...beneficios, item_layout: 'icon_top_small' }).includes('flex flex-col gap-3'), 'ícono pequeño arriba es visualmente distinto')
check(dibujarBeneficios({ ...beneficios, presentacion: 'texto' }).includes('/foto.png') === false, 'solo texto oculta las imágenes')
check(dibujarBeneficios({ ...beneficios, card_preset: 'tarjetas' }).includes('padding:24px'), 'preset de tarjetas PR27 integrado')
check(dibujarBeneficios({ ...beneficios, item_layout: 'icon_left', icon_size: 'lg' }).includes('width:48px'), 'tamaño del ícono altera geometría real')
check(dibujarBeneficios({ ...beneficios, item_layout: 'icon_left', icon_color: '#abcdef' }).includes('color:#abcdef'), 'color del ícono visible')
const { UrgenciaSection } = load('components/sections/countdown/UrgenciaSection.tsx')
for (const ubicacion of ['producto', 'carrito', 'checkout']) {
  const reloj = renderToStaticMarkup(e(UrgenciaSection, { content: { kind: 'countdown', locations: [ubicacion], mode: 'custom', end_date: '2099-12-31T23:59:00Z', counter_shape: 'cuadrado', title: 'Termina', counter_size: 'lg', counter_shadow: true }, organization, data: { ubicacion }, primaryColor: '#334455' }))
  check(reloj.includes(`data-urgencia-ubicacion="${ubicacion}"`) && reloj.includes('Termina') && reloj.includes('text-2xl') && reloj.includes('border-radius:0'), `sección reloj configura render en ${ubicacion}`)
}
const stockSeccion = renderToStaticMarkup(e(UrgenciaSection, { content: { kind: 'stock', message: 'Solo {n}', threshold: 5 }, organization, data: { product }, primaryColor: '#334455' }))
check(stockSeccion.includes('Solo 3'), 'sección de stock traduce mensaje y reservas')
viewers = 7
const personasSeccion = renderToStaticMarkup(e(UrgenciaSection, { content: { kind: 'viewers', message: 'Ahora: {n}' }, organization, primaryColor: '#334455' }))
check(personasSeccion.includes('Ahora: 7'), 'sección de personas recibe métricas reales')
check(renderToStaticMarkup(e(UrgenciaSection, { content: { locations: ['checkout'] }, organization, data: { ubicacion: 'producto' }, primaryColor: '#334455' })) === '', 'sección no aparece fuera de las ubicaciones elegidas')
console.log(`✓ ${casos} pruebas de render de detalle y urgencia (SSR de la misma composición preview/publicado; sin afirmar navegador ni despliegue)`)
