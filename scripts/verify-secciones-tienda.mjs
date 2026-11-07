/**
 * verify-secciones-tienda.mjs — compuerta del paquete W6 de las plantillas de tienda (PLANO §3/§5).
 *
 *   npm run verify:secciones-tienda                 # todo (necesita .env.local con service role)
 *   npm run verify:secciones-tienda -- --sin-base   # solo lo puro (defaults, reglas, fuentes)
 *   npm run verify:secciones-tienda -- --columnas   # imprime las columnas que se piden, por tabla
 *
 * Qué comprueba:
 * 1. Defaults de los `normalizar*` de las 9 secciones (`lib/website/v2/contrato/seccionesTienda.ts`):
 *    con `null` y `{}` devuelven el default, y sin datos reales ninguna sección es visible.
 * 2. Reglas de «nada inventado» de `components/sections/tienda/datosTienda.ts`: qué ids se piden,
 *    cómo se resuelven y cuándo una sección no tiene nada que pintar.
 * 3. Fuentes: los 9 componentes declaran `CONTENT_KEYS` con las claves del contrato y no llevan
 *    'use client' (el manifiesto las lee en el servidor); nada toca carrito, cupones ni checkout.
 * 4. Esquema (como verify-tracking): LEE los `select` del propio fuente (`getProductsByIds` de
 *    lib/supabase/queries.ts y `COLUMNAS_PRODUCTO_TIENDA` de lib/queries/tienda/productosPorId.ts)
 *    y los ejecuta contra la base real. Un nombre de columna inexistente responde 42703 y falla.
 *    Sin credenciales FALLA, salvo con `--sin-base` (y entonces lo dice).
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIN_BASE = process.argv.includes('--sin-base')
const SOLO_COLUMNAS = process.argv.includes('--columnas')

// `@/…` → archivo del repo (los módulos puros de W6 importan con el alias, como el resto del sitio).
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('@/')) {
      const base = join(ROOT, especificador.slice(2))
      const candidatos = /\.(ts|tsx|mjs|js)$/.test(base) ? [base] : [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
      const hallado = candidatos.find((cand) => existsSync(cand))
      if (hallado) return { url: pathToFileURL(hallado).href, shortCircuit: true }
    }
    return siguiente(especificador, contexto)
  },
})

const c = await import('../lib/website/v2/contrato/seccionesTienda.ts')
const d = await import('../components/sections/tienda/datosTienda.ts')

const problemas = []
const notas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── 1. Defaults de los normalizadores ─────────────────────────────────────────────────────
const conDefault = [
  ['link_cloud.pills', c.normalizarNubeEnlaces, c.DEFAULT_NUBE_ENLACES],
  ['product_index.list', c.normalizarIndiceProductos, c.DEFAULT_INDICE_PRODUCTOS],
  ['product_anatomy.default', c.normalizarAnatomiaProducto, c.DEFAULT_ANATOMIA_PRODUCTO],
  ['shop_the_look.hotspots', c.normalizarCompraElLook, c.DEFAULT_COMPRA_EL_LOOK],
  ['welcome_popup.coupon', c.normalizarVentanaBienvenida, c.DEFAULT_VENTANA_BIENVENIDA],
  ['transformation.slider', c.normalizarAntesDespues, c.DEFAULT_ANTES_DESPUES],
  ['products_grid.editorial', c.normalizarRejillaEditorial, c.DEFAULT_REJILLA_EDITORIAL],
]
for (const [clave, normalizar, porDefecto] of conDefault) {
  check(igual(normalizar(null), porDefecto), `${clave}: normalizar(null) no es el default`)
  check(igual(normalizar({}), porDefecto), `${clave}: normalizar({}) no es el default`)
  check(igual(normalizar({ clave_inventada: 1, title: 42 }), porDefecto), `${clave}: una clave ajena o de otro tipo cambia el default`)
}
check(igual(c.normalizarTarjetasServicio(null), { imageUrl: '', cards: [] }), 'service_cards.over_image: default no vacío')
check(igual(c.normalizarColumnasFoto(null), { items: [] }), 'features_grid.photo_columns: default no vacío')

// Defaults pedidos por el plano (§3).
check(c.DEFAULT_NUBE_ENLACES.source === 'categories' && c.DEFAULT_NUBE_ENLACES.max === 12, 'nube: source categories y max 12')
check(c.DEFAULT_INDICE_PRODUCTOS.showPrice === true && c.DEFAULT_INDICE_PRODUCTOS.ctaText === 'Ver todas las piezas' && c.DEFAULT_INDICE_PRODUCTOS.ctaUrl === '/productos', 'índice: show_price, cta_text y cta_url por defecto')
check(c.PRODUCTOS_INDICE_POR_DEFECTO === 6, 'índice: 6 productos sin elección')
check(c.DEFAULT_COMPRA_EL_LOOK.showCards === true, 'look: show_cards true')
check(c.DEFAULT_VENTANA_BIENVENIDA.enabled === false && c.DEFAULT_VENTANA_BIENVENIDA.delayS === 4 && c.DEFAULT_VENTANA_BIENVENIDA.frequency === 'once', 'ventana: apagada, 4 s, once')
check(c.DEFAULT_ANTES_DESPUES.startPosition === 50 && c.DEFAULT_ANTES_DESPUES.handleColor === 'acento', 'antes/después: 50 % y acento')
check(c.DEFAULT_REJILLA_EDITORIAL.countHeader === true && c.DEFAULT_REJILLA_EDITORIAL.filtersStyle === 'text', 'rejilla: count_header y filtros en texto')

// Sin datos reales, nada es visible.
check(!c.compraElLookVisible(c.DEFAULT_COMPRA_EL_LOOK), 'look visible sin foto ni puntos')
check(!c.anatomiaVisible(c.DEFAULT_ANATOMIA_PRODUCTO), 'anatomía visible sin producto')
check(!c.ventanaBienvenidaVisible(c.DEFAULT_VENTANA_BIENVENIDA), 'ventana visible apagada')
check(!c.ventanaBienvenidaVisible(c.normalizarVentanaBienvenida({ enabled: true })), 'ventana visible sin cupón')
check(!c.ventanaBienvenidaVisible(c.normalizarVentanaBienvenida({ enabled: true, coupon_code: 'hola mundo' })), 'ventana visible con un código inválido')
check(c.ventanaBienvenidaVisible(c.normalizarVentanaBienvenida({ enabled: true, coupon_code: ' hogar10 ' })), 'ventana con cupón válido no se ve')
check(c.normalizarVentanaBienvenida({ coupon_code: ' hogar10 ' }).couponCode === 'HOGAR10', 'el cupón no queda en mayúsculas y sin espacios')
check(c.normalizarVentanaBienvenida({ delay_s: 999 }).delayS === 4 && c.normalizarVentanaBienvenida({ delay_s: '0' }).delayS === 0, 'delay_s fuera de 0–60')
check(c.claveAlmacenBienvenida(120) === 'goadmin:bienvenida:120', 'clave de almacenamiento')
check([0, 1, 2].every((n) => !c.nubeEnlacesVisible(n)) && c.nubeEnlacesVisible(3), 'nube: mínimo 3 enlaces')

// Reglas de contenido.
const ad = c.normalizarAntesDespues({ items: [{ name: 'A', before_url: 'https://x/a.jpg' }, { name: 'B', before_url: 'https://x/b.jpg', after_url: 'https://x/b2.jpg' }], start_position: 130 })
check(ad.items.length === 1 && ad.items[0].name === 'B', 'antes/después: entra un par incompleto')
check(ad.startPosition === 50, 'antes/después: start_position fuera de 0–100 no vuelve a 50')
check(c.normalizarAntesDespues({ items: [{ before_url: 'javascript:alert(1)', after_url: 'https://x/b.jpg' }] }).items.length === 0, 'antes/después: acepta una URL javascript:')
const re = c.normalizarRejillaEditorial({ editorial_cards: [{ after: 8, title: 'B' }, { after: 4, title: 'A', span: 3 }, { after: 4, title: 'Repetida' }, { after: -1, title: 'X' }, { after: 2 }] })
check(igual(re.editorialCards.map((t) => [t.after, t.span, t.title]), [[4, 3, 'A'], [8, 2, 'B']]), 'rejilla: tarjetas sin ordenar, repetidas o vacías')
const nube = c.normalizarNubeEnlaces({ source: 'manual', links: [{ label: 'A', url: '/a' }, { label: '', url: '/b' }, { label: 'C', url: 'javascript:x' }, { label: 'D', url: 'https://d.co' }], max: 99 })
check(nube.links.length === 2 && nube.max === 12, 'nube: enlaces sin texto o destino inseguro, o max fuera de 3–30')
check(c.normalizarIndiceProductos({ product_ids: [3, '3', 5, -1, 'x'], cta_url: 'javascript:x' }).ctaUrl === '/productos', 'índice: cta_url inseguro no vuelve a /productos')
check(igual(c.normalizarIndiceProductos({ product_ids: [3, '3', 5, -1, 'x'] }).productIds, [3, 5]), 'índice: ids repetidos o inválidos')
check(c.normalizarTarjetasServicio({ cards: [{}, { title: 'Uno' }, { benefits: ['a'] }, { title: 'Tres' }] }).cards.length === 2, 'service_cards: tarjetas vacías o más de 2')
check(c.normalizarColumnasFoto({ items: Array.from({ length: 9 }, (_, i) => ({ title: `T${i}` })) }).items.length === 6, 'photo_columns: más de 6')

// ── 2. datosTienda: qué se pide y cuándo no se pinta ──────────────────────────────────────
const sec = (section_type, section_variant, content, is_visible = true) => ({ section_type, section_variant, content, is_visible })
const pagina = [
  sec('product_index', 'list', { product_ids: [9, 3] }),
  sec('product_anatomy', 'default', { product_id: 3 }),
  sec('shop_the_look', 'hotspots', { image_url: 'https://x/l.jpg', hotspots: [{ x: 10, y: 20, product_id: 7 }, { x: 'a', y: 2, product_id: 8 }] }),
  sec('product_index', 'list', { product_ids: [50] }, false),
  sec('products_grid', 'grid', { product_ids: [99] }),
]
check(igual(d.idsProductosTienda(pagina), [3, 7, 9]), `ids pedidos: ${JSON.stringify(d.idsProductosTienda(pagina))} (oculta, ajena o punto inválido entran)`)
check(d.idsProductosTienda([]).length === 0 && d.idsProductosTienda(null).length === 0, 'sin secciones se piden ids')
check(!d.pideListadoGeneral(pagina) && d.pideListadoGeneral([sec('product_index', 'list', {})]), 'índice sin ids debe pedir el listado (y con ids no)')
check(d.pideCategorias([sec('link_cloud', 'pills', {})]) && !d.pideCategorias([sec('link_cloud', 'pills', { source: 'manual' })]), 'nube por categorías debe pedir categorías (manual no)')
check(!d.pideCategorias([sec('link_cloud', 'pills', {}, false)]), 'una nube oculta pide categorías')

const foto = [{ storage_path: 'org/p.jpg', is_primary: true }]
const datos = {
  productosTienda: [{ id: 7, name: 'Lámpara', uuid: 'u7', product_images: foto, category_id: 2 }],
  products: [{ id: 3, name: 'Sillón', uuid: 'u3', product_images: foto, category_id: 1 }, { id: 4, name: 'Sin foto', product_images: [] }, { id: 5, name: 'Mesa', product_images: foto }],
  categories: [{ id: 1, name: 'Sala', slug: 'sala' }, { id: 2, name: 'Iluminación', slug: 'iluminacion' }, { id: 3, name: 'Sin slug', slug: '' }, { id: 4, name: 'Alcoba', slug: 'alcoba' }],
}
check(d.buscarProducto(datos, 7)?.name === 'Lámpara' && d.buscarProducto(datos, 3)?.name === 'Sillón' && d.buscarProducto(datos, 99) === null, 'buscarProducto')
check(igual(d.productosEnOrden(datos, [5, 99, 3]).map((p) => p.id), [5, 3]), 'productosEnOrden: orden pedido y sin los que faltan')
check(igual(d.primerosConFoto(datos, 6).map((p) => p.id), [3, 5, 7]), 'primerosConFoto: solo con foto, sin repetir')
check(igual(d.productosIndice({}, datos).map((p) => p.id), [3, 5, 7]) && igual(d.productosIndice({ product_ids: [7] }, datos).map((p) => p.id), [7]), 'productosIndice')
check(d.nombreCategoria(datos, { category_id: 1 }) === 'Sala' && d.nombreCategoria(datos, { category_id: 77 }) === null, 'nombreCategoria')
check(igual(d.enlacesNube({}, datos).map((e) => e.url), ['/categorias/sala', '/categorias/iluminacion', '/categorias/alcoba']), 'enlacesNube: categorías con slug')
check(d.enlacesNube({ max: 3 }, { categories: Array.from({ length: 10 }, (_, i) => ({ name: `C${i}`, slug: `c${i}` })) }).length === 3, 'enlacesNube: respeta max')
check(igual(d.puntosLook({ image_url: 'https://x/l.jpg', hotspots: [{ x: 1, y: 1, product_id: 7 }, { x: 2, y: 2, product_id: 99 }] }, datos).map((p) => p.productId), [7]), 'puntosLook: punto sin producto real')

const vacias = [
  ['link_cloud', 'pills', {}, {}],
  ['link_cloud', 'pills', { source: 'manual', links: [{ label: 'A', url: '/a' }] }, datos],
  ['service_cards', 'over_image', {}, {}],
  ['features_grid', 'photo_columns', {}, {}],
  ['transformation', 'slider', {}, {}],
  ['shop_the_look', 'hotspots', { image_url: 'https://x/l.jpg', hotspots: [{ x: 1, y: 1, product_id: 99 }] }, datos],
  ['shop_the_look', 'hotspots', { hotspots: [{ x: 1, y: 1, product_id: 7 }] }, datos],
  ['product_index', 'list', {}, {}],
  ['product_index', 'list', { product_ids: [99] }, datos],
  ['product_anatomy', 'default', { product_id: 3 }, datos],
  ['product_anatomy', 'default', { product_id: 99, details: [{ title: 'Pata' }] }, datos],
]
for (const [t, v, contenido, dat] of vacias) {
  check(d.motivoSeccionTiendaVacia(t, v, contenido, dat) !== null, `${t}.${v} sin datos reales se pinta: ${JSON.stringify(contenido)}`)
}
const llenas = [
  ['link_cloud', 'pills', {}, datos],
  ['service_cards', 'over_image', { cards: [{ title: 'Ayuda', links: [{ label: 'Contacto', url: '/contacto' }] }] }, {}],
  ['features_grid', 'photo_columns', { items: [{ title: 'Roble' }] }, {}],
  ['transformation', 'slider', { items: [{ before_url: 'https://x/a.jpg', after_url: 'https://x/b.jpg' }] }, {}],
  ['shop_the_look', 'hotspots', { image_url: 'https://x/l.jpg', hotspots: [{ x: 1, y: 1, product_id: 7 }] }, datos],
  ['product_index', 'list', {}, datos],
  ['product_anatomy', 'default', { product_id: 3, details: [{ title: 'Pata', text: 'Torneada' }] }, datos],
]
for (const [t, v, contenido, dat] of llenas) {
  check(d.motivoSeccionTiendaVacia(t, v, contenido, dat) === null, `${t}.${v} con datos reales no se pinta`)
}
check(d.motivoSeccionTiendaVacia('hero', 'fullscreen', {}, {}) === null && d.motivoSeccionTiendaVacia('products_grid', 'grid', {}, {}) === null, 'una sección ajena a W6 se marca vacía')
check(d.motivoSeccionTiendaVacia('welcome_popup', 'coupon', {}, {}) === null, 'welcome_popup no va por motivoSeccionTiendaVacia (nunca va en el flujo)')

// ── 3. Fuentes ───────────────────────────────────────────────────────────────────────────
const COMPONENTES = {
  NubeEnlaces: 'link_cloud.pills',
  TarjetasServicio: 'service_cards.over_image',
  CompraElLook: 'shop_the_look.hotspots',
  IndiceProductos: 'product_index.list',
  AnatomiaProducto: 'product_anatomy.default',
  VentanaBienvenida: 'welcome_popup.coupon',
  AntesDespues: 'transformation.slider',
  RasgosConFoto: 'features_grid.photo_columns',
  RejillaEditorial: 'products_grid.editorial',
}
const DIR = join(ROOT, 'components', 'sections', 'tienda')
const fuentes = {}
for (const [nombre, clave] of Object.entries(COMPONENTES)) {
  const src = await readFile(join(DIR, `${nombre}.tsx`), 'utf8')
  fuentes[nombre] = src
  check(!/^\s*['"]use client['"]/m.test(src), `${nombre}.tsx lleva 'use client': el manifiesto no puede leer CONTENT_KEYS`)
  check(src.includes(`CLAVES_SECCION_TIENDA['${clave}']`), `${nombre}.tsx no declara las claves del contrato '${clave}'`)
  check(src.includes(`${nombre}.CONTENT_KEYS = CONTENT_KEYS`), `${nombre}.tsx no expone ${nombre}.CONTENT_KEYS`)
  check(new RegExp(`export function ${nombre}\\(`).test(src), `${nombre}.tsx no exporta ${nombre}`)
}
const vistas = ['AntesDespuesVista', 'CompraElLookVista', 'IndiceProductosVista', 'VentanaBienvenidaVista', 'RejillaEditorialVista']
for (const v of vistas) fuentes[v] = await readFile(join(DIR, `${v}.tsx`), 'utf8')
for (const v of vistas) check(/^\s*['"]use client['"]/.test(fuentes[v]), `${v}.tsx debe ser 'use client'`)
fuentes.datosTienda = await readFile(join(DIR, 'datosTienda.ts'), 'utf8')
const cargador = await readFile(join(ROOT, 'lib', 'queries', 'tienda', 'productosPorId.ts'), 'utf8')
for (const [nombre, src] of Object.entries(fuentes)) {
  check(!/from ['"][^'"]*(lib\/cart|CheckoutWizard|api\/orders|api\/checkout)['"]|\.from\(['"]coupons['"]\)/.test(src), `${nombre}: toca carrito, cupones o checkout`)
  check(!/from ['"]@\/lib\/(supabase|queries)\//.test(src), `${nombre}: un componente no consulta la base (lee data.*)`)
}
check(!/\.from\(/.test(cargador), 'productosPorId.ts hace una consulta propia: debe reusar las de lib/supabase/queries')
check(/getProductsByIdsCatalog/.test(cargador), 'productosPorId.ts no usa getProductsByIdsCatalog (cacheada por organización)')
check(/claveAlmacenBienvenida/.test(fuentes.VentanaBienvenida) && /catch/.test(fuentes.VentanaBienvenidaVista), 'la ventana no usa la clave del contrato o no protege el almacenamiento')
check(/'Escape'/.test(fuentes.VentanaBienvenidaVista) && /aria-modal/.test(fuentes.VentanaBienvenidaVista), 'la ventana no cierra con Esc o no es aria-modal')
check(/type="range"/.test(fuentes.AntesDespuesVista), 'el comparador no usa un control de teclado (input range)')

// ── 4. Esquema real ──────────────────────────────────────────────────────────────────────
const queries = await readFile(join(ROOT, 'lib', 'supabase', 'queries.ts'), 'utf8')
const visibilidad = await readFile(join(ROOT, 'lib', 'products', 'visibilidad-web.ts'), 'utf8')
const padre = visibilidad.match(/export const SELECT_PADRE_ESTADO = '([^']+)'/)?.[1]
const inicio = queries.indexOf('export async function getProductsByIds(')
const cuerpo = inicio === -1 ? '' : queries.slice(inicio, queries.indexOf('\nexport ', inicio + 1))
const selectCrudo = cuerpo.match(/\.from\('products'\)\s*\.select\(`([^`]*)`\)/)?.[1]
check(!!padre, 'no se encontró SELECT_PADRE_ESTADO')
check(!!selectCrudo, 'no se pudo extraer el select de getProductsByIds')
check(/\.eq\('organization_id', organizationId\)/.test(cuerpo) && /\.eq\('status', 'active'\)/.test(cuerpo), 'getProductsByIds no filtra por organización y estado activo')
const selectProductos = (selectCrudo ?? '').replace('${SELECT_PADRE_ESTADO}', padre ?? '').replace(/\s+/g, ' ').trim()
const columnasTienda = (cargador.match(/COLUMNAS_PRODUCTO_TIENDA = \[([^\]]+)\]/)?.[1] ?? '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)) ?? []
check(columnasTienda.length >= 5, 'no se pudo leer COLUMNAS_PRODUCTO_TIENDA')
const COLUMNAS_CATEGORIA = ['id', 'name', 'slug', 'is_active', 'organization_id', 'branch_id', 'display_order', 'rank']

if (SOLO_COLUMNAS) {
  console.log(JSON.stringify({ products_select: selectProductos, products: columnasTienda, categories: COLUMNAS_CATEGORIA }, null, 2))
  process.exit(0)
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
async function rest(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { ok: res.ok, status: res.status, json }
}

if (!URL_BASE || !KEY) {
  if (SIN_BASE) notas.push('ESQUEMA OMITIDO (--sin-base): no se ejecutaron los select contra la base')
  else problemas.push('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (.env.local). Para solo lo puro: -- --sin-base')
} else {
  const org = Number(process.env.SECCIONES_TIENDA_ORG_ID || 0)
  const filtroOrg = org > 0 ? `&organization_id=eq.${org}` : ''
  const pruebas = [
    ['getProductsByIds', `products?select=${encodeURIComponent(selectProductos)}&product_images.archivo_disponible=eq.true&product_prices.effective_to=is.null&status=eq.active${filtroOrg}&limit=1`],
    ['COLUMNAS_PRODUCTO_TIENDA', `products?select=${encodeURIComponent(columnasTienda.join(','))}${filtroOrg}&limit=1`],
    ['categorías de la nube', `categories?select=${encodeURIComponent(COLUMNAS_CATEGORIA.join(','))}${filtroOrg}&limit=1`],
  ]
  for (const [nombre, ruta] of pruebas) {
    const r = await rest(ruta)
    check(r.ok, `select de ${nombre} no es válido contra el esquema (HTTP ${r.status}): ${JSON.stringify(r.json)}`)
    if (r.ok) notas.push(`${nombre} OK contra el esquema real`)
  }
}

for (const n of notas) console.log(`  ✓ ${n}`)
if (problemas.length > 0) {
  console.error(`\nverify:secciones-tienda FALLÓ (${problemas.length} de ${casos} comprobaciones)\n`)
  for (const p of problemas) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`\nverify:secciones-tienda OK (${casos} comprobaciones)\n`)
