/**
 * verify-portada-tienda.mjs — compuerta del paquete W5 de las plantillas de tienda (portada y
 * variantes de secciones existentes).
 *
 *   npm run verify:portada-tienda
 *   node --disable-warning=ExperimentalWarning scripts/verify-portada-tienda.mjs
 *
 * Qué comprueba:
 *  1. «Ausente ⇒ igual a main»: pinta con React (renderToStaticMarkup) las secciones EXISTENTES que
 *     este paquete tocó (HeroFullscreen, HeroSplit, HeroButtons vía BotonesAdicionales,
 *     ImageTextRight, GalleryCarousel, las 4 variantes de testimonios y los banners, con y sin
 *     distribución nueva) con contenidos SIN claves nuevas, y compara el HTML con la huella
 *     tomada de la rama base antes del cambio. Una diferencia = una tienda publicada cambiaría.
 *  2. Sin datos reales no se pinta nada inventado: las variantes nuevas sin contenido no pintan
 *     nada fuera de la vista previa; el resumen de reseñas con 0 reseñas no aparece; el cupón sin
 *     código no aparece y el vencido tampoco.
 *  3. Con datos, cada pieza pinta lo suyo (buscador → /search?q=, cupón copiable, «4,9 de N
 *     reseñas», palabra resaltada…).
 *  4. Esquema: las columnas de `lib/queries/tienda/resenas.ts` están en la lista verificada por MCP
 *     (proyecto taqjemqjtumhwptchcxk, 2026-11-07). Con NEXT_PUBLIC_SUPABASE_URL y
 *     SUPABASE_SERVICE_ROLE_KEY en el entorno, además ejecuta las mismas lecturas (HEAD, sin filas)
 *     contra la base real: un nombre de columna inexistente responde 42703 y el script falla.
 *
 * Cómo carga el TSX sin Next: transpila con `sucrase` (ya está en node_modules, sin dependencias
 * nuevas) y resuelve el alias `@/` a la raíz del repo. Nada de esto entra al build.
 *
 * Huellas: si OTRO paquete cambia a propósito una de esas secciones (y su cambio es el que
 * manda), regenera con `VERIFY_PORTADA_HUELLAS=1 node scripts/verify-portada-tienda.mjs` en la
 * rama base y pega la salida en BASE. Nunca regeneres desde una rama con cambios de W5.
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'package.json'))
const Module = require('module')
const { transform } = require('sucrase')

// ── Cargador de TS/TSX con el alias `@/` ─────────────────────────────────────────────────────
const resolverOriginal = Module._resolveFilename
Module._resolveFilename = function (pedido, padre, ...resto) {
  const p = pedido.startsWith('@/') ? join(ROOT, pedido.slice(2)) : pedido
  return resolverOriginal.call(this, p, padre, ...resto)
}
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, archivo) => {
    const { code } = transform(readFileSync(archivo, 'utf8'), {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: archivo,
    })
    m._compile(code, archivo)
  }
}
// Los avisos de React en desarrollo (keys, etc.) no son el objeto de esta compuerta.
process.env.NODE_ENV = 'production'
// `useRouter` de next/navigation exige el router de la app montado: fuera de Next, uno de mentira
// (el buscador solo lo usa al enviar, que aquí no ocurre). El resto del módulo, el real.
const cargaOriginal = Module._load
Module._load = function (pedido, padre, ...resto) {
  const real = cargaOriginal.call(this, pedido, padre, ...resto)
  if (pedido === 'next/navigation') return { ...real, useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }) }
  return real
}
// La precarga (lib/queries/tienda/portada.ts) se prueba con la base de mentira de abajo: cuenta
// cada llamada para comprobar que una página de hoy no consulta NADA.
const llamadas = []
const BASE_FALSA = {
  '@/lib/supabase/queries': {
    getOrganizationCategories: async (...a) => (llamadas.push(['categorias', ...a]), [{ id: 1, name: 'Camping', slug: 'camping', parent_id: null }]),
    getOrganizationProducts: async (...a) => (llamadas.push(['primeros', ...a]), [{ id: 50, uuid: 'u50', name: 'P50', product_images: [{}] }]),
    getProductsByIdsCatalog: async (...a) => (llamadas.push(['porId', ...a]), a[0].map((id) => ({ id, uuid: `u${id}`, name: `P${id}` }))),
  },
  './resenas': {
    getResumenResenas: async (...a) => (llamadas.push(['resumen', ...a]), { promedio: 4.5, cantidad: 10 }),
  },
}
const cargaConFalsos = Module._load
Module._load = function (pedido, padre, ...resto) {
  if (padre && /lib[\\/]queries[\\/]tienda[\\/]portada\.ts$/.test(padre.filename) && BASE_FALSA[pedido]) return BASE_FALSA[pedido]
  return cargaConFalsos.call(this, pedido, padre, ...resto)
}

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const h = React.createElement
const cargar = (ruta) => require(join(ROOT, ruta))
const pintar = (Componente, props) => renderToStaticMarkup(h(Componente, props))
const huella = (html) => createHash('sha256').update(html).digest('hex').slice(0, 16)

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

// ── 1. Secciones existentes sin claves nuevas: idénticas a main ─────────────────────────────
const ORG = { id: 9001, name: 'Tienda de prueba', description: 'Descripción de prueba', timezone: 'America/Bogota', website_settings: {} }
const FOTO = 'https://ejemplo.test/foto.jpg'
const BOTONES_HOY = [
  { label: 'Comprar', url: '/productos', variant: 'solid' },
  { label: 'Ver más', url: '/nosotros', variant: 'outline' },
  { label: 'Escríbenos', url: '/contacto', variant: 'ghost', icon: 'ArrowRight', icon_position: 'right' },
]
const TESTIMONIOS = [
  { name: 'Cliente A', text: 'Texto de prueba uno.', rating: 5, role: 'Bogotá' },
  { name: 'Cliente B', text: 'Texto de prueba dos.', rating: 4 },
]

function fixturesHoy() {
  const { HeroFullscreen } = cargar('components/sections/hero/HeroFullscreen.tsx')
  const { HeroSplit } = cargar('components/sections/hero/HeroSplit.tsx')
  const { BotonesAdicionales } = cargar('components/sections/cta/BotonesAdicionales.tsx')
  const { ImageTextRight } = cargar('components/sections/image-text/ImageTextRight.tsx')
  const { GalleryCarousel } = cargar('components/sections/gallery/GalleryCarousel.tsx')
  const { TestimonialsQuotes } = cargar('components/sections/testimonials/TestimonialsQuotes.tsx')
  const { TestimonialsGrid } = cargar('components/sections/testimonials/TestimonialsGrid.tsx')
  const { TestimonialsCarousel } = cargar('components/sections/testimonials/TestimonialsCarousel.tsx')
  const { TestimonialsMinimal } = cargar('components/sections/testimonials/TestimonialsMinimal.tsx')
  const { PromoBannersGrid } = cargar('components/sections/retail/PromoBannersGrid.tsx')
  const base = { organization: ORG, primaryColor: '#111111', data: {} }
  return {
    'hero.fullscreen vacío': () => pintar(HeroFullscreen, { ...base, content: {} }),
    'hero.fullscreen con botones': () => pintar(HeroFullscreen, { ...base, content: { title: 'Muebles que se quedan', subtitle: 'Sub', image_url: FOTO, buttons: BOTONES_HOY } }),
    'hero.fullscreen abajo a la izquierda': () => pintar(HeroFullscreen, { ...base, content: { title: 'Título', content_position: 'bottom-left', text_align: 'left', cta_text: 'Ver', cta_url: '/x' } }),
    'hero.split con botones': () => pintar(HeroSplit, { ...base, content: { title: 'Hecho para vivirse', subtitle: 'Sub', image_url: FOTO, buttons: [BOTONES_HOY[0]] } }),
    'hero.split clásico': () => pintar(HeroSplit, { ...base, content: { title: 'T', cta_text: 'A', cta_url: '/a', cta_secondary_text: 'B', cta_secondary_url: '/b' } }),
    'cta.botones adicionales': () => pintar(BotonesAdicionales, { buttons: BOTONES_HOY, primaryColor: '#111111' }),
    'image_text.image_right': () => pintar(ImageTextRight, { ...base, content: { title: 'T', text: 'Texto', image_url: FOTO, cta_text: 'Ver', cta_url: '/x' } }),
    'image_text.image_right sin foto': () => pintar(ImageTextRight, { ...base, content: { title: 'T', body: '<p>Cuerpo</p>' } }),
    'gallery.carousel': () => pintar(GalleryCarousel, { ...base, content: { title: 'Galería', images: [{ url: FOTO, alt: 'a' }, { url: FOTO, alt: 'b', caption: 'Pie' }] } }),
    'testimonials.quotes': () => pintar(TestimonialsQuotes, { ...base, content: { items: TESTIMONIOS } }),
    'testimonials.quotes vacío': () => pintar(TestimonialsQuotes, { ...base, content: {} }),
    'testimonials.grid': () => pintar(TestimonialsGrid, { ...base, content: { title: 'Opiniones', items: TESTIMONIOS } }),
    'testimonials.carousel': () => pintar(TestimonialsCarousel, { ...base, content: { items: TESTIMONIOS } }),
    'testimonials.minimal': () => pintar(TestimonialsMinimal, { ...base, content: { items: TESTIMONIOS } }),
    'promo_banners.grid': () => pintar(PromoBannersGrid, { ...base, content: { title: 'Ofertas', banners: [{ title: 'Primera compra', subtitle: '10 %', button_text: 'Ver', link_type: 'url', link_url: '/ofertas' }, { title: 'Sin enlace', bg_color: '#222222' }] } }),
    'promo_banners.grid vacío': () => pintar(PromoBannersGrid, { ...base, content: {} }),
    'promo_banners.triple_center': () => pintar(PromoBannersGrid, { ...base, content: { banner_layout: 'triple_center', banners: [{ title: 'A', link_type: 'url', link_url: '/a' }, { title: 'B', image_url: FOTO }, { title: 'C', button_text: 'Ver' }] } }),
  }
}

// Huellas de la rama base `claude/plantillas-tienda` (= main en estos archivos), tomadas antes
// de cualquier cambio de W5 con VERIFY_PORTADA_HUELLAS=1.
const BASE = {
  'hero.fullscreen vacío': '45eab51881aa274c',
  'hero.fullscreen con botones': '5b111c476358cc55',
  'hero.fullscreen abajo a la izquierda': '3a26bf6ba782d9af',
  'hero.split con botones': '0809caca7d75957b',
  'hero.split clásico': '6ff14f4a4fe95be6',
  'cta.botones adicionales': '095dab83249ec9df',
  'image_text.image_right': '32372cfaaa76b8da',
  'image_text.image_right sin foto': 'ddd7a810800d096a',
  'gallery.carousel': '7f1201ef45ef8df1',
  'testimonials.quotes': 'fc514528f6b56c38',
  'testimonials.quotes vacío': '5c902fda57b36735',
  'testimonials.grid': '809b513422501e7b',
  'testimonials.carousel': '85712b31da91d41f',
  'testimonials.minimal': 'b8a3638269112b30',
  'promo_banners.grid': '49410a425fc9e032',
  'promo_banners.grid vacío': '194cc883b099cdc2',
  'promo_banners.triple_center': '4f39318481b48821',
}

const fixtures = fixturesHoy()
if (process.env.VERIFY_PORTADA_HUELLAS === '1') {
  for (const [nombre, f] of Object.entries(fixtures)) console.log(`  '${nombre}': '${huella(f())}',`)
  process.exit(0)
}
for (const [nombre, f] of Object.entries(fixtures)) {
  let html = ''
  try {
    html = f()
  } catch (e) {
    check(false, `${nombre}: no se pudo pintar (${e.message})`)
    continue
  }
  check(BASE[nombre] !== undefined, `${nombre}: falta su huella base`)
  check(huella(html) === BASE[nombre], `${nombre}: el HTML cambió respecto de main (huella ${huella(html)} ≠ ${BASE[nombre]})`)
}


// ── 2 y 3. Variantes nuevas: sin datos, nada; con datos, lo suyo ─────────────────────────────
const portada = cargar('lib/website/portadaTienda.ts')
const contrato = cargar('lib/website/v2/contrato/seccionesTienda.ts')
const { necesidadesPortadaTienda, pidePortadaTienda, textoResumenDe, usuarioInstagram, textoVigencia, productosDePortada, posicionLlamadoInstagram } = portada

// Necesidades: una página de hoy no pide nada (ninguna consulta nueva en las 83 tiendas).
const paginaDeHoy = [
  { section_type: 'hero', section_variant: 'fullscreen', content: { title: 'T' } },
  { section_type: 'products_grid', section_variant: 'grid', content: {} },
  { section_type: 'testimonials', section_variant: 'grid', content: { title: 'Opiniones' } },
  { section_type: 'promo_banners', section_variant: 'grid', content: { banners: [{ title: 'A' }] } },
  { section_type: 'gallery', section_variant: 'carousel', content: { images: [] } },
]
check(pidePortadaTienda(necesidadesPortadaTienda(paginaDeHoy)) === false, 'una página de hoy no pide datos nuevos')
check(pidePortadaTienda(necesidadesPortadaTienda(null)) === false, 'sin secciones no pide nada')
const nBuscador = necesidadesPortadaTienda([{ section_type: 'hero', section_variant: 'search', content: {} }])
check(nBuscador.resumenes.join() === 'product_reviews' && nBuscador.categorias, 'el buscador pide reseñas y categorías')
const nBuscadorSolo = necesidadesPortadaTienda([{ section_type: 'hero', section_variant: 'search', content: { rating_chip: 'none', show_category_select: false } }])
check(!pidePortadaTienda(nBuscadorSolo), 'el buscador sin chip ni selector no pide nada')
check(necesidadesPortadaTienda([{ section_type: 'testimonials', section_variant: 'grid', content: { show_summary: true } }]).resumenes.join() === 'testimonials', 'el resumen de testimonios pide su fuente (testimonials por defecto)')
check(necesidadesPortadaTienda([{ section_type: 'testimonials', section_variant: 'quotes', content: { show_summary: true, summary_source: 'product_reviews' } }]).resumenes.join() === 'product_reviews', 'el resumen puede salir de product_reviews')
check(!pidePortadaTienda(necesidadesPortadaTienda([{ section_type: 'testimonials', section_variant: 'grid', content: { show_summary: true }, is_visible: false }])), 'una sección oculta no pide nada')
const nSplit = necesidadesPortadaTienda([{ section_type: 'hero', section_variant: 'split_products', content: {} }])
check(nSplit.primerosProductos && nSplit.idsProductos.length === 0, 'split_products vacío pide los primeros productos')
check(necesidadesPortadaTienda([{ section_type: 'hero', section_variant: 'split_products', content: { product_ids: [7, 3, 7, 9, 11] } }]).idsProductos.join() === '7,3,9', 'split_products pide sus ids (máx. 3, sin repetir)')
check(necesidadesPortadaTienda([{ section_type: 'hero', section_variant: 'brand_giant', content: { hotspots: [{ x: 10, y: 20, product_id: 5 }, { x: 'a', y: 1, product_id: 6 }] } }]).idsProductos.join() === '5', 'los puntos de la marca piden solo productos válidos')
check(necesidadesPortadaTienda([{ section_type: 'hero', section_variant: 'floating', content: { floating_cards: [{ kind: 'video' }] } }]).resumenes.length === 0, 'la portada flotante sin tarjeta de reseñas no las pide')

// Resumen: nunca una cifra inventada.
check(textoResumenDe({}, 'product_reviews') === null, 'sin resumen precargado no hay texto')
check(textoResumenDe({ resumenResenas: { product_reviews: { promedio: 0, cantidad: 0 } } }, 'product_reviews') === null, 'con 0 reseñas no hay texto')
check(textoResumenDe({ resumenResenas: { product_reviews: null } }, 'product_reviews') === null, 'si la lectura falló no hay texto')
check(textoResumenDe({ resumenResenas: { testimonials: { promedio: 4.87, cantidad: 1280 } } }, 'testimonials') === '4,9 de 1.280 reseñas', 'el resumen real se escribe «4,9 de 1.280 reseñas»')
check(textoResumenDe({ resumenResenas: { testimonials: { promedio: 5, cantidad: 1 } } }, 'product_reviews') === null, 'una fuente no se confunde con la otra')

// Instagram: solo usuarios reales de social_links.
check(usuarioInstagram({ instagram: 'https://www.instagram.com/tienda.prueba/' }) === 'tienda.prueba', 'lee el usuario de la URL de Instagram')
check(usuarioInstagram({ instagram: '@tienda_prueba' }) === 'tienda_prueba', 'acepta @usuario')
check(usuarioInstagram({ instagram: 'https://instagram.com/p/AbC123' }) === '', 'un enlace a una publicación no es un usuario')
check(usuarioInstagram({ instagram: 'https://facebook.com/tienda' }) === '', 'otra red no se toma como Instagram')
check(usuarioInstagram(null) === '' && usuarioInstagram({}) === '', 'sin redes, sin usuario')
check(posicionLlamadoInstagram(5) === 2 && posicionLlamadoInstagram(1) === 0, 'el llamado va a la mitad de la fila')

// Cupón: vigencia como fecha plana, sin zona.
check(textoVigencia('2026-12-31') === 'Válido hasta el 31 dic. 2026', 'vigencia «Válido hasta el 31 dic. 2026»')
check(textoVigencia('2026-13-01') === null && textoVigencia('') === null, 'una fecha inválida no se escribe')
check(contrato.normalizarCuponBanner({ coupon_code: 'ruta10', valid_until: '2026-01-01' }, '2026-11-07')?.vencido === true, 'un cupón con fecha pasada está vencido')
check(contrato.normalizarCuponBanner({ title: 'sin código' }, '2026-11-07') === null, 'sin código no hay cupón')

// Productos de la portada.
const P = (id, extra = {}) => ({ id, uuid: `uuid-${id}`, name: `Producto ${id}`, product_images: [{ storage_path: `org/${id}.jpg`, is_primary: true }], product_prices: [{ price: 1000 * id }], ...extra })
const listado = [P(1, { product_images: [] }), P(2), P(3), P(4), P(5)]
check(productosDePortada({ products: listado }, [], 3).map((p) => p.id).join() === '2,3,4', 'sin ids: los 3 primeros con foto')
check(productosDePortada({ products: listado, productosPortada: [P(9)] }, [9, 4, 77], 3).map((p) => p.id).join() === '9,4', 'con ids: esos, en orden, y solo los que existen')
check(productosDePortada({}, [], 3).length === 0, 'sin datos, sin productos')

// Render de las variantes nuevas.
const { HeroBuscador } = cargar('components/sections/tienda/HeroBuscador.tsx')
const { HeroMarca } = cargar('components/sections/tienda/HeroMarca.tsx')
const { HeroFlotante } = cargar('components/sections/tienda/HeroFlotante.tsx')
const { HeroSplitProductos } = cargar('components/sections/tienda/HeroSplitProductos.tsx')
const { HeroFullscreen } = cargar('components/sections/hero/HeroFullscreen.tsx')
const { HeroSplit } = cargar('components/sections/hero/HeroSplit.tsx')
const { HeroButtons } = cargar('components/sections/hero/HeroButtons.tsx')
const { GalleryCollage } = cargar('components/sections/gallery/GalleryCollage.tsx')
const { GalleryInstagram } = cargar('components/sections/gallery/GalleryInstagram.tsx')
const { GalleryCarousel } = cargar('components/sections/gallery/GalleryCarousel.tsx')
const { ImageTextColor } = cargar('components/sections/image-text/ImageTextColor.tsx')
const { ImageTextEditorial } = cargar('components/sections/image-text/ImageTextEditorial.tsx')
const { ImageTextRight } = cargar('components/sections/image-text/ImageTextRight.tsx')
const { TextBlockIconos } = cargar('components/sections/text-block/TextBlockIconos.tsx')
const { TestimonialsGrid } = cargar('components/sections/testimonials/TestimonialsGrid.tsx')
const { TestimonialsQuotes } = cargar('components/sections/testimonials/TestimonialsQuotes.tsx')
const { PromoBannersGrid } = cargar('components/sections/retail/PromoBannersGrid.tsx')
const base = { organization: ORG, primaryColor: '#111111' }
const CATS = [{ id: 1, name: 'Camping', slug: 'camping', parent_id: null }, { id: 2, name: 'Carpas', slug: 'carpas', parent_id: 1 }, { id: 3, name: 'Ciclismo', slug: 'ciclismo', parent_id: null }]
const RESUMEN = { product_reviews: { promedio: 4.9, cantidad: 2318 }, testimonials: { promedio: 4.3, cantidad: 12 } }
const RESUMEN_CERO = { product_reviews: { promedio: 0, cantidad: 0 }, testimonials: { promedio: 0, cantidad: 0 } }

// CONTENT_KEYS: lo que declara el contrato (más las claves de siempre que se nombran en el reporte).
// `blocks` de color_block es el repetidor de la decisión del dueño 2026-11-10 (verify:editor-tienda).
const EXTRA_KEYS = { 'image_text.color_block': ['blocks'] }
for (const [C, clave] of [[HeroBuscador, 'hero.search'], [HeroMarca, 'hero.brand_giant'], [GalleryCollage, 'gallery.collage'], [GalleryInstagram, 'gallery.instagram_cta'], [ImageTextColor, 'image_text.color_block'], [ImageTextEditorial, 'image_text.editorial']]) {
  check(JSON.stringify([...C.CONTENT_KEYS]) === JSON.stringify([...contrato.CLAVES_SECCION_TIENDA[clave], ...(EXTRA_KEYS[clave] ?? [])]), `${clave}: CONTENT_KEYS = las del contrato`)
}
for (const [C, clave] of [[HeroFlotante, 'hero.floating'], [HeroSplitProductos, 'hero.split_products'], [TextBlockIconos, 'text_block.inline_icons']]) {
  check(contrato.CLAVES_SECCION_TIENDA[clave].every((k) => C.CONTENT_KEYS.includes(k)), `${clave}: CONTENT_KEYS incluye las del contrato`)
}
check(cargar('components/sections/gallery/GalleryCarousel.tsx').CONTENT_KEYS.includes('stagger'), 'gallery.carousel declara stagger')

// hero · search
const buscadorVacio = pintar(HeroBuscador, { ...base, content: {}, data: {} })
check(buscadorVacio.includes('action="/search"') && buscadorVacio.includes('name="q"'), 'buscador: sin JS es un GET a /search?q=')
check(!buscadorVacio.includes('<select') && !buscadorVacio.includes('reseña'), 'buscador sin datos: ni selector ni chip')
check(buscadorVacio.includes('Tienda de prueba'), 'buscador sin título: el nombre de la organización')
check(!/ciudad|env[ií]o a/i.test(buscadorVacio), 'buscador: sin «ciudad de envío» (fuera de esta entrega)')
const buscador = pintar(HeroBuscador, { ...base, content: { title: 'Equípate', image_url: FOTO }, data: { categories: CATS, resumenResenas: RESUMEN } })
check(buscador.includes('Todas las categorías') && buscador.includes('value="camping"') && !buscador.includes('value="carpas"'), 'buscador: selector con las categorías principales reales')
check(buscador.includes('4,9') && buscador.includes('de 2.318 reseñas'), 'buscador: chip con las reseñas reales')
check(!pintar(HeroBuscador, { ...base, content: {}, data: { categories: CATS, resumenResenas: RESUMEN_CERO } }).includes('reseña'), 'buscador: con 0 reseñas no hay chip')
check(!pintar(HeroBuscador, { ...base, content: { rating_chip: 'none' }, data: { resumenResenas: RESUMEN } }).includes('reseña'), 'buscador: rating_chip none = sin chip')
check(contrato.destinoBuscador('carpa 2p', 'camping') === '/search?q=carpa%202p' && contrato.destinoBuscador('', 'camping') === '/categorias/camping' && contrato.destinoBuscador(' ', null) === null, 'buscador: destino (texto → búsqueda; categoría sola → su página; nada → no navega)')

// hero · brand_giant
const marcaVacia = pintar(HeroMarca, { ...base, content: {}, data: {} })
check(marcaVacia.includes('>Tienda de prueba</h1>'), 'marca vacía: el nombre de la organización')
const marca = pintar(HeroMarca, { ...base, content: { brand_layer: 'over_photo', image_url: FOTO, title: 'Sillón', cta_text: 'Comprar', cta_url: '/productos', hotspots: [{ x: 60, y: 40, product_id: 2 }, { x: 20, y: 70, product_id: 33, label: 'Mesa' }] }, data: { products: listado } })
check(marca.includes('href="/productos/uuid-2"') && marca.includes('Producto 2'), 'marca: el punto abre el producto real (uuid y nombre)')
check(marca.includes('href="/productos/33"') && marca.includes('Mesa'), 'marca: sin el producto cargado, enlaza por id con su rótulo')
check(marca.includes('left:60%') && marca.includes('top:40%'), 'marca: el punto va en su posición')

// hero · floating
const flotante = pintar(HeroFlotante, { ...base, content: { title: 'Una piel que brilla', title_highlight: 'brilla', floating_cards: [{ kind: 'categories' }, { kind: 'rating' }, { kind: 'video', video_url: 'https://ejemplo.test/v' }], buttons: [{ label: 'Comprar', url: '/productos' }] }, data: { categories: CATS, resumenResenas: RESUMEN } })
check(flotante.includes('data-titulo-resaltado="pill"') && flotante.includes('>brilla</span>'), 'flotante: palabra resaltada en píldora')
check(flotante.includes('href="/categorias/camping"') && flotante.includes('de 2.318 reseñas') && flotante.includes('https://ejemplo.test/v'), 'flotante: las tres tarjetas con datos reales')
const flotanteSinDatos = pintar(HeroFlotante, { ...base, content: { title: 'T', floating_cards: [{ kind: 'categories' }, { kind: 'rating' }] }, data: { resumenResenas: RESUMEN_CERO } })
check(!flotanteSinDatos.includes('/categorias/') && !flotanteSinDatos.includes('reseña'), 'flotante: sin categorías ni reseñas, sin tarjetas')

// hero · split_products = HeroSplit de siempre + mini tarjetas
const contenidoSplit = { title: 'Hecho para vivirse', image_url: FOTO, buttons: [BOTONES_HOY[0]] }
check(pintar(HeroSplitProductos, { ...base, content: contenidoSplit, data: {} }) === pintar(HeroSplit, { ...base, content: contenidoSplit, data: {} }), 'split_products sin productos = la portada dividida de siempre')
const split = pintar(HeroSplitProductos, { ...base, content: { ...contenidoSplit, product_ids: [3, 2] }, data: { products: listado } })
check(split.indexOf('Producto 3') > 0 && split.indexOf('Producto 3') < split.indexOf('Producto 2') && split.includes('href="/productos/uuid-3"'), 'split_products: los productos elegidos, en orden, con su ficha')

// Título resaltado en HeroFullscreen: solo con la clave y si la palabra está.
const conBotones = { title: 'Muebles que se quedan', subtitle: 'Sub', image_url: FOTO, buttons: BOTONES_HOY }
check(huella(pintar(HeroFullscreen, { ...base, data: {}, content: { ...conBotones, title_highlight: 'inexistente' } })) === BASE['hero.fullscreen con botones'], 'fullscreen: una palabra que no está en el título no cambia nada')
check(pintar(HeroFullscreen, { ...base, data: {}, content: { ...conBotones, title_highlight: 'quedan', title_highlight_style: 'underline' } }).includes('data-titulo-resaltado="underline"'), 'fullscreen: palabra resaltada con subrayado')

// Botón «enlace subrayado».
const enlace = pintar(HeroButtons, { buttons: [{ label: 'Ver la colección', url: '/productos', variant: 'link' }], primaryColor: '#111111' })
check(enlace.includes('underline-offset-[6px]') && !enlace.includes('hover:scale-105') && !enlace.includes('px-6'), 'botón link: subrayado, sin relleno ni escala')

// Galerías
check(pintar(GalleryCollage, { ...base, content: {} }) === '', 'collage sin fotos ni frase: nada')
check((pintar(GalleryCollage, { ...base, content: { images: [FOTO, { image_url: FOTO }, FOTO, FOTO], phrase: 'Transforma tu rutina' } }).match(/<img /g) || []).length === 3, 'collage: máximo 3 fotos')
check(pintar(GalleryInstagram, { ...base, content: {} }) === '', 'instagram sin fotos: nada')
const orgIg = { ...ORG, website_settings: { social_links: { instagram: 'https://instagram.com/tienda.prueba' } } }
const ig = pintar(GalleryInstagram, { organization: orgIg, content: { images: [FOTO, FOTO, FOTO], cta_title: 'Transforma tu espacio', cta_text: 'Ver ofertas', cta_url: '/ofertas' }, data: {} })
check(ig.includes('Síguenos @tienda.prueba') && ig.includes('Transforma tu espacio') && ig.includes('href="/ofertas"'), 'instagram: usuario de las redes del sitio y llamado')
check(!pintar(GalleryInstagram, { organization: { ...orgIg, website_settings: { ...orgIg.website_settings, show_social_links: false } }, content: { images: [FOTO] }, data: {} }).includes('Síguenos'), 'instagram: con las redes ocultas no se escribe usuario')
const carrusel = { title: 'Galería', images: [{ url: FOTO, alt: 'a' }, { url: FOTO, alt: 'b', caption: 'Pie' }] }
check(huella(pintar(GalleryCarousel, { ...base, content: { ...carrusel, stagger: false } })) === BASE['gallery.carousel'], 'carrusel con stagger false = el de siempre')
check(pintar(GalleryCarousel, { ...base, content: { ...carrusel, stagger: true } }).includes('data-galeria="stagger"'), 'carrusel con stagger: fila escalonada')

// Imagen y texto
check(pintar(ImageTextColor, { ...base, content: {}, data: {} }) === '', 'bloque de color vacío: nada')
const bloque = pintar(ImageTextColor, { ...base, content: { number: '01', title: 'Surf', bg_color: '#1F3FD8', cta_url: '/categorias/surf' }, data: {} })
check(bloque.includes('background-color:#1F3FD8') && bloque.includes('color:#FFFFFF') && bloque.includes('href="/categorias/surf"'), 'bloque de color: fondo del dueño, texto legible y enlace')
check(pintar(ImageTextEditorial, { ...base, content: {}, data: {} }) === '', 'editorial vacío: nada')
check(!pintar(ImageTextEditorial, { ...base, content: { title: 'T', body: '<script>alert(1)</script>' }, data: {} }).includes('<script>'), 'editorial: el texto se escapa (nunca HTML)')
const derecha = { title: 'T', text: 'Texto', image_url: FOTO, cta_text: 'Ver', cta_url: '/x' }
check(huella(pintar(ImageTextRight, { ...base, content: { ...derecha, thumbnails: [] } })) === BASE['image_text.image_right'], 'image_right con thumbnails vacío = el de siempre')
check((pintar(ImageTextRight, { ...base, content: { ...derecha, thumbnails: [FOTO, 'javascript:alert(1)', FOTO] } }).match(/<li /g) || []).length === 2, 'image_right: miniaturas válidas (un enlace no válido no entra)')

// Texto con íconos
check(pintar(TextBlockIconos, { ...base, content: {} }) === '', 'texto con íconos vacío: nada')
const iconos = pintar(TextBlockIconos, { ...base, content: { segments: [{ text: 'Diseño que perdura,' }, { icon: 'Heart' }, { icon: 'NoExiste' }, { text: 'para durar.' }] } })
check((iconos.match(/<svg/g) || []).length === 1 && iconos.includes('para durar.'), 'texto con íconos: un ícono que no existe se omite')

// Testimonios: el resumen solo con show_summary y reseñas reales.
const grid = { title: 'Opiniones', items: TESTIMONIOS }
check(huella(pintar(TestimonialsGrid, { ...base, content: { ...grid, show_summary: true }, data: {} })) === BASE['testimonials.grid'], 'grid con show_summary sin datos = el de siempre')
check(huella(pintar(TestimonialsGrid, { ...base, content: { ...grid, show_summary: true }, data: { resumenResenas: RESUMEN_CERO } })) === BASE['testimonials.grid'], 'grid con 0 reseñas = el de siempre')
check(pintar(TestimonialsGrid, { ...base, content: { ...grid, show_summary: true, summary_source: 'product_reviews' }, data: { resumenResenas: RESUMEN } }).includes('de 2.318 reseñas'), 'grid: resumen con las reseñas reales')
const citas = pintar(TestimonialsQuotes, { ...base, content: { items: TESTIMONIOS, image_url: FOTO, pager: 'fraction', show_summary: true }, data: { resumenResenas: RESUMEN } })
check(citas.includes('data-citas-foto') && citas.includes('01 / 02') && citas.includes('de 12 reseñas'), 'quotes con foto: una cita, «01 / 02» y resumen')
check(pintar(TestimonialsQuotes, { ...base, content: { pager: 'fraction' }, data: {} }) === '', 'quotes con foto sin testimonios: nada (nunca una cita de ejemplo)')

// Cupón del banner
const bannerHoy = { title: 'Primera compra', subtitle: '10 %', button_text: 'Ver', link_type: 'url', link_url: '/ofertas' }
check(huella(pintar(PromoBannersGrid, { ...base, data: {}, content: { title: 'Ofertas', banners: [{ ...bannerHoy, coupon_code: 'no válido!' }, { title: 'Sin enlace', bg_color: '#222222' }] } })) === BASE['promo_banners.grid'], 'banner con un código inválido = el de siempre')
const conCupon = pintar(PromoBannersGrid, { ...base, data: {}, content: { banners: [{ ...bannerHoy, coupon_code: 'ruta10', valid_until: '2099-12-31' }] } })
check(conCupon.includes('RUTA10') && conCupon.includes('Copiar') && conCupon.includes('Válido hasta el 31 dic. 2099'), 'banner con cupón: código copiable y vigencia')
check(!conCupon.includes('class="block group"') && conCupon.includes('href="/ofertas"'), 'banner con cupón: no va dentro de un enlace; el botón enlaza')
const vencido = pintar(PromoBannersGrid, { ...base, data: {}, content: { banners: [{ ...bannerHoy, coupon_code: 'VIEJO', valid_until: '2020-01-01' }] } })
check(!vencido.includes('VIEJO') && vencido.includes('Primera compra'), 'cupón vencido: el banner sí, el cupón no')
check(pintar(PromoBannersGrid, { ...base, data: {}, content: { banner_layout: 'triple_center', banners: [{ title: 'A', coupon_code: 'FINDE', link_type: 'url', link_url: '/a', button_text: 'Ver' }, { title: 'B' }, { title: 'C' }] } }).includes('FINDE'), 'distribución nueva: también muestra el cupón')

// Precarga: una página de hoy no consulta nada; una con las piezas nuevas, solo lo que pide.
const { precargarPortadaTienda } = cargar('lib/queries/tienda/portada.ts')
const datosHoy = { products: listado }
await precargarPortadaTienda(9001, null, paginaDeHoy, datosHoy)
check(llamadas.length === 0 && Object.keys(datosHoy).join() === 'products', 'precarga: una página de hoy no consulta nada ni toca data')
const datosNuevos = { products: listado }
await precargarPortadaTienda(9001, 4, [
  { section_type: 'hero', section_variant: 'search', content: {} },
  { section_type: 'hero', section_variant: 'brand_giant', content: { hotspots: [{ x: 1, y: 1, product_id: 2 }, { x: 2, y: 2, product_id: 88 }] } },
  { section_type: 'testimonials', section_variant: 'grid', content: { show_summary: true } },
], datosNuevos)
check(llamadas.filter((l) => l[0] === 'resumen').map((l) => l[2]).sort().join() === 'product_reviews,testimonials', 'precarga: un resumen por fuente pedida')
check(llamadas.some((l) => l[0] === 'categorias' && l[1] === 9001 && l[2] === 4), 'precarga: categorías de la organización y sede del contexto')
check(JSON.stringify(llamadas.find((l) => l[0] === 'porId')?.[1]) === '[88]', 'precarga: por id solo los productos que no venían en el listado')
check(!llamadas.some((l) => l[0] === 'primeros'), 'precarga: sin split_products vacío no pide el listado')
check(datosNuevos.resumenResenas?.testimonials?.cantidad === 10 && datosNuevos.productosPortada?.[0]?.id === 88 && datosNuevos.categories?.length === 1, 'precarga: deja los datos donde los leen las piezas')
llamadas.length = 0
const conCategorias = { categories: CATS }
await precargarPortadaTienda(9001, null, [{ section_type: 'hero', section_variant: 'split_products', content: {} }, { section_type: 'hero', section_variant: 'floating', content: { floating_cards: [{ kind: 'categories' }] } }], conCategorias)
check(llamadas.map((l) => l[0]).join() === 'primeros' && conCategorias.categories === CATS, 'precarga: no repite categorías ya cargadas y pide los primeros productos sin listado')

// ── 4. Esquema de las lecturas nuevas ───────────────────────────────────────────────────────
// Columnas verificadas por MCP (taqjemqjtumhwptchcxk) el 2026-11-07.
const ESQUEMA = {
  product_reviews: ['id', 'organization_id', 'product_id', 'customer_id', 'order_id', 'author_name', 'author_city', 'rating', 'title', 'content', 'images', 'is_verified_purchase', 'status', 'rejection_reason', 'reply_text', 'reply_at', 'reply_by', 'helpful_count', 'reported_count', 'created_at', 'updated_at'],
  testimonials: ['id', 'organization_id', 'customer_id', 'author_name', 'author_role', 'author_company', 'author_avatar', 'content', 'rating', 'is_featured', 'is_active', 'source', 'source_url', 'sort_order', 'created_at', 'updated_at'],
}
const fuente = readFileSync(join(ROOT, 'lib/queries/tienda/resenas.ts'), 'utf8')
const consultas = [...fuente.matchAll(/\.from\('([a-z_]+)'\)([\s\S]*?)(?=\.from\(|\n {2}const \{|$)/g)].map((m) => {
  const cadena = m[2]
  const columnas = [
    ...[...cadena.matchAll(/\.select\('([^']*)'/g)].flatMap((x) => x[1].split(',').map((c) => c.trim())),
    ...[...cadena.matchAll(/\.(?:eq|neq|in|is|gte|lte|order)\('([a-z_]+)'/g)].map((x) => x[1]),
  ]
  return { tabla: m[1], columnas, filtros: [...cadena.matchAll(/\.eq\('([a-z_]+)',\s*([^)]+)\)/g)].map((x) => [x[1], x[2].trim()]) }
})
if (process.env.VERIFY_PORTADA_DEPURAR === '1') console.log(JSON.stringify(consultas))
check(consultas.length === 2, `resenas.ts: se esperaban 2 lecturas (product_reviews y testimonials), hay ${consultas.length}`)
for (const c of consultas) {
  check(!!ESQUEMA[c.tabla], `resenas.ts: tabla no verificada ${c.tabla}`)
  for (const col of c.columnas) check((ESQUEMA[c.tabla] || []).includes(col), `resenas.ts: ${c.tabla}.${col} no está en el esquema verificado`)
  check(c.filtros.some(([col, v]) => col === 'organization_id' && v === 'organizationId'), `resenas.ts: ${c.tabla} filtra por organization_id del contexto`)
}
check(/head:\s*true/.test(fuente), 'resenas.ts: cuenta con head:true (sin traer filas)')

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const notas = []
if (URL_BASE && KEY) {
  // Las mismas lecturas, contra la base real (HEAD: sin filas). 42703 = columna inexistente.
  for (const c of consultas) {
    const params = new URLSearchParams({ select: 'id' })
    for (const [col] of c.filtros) params.append(col, col === 'organization_id' ? 'eq.0' : col === 'status' ? 'eq.approved' : col === 'is_active' ? 'eq.true' : 'eq.5')
    const r = await fetch(`${URL_BASE}/rest/v1/${c.tabla}?${params}`, { method: 'HEAD', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' } })
    check(r.ok, `resenas.ts: la lectura de ${c.tabla} falla contra la base real (HTTP ${r.status})`)
  }
} else {
  notas.push('sin NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY: el esquema se comprobó contra la lista verificada por MCP, no contra la base')
}

// ── Resultado ────────────────────────────────────────────────────────────────────────────────
if (problemas.length > 0) {
  console.error(`verify-portada-tienda: ${problemas.length} problema(s) en ${casos} comprobaciones`)
  for (const p of problemas) console.error(`  ✗ ${p}`)
  process.exit(1)
}
for (const n of notas) console.log(`  · ${n}`)
console.log(`verify-portada-tienda: ${casos} comprobaciones en verde`)
