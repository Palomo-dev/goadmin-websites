/**
 * verify-pestanas-ficha — pestañas reales de la ficha (Figma «Ficha — pestañas reales»,
 * 3255-99475, aprobado el 2026-11-25).
 *
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-pestanas-ficha.mjs
 *
 * Sin dependencias ni base de datos. Comprueba:
 * 1. Qué pestañas aparecen (plan de la ficha y contenido medido), cuál abre primero, #… → pestaña,
 *    teclado, «Reseñas (N)» sin «(0)» y sin JavaScript apiladas (reglas puras de anclasFicha.ts).
 * 2. El contrato del bloque (`product_anchor_nav · tabs`): las claves de siempre se leen igual y
 *    las nuevas valen el diseño aprobado.
 * 3. La línea corta de envío junto al botón, con datos reales (sin datos, no sale).
 * 4. Fuente: una sola pieza de pestañas en la tienda, accesibilidad y que tocar una pestaña no
 *    mueve la página ni cambia la dirección.
 *
 * Las fuentes se leen tolerando CRLF.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fuente = async (ruta) => (await readFile(join(ROOT, ruta), 'utf8')).replace(/\r\n/g, '\n')

let total = 0
const fallos = []
function check(cond, nombre) {
  total += 1
  if (!cond) fallos.push(nombre)
}
function igual(a, b, nombre) {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  check(ok, ok ? nombre : `${nombre}\n      esperado ${JSON.stringify(b)}\n      obtenido ${JSON.stringify(a)}`)
}

// ─── Carga de los módulos puros (sin alias @/) ──────────────────────────────────────────────
const dir = join(ROOT, '.verify-pestanas-ficha-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
async function cargar(ruta, nombre, reemplazos = []) {
  let js = stripTypeScriptTypes(await fuente(ruta), { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  for (const [de, a] of reemplazos) {
    if (!js.includes(de)) throw new Error(`${nombre}: no encontré «${de}»`)
    js = js.replace(de, a)
  }
  await writeFile(join(dir, nombre), js)
  return import(pathToFileURL(join(dir, nombre)).href)
}
let anclas, contrato, ficha
try {
  anclas = await cargar('components/sections/product-detail/anclasFicha.ts', 'anclasFicha.mjs')
  contrato = await cargar('lib/website/v2/contrato/seccionesTienda.ts', 'seccionesTienda.mjs')
  ficha = await cargar('components/sections/product-detail/fichaTienda.ts', 'fichaTienda.mjs', [
    ["from '@/lib/website/v2/contrato/seccionesTienda'", "from './seccionesTienda.mjs'"],
  ])
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ─── 1a. Qué pestañas aparecen: el plan de la ficha ─────────────────────────────────────────
const sec = (id, section_type, content = {}) => ({ id, section_type, content })
// La ficha de la plantilla que usa hoy el bloque (Moderna): envío y beneficios arriba, la barra,
// descripción, características (con su título) y reseñas.
const moderna = [
  sec('g', 'product_gallery'), sec('i', 'product_info'), sec('a', 'product_actions'),
  sec('e', 'product_shipping'), sec('b', 'product_benefits'), sec('n', 'product_anchor_nav'),
  sec('d', 'product_description'), sec('s', 'product_specs', { title: 'Características' }),
  sec('r', 'product_reviews'), sec('x', 'related_products'),
]
{
  const plan = ficha.planPestanasFicha(moderna)
  igual(plan.items.map((p) => p.target), ['product_description', 'product_specs', 'product_shipping', 'product_reviews'], 'Moderna: Descripción, Características, Envío y devoluciones, Reseñas')
  igual(plan.items.map((p) => p.label), ['Descripción', 'Características', 'Envío y devoluciones', 'Reseñas'], 'nombres del diseño aprobado')
  igual(plan.items.map((p) => p.seccion.id), ['d', 's', 'e', 'r'], 'cada pestaña con su bloque')
  check(!plan.items.some((p) => p.target === 'product_info'), '«Resumen» deja de ser pestaña (título, precio y Comprar siguen arriba)')
  check(!plan.items.some((p) => p.target === 'product_benefits'), 'Beneficios se quedan arriba, junto al botón')
}
// Panorama (sin bloque de envío): sin pestaña de envío.
{
  const panorama = [sec('g', 'product_gallery'), sec('i', 'product_info'), sec('n', 'product_anchor_nav'), sec('s', 'product_specs'), sec('a', 'product_actions'), sec('b', 'product_benefits'), sec('d', 'product_description'), sec('r', 'product_reviews')]
  igual(ficha.planPestanasFicha(panorama).items.map((p) => p.target), ['product_description', 'product_specs', 'product_reviews'], 'Panorama: sin bloque de envío, sin pestaña de envío')
}
// Reseñas apagadas (bloque oculto = fuera de la lista de visibles): la pestaña no aparece.
igual(ficha.planPestanasFicha(moderna.filter((s) => s.section_type !== 'product_reviews')).items.map((p) => p.target), ['product_description', 'product_specs', 'product_shipping'], 'reseñas apagadas: sin pestaña «Reseñas»')
// Sin bloque de pestañas: la ficha de siempre.
igual(ficha.planPestanasFicha(moderna.filter((s) => s.section_type !== 'product_anchor_nav')), null, 'sin bloque de pestañas: ninguna pestaña')
// Pestañas configuradas en el editor: orden, nombres y cuáles (las claves de siempre).
{
  const propias = { items: [{ label: 'Opiniones', target: 'product_reviews' }, { label: 'Detalle', target: 'product_description' }, { label: 'Resumen', target: 'product_info' }] }
  const plan = ficha.planPestanasFicha(moderna.map((s) => (s.id === 'n' ? sec('n', 'product_anchor_nav', propias) : s)))
  igual(plan.items.map((p) => [p.label, p.target]), [['Opiniones', 'product_reviews'], ['Detalle', 'product_description']], 'orden y nombres del editor; «Resumen» guardado no se pinta')
  igual(plan.items.map((p) => p.seccion.id), ['r', 'd'], 'los bloques sin pestaña (características, envío) se quedan en su sitio')
}
// Pestañas sin tocar: el título propio del bloque nombra su pestaña.
{
  const conTitulos = moderna.map((s) => (s.id === 'e' ? sec('e', 'product_shipping', { title: 'Despachos' }) : s.id === 'd' ? sec('d', 'product_description', { title_description: 'Sobre la pieza' }) : s))
  igual(ficha.planPestanasFicha(conTitulos).items.map((p) => p.label), ['Sobre la pieza', 'Características', 'Despachos', 'Reseñas'], 'títulos propios de los bloques en sus pestañas')
}
check(ficha.tituloPropioBloque('product_shipping', { title: '   ' }) === null, 'título en blanco = sin título propio')

// ─── 1b. Cuáles se ven, cuál abre, sin JavaScript ───────────────────────────────────────────
const items = [{ id: 'product_description' }, { id: 'product_specs' }, { id: 'product_shipping' }, { id: 'product_reviews' }]
igual(anclas.pestanasConContenido(items, null).map((p) => p.id), items.map((p) => p.id), 'sin medir (servidor): todas')
igual(
  anclas.pestanasConContenido(items, { product_description: true, product_specs: false, product_shipping: true, product_reviews: true }).map((p) => p.id),
  ['product_description', 'product_shipping', 'product_reviews'],
  'características sin datos (bloque de 0 px): sin pestaña',
)
igual(anclas.pestanasConContenido(items, { product_specs: true }).map((p) => p.id), ['product_specs'], 'sin medir = sin contenido')
const sinDescripcion = anclas.pestanasConContenido(items, { product_description: false, product_specs: true, product_shipping: true, product_reviews: true })
igual(anclas.pestanaActivaValida('', sinDescripcion), 'product_specs', 'abre la primera con contenido')
igual(anclas.pestanaActivaValida('product_reviews', sinDescripcion), 'product_reviews', 'la elegida se queda')
igual(anclas.pestanaActivaValida('product_description', sinDescripcion, 'product_shipping'), 'product_shipping', 'la preferida si la elegida no tiene contenido')
igual(anclas.pestanaActivaValida('x', []), '', 'sin pestañas, ninguna')

const modo = (o) => anclas.modoPestanas({ hidratado: true, cantidad: 4, escritorio: true, celular: 'acordeon', ...o })
igual(modo({ hidratado: false }), 'apiladas', 'sin JavaScript: apiladas (nada escondido)')
igual(modo({ hidratado: false, escritorio: false }), 'apiladas', 'sin JavaScript en el celular: apiladas')
igual(modo({}), 'pestanas', 'computador: pestañas')
igual(modo({ escritorio: false }), 'acordeon', 'celular: acordeón (aprobado)')
igual(modo({ escritorio: false, celular: 'pestanas' }), 'pestanas', 'celular con «Pestañas» elegido en el editor')
igual(modo({ cantidad: 1 }), 'apiladas', 'una sola pestaña: sin barra, el bloque con su título')
igual(modo({ cantidad: 1, escritorio: false }), 'apiladas', 'una sola en el celular: sin acordeón')
igual(modo({ estilo: 'acordeon' }), 'acordeon', 'estilo «Acordeón» de la descripción: acordeón también en el computador')

// Acordeón: varias abiertas a la vez.
igual(anclas.alternarAbierta(['product_description'], 'product_reviews', true), ['product_description', 'product_reviews'], 'abrir Reseñas no cierra Descripción')
igual(anclas.alternarAbierta(['product_description', 'product_reviews'], 'product_description', true), ['product_reviews'], 'cerrar una deja las demás')
igual(anclas.alternarAbierta(['product_description'], 'product_reviews', false), ['product_reviews'], 'sin «varias»: una a la vez')
igual(anclas.abrirEnAcordeon(['product_reviews'], 'product_reviews', true), ['product_reviews'], 'abrir una ya abierta no la cierra')

// ─── 1c. #… → pestaña ───────────────────────────────────────────────────────────────────────
const ids = items.map((p) => p.id)
for (const [hash, esperado] of [
  ['#resenas', 'product_reviews'],
  ['#Reseñas', 'product_reviews'],
  ['#rese%C3%B1as', 'product_reviews'],
  ['#opiniones', 'product_reviews'],
  ['#product_reviews', 'product_reviews'],
  ['#product-reviews', 'product_reviews'],
  ['#envio', 'product_shipping'],
  ['#envío-y-devoluciones', 'product_shipping'],
  ['#caracteristicas', 'product_specs'],
  ['#especificaciones', 'product_specs'],
  ['#descripcion', 'product_description'],
  ['product_reviews', 'product_reviews'],
]) igual(anclas.pestanaDeHash(hash, ids), esperado, `${hash} → ${esperado}`)
igual(anclas.pestanaDeHash('#preguntas', ids), null, '#preguntas sin pestaña de preguntas: nada')
igual(anclas.pestanaDeHash('#resenas', ['product_description']), null, '#resenas con reseñas apagadas: nada')
igual(anclas.pestanaDeHash('', ids), null, 'sin hash: nada')
igual(anclas.pestanaDeHash('#%E0%A4%A', ids), null, 'hash mal codificado: nada (sin error)')
igual(anclas.pestanaDeHash('#envio', ['descripcion', 'envio']), 'envio', 'partes de la descripción también')
igual(ids.map(anclas.idDomPestana), ['descripcion', 'caracteristicas', 'envio', 'resenas'], 'id de cada bloque en la página (destino de #… sin JavaScript)')
check(new Set(ids.map(anclas.idDomPestana)).size === ids.length, 'ids de bloque sin repetir')

// ─── 1d. Teclado y «Reseñas (N)» ────────────────────────────────────────────────────────────
igual(anclas.siguientePorTecla('ArrowRight', 'product_specs', ids), 'product_shipping', '→ siguiente')
igual(anclas.siguientePorTecla('ArrowRight', 'product_reviews', ids), 'product_description', '→ en la última vuelve a la primera')
igual(anclas.siguientePorTecla('ArrowLeft', 'product_description', ids), 'product_reviews', '← en la primera va a la última')
igual(anclas.siguientePorTecla('Home', 'product_shipping', ids), 'product_description', 'Inicio: la primera')
igual(anclas.siguientePorTecla('End', 'product_description', ids), 'product_reviews', 'Fin: la última')
igual(anclas.siguientePorTecla('Tab', 'product_description', ids), null, 'Tab: lo del navegador (entra al panel)')
igual(anclas.siguientePorTecla('ArrowRight', 'x', []), null, 'sin pestañas: nada')
igual(anclas.etiquetaConConteo('Reseñas', 12), 'Reseñas (12)', '«Reseñas (12)»')
igual(anclas.etiquetaConConteo('Reseñas', 1250), 'Reseñas (1.250)', 'miles con punto')
igual(anclas.etiquetaConConteo('Reseñas', 0), 'Reseñas', 'sin reseñas: «Reseñas» sin «(0)»')
igual(anclas.etiquetaConConteo('Opiniones', null), 'Opiniones', 'sin cuenta: el nombre tal cual')

// Bajar hasta la barra (estrellas, «Ver detalles», #…): bajo el encabezado fijo.
igual(anclas.destinoSaltoAncla({ topDestino: 900, scrollY: 0, alturaEncabezado: 72, alturaPestanas: 0, pestanasEncima: false }), 900 - 72 - 16, 'la barra queda justo bajo el encabezado')

// ─── 2. Contrato del bloque ─────────────────────────────────────────────────────────────────
{
  const def = contrato.normalizarPestanasAncla(null)
  igual(def.items, [
    { label: 'Descripción', target: 'product_description' },
    { label: 'Características', target: 'product_specs' },
    { label: 'Envío y devoluciones', target: 'product_shipping' },
    { label: 'Reseñas', target: 'product_reviews' },
  ], 'por defecto: las cuatro del diseño aprobado')
  check(def.sticky === false, 'por defecto la barra no es fija')
  check(def.celular === 'acordeon', 'por defecto, acordeón en el celular')
  check(contrato.normalizarPestanasAncla({ sticky: true }).sticky === true, 'un `sticky: true` guardado se respeta')
  check(contrato.normalizarPestanasAncla({ mobile_mode: 'pestanas' }).celular === 'pestanas', 'mobile_mode: pestanas')
  check(contrato.normalizarPestanasAncla({ mobile_mode: 'otra' }).celular === 'acordeon', 'mobile_mode desconocido: acordeón')
  igual(contrato.normalizarPestanasAncla({ items: [{ label: 'Resumen', target: 'product_info' }] }).items, [{ label: 'Resumen', target: 'product_info' }], 'las pestañas guardadas se leen igual que antes')
  igual(contrato.CLAVES_SECCION_TIENDA['product_anchor_nav.tabs'], ['items', 'sticky', 'mobile_mode'], 'claves del bloque')
  for (const d of contrato.DESTINOS_PESTANA_FICHA) check(contrato.DESTINOS_ANCLA.includes(d), `${d} también es destino de siempre`)
  check(!contrato.esDestinoPestanaFicha('product_info') && !contrato.esDestinoPestanaFicha('product_benefits') && contrato.esDestinoPestanaFicha('product_reviews'), 'solo los bloques con contenido de panel son pestaña')
}

// ─── 3. Línea corta de envío ────────────────────────────────────────────────────────────────
{
  const r = (o) => anclas.resumenEnvioFicha({ envioActivo: true, umbralSitio: null, zonas: [], ...o })
  igual(r({ umbralSitio: '100000.00' }), { envioGratis: 'Envío gratis desde $ 100.000', llega: null, umbral: 100000 }, 'umbral del sitio (numeric de Postgres llega como texto)')
  igual(r({}), { envioGratis: null, llega: null, umbral: null }, 'sin datos: no sale nada')
  igual(r({ umbralSitio: 100000, envioActivo: false }).envioGratis, null, 'envío apagado: sin línea')
  const zonas = [
    { min_minutos: 2 * 1440, max_minutos: 4 * 1440, envio_gratis_desde: 150000 },
    { min_minutos: 3 * 1440, max_minutos: 8 * 1440, envio_gratis_desde: 200000 },
  ]
  igual(r({ umbralSitio: 100000, zonas }), { envioGratis: 'Envío gratis desde $ 200.000', llega: 'Llega en 2 a 8 días', umbral: 200000 }, 'con zonas: la más alta (cierta en cualquier ciudad) y del menor al mayor plazo')
  igual(r({ umbralSitio: 100000, zonas: [zonas[0], { ...zonas[1], envio_gratis_desde: null }] }).envioGratis, null, 'una zona sin envío gratis: no se promete')
  igual(r({ zonas: [{ min_minutos: 45, max_minutos: 60, envio_gratis_desde: null }] }).llega, 'Llega en 45 a 60 min', 'domicilio en minutos')
  igual(r({ zonas: [{ min_minutos: null, max_minutos: 1440, envio_gratis_desde: null }] }).llega, 'Llega en hasta 1 día', 'solo «hasta»')
  igual(anclas.textoPlazo(null, null), null, 'sin promesa: nada')
}

// ─── 4. Fuente ──────────────────────────────────────────────────────────────────────────────
{
  const pieza = await fuente('components/sections/product-detail/PestanasFicha.tsx')
  check(pieza.includes('role="tablist"') && pieza.includes('aria-label={etiqueta}'), 'barra: tablist con nombre')
  check(pieza.includes('role="tab"') && pieza.includes('aria-selected={sel}') && pieza.includes('aria-controls={`${uid}-panel-${p.id}`}'), 'pestaña: tab con aria-selected y aria-controls')
  check(pieza.includes('tabIndex={sel ? 0 : -1}'), 'Tab entra a la pestaña activa (las demás -1)')
  check(pieza.includes("role={modo === 'pestanas' ? 'tabpanel'") && pieza.includes("tabIndex={modo === 'pestanas' ? 0 : undefined}"), 'panel: tabpanel con tabindex 0')
  check(pieza.includes('aria-expanded={abiertaAqui}'), 'celular: cada título es un botón con aria-expanded')
  check(pieza.includes('focus-visible:outline-2'), 'foco visible solo con teclado (focus-visible)')
  check(pieza.includes("'(prefers-reduced-motion: reduce)'") && pieza.includes("behavior: sinMovimiento() ? 'auto' : 'smooth'"), 'bajar respeta prefers-reduced-motion')
  check(pieza.includes('const [hidratado, setHidratado] = useState(false)'), 'sin JavaScript (antes de hidratar): apiladas')
  check(pieza.includes('onClick={() => setActiva(p.id)}'), 'tocar una pestaña solo cambia la activa')
  check(!/history\.(push|replace)State|location\.hash\s*=/.test(pieza), 'tocar una pestaña no cambia la dirección')
  check((pieza.match(/window\.scrollTo\(/g) ?? []).length === 1 && pieza.includes('const abrirPedida = useCallback('), 'la página solo baja cuando se pide (#…, estrellas, «Ver detalles»)')
  check(pieza.includes('hidden={panelOculto}') && !pieza.includes('{sel && p.contenido}'), 'los paneles no se desmontan (las reseñas no se vuelven a pedir)')

  // Una sola forma de hacer pestañas en la tienda.
  const dirFicha = join(ROOT, 'components/sections/product-detail')
  const conTablist = []
  for (const nombre of readdirSync(dirFicha)) {
    if (!/\.tsx?$/.test(nombre)) continue
    const src = await fuente(`components/sections/product-detail/${nombre}`)
    if (src.includes('role="tablist"')) conTablist.push(nombre)
  }
  igual(conTablist, ['PestanasFicha.tsx'], 'una sola pieza de pestañas en la ficha')
  const nav = await fuente('components/sections/product-detail/NavAnclas.tsx')
  check(nav.includes('<PestanasFicha') && nav.includes('escuchar') && nav.includes('medir'), 'el bloque «Pestañas de la ficha» pinta la pieza única')
  const desc = await fuente('components/sections/product-detail/ProductDescription.tsx')
  check(desc.includes('<PestanasFicha') && !desc.includes('function PestanasOAcordeon'), 'el estilo «Pestañas» de la descripción pinta la pieza única')
  check(desc.includes("partes: enTabla ? ['descripcion', 'especificaciones'] : ['descripcion']") && desc.includes('data-descripcion="pestana-tabla"'), 'descripción en su pestaña: solo el texto (las partes las da el bloque de pestañas); «Ficha en tabla» aplica, «Pestañas» y «Acordeón» no')

  const renderer = await fuente('components/sections/product-detail/ProductDetailRenderer.tsx')
  check(renderer.includes("renderSection(section, { envioFicha: 'resumen' })"), 'envío con pestaña: arriba la línea corta')
  check(renderer.includes('contenido: renderSection(i.seccion, { enPestanaFicha: true })'), 'cada bloque con pestaña, en su panel')
  check(renderer.includes('{bloquePestanas}') && renderer.indexOf('{bloquePestanas}') > renderer.indexOf('{layoutGrid}'), 'la barra va debajo de las dos columnas')
  check(renderer.includes('const visibles = envioEnPestana ? crudas : sinEnvioRepetidoDeFabrica('), 'sin pestaña de envío, la regla de «todo doble» de siempre')

  const envio = await fuente('components/sections/product-detail/ProductShipping.tsx')
  check(envio.includes("if (partes.length === 0) return null"), 'línea corta: sin datos, no sale')
  check(envio.includes('href="#envio"') && envio.includes("pedirPestanaFicha('product_shipping')"), '«Ver detalles» abre la pestaña (sin JavaScript, enlace #envio)')
  check(envio.includes('{mensaje && ('), 'el mensaje propio de envío va en la pestaña')
  const estrellas = await fuente('components/site/reviews/ReviewSummaryBadge.tsx')
  check(estrellas.includes("if (pedirPestanaFicha('product_reviews')) return") && estrellas.includes("document.getElementById('product-reviews')"), 'estrellas: abren «Reseñas»; sin pestañas, lo de siempre')
  const resenas = await fuente('components/sections/product-detail/ProductReviewsSection.tsx')
  check(resenas.includes("boton: 'Escribir la primera reseña'") && resenas.includes('textoPropio(content?.empty_state_cta) ?? VACIO_EN_PESTANA.boton'), 'reseñas vacías en la pestaña: «Escribir la primera reseña» (el texto propio manda)')
}

if (fallos.length > 0) {
  console.error(`✗ verify-pestanas-ficha: ${fallos.length} de ${total} fallaron`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-pestanas-ficha: ${total} comprobaciones (qué pestañas aparecen, primera abierta, #… → pestaña, teclado, sin JavaScript apiladas, contrato, envío, fuente)`)
