/**
 * verify-ficha-plantilla.mjs — la ficha de producto de las plantillas de tienda (paquete W4) no
 * cambia ninguna ficha de hoy, y sus consultas nuevas piden columnas que existen.
 *
 *   npm run verify:ficha-plantilla
 *   (con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno, además ejecuta los
 *    select contra la base real, al estilo de verify-tracking)
 *
 * 1. `buildDefaultProductDetailSections(null)` (y con `{}` y varios `page_settings`) da lo mismo
 *    que la versión de `main` (se lee con `git show main:…`).
 * 2. `resolverDisenoFicha`: con `page_settings` (legacy) da exactamente la fórmula de antes y no
 *    lee `page_layout`; sin `page_settings` y sin `page_layout`, los defaults de hoy; con
 *    `page_layout`, ese diseño normalizado.
 * 3. Reglas puras: mosaico, vecinos del paginador, pestañas con destino, ids de ancla, etiquetas.
 * 4. Inerte por defecto (lectura del fuente): cada rama nueva va detrás de su clave o su bloque.
 * 5. Esquema: los `select` de `lib/queries/tienda/{look,pager}.ts` y las columnas que lee la ficha
 *    técnica están en el esquema real (lista verificada por MCP el 2026-11-07, proyecto
 *    taqjemqjtumhwptchcxk). Con credenciales, PostgREST los ejecuta (42703 = columna inexistente).
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'
import { isDeepStrictEqual } from 'node:util'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
const notas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(isDeepStrictEqual(a, b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)
// Los fuentes viven con CRLF en Windows (autocrlf): se comparan siempre con LF.
const fuente = async (ruta) => (await readFile(join(ROOT, ruta), 'utf8')).replace(/\r\n/g, '\n')

// ─── Carga de los módulos puros ──────────────────────────────────────────────────────────────
const dir = join(ROOT, '.verify-ficha-plantilla-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
async function cargarTexto(ts, nombre, reemplazos = []) {
  let js = stripTypeScriptTypes(ts, { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  for (const [de, a] of reemplazos) {
    if (!js.includes(de)) throw new Error(`${nombre}: no encontré «${de}» para reemplazar`)
    js = js.replace(de, a)
  }
  await writeFile(join(dir, nombre), js)
  return import(pathToFileURL(join(dir, nombre)).href)
}
let defHoy, defMain, contrato, ficha, anclas
try {
  defHoy = await cargarTexto(await fuente('lib/defaultProductDetailSections.ts'), 'defHoy.mjs')
  const tsMain = execFileSync('git', ['show', 'main:lib/defaultProductDetailSections.ts'], { cwd: ROOT, encoding: 'utf8' })
  defMain = await cargarTexto(tsMain, 'defMain.mjs')
  contrato = await cargarTexto(await fuente('lib/website/v2/contrato/seccionesTienda.ts'), 'seccionesTienda.mjs')
  ficha = await cargarTexto(await fuente('components/sections/product-detail/fichaTienda.ts'), 'fichaTienda.mjs', [
    ["from '@/lib/website/v2/contrato/seccionesTienda'", "from './seccionesTienda.mjs'"],
  ])
  anclas = await cargarTexto(await fuente('components/sections/product-detail/anclasFicha.ts'), 'anclasFicha.mjs')
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ─── 1. Bloques por defecto = main ───────────────────────────────────────────────────────────
const PAGE_SETTINGS = [
  null,
  undefined,
  {},
  { columns: '1' },
  { columns: '2+sidebar', sticky_column: false, gallery_width: 60, show_breadcrumb: false },
  { description_position: 'below_price', show_benefits: false, related_products_layout: 'grid' },
  { gallery_layout: 'show_all', thumbnails_position: 'none', buttons_layout: 'inline', sticky_mobile: false },
  { description_position: 'below_buttons', gallery_layout: 'scroll', gallery_scroll_height: 300 },
]
for (const ps of PAGE_SETTINGS) {
  igual(defHoy.buildDefaultProductDetailSections(ps), defMain.buildDefaultProductDetailSections(ps), `buildDefaultProductDetailSections(${JSON.stringify(ps)}) = main`)
}
igual(defHoy.DEFAULT_PRODUCT_DETAIL_SECTIONS, defMain.DEFAULT_PRODUCT_DETAIL_SECTIONS, 'DEFAULT_PRODUCT_DETAIL_SECTIONS = main')

// ─── 2. Diseño de la ficha ───────────────────────────────────────────────────────────────────
/** La fórmula que tenía ProductDetailRenderer antes de W4 (`page_settings || {}`). */
const antes = (pageSettings) => {
  const p = pageSettings || {}
  return {
    columns: p.columns || '2',
    stickyColumn: p.sticky_column !== false,
    galleryWidth: p.gallery_width ?? 50,
    showBreadcrumb: p.show_breadcrumb !== false,
  }
}
const galeriaCon = (content) => [{ section_type: 'product_info', content: {} }, { section_type: 'product_gallery', content }]
const PAGE_LAYOUT = { columns: '1', sticky_column: false, show_breadcrumb: false, gallery_width: 40 }
for (const ps of PAGE_SETTINGS.filter(Boolean)) {
  igual(ficha.resolverDisenoFicha(ps, galeriaCon({})), antes(ps), `legacy ${JSON.stringify(ps)} = antes`)
  igual(ficha.resolverDisenoFicha(ps, galeriaCon({ page_layout: PAGE_LAYOUT })), antes(ps), `legacy ${JSON.stringify(ps)} no lee page_layout`)
}
for (const secciones of [[], galeriaCon({}), galeriaCon(null), galeriaCon({ page_layout: null }), galeriaCon({ page_layout: 'x' }), galeriaCon({ page_layout: [1] }), [{ section_type: 'product_info', content: { page_layout: PAGE_LAYOUT } }]]) {
  igual(ficha.resolverDisenoFicha(null, secciones), antes(null), `V2 sin page_layout en la galería (${JSON.stringify(secciones)}) = hoy`)
  igual(ficha.resolverDisenoFicha(undefined, secciones), antes(undefined), 'page_settings undefined = hoy')
}
igual(ficha.resolverDisenoFicha(null, galeriaCon({ page_layout: PAGE_LAYOUT })), { columns: '1', stickyColumn: false, galleryWidth: 40, showBreadcrumb: false }, 'V2 con page_layout')
igual(ficha.resolverDisenoFicha(null, galeriaCon({ page_layout: {} })), antes(null), 'page_layout vacío = defaults de hoy')
igual(ficha.resolverDisenoFicha(null, galeriaCon({ page_layout: { gallery_width: 90, columns: 'tres', sticky_column: 'no' } })), antes(null), 'page_layout inválido = defaults de hoy')
igual(ficha.resolverDisenoFicha(null, galeriaCon({ page_layout: { show_breadcrumb: false } })), { ...antes(null), showBreadcrumb: false }, 'Roble: solo sin migas')
igual(ficha.resolverDisenoFicha(null, galeriaCon({ page_layout: { sticky_column: true, show_breadcrumb: true } })), antes(null), 'Panorama: igual a hoy')

