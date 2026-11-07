/**
 * verify-categoria-plantilla.mjs — paquete W3 de las plantillas de tienda (categorías).
 *
 *   npm run verify:categoria-plantilla
 *   VERIFY_BASE=origin/main npm run verify:categoria-plantilla   # otra referencia base
 *
 * Tres compuertas:
 *
 * 1. Render sin opciones nuevas = main. Pinta con react-dom/server las piezas que toca W3
 *    (CategoriesGrid con cada estilo y disposición de hoy, CategoryCard, CategoryHeader y
 *    CategoryFilters) dos veces: con el código de la rama y con el de la referencia base
 *    (`git show <base>:<ruta>`, por defecto `main`). El HTML tiene que ser idéntico byte a
 *    byte con las claves ausentes, y también con valores inválidos (el normalizador los
 *    vuelve default). Con las opciones nuevas tiene que cambiar y traer lo que promete.
 * 2. Ayudas puras: normalizadores del contrato, `planColumnasCategoria` (sin columna
 *    lateral visible ⇒ `null` ⇒ la página apila como hoy), URLs y categorías hermanas.
 * 3. Esquema: las columnas de `categories` que pintan las opciones nuevas (color,
 *    description, slug, parent_id…) existen y llegan en los `select` del propio
 *    `lib/supabase/queries.ts`. Con credenciales (`.env.local`) el select se ejecuta contra la
 *    base real, como verify-tracking; sin ellas se compara con el esquema verificado por MCP.
 *    Además: el árbol de categorías solo se pide cuando hay columna lateral.
 *
 * Transpila TSX con `sucrase` (ya instalado por tailwindcss) mediante un cargador propio
 * (`verify-categoria-plantilla.cargador.mjs`); no agrega dependencias. Datos sintéticos.
 */
import { register } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_REF = process.env.VERIFY_BASE || 'main'

/** Archivos de W3 que existían en main: el grafo «base» los lee de la referencia. */
const ARCHIVOS_BASE = [
  'components/sections/products/CategoryCard.tsx',
  'components/sections/products/CategoriesGrid.tsx',
  'components/sections/products/EstilosCategoria.tsx',
  'lib/website/estiloCategoria.ts',
  'components/sections/category-detail/CategoryHeader.tsx',
  'components/sections/category-detail/CategoryFilters.tsx',
  'components/sections/category-detail/CategoryDetailRenderer.tsx',
]

