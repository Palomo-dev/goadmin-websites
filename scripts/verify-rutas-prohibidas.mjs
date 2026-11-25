/**
 * verify-rutas-prohibidas.mjs — guardia de las plantillas de tienda (PLANO §5 W7, riesgos R1 y R6).
 *
 *   npm run verify:rutas-prohibidas
 *   BASE_REF=main npm run verify:rutas-prohibidas     (por defecto origin/main)
 *
 * Falla si la rama toca, respecto a BASE_REF, alguna ruta del dinero o el esquema estricto del
 * documento del sitio. Mira lo commiteado (`git diff --name-only BASE_REF...HEAD`) y además lo que
 * aún no se ha commiteado (`git diff --name-only HEAD` y, desde el 2026-11-23, los archivos nuevos
 * sin seguimiento: antes una ruta nueva dentro de una carpeta prohibida, como
 * app/api/shipping/quote/route.ts, no se veía), para avisar antes del commit.
 *
 * Excepciones: PERMITIDAS_TEMPORALES, archivo por archivo, con motivo y fecha de vencimiento. Al
 * vencer, la guardia vuelve a fallar por esas rutas si siguen sin estar en BASE_REF.
 *
 * Sin dependencias: solo git.
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_REF = process.env.BASE_REF || 'origin/main'

/** Archivos exactos o carpetas (terminan en «/»). */
const PROHIBIDAS = [
  'components/site/CheckoutWizard.tsx',
  'app/api/orders/',
  'app/api/checkout/',
  'app/api/shipping/',
  'app/api/webhooks/',
  'lib/cart.ts',
  'lib/checkout/',
  'lib/website/v2/contrato/documentoSitio.ts',
]