// ─── 3. Reglas puras ─────────────────────────────────────────────────────────────────────────
igual(ficha.celdasMosaico(0), [], 'mosaico sin fotos')
igual(ficha.celdasMosaico(1), ['grande'], 'mosaico 1')
igual(ficha.celdasMosaico(2), ['grande', 'grande'], 'mosaico 2: la mediana sin pareja va grande')
igual(ficha.celdasMosaico(3), ['grande', 'mediana', 'mediana'], 'mosaico 3')
igual(ficha.celdasMosaico(4), ['grande', 'mediana', 'mediana', 'grande'], 'mosaico 4 (Atelier)')
igual(ficha.celdasMosaico(6), ['grande', 'mediana', 'mediana', 'grande', 'grande', 'grande'], 'mosaico 6')
igual(ficha.celdasMosaico(7), ['grande', 'mediana', 'mediana', 'grande', 'grande', 'mediana', 'mediana'], 'mosaico 7')
igual(ficha.celdasMosaico(-3), [], 'mosaico negativo')
igual(ficha.celdasMosaico(2.5), [], 'mosaico no entero')

igual(ficha.vecinosEnOrden([5, 7, 9], 7), { anteriorId: 5, siguienteId: 9 }, 'vecinos en medio')
igual(ficha.vecinosEnOrden([5, 7, 9], 5), { anteriorId: null, siguienteId: 7 }, 'primero sin anterior (sin vuelta)')
igual(ficha.vecinosEnOrden([5, 7, 9], 9), { anteriorId: 7, siguienteId: null }, 'último sin siguiente')
igual(ficha.vecinosEnOrden([5, 7, 9], 4), { anteriorId: null, siguienteId: null }, 'fuera del orden (variante u oculto)')
igual(ficha.vecinosEnOrden([], 4), { anteriorId: null, siguienteId: null }, 'categoría vacía')

