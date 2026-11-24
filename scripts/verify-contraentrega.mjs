/**
 * verify-contraentrega.mjs — la regla pura de «¿se ofrece contraentrega y con qué anticipo?».
 *
 *   npm run verify:contraentrega
 *
 * Prueba `lib/contraentrega/reglaContraentrega.ts` (copia byte a byte del ERP), sus textos y la
 * referencia del anticipo con TODOS los casos de la pantalla 09 del Figma (3019:76125) y, sobre
 * todo, que SIN condiciones el efectivo se comporta exactamente como hoy. Además revisa en el
 * fuente que cada punto del flujo siga conectado (orders, init, webhooks, resultado, consulta).
 * Sin dependencias ni base: node --experimental-strip-types.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CONDICIONES_POR_DEFECTO,
  cobroEnPuerta,
  conCondicionesDeSede,
  condicionesDeSede,
  evaluarContraentrega,
  faltaParaMinimo,
  montoAnticipo,
  normalizarCondiciones,
  productoAplica,
} from '../lib/contraentrega/reglaContraentrega.ts'
import {
  avisoCarritoContraentrega,
  avisoFichaContraentrega,
  codigoConector,
  fraseAnticipoHoy,
  fraseMedios,
  lineaResumenAnticipo,
  lineaSiNoRecibe,
  listaConY,
  textoMotivo,
  descripcionContraentrega,
  textoMedios,
} from '../lib/contraentrega/textosContraentrega.ts'
import { esReferenciaAnticipo, idDeReferenciaAnticipo, referenciaAnticipo } from '../lib/contraentrega/referenciaAnticipo.ts'
import { textosCorreoRecibido, textosCorreoRecordatorioPago } from '../lib/email/textosCorreoPedido.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fallos = []
let pruebas = 0
function igual(nombre, real, esperado) {
  pruebas += 1
  const a = JSON.stringify(real)
  const b = JSON.stringify(esperado)
  if (a !== b) fallos.push(`${nombre}\n    esperado ${b}\n    recibido ${a}`)
}
const fmt = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`

// Pedido del Figma: WO-000415 = productos 142.000 + envío 9.000 = 151.000.
const base = {
  tipoEntrega: 'delivery_own',
  subtotalProductos: 142000,
  envio: 9000,
  total: 151000,
  zonaId: 'z-chapinero',
  nombresZonas: ['Chapinero', 'Zona Norte', 'Zona Centro'],
  lineas: [
    { productoId: 1, categoriaId: 10, nombre: 'Aceite de oliva 500 ml' },
    { productoId: 2, categoriaId: 11, nombre: 'Café molido 500 g' },
  ],
  cliente: null,
  pasarelasActivas: ['wompi_co'],
}
const cond = (extra = {}) => normalizarCondiciones({ ...CONDICIONES_POR_DEFECTO, ...extra })

// ── Sin condiciones: EXACTAMENTE como hoy ──────────────────────────────────────────────────────
for (const tipo of ['delivery_own', 'delivery_third_party', 'pickup', 'dine_in']) {
  const r = evaluarContraentrega({ ...base, tipoEntrega: tipo, condiciones: null })
  igual(`sin condiciones (${tipo}): se ofrece, sin anticipo, todo al recibir`, [r.conCondiciones, r.disponible, r.anticipo, r.alRecibir, r.motivos], [false, true, null, 151000, []])
}
igual('settings vacíos → sin condiciones', condicionesDeSede({}, 5), null)
igual('settings null → sin condiciones', condicionesDeSede(null, 5), null)
igual('otra sede → sin condiciones', condicionesDeSede({ contraentrega: { version: 1, sedes: { 7: cond() } } }, 5), null)
igual('su sede → condiciones', condicionesDeSede({ contraentrega: { version: 1, sedes: { 5: { montoMinimo: 80000 } } } }, 5)?.montoMinimo, 80000)
igual('recoger con condiciones: «Pagar al recoger», sin anticipo (09 H)', (() => {
  const r = evaluarContraentrega({ ...base, tipoEntrega: 'pickup', condiciones: cond({ montoMinimo: 900000, anticipo: { ...CONDICIONES_POR_DEFECTO.anticipo, tipo: 'envio' } }) })
  return [r.conCondiciones, r.disponible, r.anticipo]
})(), [false, true, null])
igual('defecto: quién puede usarla APAGADAS y transportadora encendida', [CONDICIONES_POR_DEFECTO.soloClientesConEntregas, CONDICIONES_POR_DEFECTO.noOfrecerARechazados, CONDICIONES_POR_DEFECTO.transportadora, CONDICIONES_POR_DEFECTO.anticipo.plazoMinutos], [false, false, true, 30])

// ── Pantalla 09 ────────────────────────────────────────────────────────────────────────────────
// A · Disponible, sin anticipo
{
  const r = evaluarContraentrega({ ...base, condiciones: cond() })
  igual('09 A: disponible sin anticipo, paga 151.000 al recibir', [r.conCondiciones, r.disponible, r.anticipo, r.alRecibir], [true, true, null, 151000])
}
// B · Con anticipo «el envío»
{
  const c = cond({ anticipo: { ...CONDICIONES_POR_DEFECTO.anticipo, tipo: 'envio' } })
  const r = evaluarContraentrega({ ...base, condiciones: c })
  igual('09 B: anticipo 9.000 del envío y 142.000 al recibir', [r.disponible, r.anticipo?.monto, r.anticipo?.base, r.alRecibir, r.anticipo?.plazoMinutos, r.anticipo?.pasarelas], [true, 9000, 'envio', 142000, 30, ['wompi_co']])
  igual('09 B: texto', lineaResumenAnticipo(r, fmt), 'Paga hoy $ 9.000 del envío y $ 142.000 al recibir.')
  igual('08c: varias pasarelas en el orden de Finanzas (la primera marcada)', evaluarContraentrega({ ...base, condiciones: c, pasarelasActivas: ['mp_checkout', 'wompi_co', 'bold_link'] }).anticipo?.pasarelas, ['mp_checkout', 'wompi_co', 'bold_link'])
}
// C · Falta para el mínimo
{
  const r = evaluarContraentrega({ ...base, subtotalProductos: 68000, total: 77000, condiciones: cond({ montoMinimo: 80000 }) })
  igual('09 C: mínimo, faltan 12.000', [r.disponible, r.motivos[0]], [false, { codigo: 'monto_minimo', minimo: 80000, faltan: 12000 }])
  igual('09 C: texto', textoMotivo(r.motivos[0], fmt).texto, 'Disponible desde $ 80.000 — te faltan $ 12.000.')
  igual('09 C: sin anticipo ni descuento si no se ofrece', [r.anticipo, r.alRecibir], [null, 77000])
  igual('14: aviso del carrito', faltaParaMinimo(cond({ montoMinimo: 80000 }), 68000), { minimo: 80000, faltan: 12000 })
  igual('14: sin mínimo, sin aviso', faltaParaMinimo(cond(), 68000), null)
}
// D · Pasa el máximo
{
  const r = evaluarContraentrega({ ...base, subtotalProductos: 742000, total: 751000, condiciones: cond({ montoMaximo: 600000 }) })
  igual('09 D: máximo', r.motivos[0], { codigo: 'monto_maximo', maximo: 600000, total: 742000 })
  igual('09 D: texto', textoMotivo(r.motivos[0], fmt).texto, 'Solo para pedidos hasta $ 600.000. Tu pedido es de $ 742.000: págalo en línea o divídelo en dos.')
}
// E · Productos que no aplican (todos menos Licores = categoría 20; y un producto suelto)
{
  const c = cond({ productos: { modo: 'excepto', categorias: [20], productos: [99] } })
  const lineas = [...base.lineas, { productoId: 3, categoriaId: 20, nombre: 'Aguardiente 750 ml' }, { productoId: 4, categoriaId: 20, nombre: 'Vino tinto reserva 750 ml' }]
  const r = evaluarContraentrega({ ...base, lineas, condiciones: c })
  igual('09 E: 2 productos excluidos', [r.disponible, r.motivos[0]], [false, { codigo: 'productos', productoIds: [3, 4] }])
  igual('09 E: texto', textoMotivo(r.motivos[0], fmt), { texto: 'No disponible para 2 productos de tu carrito.', accion: 'Ver cuáles' })
  igual('15b: producto excluido por categoría', productoAplica(c, { productoId: 4, categoriaId: 20 }), false)
  igual('15: producto que sí aplica', productoAplica(c, { productoId: 1, categoriaId: 10 }), true)
  igual('variante de un padre excluido', productoAplica(c, { productoId: 500, categoriaId: 10, productoPadreId: 99 }), false)
  igual('«solo algunos»', productoAplica(cond({ productos: { modo: 'solo', categorias: [10], productos: [] } }), { productoId: 2, categoriaId: 11 }), false)
}
// F · Dirección sin cobertura
{
  const c = cond({ zonas: { modo: 'algunas', ids: ['z-chapinero', 'z-norte'] } })
  const fuera = evaluarContraentrega({ ...base, zonaId: 'z-sur', condiciones: c })
  igual('09 F: zona sin cobertura', fuera.motivos[0].codigo, 'zona')
  igual('09 F: texto con las zonas', textoMotivo(fuera.motivos[0], fmt).texto, 'No llega a tu dirección. Contraentrega solo en: Chapinero, Zona Norte, Zona Centro.')
  igual('09 F (checkout, con la ciudad del cliente)', textoMotivo(fuera.motivos[0], fmt, 'Medellín'), {
    texto: 'No llega a tu dirección (Medellín). Contraentrega solo en Chapinero, Zona Norte y Zona Centro.',
    accion: 'Cambiar dirección',
  })
  igual('09 F: ciudad vacía = texto de siempre', textoMotivo(fuera.motivos[0], fmt, '  ').texto, 'No llega a tu dirección. Contraentrega solo en: Chapinero, Zona Norte, Zona Centro.')
  igual('09 F: sin cobertura, otro motivo no cambia con la ciudad', textoMotivo({ codigo: 'primera_compra' }, fmt, 'Medellín').accion, 'Ingresar')
  igual('09 F: sin zona cotizada no se ofrece', evaluarContraentrega({ ...base, zonaId: null, condiciones: c }).disponible, false)
  igual('09 F: en zona sí', evaluarContraentrega({ ...base, condiciones: c }).disponible, true)
  igual('transportadora (decisión 4): no mira las zonas', evaluarContraentrega({ ...base, tipoEntrega: 'delivery_third_party', zonaId: null, condiciones: c }).disponible, true)
  igual('transportadora apagada', evaluarContraentrega({ ...base, tipoEntrega: 'delivery_third_party', condiciones: cond({ transportadora: false }) }).motivos[0].codigo, 'transportadora')
}
// G · Solo clientes con compras entregadas
{
  const c = cond({ soloClientesConEntregas: true })
  igual('09 G: invitado', evaluarContraentrega({ ...base, condiciones: c, cliente: null }).motivos[0].codigo, 'primera_compra')
  igual('09 G: cliente sin entregas', evaluarContraentrega({ ...base, condiciones: c, cliente: { pedidosEntregados: 0, rechazosEnPuerta: 0 } }).disponible, false)
  igual('09 G: cliente con una entrega', evaluarContraentrega({ ...base, condiciones: c, cliente: { pedidosEntregados: 1, rechazosEnPuerta: 0 } }).disponible, true)
  igual('09 G: texto', textoMotivo({ codigo: 'primera_compra' }, fmt).accion, 'Ingresar')
}
// I · Rechazó un pedido en la puerta (texto neutro)
{
  const c = cond({ noOfrecerARechazados: true })
  const r = evaluarContraentrega({ ...base, condiciones: c, cliente: { pedidosEntregados: 3, rechazosEnPuerta: 1 } })
  igual('09 I: rechazo previo', r.motivos[0].codigo, 'rechazo_previo')
  igual('09 I: texto neutro', textoMotivo(r.motivos[0], fmt).texto, 'Para esta compra el pago es en línea. Si tienes dudas, escríbenos.')
  igual('09 I: con la regla apagada se ofrece', evaluarContraentrega({ ...base, condiciones: cond(), cliente: { pedidosEntregados: 0, rechazosEnPuerta: 4 } }).disponible, true)
}
// Orden de los motivos: monto → productos → dirección
{
  const c = cond({ montoMinimo: 900000, productos: { modo: 'excepto', categorias: [10], productos: [] }, zonas: { modo: 'algunas', ids: ['x'] } })
  igual('orden de motivos', evaluarContraentrega({ ...base, condiciones: c }).motivos.map((m) => m.codigo), ['monto_minimo', 'productos', 'zona'])
}

// ── Anticipo ───────────────────────────────────────────────────────────────────────────────────
{
  const a = (x) => cond({ anticipo: { ...CONDICIONES_POR_DEFECTO.anticipo, ...x } })
  igual('porcentaje 20 % del total con envío', montoAnticipo(a({ tipo: 'porcentaje', porcentaje: 20 }), 9000, 151000), { monto: 30200, base: 'porcentaje' })
  igual('valor fijo', montoAnticipo(a({ tipo: 'fijo', valorFijo: 10000 }), 9000, 151000), { monto: 10000, base: 'fijo' })
  igual('valor fijo nunca más que el total', montoAnticipo(a({ tipo: 'fijo', valorFijo: 500000 }), 9000, 151000)?.monto, 151000)
  igual('envío gratis + «no pedir anticipo»', montoAnticipo(a({ tipo: 'envio', siEnvioGratis: 'sin_anticipo' }), 0, 151000), null)
  igual('envío gratis + «valor fijo de 9.000»', montoAnticipo(a({ tipo: 'envio', siEnvioGratis: 'valor_fijo', valorEnvioGratis: 9000 }), 0, 151000), { monto: 9000, base: 'envio_gratis_fijo' })
  igual('envío gratis + «no pedir»: disponible y todo al recibir', (() => {
    const r = evaluarContraentrega({ ...base, envio: 0, total: 142000, condiciones: a({ tipo: 'envio' }) })
    return [r.disponible, r.anticipo, r.alRecibir]
  })(), [true, null, 142000])
  igual('pasarela fija inactiva → no se ofrece (nunca todo en la puerta a escondidas)', evaluarContraentrega({ ...base, condiciones: a({ tipo: 'envio', pasarela: 'bold_link' }) }).motivos[0].codigo, 'sin_pasarela')
  igual('pasarela fija activa → solo esa', evaluarContraentrega({ ...base, pasarelasActivas: ['mp_checkout', 'wompi_co'], condiciones: a({ tipo: 'envio', pasarela: 'wompi_co' }) }).anticipo?.pasarelas, ['wompi_co'])
  igual('sin pasarelas y sin anticipo: se ofrece', evaluarContraentrega({ ...base, pasarelasActivas: [], condiciones: cond() }).disponible, true)
  igual('si no recibe: devolver', lineaSiNoRecibe('devolver'), 'Si no recibes el pedido, te devolvemos el anticipo.')
  igual('si no recibe: retener', lineaSiNoRecibe('retener'), 'Si no recibes el pedido, el anticipo cubre el envío y no se devuelve.')
}

// ── Cobro en la puerta (Logística › Cuadres espera solo esto) ─────────────────────────────────
igual('puerta: anticipo pagado', cobroEnPuerta(151000, { monto: 9000, estado: 'paid' }), 142000)
igual('puerta: anticipo pendiente no descuenta', cobroEnPuerta(151000, { monto: 9000, estado: 'pending' }), 151000)
igual('puerta: anticipo vencido no descuenta', cobroEnPuerta('151000.00', { monto: '9000', estado: 'expired' }), 151000)
igual('puerta: sin anticipo, el total', cobroEnPuerta(58900, { monto: null, estado: null }), 58900)

// ── Lectura tolerante y guardado ───────────────────────────────────────────────────────────────
{
  const n = normalizarCondiciones({ montoMinimo: '-5', medios: ['cash', 'bitcoin'], anticipo: { tipo: 'raro', porcentaje: 300, plazoMinutos: 2 }, texto: 'x'.repeat(300) })
  igual('normaliza basura', [n.montoMinimo, n.medios, n.anticipo.tipo, n.anticipo.porcentaje, n.anticipo.plazoMinutos, n.texto.length], [null, ['cash'], 'ninguno', null, 30, 160])
  const s = conCondicionesDeSede({ otra: 1, contraentrega: { version: 1, sedes: { 3: cond() } } }, 5, cond({ montoMinimo: 1 }))
  igual('guardar una sede no pisa las otras claves ni sedes', [s.otra, Object.keys(s.contraentrega.sedes).sort()], [1, ['3', '5']])
  igual('quitar una sede', Object.keys(conCondicionesDeSede(s, 3, null).contraentrega.sedes), ['5'])
}

// ── Textos y referencia ────────────────────────────────────────────────────────────────────────
igual('medios', fraseMedios(['cash', 'card', 'qr']), 'En efectivo, con datáfono o Nequi')
igual('08: desglose «Al recibir · efectivo, datáfono o Nequi» (Nequi con mayúscula)', textoMedios(['cash', 'card', 'qr']), 'efectivo, datáfono o Nequi')
igual('09 A: descripción sin anticipo', descripcionContraentrega(['cash', 'card', 'qr'], null), 'Paga en efectivo, con datáfono o Nequi cuando recibas tu pedido.')
igual('08: descripción con anticipo del envío', descripcionContraentrega(['cash', 'card', 'qr'], { base: 'envio' }),
  'Paga en efectivo, con datáfono o Nequi cuando recibas tu pedido. Para confirmarlo, hoy pagas solo el envío.')
igual('descripción: solo Nequi o transferencia', [descripcionContraentrega(['qr'], null), descripcionContraentrega(['transfer'], null)],
  ['Paga con Nequi cuando recibas tu pedido.', 'Paga con transferencia cuando recibas tu pedido.'])
igual('conector wompi', [codigoConector('wompi'), codigoConector('mp'), codigoConector('bold_link'), codigoConector('cash')], ['wompi_co', 'mp_checkout', 'bold_link', null])
{
  const id = '17969056-f5cf-45b0-8f6a-7c2ea851fa5e'
  igual('referencia ida y vuelta', idDeReferenciaAnticipo(referenciaAnticipo(id)), id)
  igual('referencia: número de pedido no es anticipo', [esReferenciaAnticipo('WO-000415'), esReferenciaAnticipo('ANT-123'), esReferenciaAnticipo(null)], [false, false, false])
}

// ── El flujo sigue conectado (contrato en el fuente) ───────────────────────────────────────────
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
const conectado = [
  ['app/api/orders/route.ts', "paymentMethod === 'cash' && !mesaPedido && esDomicilio(tipoGuardado)"],
  ['app/api/orders/route.ts', "advance_status: 'pending'"],
  ['app/api/orders/route.ts', 'CONTRAENTREGA_NO_DISPONIBLE'],
  ['app/api/checkout/init/route.ts', 'source === FUENTE_COBRO_ANTICIPO'],
  ['app/api/checkout/init/route.ts', "code: 'ANTICIPO_PAGADO'"],
  ['app/api/webhooks/wompi_co/route.ts', 'procesarAnticipoWompi(supabase, body)'],
  ['app/api/webhooks/bold/route.ts', "pasarela: 'bold_link'"],
  ['app/api/webhooks/mercadopago/route.ts', "pasarela: 'mp_checkout'"],
  ['lib/contraentrega/anticipoWebhook.ts', "fn_web_order_anticipo_resultado"],
  ['app/checkout/resultado/page.tsx', 'idDeReferenciaAnticipo(orderRef)'],
  ['app/api/orders/[id]/tracking/route.ts', 'advance_amount, advance_status, advance_due_at, advance_gateway'],
  ['components/site/CheckoutWizard.tsx', "source: 'anticipo_pedido'"],
]
for (const [archivo, texto] of conectado) igual(`conectado: ${archivo} › ${texto}`, fuente(archivo).includes(texto), true)
// El init del anticipo NO pasa el pedido a pasarela: el método sigue en efectivo.
igual('init: el anticipo no escribe payment_method', /isAnticipo\) \{[^}]*payment_method\s*:/.test(fuente('app/api/checkout/init/route.ts')), false)
igual('opción: enlaces con Enlace, no <a href>', /<a\s+href/.test(fuente('components/site/contraentrega/OpcionContraentrega.tsx')), false)
igual('checkout: 09 E «Quitar» y 09 F «Cambiar dirección» conectados',
  fuente('components/site/CheckoutWizard.tsx').includes('onCambiarDireccion={cambiarDireccionContraentrega} onQuitar={quitarNoAplican}'), true)
igual('init: el anticipo solo escribe advance_gateway', /isAnticipo\) \{[^}]*advance_gateway: pasarelaAnticipo/.test(fuente('app/api/checkout/init/route.ts')), true)

// ── Los 3 correos del anticipo (aprobado 2026-11-24): 1 al crear, máx. 1 recordatorio, 1 al pagar ──
{
  // 1. Al crear: «Recibimos tu pedido» con el anticipo pendiente, la hora límite y «Pagar anticipo».
  const alCrear = textosCorreoRecibido({ orderNumber: 'WO-000415', faltaAnticipo: { monto: 9000, alRecibir: 142000, hasta: '4:30 p. m.', mismoDia: true } })
  igual('correo 1: falta el anticipo, el resto al recibir y la hora límite', alCrear.mensajeHtml,
    'Recibimos tu pedido <strong>WO-000415</strong>. Falta el anticipo de <strong>$9.000</strong> para confirmarlo; el resto (<strong>$142.000</strong>) lo pagas al recibir. Paga antes de las <strong>4:30 p. m.</strong>; si no, el pedido se cancela sin cobro.')
  igual('correo 1: botón «Pagar anticipo»', alCrear.boton, 'Pagar anticipo')
  igual('correo 1: «antes de la 1:05»', textosCorreoRecibido({ orderNumber: 'W', faltaAnticipo: { monto: 1, alRecibir: 1, hasta: '1:05 p. m.', mismoDia: true } }).mensajeHtml.includes('antes de la <strong>1:05 p. m.</strong>'), true)
  igual('correo 1: vence otro día → fecha y hora', textosCorreoRecibido({ orderNumber: 'W', faltaAnticipo: { monto: 1, alRecibir: 1, hasta: '25 nov · 12:10 a. m.', mismoDia: false } }).mensajeHtml.includes('antes del <strong>25 nov · 12:10 a. m.</strong>'), true)
  igual('correo 1: la hora no entra como HTML', textosCorreoRecibido({ orderNumber: 'W', faltaAnticipo: { monto: 1, alRecibir: 1, hasta: '<i>x', mismoDia: true } }).mensajeHtml.includes('<i>'), false)
  igual('correo 1: sin anticipo, el texto de siempre', textosCorreoRecibido({ orderNumber: 'W-9' }).boton, 'Seguir mi pedido')
  igual('correo 1: anticipo 0, el texto de siempre', textosCorreoRecibido({ orderNumber: 'W-9', faltaAnticipo: { monto: 0, alRecibir: 5, hasta: 'x', mismoDia: true } }).boton, 'Seguir mi pedido')
  igual('correo 1: el anticipo manda sobre «falta el pago en línea»', textosCorreoRecibido({ orderNumber: 'W', faltaPagoEnLinea: true, faltaAnticipo: { monto: 9000, alRecibir: 1, hasta: '', mismoDia: true } }).boton, 'Pagar anticipo')

  // 2. Recordatorio: el mismo «Termina tu pago» por el valor DEL ANTICIPO.
  const rec = textosCorreoRecordatorioPago({ orderNumber: 'WO-000415', nombreTienda: 'T', total: 151000, hasta: '4:30 p. m.', mismoDia: true, anticipo: 9000 })
  igual('correo 2: valor del anticipo, no del total', [rec.mensajeHtml.includes('$9.000'), rec.mensajeHtml.includes('151.000'), rec.boton], [true, false, 'Pagar anticipo'])

  // Contrato en el fuente: quién envía cada uno y que no se dupliquen.
  const pedidos = fuente('app/api/orders/route.ts')
  const correo = fuente('lib/contraentrega/correoAnticipo.ts')
  const webhook = fuente('lib/contraentrega/anticipoWebhook.ts')
  const regla = fuente('lib/orders/recordatorioPago.ts')
  const bloque = pedidos.slice(pedidos.indexOf('} else if (anticipoPedido) {'), pedidos.indexOf('} else if (!PASARELAS_CON_CORREO_AL_PAGAR'))
  igual('correo 1: la creación lo envía en el ramal del anticipo, con su else', /if \(tieneCorreo\(customer\.email\)\) \{\s*await enviarCorreoAnticipoPendiente\(webOrder\.id\)\s*\} else \{/.test(bloque), true)
  igual('correo 1: el ramal del anticipo no manda además el «Recibimos tu pedido» genérico', bloque.includes('sendOrderConfirmationEmail('), false)
  igual('correo 1: una sola llamada desde la creación', (pedidos.match(/enviarCorreoAnticipoPendiente\(/g) || []).length, 1)
  igual('correo 1: solo con el anticipo pendiente', correo.includes("pedido.advance_status !== 'pending'"), true)
  igual('correo 1: botón a la página del pedido con su token', correo.includes('rutaSeguimiento(organizationId, pedido)'), true)
  igual('correo 1: hora límite en la zona de la sede', correo.includes('sede?.timezone || org?.timezone || ZONA_POR_DEFECTO') && correo.includes('pedido.advance_due_at'), true)
  igual('correo 1: con la marca de la tienda', correo.includes('cargarMarcaPedido(sb, organizationId'), true)
  igual('correo 2: la regla incluye el anticipo pendiente', regla.includes("pedido.anticipoEstado !== 'pending'") && regla.includes('plazoAnticipoMinutos'), true)
  igual('correo 3: el webhook no envía el de creación', webhook.includes('enviarCorreoAnticipoPendiente'), false)
  igual('correo 3: solo en la transición a pagado', (webhook.match(/status === 'pagado'\) \{\s*await enviarCorreoAnticipoPagado/g) || []).length, 2)
  igual('correo 3: sin cambios (exige pagado y registra pedido_pagado)', correo.includes("pedido.advance_status !== 'paid'") && correo.includes("tipo: 'pedido_pagado'"), true)
  igual('la página del pedido cobra el anticipo (botón «Pagar anticipo» del correo)', fuente('app/pedido/[id]/OrderTracker.tsx').includes("source: 'anticipo_pedido'"), true)
}

// ── Carrito lateral (14 / 14b) y ficha (15 / 15b) ─────────────────────────────────────────────
{
  // Lo que entrega GET /api/contraentrega/condiciones; normalizarCondiciones lo lee tal cual.
  const publica = (extra = {}) => ({
    conCondiciones: true,
    montoMinimo: null,
    montoMaximo: null,
    transportadora: true,
    productos: { modo: 'todos', categorias: [], productos: [] },
    medios: ['cash', 'card', 'transfer', 'qr'],
    anticipo: { tipo: 'ninguno', porcentaje: null, valorFijo: null, siEnvioGratis: 'sin_anticipo', valorEnvioGratis: null },
    zonas: null,
    texto: null,
    ...extra,
  })
  const anticipo = (tipo, extra = {}) => ({ ...publica().anticipo, tipo, ...extra })
  const carrito = (p, subtotal, excluidos = []) =>
    avisoCarritoContraentrega(p, { falta: faltaParaMinimo(normalizarCondiciones(p), subtotal), subtotalProductos: subtotal, excluidos }, fmt)

  igual('respuesta pública → condiciones (mínimo y productos)', (() => {
    const n = normalizarCondiciones(publica({ montoMinimo: 80000, productos: { modo: 'excepto', categorias: [20], productos: [] } }))
    return [n.ofrecer, n.montoMinimo, n.productos.modo, n.productos.categorias]
  })(), [true, 80000, 'excepto', [20]])
  igual('lista con y', [listaConY([]), listaConY(['Chapinero']), listaConY(['Chapinero', 'Zona Norte']), listaConY(['Chapinero', 'Zona Norte', 'Zona Centro'])],
    ['', 'Chapinero', 'Chapinero y Zona Norte', 'Chapinero, Zona Norte y Zona Centro'])
  igual('anticipo hoy', [
    fraseAnticipoHoy(anticipo('ninguno'), fmt),
    fraseAnticipoHoy(anticipo('envio'), fmt),
    fraseAnticipoHoy(anticipo('porcentaje', { porcentaje: 20 }), fmt),
    fraseAnticipoHoy(anticipo('fijo', { valorFijo: 10000 }), fmt),
    fraseAnticipoHoy(anticipo('fijo'), fmt),
  ], [null, 'hoy pagas solo el envío', 'hoy pagas el 20 % del pedido', 'hoy pagas $ 10.000', null])

  igual('14b 1: disponible sin anticipo', carrito(publica(), 68000), { tipo: 'disponible', titulo: 'Contraentrega disponible: pagas al recibir.' })
  igual('14b 2: disponible con anticipo', carrito(publica({ anticipo: anticipo('envio') }), 68000).titulo, 'Contraentrega disponible: hoy pagas solo el envío y el resto al recibir.')
  igual('14 / 14b 3: falta para el mínimo', carrito(publica({ montoMinimo: 80000, anticipo: anticipo('envio') }), 68000), {
    tipo: 'minimo',
    titulo: 'Te faltan $ 12.000 para pagar contra entrega',
    detalle: 'Desde $ 80.000 puedes pagar al recibir (hoy pagas solo el envío).',
    avance: 0.85,
  })
  igual('14: mínimo sin anticipo', carrito(publica({ montoMinimo: 80000 }), 68000).detalle, 'Desde $ 80.000 puedes pagar al recibir.')
  igual('14: mínimo alcanzado → disponible', carrito(publica({ montoMinimo: 80000 }), 80000).tipo, 'disponible')
  igual('14: pasa el máximo', carrito(publica({ montoMaximo: 600000 }), 742000), { tipo: 'maximo', titulo: 'Contraentrega solo para pedidos hasta $ 600.000', detalle: 'Este pedido se paga en línea.' })
  igual('14b 4: un producto no aplica', carrito(publica({ productos: { modo: 'excepto', categorias: [20], productos: [] } }), 126000, [{ productId: 4, nombre: 'Vino tinto reserva 750 ml' }]), {
    tipo: 'productos',
    titulo: 'Contraentrega no aplica a «Vino tinto reserva 750 ml». Quítalo para pagar al recibir o paga todo en línea.',
    productoIds: [4],
  })
  igual('14b 4: varios no aplican', carrito(publica(), 126000, [{ productId: 3, nombre: 'Aguardiente' }, { productId: 4, nombre: 'Vino' }]).titulo,
    'Contraentrega no aplica a 2 productos de tu carrito. Quítalos para pagar al recibir o paga todo en línea.')
  igual('14: orden de la regla (monto antes que productos)', carrito(publica({ montoMinimo: 80000 }), 68000, [{ productId: 4, nombre: 'Vino' }]).tipo, 'minimo')

  const conZonas = publica({ montoMinimo: 80000, zonas: ['Chapinero', 'Zona Norte', 'Zona Centro'], anticipo: anticipo('envio') })
  igual('15: ficha, producto que aplica', avisoFichaContraentrega(conZonas, true, fmt), {
    tipo: 'disponible',
    titulo: 'Contraentrega disponible · pagas al recibir',
    detalle: 'En Chapinero, Zona Norte y Zona Centro, en pedidos desde $ 80.000. Hoy pagas solo el envío.',
  })
  igual('15b: comparación, sin más condiciones solo el título', avisoFichaContraentrega(publica(), true, fmt), { tipo: 'disponible', titulo: 'Contraentrega disponible · pagas al recibir', detalle: null })
  igual('15: rango de montos', avisoFichaContraentrega(publica({ montoMinimo: 50000, montoMaximo: 600000 }), true, fmt).detalle, 'En pedidos de $ 50.000 a $ 600.000.')
  igual('15b: producto que no aplica', avisoFichaContraentrega(conZonas, false, fmt), {
    tipo: 'en_linea',
    titulo: 'Este producto se paga en línea',
    detalle: 'No aplica pago contra entrega. Si lo llevas con otros productos, ese pedido también se paga en línea.',
  })
  igual('15b: la ficha decide con productoAplica (categoría excluida)',
    productoAplica(normalizarCondiciones(publica({ productos: { modo: 'excepto', categorias: [20], productos: [] } })), { productoId: 4, categoriaId: 20, productoPadreId: null }), false)
}

// El cajón y la ficha montan el aviso; el endpoint lee del host y solo responde lo del aviso.
{
  const cajon = fuente('components/site/CartDrawer.tsx')
  igual('cajón: importa el aviso', cajon.includes("import { AvisoContraentregaCarrito } from './contraentrega/AvisoContraentregaCarrito'"), true)
  igual('cajón: monta el aviso con la sede', /<AvisoContraentregaCarrito[\s\S]*?branchId=\{branchId\}/.test(cajon), true)
  const ficha = fuente('app/productos/[id]/ProductDetailActions.tsx')
  igual('ficha: monta el aviso (variantes y producto simple)', (ficha.match(/<AvisoContraentregaFicha product=\{product\} branchId=\{branchId\} \/>/g) || []).length, 2)
  const avisos = fuente('components/site/contraentrega/AvisoContraentregaCarrito.tsx') + fuente('components/site/contraentrega/AvisoContraentregaFicha.tsx')
  igual('avisos: sin condiciones no pintan nada', (avisos.match(/!respuesta\.conCondiciones/g) || []).length, 2)
  const lectura = fuente('app/api/contraentrega/condiciones/route.ts')
  igual('condiciones: organización del host', lectura.includes('await getOrgIdDelHost()'), true)
  igual('condiciones: límite por IP', lectura.includes('checkRateLimit(`contraentrega-condiciones:ip:${getClientIP(request)}`'), true)
  igual('condiciones: sede validada contra la organización', lectura.includes(".eq('id', branchId).eq('organization_id', orgId)"), true)
  igual('condiciones: con caché pública', lectura.includes('s-maxage=300'), true)
  igual('condiciones: sin efectivo en el sitio o la sede, nada',
    lectura.includes('fila.is_active === true && fila.show_on_website === true && metodoPermitidoEnSede(fila.branch_ids, branchId)'), true)
  igual('condiciones: no lee nada del cliente ni de la sesión', /getAuthCustomer|historialCliente|cookies\(/.test(lectura), false)
}

if (fallos.length > 0) {
  console.error(`✗ verify-contraentrega: ${fallos.length} de ${pruebas} fallaron`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-contraentrega: ${pruebas} pruebas (pantalla 09, anticipo, puerta, sin condiciones = como hoy, flujo conectado)`)