/**
 * Cambios del dinero que SÍ se revisaron, con fecha de vencimiento (inclusive, día de Bogotá).
 *
 * 2026-11-23 — Logística Fase 1 (domicilio propio, Colombia; ERP docs/logistica/FASE1-CIMIENTOS.md,
 * TODO 6). Esta guardia es de las plantillas de tienda (W1–W7): que un trabajo de diseño no toque
 * el dinero. La Fase 1 SÍ tiene que tocarlo, y lo hace para endurecerlo; revisado uno por uno:
 * - app/api/orders/route.ts: el envío lo decide SIEMPRE el servidor (antes se cobraba el
 *   `shipping` del navegador salvo con ORDERS_ENFORCE_SERVER_SHIPPING=true, y aceptaba 0).
 *   Domicilio propio con zonas: `logistica_cotizar_envio` con el subtotal del servidor y la
 *   organización de la sesión del host; fuera de cobertura o bajo el mínimo, 422; tarifa ajena,
 *   409. El `shipping` del navegador solo se registra como desfase.
 * - app/api/orders/[id]/tracking/route.ts: `logistica_rastreo_publico` con service role SOLO con
 *   el token `?t=` válido; sin él, ningún dato del envío. Sin fotos ni firmas de entrega
 *   (`shipment-pod` es privado) y sin teléfono del domiciliario.
 * - app/api/orders/[id]/delivery/route.ts: solo el primer nombre del domiciliario; sin teléfono,
 *   foto de perfil, fotos ni firma de la prueba de entrega; sin token, nada del envío.
 * - app/api/shipping/quote/route.ts (nueva): cotización informativa del checkout; organización del
 *   host, sede validada contra ella, límite por IP y respuesta recortada (`cotizacionPublica`).
 * - components/site/CheckoutWizard.tsx: muestra la cotización por zona y manda el barrio; el
 *   total que pinta es informativo, /api/orders vuelve a cotizar.
 * Vence el 2026-12-07: para entonces la Fase 1 debe estar en origin/main (y la excepción sobra).
 * Comprobado por scripts/verify-zonas-envio.mjs (cobro del servidor, recorte de la cotización,
 * token del rastreo, sin fotos ni teléfono).
 *
 * 2026-11-24 — Consulta del pedido rediseñada (Figma «21 Logística» › 10, aprobada por el dueño):
 * - lib/checkout/metodosPagoSitio.ts (nueva): EXTRACCIÓN tal cual de `getWebsitePaymentMethods` de
 *   app/checkout/page.tsx (commit aparte, sin cambios de comportamiento); la usan el checkout y
 *   «Pagar con otro medio» de la consulta.
 * - app/api/checkout/init/route.ts: endurece; un pedido web cerrado (vencido, cancelado, rechazado
 *   o reembolsado) ya no se cobra (409 PEDIDO_CERRADO), con su `else` de antes para lo demás.
 * Vence el 2026-12-08. Comprobado por scripts/verify-consulta-pedido.mjs.
 *
 * 2026-11-24 — Correo «Recibimos tu pedido» con el texto correcto (decía «llegó al restaurante» en
 * todas las tiendas):
 * - app/api/orders/route.ts: SOLO el bloque del correo, después de crear el pedido. Pasa
 *   `esRestaurante` (ya calculado en `contexto`) y `faltaPagoEnLinea` (`consultarMetodoPasarela`,
 *   misma regla que la consulta del pedido), dentro del `Promise.all` que ya cargaba la marca y la
 *   clave. Sin `if` nuevos; si la consulta falla, `false` y el correo sale como antes. No toca el
 *   pedido, el cobro, el stock ni la respuesta.
 * Vence el 2026-12-08. Comprobado por scripts/verify-recordatorio-pago.mjs.
 *
 * 2026-11-24 — Promociones V2 (Figma «05 POS y ventas» 2998:192939 y «16 Sitio web» 3006:75498,
 * aprobadas por el dueño): precio por volumen y «solo para un grupo de clientes».
 * - app/api/orders/route.ts: DOS cambios, sin tocar el cobro, el stock ni la respuesta.
 *   (1) `evaluateCartPromotions` recibe `sessionCustomerId: authCustomer?.id` (el cliente de la
 *   SESIÓN, ya resuelto por getAuthCustomer en la misma ruta; el invitado buscado por correo NO
 *   cuenta). Sin sesión es null y las promociones con grupo de clientes o usos por cliente no
 *   aplican: el resto se calcula igual que antes. (2) Tras `increment_promotion_usage`, la RPC
 *   `register_promotion_customer_use` (ERP 20261124200000) con su `else` (sin ficha de cliente:
 *   como antes). Un fallo solo se registra en consola.
 *   El cálculo nuevo (escalones) vive fuera de las rutas del dinero: lib/promotions.ts y
 *   lib/promociones/precioVolumen.ts (copia byte a byte del ERP).
 * Vence el 2026-12-09. Comprobado por scripts/verify-precio-volumen.mjs y verify-promo-minimo.mjs.
 *
 * 2026-11-24 — Tienda «Compra más, paga menos» (Figma «16 Sitio web» 3006:75498, aprobado) y envío
 * gratis medido DESPUÉS de los descuentos (decisión del dueño). Lo nuevo vive fuera de las rutas
 * del dinero (lib/shipping/envioGratisDescontado.ts, lib/promociones/escalonesTienda*.ts,
 * components/site/volumen/*, components/site/checkout/PromocionesResumen.tsx); en ellas, solo:
 * - app/api/orders/route.ts: `subtotalEnvioGratis = subtotal − (promociones + cupón)` se pasa a
 *   `resolverEnvio` (ahí el subtotal SOLO decide el envío gratis de la tarifa plana y de las de
 *   Transporte) y a `cotizarDomicilioWeb` (decide solo el envío gratis de la zona; el pedido mínimo
 *   y las reglas siguen con el subtotal normal). Sin `if` nuevos. No toca precios, impuesto,
 *   promociones, cupón, stock ni la respuesta.
 * - app/api/shipping/quote/route.ts: acepta `subtotalEnvioGratis` (número) y lo pasa igual; sin el
 *   campo, `null` y la cotización de antes.
 * - components/site/CheckoutWizard.tsx: (1) extracción: las filas de promociones del resumen pasan
 *   a `DescuentosPorPromocion` (con `agrupar=false` pinta lo mismo que antes); (2) el diseño: el
 *   desglose «Descuentos por promoción», la promoción de cada línea y «Subtotal (precio normal)»;
 *   (3) el envío gratis que se muestra (tarifa plana, /api/shipping/calculate, /api/shipping/quote
 *   y las tarjetas de domicilio) con el subtotal descontado. El mensaje de envío gratis lleva su
 *   `else` con el texto de antes. Sin cambios en el payload de /api/orders ni en el cobro.
 * Vence el 2026-12-09. Comprobado por scripts/verify-escalones-tienda.mjs.
 *
 * 2026-11-24 — Contraentrega con condiciones (Figma «05 POS y ventas» 3014:194407 y «16 Sitio web»
 * 3019:76125, aprobado por el dueño; ERP 20261124230000). La regla vive fuera de las rutas del
 * dinero (lib/contraentrega/*, copia byte a byte del ERP en reglaContraentrega.ts); en ellas, solo:
 * - app/api/orders/route.ts: con `paymentMethod === 'cash'` a domicilio y condiciones en la sede,
 *   el SERVIDOR evalúa la regla con sus montos: no disponible → 422 CONTRAENTREGA_NO_DISPONIBLE;
 *   con anticipo → `advance_*` en el insert (pendiente, vence en 30 min) y `anticipo` en la
 *   respuesta. Cada `if` con su `else` de hoy: sin condiciones (las ~40 tiendas actuales) no cambia
 *   nada. 2026-11-24 (aprobado por el dueño): con anticipo pendiente, el bloque del correo llama
 *   `enviarCorreoAnticipoPendiente` (lib/contraentrega/correoAnticipo.ts: «Falta el anticipo de $ X»,
 *   hora límite y «Pagar anticipo»), con su `else` sin correo como hoy; antes no salía ningún correo
 *   hasta pagar el anticipo. El recordatorio (lib/orders/recordatorioPago.ts) incluye el anticipo
 *   pendiente; el correo de anticipo pagado no cambia. Comprobado por verify-contraentrega y
 *   verify-recordatorio-pago.
 * - app/api/checkout/init/route.ts: fuente nueva `anticipo_pedido` (id + organización del host,
 *   monto de la base, pasarela activa y permitida) que cobra `ANT-<id>` y solo escribe
 *   `advance_gateway` (el pedido sigue en efectivo); un pedido con el anticipo pagado (`partial`)
 *   ya no se cobra completo en línea (409 ANTICIPO_PAGADO).
 * - app/api/webhooks/{wompi_co,bold,mercadopago}/route.ts: un ramal `ANT-` antes de lo demás que
 *   llama lib/contraentrega/anticipoWebhook.ts (Wompi: firma obligatoria e idempotencia en
 *   integration_events; Bold/MP: organización ya verificada) → RPC transaccional e idempotente
 *   `fn_web_order_anticipo_resultado`: pago parcial (`partial`), nunca «pagado» completo.
 * - app/api/orders/[id]/tracking/route.ts: lee `advance_*` y responde `order.anticipo` (o null);
 *   con anticipo, además los medios de la puerta (condiciones de la sede, `anticipo.medios`).
 * - components/site/CheckoutWizard.tsx: la opción «Efectivo» pinta el estado de /api/contraentrega
 *   (components/site/contraentrega/OpcionContraentrega.tsx), manda `anticipoPasarela` y, si la
 *   respuesta trae anticipo, abre la pasarela por el anticipo. Opción apagada: «Cambiar dirección»
 *   (09 F) abre los datos de envío y «Quitar» (09 E) saca del carrito los productos que no aplican
 *   (con `removeItem`, el mismo del carrito). Con anticipo, el resumen y la barra fija muestran «Pagas
 *   hoy / Pagas al recibir» (08 / 10); el cobro no cambia. Sin condiciones: como hoy.
 * Vence el 2026-12-10. Comprobado por scripts/verify-contraentrega.mjs.
 *
 * 2026-11-24 — Barra fija del pago en celular A/B/C (Figma «16 Sitio web» 3059:80757, aprobada por
 * el dueño; por defecto C), resumen del pago versión 1 (3061:82007) y opciones de pago como en
 * contraentrega 08 / 10 / 10c. Solo PINTA; no toca el payload de /api/orders, el cobro ni el flujo
 * de `handleSubmit`. Lo nuevo vive fuera de las rutas del dinero (components/site/checkout/
 * barraPago.ts, resumenPago.ts, BarraPagoMovil.tsx, ResumenPagoPiezas.tsx, TarjetaMetodoPago.tsx);
 * en ella, solo:
 * - components/site/CheckoutWizard.tsx: (1) en celular (`md:hidden`) la barra nueva con el estilo
 *   de `website_settings.checkout_mobile_bar_style` (sin valor: C) y su `else`: en computador
 *   (`hidden md:block`) la barra de siempre, sin cambios; el espaciador usa el alto real de la
 *   barra en celular y el `h-20` de siempre en computador. (2) El botón con contraentrega
 *   disponible SIN anticipo dice «Confirmar pedido» (antes «Pagar $ X» sin cobrar nada en línea);
 *   sin condiciones o con anticipo, el texto de antes. (3) Cada método en una tarjeta con radio a
 *   la izquierda e ícono a la derecha; el ícono elegido en el ERP (`website_icon`) se pinta como
 *   ícono de lucide, no como palabra; el desglose de contraentrega, el motivo y el selector de
 *   pasarela siguen ahí. (4) Resumen: chip de entrega, sellos y «Medios de pago» de los métodos
 *   activos, sin emojis salvo los propios de la tienda. (5) El traspaso del chat (`?cart=`,
 *   `?customer=`) acepta `?metodo=<código>`: se preselecciona solo si está activo en la tienda web
 *   y aplica al pedido (contraentrega no disponible no se fuerza); el cliente lo cambia; sin
 *   parámetro, su `else`: el primer método, como hoy.
 * Vence el 2026-12-10. Comprobado por scripts/verify-barra-pago.mjs (3 estilos × 4 casos).
 *
 * 2026-11-24 — Pagos del pedido: método e intentos (Figma «05 POS y ventas» 3087:201491, aprobado
 * por el dueño; ERP 20261125001000). Lo nuevo vive fuera de las rutas del dinero
 * (lib/payments/intentosPagoReglas.ts, puro; lib/payments/intentosPago.ts, el único que registra) y
 * la regla del rechazo en lib/payments/pagoPedidoWeb.ts (`camposPedidoPorPago`). En ellas, solo:
 * - app/api/checkout/init/route.ts: tras generar la URL, «Enlace de pago creado» para pedido web y
 *   anticipo (`registrarIntentoPago`, nunca lanza), con su `else` sin registro para las demás
 *   fuentes. No toca el cobro, el pedido ni la respuesta.
 * - app/api/webhooks/bold/route.ts y mercadopago/route.ts: pasan `intento` (recortado: nunca la
 *   respuesta completa) a `aplicarPagoPedidoWeb` / `aplicarAnticipoPasarela`, después de la firma o
 *   de la conexión dueña del pago. Sin `if` nuevos.
 * - app/api/webhooks/wompi_co/route.ts: registra el intento después de la verificación de firma
 *   (también PENDING); decisión del dueño: un DECLINED/ERROR ya NO cancela el pedido ni libera el
 *   stock: queda «Pendiente» con el pago rechazado hasta que venza (`camposPedidoPorPago`, la misma
 *   regla que Bold y Mercado Pago), y solo si el pedido sigue «Pendiente», con su `else` de antes
 *   para pagado/pendiente/reembolsado.
 * Vence el 2026-12-11. Comprobado por scripts/verify-intentos-pago.mjs y verify-pasarelas-bold-mp.mjs.
 *
 * 2026-11-24 — «Consultar pedido v2» (Figma «16 Sitio web» 3102:84056, aprobado por el dueño):
 * - app/api/orders/lookup/route.ts: RETIRADO. Buscaba por correo solo y listaba hasta 10 pedidos con
 *   nombre, totales y productos. Ahora responde 410 sin consultar la base; nadie lo llama
 *   (/consultar-pedido usa /api/cuenta/buscar-pedido: número + correo o teléfono). No toca la
 *   creación de pedidos, el cobro ni el stock.
 * Vence el 2026-12-11. Comprobado por scripts/verify-consultar-pedido.mjs.
 */
