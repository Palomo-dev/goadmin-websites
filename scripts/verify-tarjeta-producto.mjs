/**
 * verify-tarjeta-producto.mjs — la tarjeta de hoy no cambia si no hay estilo,
 * y sitio + sección se fusionan con el preset.
 *
 *   npm run verify:tarjeta-producto
 */
import { esquemaTema } from '../lib/website/v2/contrato/documentoSitio.ts'
import {
  CLASE_BOTON_HOVER_MOVIL,
  aplicarEstiloTarjeta,
  estiloAlElegirPreset,
  etiquetasDeEstilo,
  guardarCambioTarjeta,
  posicionBotonInterna,
  radioForma,
  resolverTarjetaProducto,
  separacionTarjetas,
  valoresDePreset,
  vendidosEnTarjeta,
  etiquetasPropiasEnTarjeta,
  textoContraste,
  normalizarTarjeta,
  vistaEditorTarjeta,
} from '../lib/website/tarjetaProducto.ts'

import { readFileSync } from 'node:fs'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(resolverTarjetaProducto(null, null) === null, 'sin estilo no hay parche')
check(resolverTarjetaProducto(undefined, {}) === null, 'objeto vacío no hay parche')
check(resolverTarjetaProducto({ card_preset: 'actual' }, null) === null, 'preset actual no cambia el render')
check(aplicarEstiloTarjeta({ card_preset: 'actual', card_radius: 12 })?.card_radius === 12, 'una clave sobre actual sí se aplica')
check(aplicarEstiloTarjeta({ card_preset: 'actual', card_radius: 12 })?.text_align == null, 'actual no rellena el resto')

const minimal = aplicarEstiloTarjeta({ card_preset: 'minimal' })
check(minimal?.card_border_width === 0, 'minimal sin borde')
check(minimal?.card_shadow === 'none', 'minimal sin sombra')
check(minimal?.card_radius === 0, 'minimal sin radio')
check(minimal?.image_ratio === '4:5', 'minimal imagen grande')
check(minimal?.text_align === 'center', 'minimal texto centrado')
check(minimal?.hover_image === 'none', 'minimal sin zoom')
check(minimal?.card_layout !== 'horizontal', 'minimal sigue vertical')

const boxed = aplicarEstiloTarjeta({ card_preset: 'boxed' })
check(boxed?.card_radius === 16, 'caja radio 16')
check(boxed?.card_border_width === 1, 'caja borde fino')
check(boxed?.card_shadow === 'sm', 'caja sombra suave')

const overlay = aplicarEstiloTarjeta({ card_preset: 'overlay' })
check(overlay?.add?.button_position === 'over_image_bottom', 'overlay botón sobre la imagen')
check(overlay?.add?.button_visibility === 'hover', 'overlay botón al pasar el mouse')
check(overlay?.buy?.show === false, 'overlay oculta comprar')
check(posicionBotonInterna(overlay?.add?.button_position) === 'overlay_bottom', 'posición interna del overlay')

const compact = aplicarEstiloTarjeta({ card_preset: 'compact' })
check(compact?.card_layout === 'horizontal', 'compacta es horizontal')

const rich = aplicarEstiloTarjeta({ card_preset: 'rich' })
check(rich?.show_reviews === true, 'completa muestra reseñas')
check(rich?.show_compare_price === true, 'completa muestra el tachado')
check(rich?.add?.button_width === 'full', 'completa botón ancho')
check(etiquetasDeEstilo(rich)?.some((e) => e.type === 'new'), 'completa muestra Nuevo')
check(etiquetasDeEstilo(rich)?.some((e) => e.type === 'free_shipping'), 'completa muestra envío')

const seccion = resolverTarjetaProducto(
  { card_preset: 'boxed' },
  { add: { button_style: 'ghost' } },
)
check(seccion?.card_radius === 16, 'la sección conserva el radio del sitio')
check(seccion?.add?.button_style === 'ghost', 'la sección pisa el botón')
check(seccion?.add?.button_width === 'full', 'el botón del sitio sigue en lo que la sección no toca')

check(separacionTarjetas(null) == null, 'sin gap la rejilla no cambia')
check(separacionTarjetas({ card_gap: 20 })?.gap === '20px', 'el gap se vuelve estilo')
check(CLASE_BOTON_HOVER_MOVIL.includes('max-md:opacity-100'), 'en celular el hover se ve')
check(radioForma('square', false) === 0, 'cuadrado es 0')
check(radioForma('rounded', false) === 8, 'redondo es 8')
check(radioForma('semi', false) === 14, 'semi es 14')
check(radioForma('pill', false) === 9999, 'píldora es 9999')
check(radioForma('circle', true) === 9999, 'círculo solo con ícono')
check(radioForma('circle', false) == null, 'círculo sin ícono no aplica')