const problemas = []
const notas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const base = {}
for (const ruta of ARCHIVOS_BASE) {
  try {
    base[ruta] = execFileSync('git', ['show', `${BASE_REF}:${ruta}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch {
    console.error(`verify-categoria-plantilla: no se pudo leer ${ruta} en ${BASE_REF}. Pasa otra referencia con VERIFY_BASE.`)
    process.exit(1)
  }
}
register(pathToFileURL(join(ROOT, 'scripts/verify-categoria-plantilla.cargador.mjs')).href, import.meta.url, { data: { root: ROOT, base } })

const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')

const url = (ruta) => pathToFileURL(join(ROOT, ruta)).href
const actual = async (ruta) => import(url(ruta))
const deBase = async (ruta) => import(`${url(ruta)}?base`)

const enrutador = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }
function pintar(Componente, props) {
  return renderToStaticMarkup(
    React.createElement(AppRouterContext.Provider, { value: enrutador }, React.createElement(Componente, props)),
  )
}

// ─── Datos sintéticos (sin organizaciones reales) ────────────────────────────────────────────
const CATEGORIAS = [
  { id: 1, name: 'Sala', slug: 'sala', color: '#DBC6A4', image_url: 'https://ejemplo.test/sala.jpg', description: 'Sillones y mesas bajas.', product_count: 8, parent_id: null, icon: null },
  { id: 2, name: 'Comedor', slug: 'comedor', color: '#1F3FD8', image_url: null, description: null, product_count: 3, parent_id: null, icon: null },
  { id: 3, name: 'Alcoba', slug: 'alcoba', color: '#0E2433', image_url: 'https://ejemplo.test/alcoba.jpg', description: 'Camas y mesas de noche.', product_count: 0, parent_id: null, icon: null },
  { id: 4, name: 'Iluminación', slug: 'iluminacion', color: 'azul', image_url: null, description: '', product_count: 12, parent_id: null, icon: null },
  { id: 5, name: 'Oficina', slug: 'oficina', color: null, image_url: 'https://ejemplo.test/oficina.jpg', description: 'Escritorios.', product_count: 5, parent_id: null, icon: null },
]

// ─── 1. Render sin opciones nuevas = main ────────────────────────────────────────────────────
const RUTA_GRID = 'components/sections/products/CategoriesGrid.tsx'
const RUTA_CARD = 'components/sections/products/CategoryCard.tsx'
const RUTA_HEADER = 'components/sections/category-detail/CategoryHeader.tsx'
const RUTA_FILTROS = 'components/sections/category-detail/CategoryFilters.tsx'

const [gridA, gridB, cardA, cardB, headerA, headerB, filtrosA, filtrosB] = await Promise.all([
  actual(RUTA_GRID), deBase(RUTA_GRID), actual(RUTA_CARD), deBase(RUTA_CARD),
  actual(RUTA_HEADER), deBase(RUTA_HEADER), actual(RUTA_FILTROS), deBase(RUTA_FILTROS),
])

/** Configuraciones de hoy (claves de main) para la rejilla de categorías. */
const ESTILOS_HOY = [undefined, 'overlay', 'circle', 'card_bottom', 'pill', 'bento', 'minimal_icon', 'raro']
const DISPOSICIONES = [
  {},
  { desktop_layout: 'carousel' },
  { desktop_layout: 'list' },
  { mobile_layout: 'list' },
  { mobile_layout: 'grid', desktop_columns: 3 },
  { shape: 'circle', show_count: true },
  { shape: 'rounded', show_count: true, show_description: true, text_position: 'below' },
  { text_position: 'inside', overlay_color: '#1F3FD8', overlay_opacity: 40, card_hover: 'zoom' },
  { text_position: 'on_hover', card_radius: 0, card_shadow: 'md', image_ratio: '4:3' },
  { show_view_all: true, title: 'Categorías', subtitle: 'Todo' },
  { list_scroll: true, desktop_layout: 'list', show_count: true },
]
/** Valores inválidos de las claves nuevas: el normalizador los vuelve default ⇒ igual a main. */
const INVALIDAS = [
  {},
  { category_text_position: 'bottom', category_card_color: 'none', category_cta_icon: 'none' },
  { category_text_position: 'arriba', category_card_color: 'rojo', category_cta_icon: 'flecha' },
  { category_text_position: 3, category_card_color: null, category_cta_icon: true },
]

let iguales = 0
for (const estilo of ESTILOS_HOY) {
  for (const disp of DISPOSICIONES) {
    for (const inval of INVALIDAS) {
      const content = { ...(estilo ? { category_style: estilo } : {}), ...disp, ...inval }
      const props = { content, primaryColor: '#B4583A', data: { categories: CATEGORIAS } }
      const a = pintar(gridA.CategoriesGrid, props)
      const b = pintar(gridB.CategoriesGrid, props)
      check(a === b, `CategoriesGrid ${JSON.stringify(content)}: el render cambió frente a ${BASE_REF}`)
      if (a === b) iguales++
    }
  }
}
for (const estilo of [{}, { text_position: 'below', show_count: true, show_color: true }, { shape: 'circle', media_source: 'icon' }, { card_bg: '#fff', badge: 'Nuevo' }]) {
  const props = { cat: CATEGORIAS[0], cardStyle: estilo, primaryColor: '#111111' }
  check(pintar(cardA.CategoryCard, props) === pintar(cardB.CategoryCard, props), `CategoryCard ${JSON.stringify(estilo)}: cambió frente a ${BASE_REF}`)
}

const DATOS_PAGINA = {
  category: { id: 1, name: 'Sala', slug: 'sala', description: 'Piezas para la sala.', image_url: 'https://ejemplo.test/sala.jpg', parent_id: null },
  parentCategory: { id: 9, name: 'Muebles', slug: 'muebles' },
  subcategories: [{ id: 11, name: 'Sofás', slug: 'sofas', product_count: 4 }, { id: 12, name: 'Mesas de centro', slug: 'mesas-centro', product_count: 2, icon: '🪑' }],
  total: 6,
  categorySlug: 'sala',
  currentSort: 'best_selling',
  currentSubcategory: '',
  currentView: 'grid',
}
const VARIANTES_DATOS = [DATOS_PAGINA, { ...DATOS_PAGINA, currentSubcategory: 'sofas', currentSort: 'newest', total: 1 }, { ...DATOS_PAGINA, subcategories: [], category: { ...DATOS_PAGINA.category, image_url: null, description: null } }]
for (const data of VARIANTES_DATOS) {
  for (const content of [{}, { show_image: false }, { show_breadcrumb: false, show_count: false }, { layout: 'stack' }, { layout: 'raro' }, { layout: 'split_text', show_image: true }]) {
    // `split_text` con foto de portada visible: la foto manda y se pinta como hoy.
    if (content.layout === 'split_text' && !data.category.image_url) continue
    const props = { content, data, primaryColor: '#111111' }
    check(pintar(headerA.CategoryHeader, props) === pintar(headerB.CategoryHeader, props), `CategoryHeader ${JSON.stringify(content)}: cambió frente a ${BASE_REF}`)
  }
  for (const content of [{}, { show_sort: false }, { show_view_toggle: false }, { subcategory_style: 'chips' }, { subcategory_style: 'raro', search: 'si' }, { search: false }]) {
    const props = { content, data, primaryColor: '#1F3FD8' }
    check(pintar(filtrosA.CategoryFilters, props) === pintar(filtrosB.CategoryFilters, props), `CategoryFilters ${JSON.stringify(content)}: cambió frente a ${BASE_REF}`)
  }
}
notas.push(`render = ${BASE_REF}: ${iguales} configuraciones de la rejilla, + tarjeta, encabezado y filtros`)

// ─── 1b. Con opciones nuevas, cambia y trae lo prometido ─────────────────────────────────────
const g = (content) => pintar(gridA.CategoriesGrid, { content, primaryColor: '#B4583A', data: { categories: CATEGORIAS } })
const gBase = (content) => pintar(gridB.CategoriesGrid, { content, primaryColor: '#B4583A', data: { categories: CATEGORIAS } })

const tituloArriba = g({ category_style: 'title_top', show_count: true, desktop_columns: 3 })
check(tituloArriba !== gBase({ category_style: 'title_top', show_count: true, desktop_columns: 3 }), 'title_top: debe dejar de ser la tarjeta superpuesta')
check(tituloArriba.includes('Explorar') && tituloArriba.includes('Sillones y mesas bajas.') && tituloArriba.includes('8 productos'), 'title_top: «Explorar», descripción real y conteo')
check(!tituloArriba.includes('<p class="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300"></p>'), 'title_top: sin descripción no pinta un párrafo vacío')
check(tituloArriba.indexOf('>Sala</h3>') < tituloArriba.indexOf('sala.jpg'), 'title_top: el nombre va antes (encima) de la foto')

const conColor = g({ category_style: 'card_bottom', category_card_color: 'per_item' })
check(conColor.includes('background-color:#DBC6A4') && conColor.includes('background-color:#1F3FD8'), 'per_item: el pie toma categories.color')
check(conColor.includes('color:#111827') && conColor.includes('color:#FFFFFF'), 'per_item: texto oscuro sobre claro y blanco sobre oscuro')
check(!conColor.includes('background-color:azul'), 'per_item: un color que no es hex no se pinta')

const arriba = g({ category_style: 'card_bottom', category_text_position: 'top' })
const iNombre = arriba.indexOf('>Sala</p>')
const iFoto = arriba.indexOf('sala.jpg')
check(iNombre > -1 && iFoto > -1 && iNombre < iFoto, 'text_position top (card_bottom): el pie va antes de la foto')

const flechaCirculo = g({ category_style: 'card_bottom', category_cta_icon: 'arrow_circle', show_count: true })
check(flechaCirculo.includes('rounded-full bg-white') && !flechaCirculo.includes('Ver productos →'), 'arrow_circle (card_bottom): flecha en círculo en vez de «Ver productos →»')
const flecha = g({ category_style: 'card_bottom', category_cta_icon: 'arrow' })
check(flecha.includes('lucide-arrow-right') && !flecha.includes('Ver productos →'), 'arrow (card_bottom): flecha al lado del nombre')

const superpuestaArriba = g({ category_text_position: 'top' })
check(superpuestaArriba.includes('linear-gradient(to bottom') && superpuestaArriba.includes('items-start'), 'text_position top (superpuesta): texto y degradado arriba')
const superpuestaColor = g({ category_card_color: 'per_item' })
check(superpuestaColor.includes('rgba(219, 198, 164, 0.6)'), 'per_item (superpuesta): el degradado toma el color de la categoría')
check(g({ category_cta_icon: 'arrow_circle' }).includes('lucide-arrow-up-right'), 'arrow_circle (superpuesta): flecha en círculo')
check(g({ text_position: 'below', category_card_color: 'per_item' }).includes('background-color:#DBC6A4'), 'per_item (debajo): el pie toma el color')

// Encabezado partido y filtros nuevos
const sinFoto = { ...DATOS_PAGINA, category: { ...DATOS_PAGINA.category, image_url: null } }
const partido = pintar(headerA.CategoryHeader, { content: { layout: 'split_text' }, data: sinFoto })
check(partido.includes('md:grid-cols-2') && partido.includes('Piezas para la sala.') && (partido.match(/6 productos/g) || []).length === 1, 'split_text: título a la izquierda, texto a la derecha y un solo conteo')
check(partido !== pintar(headerB.CategoryHeader, { content: { layout: 'split_text' }, data: sinFoto }), 'split_text: cambia frente a main')

const texto = pintar(filtrosA.CategoryFilters, { content: { subcategory_style: 'text' }, data: DATOS_PAGINA })
check(texto.includes('aria-label="Subcategorías"') && !texto.includes('rounded-full text-sm font-medium'), 'subcategory_style text: sin píldoras')
const pestanas = pintar(filtrosA.CategoryFilters, { content: { subcategory_style: 'tabs' }, data: DATOS_PAGINA })
check(pestanas.includes('border-b-2') && pestanas.includes('aria-current="true"'), 'subcategory_style tabs: pestañas con la activa marcada')
const buscador = pintar(filtrosA.CategoryFilters, { content: { search: true }, data: DATOS_PAGINA })
check(buscador.includes('action="/search"') && buscador.includes('name="q"') && buscador.includes('Buscar en la tienda'), 'search: píldora que envía a /search?q=')

// FiltrosLaterales (nuevo)
const { FiltrosLaterales, CONTENT_KEYS } = await actual('components/sections/category-detail/FiltrosLaterales.tsx')
const HERMANAS = [{ id: 1, name: 'Sala', slug: 'sala', parent_id: null }, { id: 2, name: 'Comedor', slug: 'comedor', parent_id: null }]
const lateral = pintar(FiltrosLaterales, { content: {}, data: { ...DATOS_PAGINA, categoriasHermanas: HERMANAS } })
check(lateral.includes('Categorías') && lateral.includes('href="/categorias/comedor"') && lateral.includes('Subcategorías'), 'lateral: categorías hermanas y subcategorías reales')
check(lateral.includes('href="/categorias/sala?sub=sofas"') && lateral.includes('>4</span>'), 'lateral: subcategoría = ?sub= con su conteo real')
check(lateral.includes('Ordenar por') && !lateral.includes('Limpiar filtros'), 'lateral: orden sí; «Limpiar» solo con filtros puestos')
const lateralActivo = pintar(FiltrosLaterales, { content: { clear_text: 'Quitar todo' }, data: { ...DATOS_PAGINA, currentSubcategory: 'sofas', currentSort: 'newest', categoriasHermanas: HERMANAS } })
check(lateralActivo.includes('2 filtros activos') && lateralActivo.includes('Quitar todo') && lateralActivo.includes('href="/categorias/sala"'), 'lateral: «Limpiar» con el texto del dueño vuelve a la categoría sin filtros')
check(lateralActivo.includes('href="/categorias/sala?orden=newest"'), 'lateral: desmarcar la subcategoría conserva el orden')
const lateralSinSub = pintar(FiltrosLaterales, { content: { show_subcategories: false, show_sort: false }, data: { ...DATOS_PAGINA, categoriasHermanas: [] } })
check(lateralSinSub === '', 'lateral: sin categorías hermanas, sin subcategorías, sin orden ni filtros no se pinta')
// Las opciones del selector de orden («Precio: Menor a Mayor») son las de siempre; no son facetas.
const sinOrden = (html) => html.replace(/<select[\s\S]*?<\/select>/g, '')
check(!/precio|disponib|stock|a pedido|type="checkbox"/i.test(sinOrden(lateral + lateralActivo)), 'lateral: sin facetas de precio ni disponibilidad ni multiselección (PLANO §7)')
check(JSON.stringify([...CONTENT_KEYS]) === JSON.stringify(['show_subcategories', 'show_sort', 'clear_text']) && FiltrosLaterales.CONTENT_KEYS === CONTENT_KEYS, 'lateral: CONTENT_KEYS = claves del contrato, leíbles por el manifiesto')

// ─── 2. Ayudas puras ─────────────────────────────────────────────────────────────────────────
const contrato = await actual('lib/website/v2/contrato/seccionesTienda.ts')
const col = await actual('components/sections/category-detail/columnasCategoria.ts')
const est = await actual('lib/website/estiloCategoria.ts')
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

check(igual(contrato.normalizarAjustesCategorias({}), { textPosition: 'bottom', cardColor: 'none', ctaIcon: 'none' }), 'contrato: ajustes de categoría ausentes = hoy')
check(contrato.disposicionEncabezadoCategoria(null) === 'stack', 'contrato: encabezado ausente = stack')
check(igual(contrato.normalizarAjustesFiltrosCategoria({}), { subcategoryStyle: 'chips', search: false }), 'contrato: filtros ausentes = chips sin buscador')
check(est.estiloCategoria('title_top') === 'title_top' && est.estiloCategoria(undefined) === null && est.estiloCategoria('overlay') === null, 'estiloCategoria: title_top nuevo; ausente y overlay siguen en la tarjeta de hoy')
check(est.colorDeCategoria('#abc') === '#abc' && est.colorDeCategoria(' #A1B2C3 ') === '#A1B2C3' && est.colorDeCategoria('azul') === null && est.colorDeCategoria(null) === null, 'colorDeCategoria: solo hex')
check(est.textoSobreColor('#FFFFFF') === '#111827' && est.textoSobreColor('#000000') === '#FFFFFF' && est.textoSobreColor('#1F3FD8') === '#FFFFFF' && est.textoSobreColor('#DBC6A4') === '#111827', 'textoSobreColor: contraste')

const S = (section_type, section_variant = 'default', is_visible = true) => ({ section_type, section_variant, is_visible })
const PAGINA_HOY = [S('category_header'), S('category_filters'), S('category_products')]
check(col.planColumnasCategoria(PAGINA_HOY) === null, 'plan: sin columna lateral = null (página de hoy)')
check(col.planColumnasCategoria([]) === null, 'plan: sin secciones = null')
check(col.planColumnasCategoria([S('category_header'), S('category_filters', 'sidebar_facets', false), S('category_products')]) === null, 'plan: columna lateral oculta = null')
check(col.planColumnasCategoria([S('category_header'), S('category_filters', 'sidebar_facets'), S('category_products')], false) === null, 'plan: sin registrar en SECTION_MAP = null')
check(col.planColumnasCategoria([S('category_header'), S('category_filters', 'sidebar_facets'), S('image_text', 'image_right')]) === null, 'plan: sin listado después = null')
const PAGINA_CONTRASTE = [S('category_header'), S('category_filters', 'sidebar_facets'), S('category_products'), S('image_text', 'image_right'), S('features_grid', 'icons')]
const plan = col.planColumnasCategoria(PAGINA_CONTRASTE)
check(plan && plan.length === 4 && plan[1].tipo === 'columnas' && plan[1].principal.length === 1 && plan[1].principal[0].indice === 2 && plan[2].indice === 3, 'plan: encabezado · [lateral | productos] · imagen · rasgos')
check(col.urlListadoCategoria('sala', { orden: 'best_selling', sub: '', vista: 'grid' }) === '/categorias/sala', 'url: defaults fuera')
check(col.urlListadoCategoria('sala', { orden: 'price_asc', sub: 'sofas', vista: 'list' }) === '/categorias/sala?orden=price_asc&sub=sofas&vista=list', 'url: orden, sub y vista')
check(col.filtrosActivos('', 'best_selling') === 0 && col.filtrosActivos('sofas', 'newest') === 2, 'filtrosActivos')
const ARBOL = [{ id: 1, name: 'Muebles', slug: 'muebles', parent_id: null, children: [{ id: 3, name: 'Sala', slug: 'sala', parent_id: 1, children: [] }, { id: 4, name: 'Comedor', slug: 'comedor', parent_id: 1, children: [] }] }, { id: 2, name: 'Decoración', slug: 'decoracion', parent_id: null, children: [] }]
check(igual(col.categoriasHermanas(ARBOL, { id: 3, parent_id: 1 }).map((c) => c.slug), ['sala', 'comedor']), 'hermanas: hijas del mismo padre')
check(igual(col.categoriasHermanas(ARBOL, { id: 2, parent_id: null }).map((c) => c.slug), ['muebles', 'decoracion']), 'hermanas: raíces')
check(igual(col.categoriasHermanas(ARBOL, { id: 99, parent_id: null }), []), 'hermanas: categoría fuera del árbol = []')

// ─── 3. Esquema y rendimiento ────────────────────────────────────────────────────────────────
/** Columnas de `categories` verificadas por MCP (proyecto del sitio) el 2026-11-07. */
const COLUMNAS_CATEGORIES_MCP = ['id', 'organization_id', 'parent_id', 'name', 'slug', 'rank', 'created_at', 'updated_at', 'icon', 'color', 'image_url', 'description', 'is_active', 'display_order', 'meta_title', 'meta_description', 'uuid', 'metadata', 'requires_preparation', 'station', 'branch_id', 'cuenta_ingreso', 'cuenta_costo', 'cuenta_inventario', 'cuenta_devolucion', 'default_weight_kg']
/** Lo que leen las opciones nuevas de W3 en cada fuente de datos. */
const LECTURAS = {
  getOrganizationCategoriesUncached: ['id', 'name', 'slug', 'color', 'image_url', 'description'], // rejilla: per_item, title_top
  getSubcategoriesUncached: ['id', 'name', 'slug'], // columna lateral (+ product_count calculado)
  getMenuCategoriesUncached: ['id', 'name', 'slug', 'parent_id'], // categorías hermanas
}
const queries = readFileSync(join(ROOT, 'lib/supabase/queries.ts'), 'utf8')
function selectDe(nombre) {
  const i = queries.indexOf(`async function ${nombre}(`)
  if (i === -1) return null
  const cuerpo = queries.slice(i, queries.indexOf('\n}\n', i))
  const m = cuerpo.match(/\.from\('categories'\)\s*\.select\(\s*'([^']*)'/)
  return m ? m[1] : null
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
for (const [fn, columnas] of Object.entries(LECTURAS)) {
  const select = selectDe(fn)
  check(select != null, `${fn}: no se encontró su select de categories en queries.ts`)
  if (select == null) continue
  const pedidas = select === '*' ? COLUMNAS_CATEGORIES_MCP : select.split(',').map((c) => c.trim())
  for (const c of columnas) check(pedidas.includes(c), `${fn}: el select («${select}») no trae ${c}`)
  for (const c of pedidas) check(COLUMNAS_CATEGORIES_MCP.includes(c), `${fn}: ${c} no existe en categories`)
  if (URL_BASE && KEY) {
    const sel = select === '*' ? columnas.join(',') : select
    const r = await fetch(`${URL_BASE}/rest/v1/categories?select=${encodeURIComponent(sel)}&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    check(r.ok, `${fn}: el select no es válido contra la base real (HTTP ${r.status}): ${await r.text()}`)
  }
}
notas.push(URL_BASE && KEY ? 'esquema: selects ejecutados contra la base real' : 'esquema: sin credenciales, comparado con las columnas verificadas por MCP el 2026-11-07')

const renderer = readFileSync(join(ROOT, 'components/sections/category-detail/CategoryDetailRenderer.tsx'), 'utf8')
const iPlan = renderer.indexOf('if (plan && templatePage)')
const iArbol = renderer.indexOf('await getMenuCategories(')
const iHoy = renderer.indexOf('// ---- Modo plantilla: renderizar secciones ----')
check(iPlan > -1 && iArbol > iPlan && iArbol < iHoy && renderer.split('getMenuCategories(').length === 2, 'rendimiento: el árbol de categorías solo se pide con columna lateral (una vez)')
const hoyBase = base['components/sections/category-detail/CategoryDetailRenderer.tsx']
const tramo = (t) => t.slice(t.indexOf('// ---- Modo plantilla: renderizar secciones ----'))
check(tramo(renderer) === tramo(hoyBase), 'CategoryDetailRenderer: el camino sin columna lateral (plantilla y respaldo) es el de main, línea por línea')

for (const n of notas) console.log(`  ✓ ${n}`)
if (problemas.length) {
  console.error(`\nverify-categoria-plantilla: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-categoria-plantilla: ${casos} casos`)