const PERMITIDAS_TEMPORALES = [
  { ruta: 'app/api/orders/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: envío decidido en el servidor' },
  { ruta: 'app/api/orders/[id]/tracking/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: rastreo público con token' },
  { ruta: 'app/api/orders/[id]/delivery/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: sin teléfono ni fotos' },
  { ruta: 'app/api/shipping/quote/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: cotización del checkout' },
  { ruta: 'components/site/CheckoutWizard.tsx', hasta: '2026-12-07', motivo: 'Logística Fase 1: domicilio por zona' },
  { ruta: 'lib/checkout/metodosPagoSitio.ts', hasta: '2026-12-08', motivo: 'Consulta del pedido: extracción de los medios de pago del checkout' },
  { ruta: 'app/api/checkout/init/route.ts', hasta: '2026-12-08', motivo: 'Consulta del pedido: no se cobra un pedido web cerrado' },
  { ruta: 'app/api/orders/route.ts', hasta: '2026-12-08', motivo: 'Correo «Recibimos tu pedido»: texto por tipo de negocio y pago pendiente' },
  { ruta: 'app/api/orders/route.ts', hasta: '2026-12-09', motivo: 'Promociones V2: cliente de la sesión al motor y usos por cliente' },
  { ruta: 'app/api/orders/route.ts', hasta: '2026-12-09', motivo: 'Envío gratis después de promociones y cupón' },
  { ruta: 'app/api/shipping/quote/route.ts', hasta: '2026-12-09', motivo: 'Envío gratis después de promociones y cupón (cotización informativa)' },
  { ruta: 'components/site/CheckoutWizard.tsx', hasta: '2026-12-09', motivo: 'Tienda Promociones V2: resumen por promoción y envío gratis después de descuentos' },
  { ruta: 'app/api/orders/route.ts', hasta: '2026-12-10', motivo: 'Contraentrega con condiciones: el servidor decide la opción y el anticipo; correo «Falta el anticipo» al crear el pedido' },
  { ruta: 'app/api/checkout/init/route.ts', hasta: '2026-12-10', motivo: 'Contraentrega: cobro del anticipo (ANT-<id>) sin pasar el pedido a pasarela' },
  { ruta: 'app/api/webhooks/wompi_co/route.ts', hasta: '2026-12-10', motivo: 'Contraentrega: anticipo con firma obligatoria, pago parcial' },
  { ruta: 'app/api/webhooks/bold/route.ts', hasta: '2026-12-10', motivo: 'Contraentrega: anticipo de la organización que firmó, pago parcial' },
  { ruta: 'app/api/webhooks/mercadopago/route.ts', hasta: '2026-12-10', motivo: 'Contraentrega: anticipo de la organización dueña del pago, pago parcial' },
  { ruta: 'app/api/orders/[id]/tracking/route.ts', hasta: '2026-12-10', motivo: 'Contraentrega: anticipo en la consulta del pedido' },
  { ruta: 'components/site/CheckoutWizard.tsx', hasta: '2026-12-10', motivo: 'Contraentrega: opción con condiciones y pago del anticipo' },
  { ruta: 'components/site/CheckoutWizard.tsx', hasta: '2026-12-10', motivo: 'Barra del pago en celular A/B/C, «Confirmar pedido» sin anticipo, resumen v1, tarjetas de pago y ?metodo= del chat' },
  { ruta: 'app/api/checkout/init/route.ts', hasta: '2026-12-11', motivo: 'Pagos del pedido: «Enlace de pago creado» en el historial de intentos' },
  { ruta: 'app/api/webhooks/bold/route.ts', hasta: '2026-12-11', motivo: 'Pagos del pedido: intento de Bold al historial (pieza común)' },
  { ruta: 'app/api/webhooks/mercadopago/route.ts', hasta: '2026-12-11', motivo: 'Pagos del pedido: intento de Mercado Pago al historial (pieza común)' },
  { ruta: 'app/api/webhooks/wompi_co/route.ts', hasta: '2026-12-11', motivo: 'Pagos del pedido: intento de Wompi al historial; el rechazo ya no cancela (decisión del dueño)' },
  { ruta: 'app/api/orders/lookup/route.ts', hasta: '2026-12-11', motivo: 'Consultar pedido v2: búsqueda por correo retirada (410)' },
]