// Pestañas de la ficha (pestañas reales, 2026-11-25): qué bloques pasan a los paneles.
{
  const conNav = (lista, contenido = {}) => [{ id: 'n', section_type: 'product_anchor_nav', content: contenido }, ...lista]
  const plan = ficha.planPestanasFicha(conNav([{ id: 'g', section_type: 'product_gallery' }, { id: 'r', section_type: 'product_reviews' }, { id: 'i', section_type: 'product_info' }]))
  igual(plan.items.map((p) => p.target), ['product_reviews'], 'se quitan las pestañas sin bloque')
  check(plan.nav.id === 'n', 'el plan lleva el bloque de pestañas')
  igual(ficha.planPestanasFicha([{ id: 'r', section_type: 'product_reviews' }]), null, 'sin bloque de pestañas: la ficha de siempre')
  igual(ficha.planPestanasFicha(conNav([])).items, [], 'sin destinos, sin pestañas')
  // Una pestaña guardada hacia la información («Resumen» de antes) no se pinta: su bloque se queda arriba.
  const viejas = { items: [{ label: 'Resumen', target: 'product_info' }, { label: 'Envío', target: 'product_shipping' }] }
  igual(ficha.planPestanasFicha(conNav([{ id: 'i', section_type: 'product_info' }, { id: 'e', section_type: 'product_shipping' }], viejas)).items.map((p) => p.label), ['Envío'], '«Resumen» deja de ser pestaña; el nombre guardado se respeta')
}
check(ficha.etiquetaCombinable(null) && ficha.etiquetaCombinable('general') && ficha.etiquetaCombinable(undefined) && ficha.etiquetaCombinable(''), 'etiquetas general o sin kind combinan')
check(!ficha.etiquetaCombinable('dieta') && !ficha.etiquetaCombinable('alergeno') && !ficha.etiquetaCombinable('picante'), 'dieta, alérgeno y picante no combinan')
check(ficha.tieneBloque([{ section_type: 'product_pager' }], 'product_pager') && !ficha.tieneBloque([{ section_type: 'product_pager', is_visible: false }], 'product_pager') && !ficha.tieneBloque(null, 'product_pager'), 'tieneBloque respeta is_visible')
igual([...ficha.TIPOS_BLOQUE_FICHA_TIENDA].sort(), ['complete_the_look', 'product_anchor_nav', 'product_pager'], 'tipos de bloque nuevos')
for (const t of ficha.TIPOS_BLOQUE_FICHA_TIENDA) check(contrato.esTipoNuevoTienda(t), `${t} es tipo nuevo del contrato`)
check(contrato.VALORES_NUEVOS_TIENDA['product_gallery.gallery_layout'].includes('mosaic'), 'mosaic es valor nuevo del contrato')