const sucio = aplicarEstiloTarjeta({ card_preset: 'boxed', card_bg: 'red;background:url(x)', card_radius: 99, add: { button_style: 'no-existe' } })
check(sucio?.card_bg === '#FFFFFF', 'un color inválido no pisa el del preset')
check(sucio?.card_radius === 16, 'el radio fuera de 0–32 no pisa el del preset')
check(sucio?.add?.button_style === 'solid', 'un estilo de botón desconocido no pisa el del preset')
check(sucio?.card_border_width === 1, 'el preset caja sigue después de limpiar')
check(aplicarEstiloTarjeta({ card_bg: 'red;background:url(x)', card_radius: 99 }) === null, 'solo claves inválidas no cambian la tarjeta')

const guardado = guardarCambioTarjeta(null, 'add.button_style', 'outline')
check(guardado.add?.button_style === 'outline', 'editar un botón no rellena toda la tarjeta')
check(guardado.card_radius == null, 'editar un botón no escribe el radio')
check(JSON.stringify(estiloAlElegirPreset('actual')) === JSON.stringify({ card_preset: 'actual' }), 'elegir actual no escribe el resto')
check(estiloAlElegirPreset('minimal').image_ratio === '4:5', 'elegir minimal rellena las opciones')
check(valoresDePreset('overlay').add?.button_visibility === 'hover', 'la vista del preset overlay es hover')

const temaViejo = esquemaTema.safeParse({ colores: {}, tipografia: {} })
check(temaViejo.success, 'un tema sin tarjeta sigue siendo válido')
const temaNuevo = esquemaTema.safeParse({
  colores: {},
  tipografia: {},
  tarjetaProducto: { mode: 'value', value: { card_preset: 'boxed', add: { button_style: 'solid', button_width: 'full' } } },
})
check(temaNuevo.success, 'el tema acepta product_card_style')
check(esquemaTema.safeParse({ colores: {}, tipografia: {}, tarjetaInventada: { mode: 'value', value: 1 } }).success === false, 'el tema sigue estricto')

// «Unidades vendidas»: una sola bandera, sola no activa el estilo de la tarjeta.
check(aplicarEstiloTarjeta({ show_sales_count: true }) === null, 'vendidos sola no cambia el resto de la tarjeta')
check(resolverTarjetaProducto({ show_sales_count: true }, null) === null, 'vendidos del sitio sola: tarjeta de hoy')
check(aplicarEstiloTarjeta({ card_radius: 8, show_sales_count: true })?.show_sales_count === undefined, 'el estilo no lleva la bandera')
check(vendidosEnTarjeta({ show_sales_count: true }, null) === true, 'vendidos desde el sitio')
check(vendidosEnTarjeta(null, { show_sales_count: true }) === true, 'vendidos desde la sección')
check(vendidosEnTarjeta(null, null) === false && vendidosEnTarjeta({ show_sales_count: 'si' }, {}) === false, 'sin bandera (o inválida): como hoy')
check(guardarCambioTarjeta({}, 'show_sales_count', true).show_sales_count === true, 'el editor la guarda')
check(guardarCambioTarjeta({ show_sales_count: true }, 'show_sales_count', undefined).show_sales_count === undefined, 'apagarla borra la clave')
check(vistaEditorTarjeta(null, { show_sales_count: true }).show_sales_count === true, 'el inspector la ve heredada')
check(esquemaTema.safeParse({ colores: {}, tipografia: {}, tarjetaProducto: { mode: 'value', value: { show_sales_count: true } } }).success, 'el contrato acepta show_sales_count')