/** Día calendario de hoy en Bogotá (YYYY-MM-DD), sin pasar por UTC. */
function hoyBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** La excepción vigente de una ruta en el día `hoy`, o null. */
export function excepcionVigente(ruta, hoy, lista = PERMITIDAS_TEMPORALES) {
  return lista.find((e) => e.ruta === ruta && hoy <= e.hasta) ?? null
}

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' })
}

function archivos(args) {
  return git(args).split('\n').map((l) => l.trim()).filter(Boolean)
}

export function esProhibida(ruta) {
  return PROHIBIDAS.some((p) => (p.endsWith('/') ? ruta.startsWith(p) : ruta === p))
}

try {
  git(['rev-parse', '--verify', '--quiet', `${BASE_REF}^{commit}`])
} catch {
  console.error(`✗ verify-rutas-prohibidas: no existe la referencia «${BASE_REF}» (BASE_REF=<rama> para otra)`)
  process.exit(1)
}

// Autoprueba del comparador: que la guardia no pase por un error de la propia guardia.
const autoprueba = [
  ['app/api/orders/route.ts', true],
  ['app/api/checkout/init/route.ts', true],
  ['app/api/webhooks/wompi_co/route.ts', true],
  ['lib/checkout/total.ts', true],
  ['lib/cart.ts', true],
  ['components/site/CheckoutWizard.tsx', true],
  ['lib/website/v2/contrato/documentoSitio.ts', true],
  ['lib/cartas.ts', false],
  ['app/api/ordersx/route.ts', false],
  ['components/site/CheckoutWizardAyuda.tsx', false],
  ['lib/website/v2/contrato/seccionesTienda.ts', false],
]
const fallosAutoprueba = autoprueba.filter(([r, esperado]) => esProhibida(r) !== esperado)
// Las excepciones: exactas (no la carpeta), y caducan.
const PRUEBA_EXC = [{ ruta: 'app/api/orders/route.ts', hasta: '2026-12-07', motivo: 'prueba' }]
const autopruebaExc = [
  ['app/api/orders/route.ts', '2026-11-23', true],
  ['app/api/orders/route.ts', '2026-12-07', true],
  ['app/api/orders/route.ts', '2026-12-08', false],
  ['app/api/orders/otra/route.ts', '2026-11-23', false],
]
for (const [r, hoy, esperado] of autopruebaExc) {
  if (!!excepcionVigente(r, hoy, PRUEBA_EXC) !== esperado) fallosAutoprueba.push([`${r} @ ${hoy}`])
}
if (fallosAutoprueba.length > 0) {
  console.error(`✗ verify-rutas-prohibidas: el comparador falla en ${fallosAutoprueba.map(([r]) => r).join(', ')}`)
  process.exit(1)
}