// «Envío y devoluciones» + «Beneficios», los dos de fábrica, repetían los mismos datos (2026-11-25).
{
  const tipos = (lista) => lista.map((s) => s.section_type)
  const galeria = { section_type: 'product_gallery', content: { page_layout: { columns: '2' } } }
  const envio = { section_type: 'product_shipping', content: {} }
  const beneficios = { section_type: 'product_benefits', content: {} }
  const nav = { section_type: 'product_anchor_nav', content: {} }
  const resenas = { section_type: 'product_reviews', content: {} }
  // La ficha de Moderna tal como la armaba la plantilla.
  const moderna = [galeria, { section_type: 'product_info' }, envio, beneficios, nav, resenas]
  const limpia = ficha.sinEnvioRepetidoDeFabrica(moderna)
  igual(tipos(limpia), ['product_gallery', 'product_info', 'product_benefits', 'product_anchor_nav', 'product_reviews'], 'los dos de fábrica: se queda Beneficios')
  check(moderna.length === 6, 'no cambia la lista que recibe')
  // Con «Envío y devoluciones» como pestaña el renderer no aplica la regla (el detalle va en su
  // pestaña y arriba solo queda la línea corta con datos reales): verify-pestanas-ficha.
  // Beneficios con estilo pero sin textos propios sigue pintando los de fábrica: también repite.
  igual(tipos(ficha.sinEnvioRepetidoDeFabrica([envio, { section_type: 'product_benefits', content: { benefits_style: 'tarjetas', items: [] } }])), ['product_benefits'], 'beneficios con estilo y sin items: de fábrica')
  // Lo que el comercio tocó se respeta: se pintan los dos.
  for (const [nombre, tocado] of [
    ['título', { title: 'Despachos' }],
    ['mensaje', { custom_message: 'Despachamos el mismo día' }],
    ['un interruptor', { show_return_policy: false }],
    ['estilo de tarjeta', { card_radius: 12 }],
  ]) {
    igual(tipos(ficha.sinEnvioRepetidoDeFabrica([{ section_type: 'product_shipping', content: tocado }, beneficios])), ['product_shipping', 'product_benefits'], `envío con ${nombre}: se pinta`)
  }
  const propios = { section_type: 'product_benefits', content: { items: [{ title: 'Hecho a mano' }] } }
  igual(tipos(ficha.sinEnvioRepetidoDeFabrica([envio, propios])), ['product_shipping', 'product_benefits'], 'beneficios propios: no repiten, se pintan los dos')
  // Sin Beneficios (o restaurante, donde los de fábrica no se pintan) el envío es lo único que hay.
  igual(tipos(ficha.sinEnvioRepetidoDeFabrica([galeria, envio, resenas])), ['product_gallery', 'product_shipping', 'product_reviews'], 'solo envío: se queda')
  igual(tipos(ficha.sinEnvioRepetidoDeFabrica([envio, beneficios], { restaurante: true })), ['product_shipping', 'product_benefits'], 'restaurante: no toca nada')
  // Fichas sin «Envío y devoluciones» (las otras plantillas y los bloques por defecto): idénticas.
  const porDefectoFicha = defHoy.buildDefaultProductDetailSections(null).filter((s) => s.is_visible !== false)
  igual(ficha.sinEnvioRepetidoDeFabrica(porDefectoFicha), porDefectoFicha, 'bloques por defecto: sin cambios')
  igual(ficha.sinEnvioRepetidoDeFabrica([]), [], 'lista vacía')
  igual(tipos(ficha.sinEnvioRepetidoDeFabrica([{ section_type: 'product_shipping', content: null }, { section_type: 'product_benefits' }])), ['product_benefits'], 'contenido nulo = sin tocar')
}

