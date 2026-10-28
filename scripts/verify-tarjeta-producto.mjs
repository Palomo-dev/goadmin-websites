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
  vistaEditorTarjeta,
} from '../lib/website/tarjetaProducto.ts'

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

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