const commiteados = archivos(['diff', '--name-only', `${BASE_REF}...HEAD`])
const pendientes = [
  ...archivos(['diff', '--name-only', 'HEAD']),
  ...archivos(['ls-files', '--others', '--exclude-standard']),
]
const hoy = hoyBogota()
const prohibidasTocadas = [...new Set([...commiteados, ...pendientes])].filter(esProhibida).sort()
const permitidas = prohibidasTocadas.filter((r) => excepcionVigente(r, hoy))
const tocadas = prohibidasTocadas.filter((r) => !excepcionVigente(r, hoy))

for (const r of permitidas) {
  const e = excepcionVigente(r, hoy)
  console.log(`! verify-rutas-prohibidas: ${r} permitida hasta el ${e.hasta} (${e.motivo})`)
}
const vencidas = PERMITIDAS_TEMPORALES.filter((e) => hoy > e.hasta && prohibidasTocadas.includes(e.ruta))
for (const e of vencidas) console.error(`  (la excepción de ${e.ruta} venció el ${e.hasta})`)

if (tocadas.length > 0) {
  console.error(`✗ verify-rutas-prohibidas: la rama toca rutas prohibidas respecto a ${BASE_REF}:`)
  for (const r of tocadas) console.error(`  - ${r}${pendientes.includes(r) && !commiteados.includes(r) ? ' (sin commitear)' : ''}`)
  process.exit(1)
}
console.log(`✓ verify-rutas-prohibidas: ${commiteados.length} archivos cambiados respecto a ${BASE_REF} (+${pendientes.length} sin commitear), ninguno en las ${PROHIBIDAS.length} rutas prohibidas${permitidas.length ? ` salvo ${permitidas.length} con excepción vigente` : ''}`)
