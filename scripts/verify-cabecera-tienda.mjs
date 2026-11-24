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
 * 4. Moneda en el celular: «hoja» abre HojaMonedas con portal al body (modal real, con el estilo
 *    del computador en la fila); «lateral» despliega la lista sin max-height ni scroll anidado; los
 *    menús móviles bloquean el scroll de la página y contienen el suyo (overscroll-behavior).
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
  check(c.avisoContraentrega.carrito === false && c.avisoContraentrega.ficha === false, 'aviso de contraentrega apagado (carrito y ficha), como hoy')
}
// Aviso de contraentrega (Figma 3071:82659): un solo dato, dos casillas; lo que no es booleano no cuenta.
{
  const encendido = opcionesCarrito({ header_carrito: { avisoContraentrega: { ficha: true } } })
  check(encendido.avisoContraentrega.ficha === true && encendido.avisoContraentrega.carrito === false, 'aviso: solo la ficha encendida')
  check(encendido.configurado === true, 'aviso: cuenta como configurado')
  const raro = opcionesCarrito({ header_carrito: { avisoContraentrega: { carrito: 'si', ficha: 1 } } })
  check(raro.avisoContraentrega.carrito === false && raro.avisoContraentrega.ficha === false && raro.configurado === false, 'aviso: valores no booleanos = apagado')
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

// 4. Moneda en el celular (queja 2026-11-22: en «Menú lateral» la lista abría un segundo scroll
//    y en «hoja» salía el modal viejo atrapado dentro del panel del menú).
const compartido = readFileSync(new URL('../components/site/header/HeaderShared.tsx', import.meta.url), 'utf8')
const tramo = (desde, hasta) => {
  const i = compartido.indexOf(desde)
  const j = compartido.indexOf(hasta, i + 1)
  return i < 0 || j < 0 ? '' : compartido.slice(i, j)
}
const bloqueMovil = tramo('export function BloqueMonedaMovil', '\ntype MonedaVisible')
const filaHoja = tramo('function FilaMonedaHoja', '\nfunction ListaMonedaMenuMovil')
const lateral = tramo('function ListaMonedaMenuMovil', '\n// Corta en la raíz del portal')
const hoja = tramo('export function HojaMonedas', '\n/** «En la barra»')
const barra = tramo('function MonedaBarraMovil', '\n// Sección de auth para drawers móviles')
check(!compartido.includes('MobileCurrencyChips'), 'hoja: el modal viejo (MobileCurrencyChips, «COP — Colombia» sin banderas) ya no existe')
check(/\) : \(\s*<FilaMonedaHoja /.test(bloqueMovil), 'hoja (por defecto): el menú pinta FilaMonedaHoja')
check(filaHoja.includes('<HojaMonedas ') && filaHoja.includes('refRetorno={refFila}'), 'hoja: la fila abre HojaMonedas y le pasa a dónde devolver el foco')
check(filaHoja.includes("estilo === 'bandera'") && filaHoja.includes('<BanderaMoneda codigo={currency} />') && filaHoja.includes("estilo === 'simbolo'") && filaHoja.includes("estilo === 'icono'") && filaHoja.includes("estilo === 'segmento'"), 'hoja: la fila muestra la moneda con el estilo del computador (bandera, símbolo, ícono, código)')
check(/createPortal\([\s\S]*document\.body,?\s*\)/.test(hoja), 'hoja: HojaMonedas va con createPortal(…, document.body)')
check(hoja.includes('<DialogoMoneda.Root') && hoja.includes('<DialogoMoneda.Content') && hoja.includes('<DialogoMoneda.Title'), 'hoja: es un diálogo (Radix) que bloquea el scroll de fondo, cierra con Escape y se apila sobre vaul')
check(hoja.includes('onCloseAutoFocus') && hoja.includes('refRetorno.current.focus('), 'hoja: devuelve el foco al cerrar')
check(hoja.includes('zIndex: 2147483647') && hoja.includes("setAttribute('data-moneda-abierta'"), 'hoja: por encima del menú, la barra inferior y el chat')
check(hoja.includes('onPointerMove={cortarPropagacion}'), 'hoja: deslizar la lista no arrastra el menú inferior que la contiene')
check(hoja.includes('data-superficie-propia=""'), 'hoja: conserva data-superficie-propia (colores)')
check(/html\[data-moneda-abierta\] \[data-gochat-widget\][^{]*\{\s*display: none !important;/.test(css), 'hoja: el chat se oculta mientras está abierta')
check(barra.includes('<HojaMonedas ') && barra.includes('refRetorno={refPildora}'), 'en la barra: la píldora abre la misma hoja (con portal)')
check(lateral.length > 0 && !/max-h-|overflow-(y-)?(auto|scroll|hidden)/.test(lateral), 'lateral: la lista desplegada no lleva max-height ni overflow propio')
check(lateral.includes("scrollIntoView({ block: 'nearest' })"), 'lateral: al desplegar, la lista se trae a la vista entera')
check(lateral.includes('compacta'), 'lateral: filas compactas (36 px, una línea)')
const selector = readFileSync(new URL('../components/site/CurrencySelector.tsx', import.meta.url), 'utf8')
check(selector.includes("compacta ? 'h-9' : 'h-10'"), 'ListaMonedas: «compacta» baja la fila de 40 a 36 px')
const menus = {
  'mobile/MobileDrawer.tsx': 'useBloqueoScrollFondo(open)',
  'mobile/MobileFullscreen.tsx': 'useBloqueoScrollFondo(open)',
  'mobile/MobileTabs.tsx': 'useBloqueoScrollFondo(true)',
  'mobile/MobileBottomSheet.tsx': '<Drawer.Root open={open}',
  'mobile/HeaderMovilConfigurable.tsx': '<MobileMenuShell ',
  'HeaderMinimal.tsx': "document.body.style.overflow = 'hidden'",
}
for (const [archivo, bloqueo] of Object.entries(menus)) {
  const f = readFileSync(new URL(`../components/site/header/${archivo}`, import.meta.url), 'utf8')
  check(f.includes(bloqueo), `${archivo}: bloquea el scroll de la página mientras el menú está abierto`)
  check(/overflow-y-auto overscroll-contain[^"`]*["`][^>]*data-scroll-menu=""/.test(f), `${archivo}: el scroll del menú lleva overscroll-behavior: contain`)
}
const shell = readFileSync(new URL('../components/site/header/mobile/MobileMenuShell.tsx', import.meta.url), 'utf8')
check(shell.includes("document.body.style.overflow = 'hidden'"), 'MobileMenuShell bloquea el scroll del body')
for (const archivo of ['mobile/MobileDrawer.tsx', 'mobile/HeaderMovilConfigurable.tsx', 'HeaderMinimal.tsx']) {
  const f = readFileSync(new URL(`../components/site/header/${archivo}`, import.meta.url), 'utf8')
  check(!/<nav className="[^"]*overflow-y-auto/.test(f), `${archivo}: la navegación no tiene scroll propio (uno solo para todo el menú)`)
}

if (problemas.length) {
  console.error(`✗ verify-cabecera-tienda: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-cabecera-tienda: ${casos} comprobaciones`)