// Etiquetas propias («Originales»): lista; sola no activa el estilo.
const orig = { labels_custom: [{ id: 'o', label: '  Originales ', bg: '#FACC15' }] }
check(aplicarEstiloTarjeta(orig) === null && resolverTarjetaProducto(orig, null) === null, 'etiquetas propias solas: tarjeta de hoy')
check(normalizarTarjeta(orig).labels_custom[0].label === 'Originales', 'texto recortado')
check(normalizarTarjeta({ labels_custom: [{ label: '' }, 3, { label: 'x'.repeat(40) }] }).labels_custom.length === 1, 'sin texto se descarta')
check(normalizarTarjeta({ labels_custom: Array.from({ length: 9 }, (_, i) => ({ label: 'e' + i })) }).labels_custom.length === 6, 'máximo 6')
check(normalizarTarjeta({ labels_custom: [] }) === null, 'lista vacía = nada')
const pint = etiquetasPropiasEnTarjeta({ show_sales_count: true, ...orig }, null)
check(pint.length === 1 && pint[0].type === 'custom' && pint[0].position === 'top-right' && pint[0].text_color === '#111827', 'pinta Originales arriba a la derecha con contraste oscuro sobre amarillo')
check(textoContraste('#111827') === '#FFFFFF', 'contraste claro sobre oscuro')
check(etiquetasPropiasEnTarjeta(orig, { labels_custom: [{ label: 'B', show: false }] }).length === 0, 'la sección reemplaza la lista del sitio')
check(etiquetasPropiasEnTarjeta(null, null).length === 0, 'sin lista: como hoy')
check(guardarCambioTarjeta({ show_sales_count: true }, 'labels_custom', orig.labels_custom).show_sales_count === true, 'guardar la lista conserva vendidos')
check(guardarCambioTarjeta(orig, 'labels_custom', []).labels_custom === undefined, 'quitar todas borra la clave')
check(vistaEditorTarjeta(null, orig).labels_custom?.length === 1, 'el inspector ve la lista heredada')

check(esquemaTema.safeParse({ colores: {}, tipografia: {}, tarjetaProducto: { mode: 'value', value: { show_sales_count: true, labels_custom: [{ id: 'o', label: 'Originales', bg: '#FACC15' }] } } }).success, 'el contrato acepta labels_custom')

// ── Ícono de «Elegir» (producto padre): choose.icon ?? add.icon; Layers solo de respaldo ──
{
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../components/sections/products/ProductCard.tsx', import.meta.url), 'utf8')
  check(aplicarEstiloTarjeta({ choose: { icon: 'none' } })?.choose?.icon === '', "icon 'none' = sin ícono (solo el texto)")
  check(aplicarEstiloTarjeta({ choose: { icon: '' } })?.choose?.icon === '', "icon '' = sin ícono")
  check(aplicarEstiloTarjeta({ choose: { icon: 'Layers2' } })?.choose?.icon === undefined, 'ícono fuera de la lista: se ignora')
  for (const ic of ['Plus', 'ShoppingBag', 'ShoppingCart', 'Heart', 'Eye', 'ArrowRight', 'Zap', 'Star']) {
    check(aplicarEstiloTarjeta({ add: { icon: ic } })?.add?.icon === ic, `ícono válido ${ic}`)
    check(new RegExp(`ICON_MAP: Record<string, any> = \\{[^}]*\\b${ic}\\b`).test(src), `ICON_MAP pinta ${ic}`)
  }
  check(src.includes('const iconoElegir = estiloTarjeta ? (estiloTarjeta.choose?.icon ?? estiloTarjeta.add?.icon) : undefined'), 'la tarjeta resuelve choose.icon ?? add.icon')
  check((src.match(/iconoElegir=\{iconoElegir\}/g) || []).length === 2, 'los dos lugares que pintan botones pasan iconoElegir')
  check(src.includes("const estiloSinIcono = iconoElegir != null && (iconoVacio(iconoElegir) || iconoElegir === 'none')"), "'' o 'none' = solo texto")
  check(src.includes('const sinIcono = iconoElegir != null ? estiloSinIcono && !btnIconOnly : iconoVacio(button.icon)'), '«Solo ícono» nunca queda vacío')
  check(src.includes('const ChooseIcon = iconoDelEstilo || (iconoElegir == null ? iconoDelBoton : undefined) || ICON_MAP.Layers || Layers'), 'Layers solo de respaldo; sin estilo, como antes')
  // El badge de variantes no cambia: Layers con el número.
  check(/type: 'variants',[\s\S]{0,200}icon: 'Layers',/.test(src) && src.includes("const Icon = badge.icon === 'Layers' ? Layers :"), 'badge de variantes: Layers con el número (sin cambios)')
}