// ─── 4. Inerte por defecto (fuente) ──────────────────────────────────────────────────────────
{
  const galeria = await fuente('components/site/ProductImageGallery.tsx')
  check(galeria.includes("if (layout === 'mosaic') {"), 'la galería pinta el mosaico solo con gallery_layout mosaic')
  check(galeria.includes("const layout = settings.gallery_layout || 'carousel'"), 'la galería sigue en carrusel por defecto')

  const renderer = await fuente('components/sections/product-detail/ProductDetailRenderer.tsx')
  check(renderer.includes('resolverDisenoFicha(templatePage?.page_settings ?? null, secciones)'), 'el renderer resuelve el diseño con page_settings primero')
  check(renderer.includes('buildDefaultProductDetailSections(pageSettings)') && renderer.includes("const pageSettings = (templatePage?.page_settings || {}) as Record<string, any>"), 'los bloques por defecto se arman con los page_settings de siempre')
  check(renderer.includes('const planPestanas = planPestanasFicha(crudas)') && renderer.includes('const bloquePestanas = planPestanas && datosPestanas ?'), 'los paneles de pestañas solo existen con el bloque de pestañas')
  check(renderer.includes('if (extrasFicha) {') && renderer.includes('// Sin extras: los datos de siempre.'), 'los datos nuevos solo entran con extrasFicha')

  const pagina = await fuente('app/productos/[id]/page.tsx')
  // Relacionados elegidos a mano / comprados juntos (verify-secciones-ficha): solo si la sección los pide.
  check(pagina.includes('if (conPaginador || bloqueLook || conFichaTecnica || conRelacionados || opcionesRelacionados.verTodos || conEnvioEnPestana) {'), 'la página consulta solo si la plantilla trae los bloques nuevos')
  check(pagina.includes('conEnvioEnPestana || enLienzo ? getZonasEnvioFicha(organization.id) : Promise.resolve(null)'), 'las zonas de envío solo con la pestaña «Envío y devoluciones» (o en el lienzo)')
  check(pagina.includes("conPaginador ? getPaginadorFicha(") && pagina.includes('look\n        ? getCompletaElLook('), 'cada consulta detrás de su bloque')
  check(pagina.includes('const seccionesFicha = hasTemplateSections ? productDetailTemplate.website_page_sections : []'), 'la ficha legacy monolítica no consulta nada nuevo')

  const acciones = await fuente('app/productos/[id]/ProductDetailActions.tsx')
  check(acciones.includes('precioEnBoton = false,') && acciones.includes('ayudaVariante = false,'), 'acciones: las opciones nuevas valen false por defecto')
  // Botones configurables (Figma 2779:65038, 2026-11-22): el precio llega solo con la opción y
  // FilasAccionesFicha lo agrega al texto de «Agregar» (scripts/verify-acciones-ficha.mjs).
  check(acciones.includes('precio: precioEnBoton ? formatPrice(effectivePrice) : null,'), 'acciones: sin precio en el botón, la etiqueta de siempre')
  const boton = await fuente('components/site/AddToCartButton.tsx')
  check(boton.includes("{etiqueta ?? 'Agregar al carrito'}"), 'botón: sin etiqueta, «Agregar al carrito»')
  const selector = await fuente('components/site/VariantSelector.tsx')
  check(selector.includes('ayudaVariante = false,') && selector.includes('precioEnBoton = false,'), 'selector: opciones nuevas en false por defecto')
  // 2026-11-25: la primera variante disponible se preselecciona SIEMPRE (también con `button_hint: 'auto'`).
  {
    const efecto = selector.slice(selector.indexOf('// Preseleccionar la primera variante disponible'), selector.indexOf('// Sincroniza con el otro selector de la ficha'))
    check(efecto.includes('if (variants.length > 0 && !selectedVariant) {') && efecto.includes('primeraVarianteDisponible(variants)'), 'selector: se preselecciona la primera variante disponible')
    check(!efecto.includes('ayudaVariante'), 'selector: la preselección no depende de la pista del botón')
  }
  const accionesBloque = await fuente('components/sections/product-detail/ProductActions.tsx')
  check(accionesBloque.includes('normalizarAjustesAccionesFicha(content'), 'el bloque de acciones lee sus claves con el normalizador del contrato')
  igual(contrato.normalizarAjustesAccionesFicha({}), { showPriceInButton: false, buttonHint: 'none' }, 'acciones sin claves = hoy')

  // Nada de dinero: ni checkout, ni pedidos, ni carrito propio.
  for (const ruta of ['lib/queries/tienda/look.ts', 'lib/queries/tienda/pager.ts', 'components/sections/tienda/CompletaElLook.tsx', 'components/sections/tienda/AgregarTodoLook.tsx']) {
    const src = await fuente(ruta)
    check(!/localStorage|\/api\/orders|\/checkout|CheckoutWizard/.test(src), `${ruta}: no toca carrito a mano, pedidos ni checkout`)
  }
  check((await fuente('components/sections/tienda/AgregarTodoLook.tsx')).includes("import { addProductToCart } from '@/lib/cart'"), '«Agregar todo» usa el addToCart de siempre')

  // Multi-tenant: toda lectura de products filtra por la organización del contexto.
  for (const ruta of ['lib/queries/tienda/look.ts', 'lib/queries/tienda/pager.ts']) {
    const src = await fuente(ruta)
    const lecturas = src.split(".from('products')").length - 1
    const conOrg = src.split(".eq('organization_id', organizationId)").length - 1
    check(lecturas > 0 && conOrg >= lecturas, `${ruta}: cada lectura de products filtra por organization_id (${conOrg}/${lecturas})`)
    check(src.includes('cacheCatalog(') && src.includes('cache('), `${ruta}: caché por organización y por petición`)
  }
}

