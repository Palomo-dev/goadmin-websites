/**
 * verify-cabecera-tienda.mjs — cabecera de la tienda: íconos, selector de moneda y cajón del
 * carrito (Figma «16 Sitio web» 2747:57859, aprobado 2026-11-22).
 *
 *   npm run verify:cabecera-tienda
 *
 * Qué comprueba:
 * 1. Sin `header_iconos` / `header_moneda` / `header_carrito` todo vale lo de hoy (la tienda sigue
 *    por su camino viejo) y las claves viejas dan el estilo («Círculo» / «Solo ícono»).
 * 2. Botón del carrito: documento → fila legacy (`cart_button_mode`/`_texts`) → textos de hoy;
 *    modos fijo / al abrir; `{monto}`; monedas visibles y moneda al entrar.
 * 3. En el fuente: el cajón elige el texto al abrirse, ordena los botones en columna con espacio,
 *    oculta el chat mientras está abierto y /api/currency sin parámetros nuevos responde igual.
 */
import { readFileSync } from 'node:fs'
import {
  TEXTOS_BOTON_CARRITO_HOY,
  contadorCarrito,
  estiloIconosEfectivo,
  mensajeEnvioGratis,
  monedaInicial,
  monedasVisibles,
  opcionesCarrito,
  opcionesIconos,
  opcionesMoneda,
  segmentoMonedas,
  textoBotonCarrito,
} from '../lib/website/v2/cabeceraTienda.ts'
import { OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1. Sin configuración: lo de hoy.
for (const a of [null, {}, { header_iconos: null, header_moneda: null, header_carrito: null }]) {
  check(opcionesIconos(a).configurado === false, 'sin header_iconos no hay íconos nuevos')
  check(opcionesMoneda(a).configurado === false && opcionesMoneda(a).estilo === null, 'sin header_moneda, el selector de hoy')
  check(opcionesMoneda(a).movil === 'hoja', 'celular: la hoja de hoy')
  const c = opcionesCarrito(a)
  check(c.configurado === false, 'sin header_carrito no hay cajón nuevo')
  check(igual(c.boton.textos, TEXTOS_BOTON_CARRITO_HOY) && c.boton.modo === 'al_abrir', 'botón de hoy: dinámico con los 4 textos')
  check(c.titulo === 'Tu Carrito' && c.seguirComprando === 'Continuar Comprando', 'textos del cajón de hoy')
  check(c.enlace.texto === 'Ver carrito completo' && c.enlace.estilo === 'borde' && c.enlace.mostrar, '«Ver carrito completo» con borde, como hoy')
}
check(estiloIconosEfectivo({ header_icons_circle: true }) === 'circulo', 'header_icons_circle → Círculo')
check(estiloIconosEfectivo({ header_icons_box: { shape: 'circle' } }) === 'circulo', 'caja en círculo → Círculo')
check(estiloIconosEfectivo({}) === 'icono', 'sin nada → Solo ícono')
check(opcionesIconos({ header_icons_circle: true, header_icons_weight: 'relleno' }).configurado === false, 'las claves viejas no activan el camino nuevo')
for (const clave of ['header_iconos', 'header_moneda', 'header_carrito']) {
  check(OPCIONES_SHELL[clave]?.porDefecto === null && OPCIONES_SHELL[clave]?.nueva === true, `${clave} en el contrato, sin columna`)
}

// 2. Lógica.
check(opcionesCarrito({ cart_button_mode: 'fixed', cart_button_texts: ['Pagar'] }).boton.modo === 'fijo', 'fila legacy fixed → fijo')
check(textoBotonCarrito(opcionesCarrito({ cart_button_mode: 'fixed', cart_button_texts: ['Pagar', 'Otro'] }).boton, () => 0.9) === 'Pagar', 'fixed de hoy: el primer texto')
check(textoBotonCarrito({ modo: 'fijo', textos: ['A'], texto: 'Finalizar compra' }) === 'Finalizar compra', 'fijo con texto propio')
check(textoBotonCarrito({ modo: 'al_abrir', textos: ['A', 'B'] }, () => 0.7) === 'B', 'al abrir: uno de la lista')
check(
  opcionesCarrito({ cart_button_mode: 'fixed', header_carrito: { boton: { modo: 'al_abrir', textos: ['X'] } } }).boton.modo === 'al_abrir',
  'el documento manda sobre la fila legacy',
)
check(mensajeEnvioGratis('¡Te faltan {monto} para envío gratis!', '$ 45.000') === '¡Te faltan $ 45.000 para envío gratis!', '{monto} se reemplaza')
check(igual(contadorCarrito(120, 'numero'), { tipo: 'numero', texto: '99+' }), 'contador 99+')
check(contadorCarrito(2, 'oculto') === null, 'contador oculto')
const disp = [{ code: 'USD' }, { code: 'COP' }, { code: 'EUR' }]
check(igual(monedasVisibles(disp, ['EUR'], 'COP').map((m) => m.code), ['COP', 'EUR']), 'monedas visibles con la base primero')
check(monedaInicial('USD', 'COP', { alEntrar: 'pais', visibles: ['EUR'] }) === 'COP', 'país sin moneda visible → base')
check(monedaInicial('USD', 'COP', { alEntrar: 'base', visibles: null }) === 'COP', 'siempre la base')
check(segmentoMonedas(monedasVisibles(disp, null, 'COP'), 'COP').resto.length === 1, 'segmento: +1')

// 3. Fuente.
const cajon = readFileSync(new URL('../components/site/CartDrawer.tsx', import.meta.url), 'utf8')
// Modos del botón (Figma 2773:62797 – 2775:64409): el texto lo elige TextoBotonCarrito con el
// estado del cajón; «al abrir» elige durante el render al pasar a abierto (sin cuadro viejo).
const textoBoton = readFileSync(new URL('../components/site/TextoBotonCarrito.tsx', import.meta.url), 'utf8')
check(cajon.includes('<TextoBotonCarrito boton={opciones.boton} abierto={isOpen}') && textoBoton.includes('eleccion.abierto !== abierto') && textoBoton.includes('indiceAlAbrir('), 'el cajón elige el texto del botón cada vez que se abre')
check(cajon.includes('flex flex-col gap-2.5'), 'botones del cajón en columna con espacio entre ellos')
check(!/<Link[^>]*>\s*<Button/.test(cajon), 'ningún <Button> dentro de un <Link> en línea (quedaban pegados)')
check(cajon.includes("setAttribute('data-carrito-abierto'"), 'el cajón marca el documento mientras está abierto')
check(!cajon.includes('cartButtonConfig'), 'el cajón ya no recibe la configuración vieja suelta')
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
check(/html\[data-carrito-abierto\] \[data-gochat-widget\][^{]*\{\s*display: none !important;/.test(css), 'el chat se oculta con el cajón abierto')
const api = readFileSync(new URL('../app/api/currency/route.ts', import.meta.url), 'utf8')
check(api.includes("countryIso3 && !inicialBase"), '/api/currency: inicial=base no detecta el país')
check(api.includes('monedaPermitida(code, baseCurrency, listaVisible)'), '/api/currency filtra las monedas visibles')
const proveedor = readFileSync(new URL('../components/site/CurrencyProvider.tsx', import.meta.url), 'utf8')
check(proveedor.includes("const url = consulta ? `/api/currency?${consulta}` : '/api/currency'"), 'sin opciones nuevas la petición es la de siempre')
const vivos = readFileSync(new URL('../components/site/useAjustesVivosPreview.ts', import.meta.url), 'utf8')
check(vivos.includes("'cart_button_mode', 'cart_button_texts'"), 'vista previa en vivo del botón del carrito (fila legacy)')

if (problemas.length) {
  console.error(`✗ verify-cabecera-tienda: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-cabecera-tienda: ${casos} comprobaciones`)