// ── Plantillas de tienda (W2): claves nuevas de tarjeta ─────────────────────────────────────
// 1) Snapshot contra `main`: se pinta la tarjeta (ProductCard) y la rejilla (ProductsGrid) con
//    react-dom/server en dos pasadas — el código de `main` (git show) y el del árbol — con
//    estilos SIN claves nuevas (o con su valor por defecto o uno inválido). El HTML tiene que ser
//    idéntico byte a byte. `TARJETA_REF=<rama>` compara contra otra rama.
// 2) Con las claves nuevas, el marcado esperado de cada una y de las 7 tarjetas de plantilla.
{
  const { execFileSync } = await import('node:child_process')
  const { register } = await import('node:module')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
  const ref = process.env.TARJETA_REF || 'main'
  const pintar = (entorno) => {
    const json = execFileSync(process.execPath, ['--import', './scripts/tarjeta-producto/registrar.mjs', 'scripts/tarjeta-producto/pintar.mjs'], {
      cwd: raiz,
      env: { ...process.env, ...entorno },
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
    return JSON.parse(json)
  }
  let referencia = null
  try {
    execFileSync('git', ['-C', raiz, 'rev-parse', '--verify', '--quiet', ref], { stdio: 'ignore' })
    referencia = pintar({ TARJETA_REF: ref, TARJETA_NUEVOS: '0' })
  } catch {
    check(false, `no se pudo pintar la referencia «${ref}» (¿existe la rama? TARJETA_REF=<rama> para otra)`)
  }
  const rama = pintar({ TARJETA_REF: '', TARJETA_NUEVOS: '1' })
  if (referencia) {
    const ids = Object.keys(referencia)
    check(ids.length >= 300, `snapshot con pocos casos (${ids.length})`)
    const distintos = ids.filter((id) => referencia[id] !== rama[id])
    for (const id of distintos.slice(0, 10)) check(false, `sin claves nuevas el HTML cambió respecto a ${ref}: ${id}`)
    check(distintos.length === 0, `${distintos.length} casos sin claves nuevas difieren de ${ref}`)
    check(ids.every((id) => !String(referencia[id]).startsWith('ERROR')), `la referencia ${ref} no pintó algún caso`)
    console.log(`snapshot: ${ids.length} casos sin claves nuevas idénticos a ${ref}: ${distintos.length === 0 ? 'sí' : 'NO'}`)
  }
  for (const [id, html] of Object.entries(rama)) check(!String(html).startsWith('ERROR'), `no pinta ${id}: ${html}`)

  // Mayúsculas / hover del tema (integrador W7): solo se agrega data-boton-tema a los botones.
  {
    const marcados = Object.keys(rama).filter((id) => id.startsWith('marca:'))
    const otros = marcados.filter((id) => String(rama[id]).replace(/ data-boton-tema=""/g, '') !== rama[id.slice(6)])
    check(marcados.length > 0 && otros.length === 0, `con mayúsculas/hover cambió algo más que data-boton-tema en ${otros.length} casos (${otros.slice(0, 3).join(', ')})`)
    check(marcados.some((id) => String(rama[id]).includes('data-boton-tema')), 'con mayúsculas/hover ningún botón de la tarjeta lleva data-boton-tema')
    check(Object.keys(rama).filter((id) => !id.startsWith('marca:')).every((id) => !String(rama[id]).includes('data-boton-tema')), 'sin las opciones algún botón lleva data-boton-tema')
  }
  const h = (id) => String(rama[id] ?? '')
  const subtitulo = (id) => /data-subtitulo-tarjeta="">([^<]*)</.exec(h(id))?.[1] ?? null
  const cuenta = (texto, aguja) => texto.split(aguja).length - 1
  const esquina = (id, clase) => {
    const i = h(id).indexOf(`<div class="absolute ${clase} z-10 flex flex-col gap-1">`)
    return i < 0 ? '' : h(id).slice(i, h(id).indexOf('</div></div>', i) + 12)
  }

  check(subtitulo('suelta:subtituloMarca·simple') === 'Taller Norte', 'card_subtitle brand pinta la marca')
  check(subtitulo('suelta:subtituloMarca·sinFoto') === null, 'card_subtitle brand sin marca: no hay línea')
  check(subtitulo('suelta:subtituloReferencia·simple') === 'RF-0101', 'card_subtitle reference')
  check(subtitulo('suelta:subtituloReferencia·sinFoto') === null, 'card_subtitle reference vacía: no hay línea')
  check(subtitulo('suelta:subtituloMedidas·simple') === '45 × 50 × 82,5 cm', 'card_subtitle dimensions = textoDimensiones')
  check(subtitulo('suelta:subtituloMedidas·sinFoto') === null, 'card_subtitle dimensions incompletas: no hay línea')
  check(subtitulo('suelta:subtituloDescripcion·simple') === 'Roble macizo aceitado', 'card_subtitle description = primera línea sin HTML')
  check(subtitulo('suelta:subtituloNada·simple') === null, 'card_subtitle none: sin línea')

  check(h('suelta:desde·padre').includes('>Desde<'), 'price_prefix desde en un padre')
  check(!h('suelta:desde·simple').includes('>Desde<'), 'price_prefix desde no va en un producto simple')
  check(h('suelta:desdeArriba·padre').includes('>Desde<'), 'price_prefix con el precio arriba del nombre')
  check(h('suelta:desdeBoton·padre').includes('>Desde<'), 'price_prefix con el precio junto al botón')
  check(h('plantilla:panorama·padre').includes('>Desde<') && !h('plantilla:panorama·padreSinVariantes').includes('>Desde<'), 'Panorama: «Desde» solo en padres con variantes')

  const junto = h('suelta:junto·oferta')
  check(junto.includes('data-precio-junto=""'), 'beside_title pinta la fila nombre + precio')
  check(cuenta(junto, '$ 2.099.000') === 1 && cuenta(junto, '$ 2.990.000') === 1, 'beside_title: el precio (y el anterior) una sola vez')
  check(/data-precio-junto="">[\s\S]*?Sillón Nube[\s\S]*?\$ 2\.099\.000/.test(junto), 'beside_title: precio a la derecha del nombre')

  check(h('suelta:fuente·simple').includes('font-family:var(--font-heading)'), 'title_font heading usa la fuente de títulos')
  check(!h('suelta:junto·simple').includes('font-family:'), 'sin title_font el nombre no lleva style')

  const lineas = h('suelta:lineas·simple')
  check(lineas.includes('border-width:1px') && !lineas.includes('--card-radius:16px') && !lineas.includes('shadow-lg'), 'card_grid_lines: borde 1 px, sin radio ni sombra')

  const corazones = (id) => cuenta(h(id), 'lucide-heart')
  check(corazones('ninguno·simple·botones-legado') === 1, 'hoy: el corazón de card_buttons')
  check(corazones('suelta:favCirculo·simple') === 1 && esquina('suelta:favCirculo·simple', 'top-2 right-2').includes('lucide-heart'), 'wishlist circle: un corazón arriba a la derecha')
  check(esquina('suelta:favCirculo·simple', 'top-2 right-2').includes('background-color:#FFFFFF;color:#111827;border-radius:9999px'), 'wishlist circle: círculo blanco')
  check(corazones('suelta:favGhostIzq·simple') === 1 && esquina('suelta:favGhostIzq·simple', 'top-2 left-2').includes('lucide-heart'), 'wishlist ghost top_left: arriba a la izquierda')
  check(corazones('suelta:favNinguno·simple') === 0, 'wishlist none: quita el corazón de card_buttons')
  check(corazones('plantilla:hogar·simple') === 1 && corazones('plantilla:radiante·simple') === 1, 'Hogar y Radiante: corazón en círculo')

  check(h('suelta:desliza·oferta').includes('translate-x-full transition-transform duration-300 group-hover:translate-x-0') && h('suelta:desliza·oferta').includes('group-hover:-translate-x-full'), 'hover_image_transition slide')
  check(!h('suelta:desliza·simple').includes('translate-x-full'), 'slide sin segunda foto: nada cambia')
  check(h('plantilla:atelier·oferta').includes('opacity-0 transition-opacity duration-300 group-hover:opacity-100'), 'sin transición: el fundido de hoy')

  check(h('suelta:elegir·padre').includes('Elige tu talla') && !h('suelta:elegir·simple').includes('Elige tu talla'), 'choose_label solo en el botón Elegir del padre')
  check(h('plantilla:hogar·padre').includes('Elige una opción'), 'Hogar: «Elige una opción»')
  check(h('suelta:suave·simple').includes('color-mix(in srgb, var(--text-color, #111827) 8%, transparent)'), 'button_style soft: fondo tenue')
  check(h('suelta:suave·padre').includes('color-mix(in srgb, var(--text-color, #111827) 8%, transparent)'), 'soft también en Elegir')
  check(h('plantilla:atelier·simple').includes('data-precio-junto=""') && h('plantilla:atelier·simple').includes('font-family:var(--font-heading)'), 'Atelier: precio junto al nombre en la fuente de títulos')
  check(subtitulo('plantilla:roble·simple') === '45 × 50 × 82,5 cm', 'Roble: medidas bajo el nombre')

  const rejilla = (id) => h(id)
  check(rejilla('rejilla:lineas-sitio').includes('pb-px pr-px [&amp;&gt;*]:-mb-px [&amp;&gt;*]:-mr-px') && rejilla('rejilla:lineas-sitio').includes('gap:0px'), 'card_grid_lines: rejilla sin separación con bordes compartidos')
  check(rejilla('rejilla:lineas-seccion').includes('gap:0px') && !rejilla('rejilla:lineas-seccion').includes('gap:24px'), 'card_grid_lines gana a card_gap')
  check(!rejilla('rejilla:lineas-carrusel').includes('-mr-px'), 'card_grid_lines no toca el carrusel')
  check(rejilla('rejilla:subrayado').includes('data-pestanas="underline"') && rejilla('rejilla:subrayado').includes('background-color:transparent;color:#1F3FD8'), 'tabs_style underline: activa sin fondo, del color primario')
  check(rejilla('rejilla:subrayado-colores').includes('color:#2E2E2A'), 'tabs_style underline respeta el color de la sección')
  check(!rejilla('rejilla:subrayado-barra-nueva').includes('data-pestanas'), 'tabs_style no toca la barra nueva (chip_style manda)')

  // Funciones puras (lib/website/tarjetaPlantillasTienda.ts), por el mismo cargador.
  register('./tarjeta-producto/cargador.mjs', import.meta.url, { data: { root: raiz, ref: null } })
  const t = await import('../lib/website/tarjetaPlantillasTienda.ts')
  check(t.rejillaConLineas(null) === null && t.rejillaConLineas({ card_radius: 2 }) === null, 'sin card_grid_lines: la rejilla de hoy')
  check(t.ajustesTarjetaConLineas(null) === null, 'sin card_grid_lines: la tarjeta de hoy')
  check(t.favoritoTarjeta(null) === undefined && t.favoritoTarjeta({ wishlist_position: 'top_left' }) === undefined, 'sin wishlist_style manda card_buttons')
  check(t.favoritoTarjeta({ wishlist_style: 'none' }) === null, 'wishlist none = sin corazón')
  check(t.subtituloTarjeta(null, {}) === null && t.subtituloTarjeta({ card_subtitle: 'brand' }, { brand: '  ' }) === null, 'subtítulo vacío no se pinta')
  check(t.subtituloTarjeta({ card_subtitle: 'description' }, { description: '\n\n• Cuero curtido\nOtra' }) === 'Cuero curtido', 'primera línea con texto, sin viñeta')
  check(t.prefijoPrecioTarjeta({ price_prefix: 'desde' }, false) === null && t.prefijoPrecioTarjeta({ price_prefix: 'none' }, true) === null, '«Desde» solo en padres y con desde')
  check(t.estiloFuenteTitulo({ title_font: 'body' }) === undefined, 'title_font body = el de hoy')
  check(t.textoElegirTarjeta({ choose_label: 'Elige un acabado' }) === 'Elige un acabado' && t.textoElegirTarjeta(null) === undefined, 'choose_label')
  check(t.pestanasSubrayadas({}, '#000') === null && t.pestanasSubrayadas({ tabs_style: 'chips' }, '#000') === null, 'tabs_style chips/ausente = las de hoy')
  const sub = t.pestanasSubrayadas({ tabs_style: 'underline', filter_active_bg: '#EEE' }, '#123456')
  check(sub?.content.filter_active_bg === '#EEE' && sub?.content.filter_active_text === '#123456', 'underline: conserva los colores de la sección')
  check(JSON.stringify(t.COLUMNAS_SUBTITULO_TARJETA.dimensions) === JSON.stringify(['length_cm', 'width_cm', 'height_cm']), 'columnas de medidas')
  // Las clases de la tarjeta nueva están completas en el fuente (Tailwind no ve clases armadas).
  const fuente = readFileSync(new URL('../lib/website/tarjetaPlantillasTienda.ts', import.meta.url), 'utf8')
  for (const clase of [t.CLASE_SEGUNDA_IMAGEN_DESLIZA, t.CLASE_PRIMERA_IMAGEN_DESLIZA, t.CLASE_REJILLA_LINEAS]) check(fuente.includes(`'${clase}'`), `clase literal en el fuente: ${clase}`)
}

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