// ─── 4b. Salto hasta la barra y ficha técnica (arreglo 2026-11-25) ──────────────────────────────
// El dueño: «clic en Envío: la pestaña se marca pero el contenido no cambia». En Panorama
// «Resumen» y «Envío» van encima de las pestañas; el salto del navegador subía poco o nada.
{
  const base = { scrollY: 1000, alturaEncabezado: 146, alturaPestanas: 45 }
  // Destino encima de las pestañas (Envío): queda bajo el encabezado, sin restar las pestañas.
  igual(anclas.destinoSaltoAncla({ ...base, topDestino: -209, pestanasEncima: false }), 1000 - 209 - 146 - 16, 'salto a un bloque encima de las pestañas')
  // Destino después de las pestañas (Características): también bajo las pestañas pegadas.
  igual(anclas.destinoSaltoAncla({ ...base, topDestino: 462, pestanasEncima: true }), 1000 + 462 - 146 - 45 - 16, 'salto a un bloque debajo de las pestañas fijas')
  igual(anclas.destinoSaltoAncla({ ...base, scrollY: 0, topDestino: 100, pestanasEncima: true }), 0, 'el salto nunca es negativo')
  igual(anclas.destinoSaltoAncla({ ...base, topDestino: Number.NaN, pestanasEncima: false }), 0, 'medida rota: arriba del todo, no NaN')
  igual(anclas.destinoSaltoAncla({ ...base, topDestino: 300.4, pestanasEncima: false }), Math.round(1000 + 300.4 - 146 - 16), 'salto en píxeles enteros')

  // Desde el 2026-11-25 las pestañas son de verdad (Figma 3255-99475): qué pestañas aparecen,
  // la primera abierta, #… → pestaña, teclado y sin JavaScript apiladas, en verify-pestanas-ficha.

  // Ficha técnica icon_grid: sin celdas vacías ni textos montados (mismo estilo).
  const specsSrc = await fuente('components/sections/product-detail/ProductSpecsVariantes.tsx')
  const iconos = specsSrc.slice(specsSrc.indexOf('export function ProductSpecsIconos'), specsSrc.indexOf('ProductSpecsIconos.CONTENT_KEYS'))
  check(iconos.length > 0, 'ProductSpecsIconos no se encontró')
  check(!/grid-cols-\d|sm:grid-cols/.test(iconos), 'ficha técnica: sin columnas fijas (dejaban la 4.ª celda vacía)')
  check(iconos.includes('flex flex-wrap') && iconos.includes('flex: `1 1 ${ANCHO_MIN_CELDA}`'), 'ficha técnica: celdas que llenan cada fila')
  check(/className="flex min-w-0 items-start/.test(iconos) && iconos.includes('flex min-w-0 flex-1 flex-col-reverse'), 'ficha técnica: min-w-0 en la celda y en el texto')
  check(iconos.includes('[overflow-wrap:anywhere]') && iconos.includes('tabular-nums'), 'ficha técnica: la referencia larga corta en su celda y con cifras tabulares')
  check(iconos.indexOf('<dt') < iconos.indexOf('<dd'), 'ficha técnica: dt antes que dd')
  check(/export const ANCHO_MIN_CELDA = '9\.5rem'/.test(specsSrc), 'ficha técnica: ancho mínimo de celda declarado')
  // Celdas por fila con 9.5rem (152 px) mínimo: nunca más celdas que datos (sin huecos).
  const porFila = (ancho, n) => Math.max(1, Math.min(n, Math.floor(ancho / 152)))
  igual([porFila(560, 3), porFila(343, 3), porFila(1200, 6), porFila(140, 2)], [3, 2, 6, 1], 'celdas por fila: columna de escritorio, celular, ancho completo, muy angosta')
}

// ─── 5. Esquema ──────────────────────────────────────────────────────────────────────────────
/** Columnas reales (information_schema, MCP 2026-11-07). */
const ESQUEMA = {
  products: ['id', 'uuid', 'name', 'sku', 'is_parent', 'track_stock', 'category_id', 'tag_id', 'status', 'parent_product_id', 'organization_id', 'brand', 'reference', 'length_cm', 'width_cm', 'height_cm', 'weight_kg', 'warranty_months'],
  product_prices: ['id', 'price', 'compare_price', 'effective_to'],
  product_images: ['id', 'storage_path', 'is_primary', 'display_order', 'shared_image_id', 'archivo_disponible'],
  shared_images: ['storage_path'],
  stock_levels: ['branch_id', 'qty_on_hand', 'qty_reserved'],
  product_tag_relations: ['product_id', 'tag_id'],
  product_tags: ['id', 'kind'],
}

/** `id, a ( b, c ( d ) )` → [[tabla, columna]…] con la tabla de cada embed. */
function columnasDeSelect(tabla, select) {
  const salida = []
  let i = 0
  const leer = (t) => {
    let token = ''
    while (i < select.length) {
      const ch = select[i]
      if (ch === '(') {
        i++
        leer(token.trim())
        token = ''
      } else if (ch === ')') {
        i++
        if (token.trim()) salida.push([t, token.trim()])
        return
      } else if (ch === ',') {
        i++
        if (token.trim()) salida.push([t, token.trim()])
        token = ''
      } else {
        token += ch
        i++
      }
    }
    if (token.trim()) salida.push([t, token.trim()])
  }
  leer(tabla)
  return salida
}
function constante(src, nombre) {
  const m = src.match(new RegExp(`export const ${nombre} = (?:\`([^\`]*)\`|'([^']*)')`))
  return m ? (m[1] ?? m[2]).replace(/\s+/g, ' ').trim() : null
}
const look = await fuente('lib/queries/tienda/look.ts')
const pager = await fuente('lib/queries/tienda/pager.ts')
const SELECTS = [
  ['products', 'SELECT_PRODUCTOS_LOOK', constante(look, 'SELECT_PRODUCTOS_LOOK')],
  ['product_tag_relations', 'SELECT_ETIQUETAS_LOOK', constante(look, 'SELECT_ETIQUETAS_LOOK')],
  ['product_tag_relations', 'SELECT_RELACIONES_LOOK', constante(look, 'SELECT_RELACIONES_LOOK')],
  ['products', 'SELECT_VECINOS_FICHA', constante(pager, 'SELECT_VECINOS_FICHA')],
]
for (const [tabla, nombre, select] of SELECTS) {
  check(!!select, `${nombre} no se encontró en el fuente`)
  if (!select) continue
  for (const [t, c] of columnasDeSelect(tabla, select)) {
    check(ESQUEMA[t]?.includes(c), `${nombre}: ${t}.${c} no está en el esquema verificado`)
  }
}
// Filtros que usan las consultas.
for (const col of ['organization_id', 'status', 'parent_product_id', 'category_id', 'tag_id', 'id']) check(ESQUEMA.products.includes(col), `filtro products.${col}`)
check(look.includes(".eq('product_images.archivo_disponible', true)") && ESQUEMA.product_images.includes('archivo_disponible'), 'filtro product_images.archivo_disponible')
// Columnas que lee la ficha técnica.
const specs = await fuente('components/sections/product-detail/ProductSpecsVariantes.tsx')
for (const col of new Set([...specs.matchAll(/product\.([a-z_]+)/g)].map((m) => m[1]))) {
  check(ESQUEMA.products.includes(col), `ficha técnica: products.${col} no está en el esquema verificado`)
}

// Con credenciales: PostgREST ejecuta cada select (como verify-tracking).
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (URL_BASE && KEY) {
  for (const [tabla, nombre, select] of SELECTS) {
    if (!select) continue
    const res = await fetch(`${URL_BASE}/rest/v1/${tabla}?select=${encodeURIComponent(select.replace(/\s+/g, ''))}&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
    check(res.ok, `${nombre}: PostgREST respondió ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  notas.push('selects ejecutados contra la base real')
} else {
  notas.push('sin credenciales: selects comparados con el esquema verificado por MCP (no se ejecutaron)')
}

if (problemas.length > 0) {
  console.error(`✗ verify-ficha-plantilla: ${problemas.length} problema(s) en ${casos} casos`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-ficha-plantilla: ${casos} casos (bloques por defecto = main, ficha legacy igual, reglas puras, inerte por defecto, esquema)`)
for (const n of notas) console.log(`  · ${n}`)
