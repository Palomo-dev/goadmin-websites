/**
 * verify-recordatorio-pago.mjs — correo «Termina tu pago» y el texto de «Recibimos tu pedido».
 *
 *   npm run verify:recordatorio-pago
 *
 * Sin base de datos ni envíos. Carga las funciones puras y comprueba:
 * - a quién: pasarela sin pagar, del sitio, con correo; no efectivo, transferencia, PSE, mesa,
 *   comer aquí, pagado, liberado ni otro origen;
 * - cuándo: a los 10 minutos, o a la mitad de un plazo corto; no después de vencer ni con menos
 *   de 2 minutos por delante; `failed` con el pedido vivo sí;
 * - una sola vez: con una fila `recordatorio_pago` no se repite; un comprador, su pedido más
 *   reciente; si a ese correo ya se le recordó hace menos de 2 horas, no; tope por corrida;
 * - el reclamo: gana la fila más vieja;
 * - los textos: asunto, total, «hasta las …» en la zona de la sede, botón «Pagar ahora»;
 * - «Recibimos tu pedido»: restaurante, comercio y pago por pasarela pendiente;
 * - y en el fuente: el cron autenticado (pg_cron cada 5 minutos, fuera de vercel.json), el reclamo antes del envío, el corte
 *   con el 23514 y el pedido nuevo que ya pasa el tipo de negocio y el pago pendiente.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-recordatorio-pago-'))

async function cargar(ruta, destino, reemplazos = []) {
  let src = stripTypeScriptTypes(await readFile(join(ROOT, ruta), 'utf8'), { mode: 'strip' })
  for (const [de, a] of reemplazos) src = src.replaceAll(de, a)
  await writeFile(join(dir, destino), src)
}

let reglas
let metodo
let textos
let token
let consulta
let ventana
try {
  process.env.ORDER_TRACKING_SECRET = 'secreto-de-prueba-para-el-enlace'
  await cargar('lib/orders/estados-pedido.ts', 'estados-pedido.mjs')
  await cargar('lib/orders/metodoPasarela.ts', 'metodoPasarela.mjs')
  await cargar('lib/orders/recordatorioPago.ts', 'recordatorioPago.mjs', [
    ["from '@/lib/orders/estados-pedido'", "from './estados-pedido.mjs'"],
    ["from '@/lib/orders/metodoPasarela'", "from './metodoPasarela.mjs'"],
  ])
  await cargar('lib/email/textosCorreoPedido.ts', 'textosCorreoPedido.mjs')
  await cargar('lib/orders/tokenSeguimiento.ts', 'tokenSeguimiento.mjs')
  await cargar('lib/orders/consultaPedido.ts', 'consultaPedido.mjs', [
    ["from '@/lib/orders/estados-pedido'", "from './estados-pedido.mjs'"],
  ])
  await cargar('lib/restaurant/horario.ts', 'horario.mjs')
  await cargar('lib/restaurant/ventanaPedido.ts', 'ventanaPedido.mjs', [["from './horario'", "from './horario.mjs'"]])
  const url = (f) => pathToFileURL(join(dir, f)).href
  reglas = await import(url('recordatorioPago.mjs'))
  metodo = await import(url('metodoPasarela.mjs'))
  textos = await import(url('textosCorreoPedido.mjs'))
  token = await import(url('tokenSeguimiento.mjs'))
  consulta = await import(url('consultaPedido.mjs'))
  ventana = await import(url('ventanaPedido.mjs'))
} finally {
  await rm(dir, { recursive: true, force: true })
}

const problemas = []
let casos = 0
function check(cond, msg) {
  casos++
  if (!cond) problemas.push(msg)
}
function igual(a, b, msg) {
  check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
}

const ahora = new Date('2026-11-24T20:00:00.000Z') // 3:00 p. m. en Bogotá
const min = 60 * 1000
const iso = (deltaMs) => new Date(ahora.getTime() - deltaMs).toISOString()

function pedido(parcial = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 7,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'mercadopago',
    source: 'website',
    email: 'cliente@ejemplo.com',
    deliveryType: 'delivery_own',
    restaurantTableId: null,
    notasInternas: null,
    createdAt: iso(12 * min),
    stockReleasedAt: null,
    recordatorios: [],
    ...parcial,
  }
}
const pasarela = { nativo: false, plazoMinutos: 30 }
const motivo = (p, ctx = pasarela) => reglas.motivoSinRecordatorio(p, ahora, ctx)

// ── Método de pago ──────────────────────────────────────────────────────────
check(metodo.esMetodoPasarela('wompi', false), 'wompi con conexión es pasarela')
check(!metodo.esMetodoPasarela('wompi', null), 'sin respuesta de la base no se asume pasarela')
check(!metodo.esMetodoPasarela('contraentrega', true), 'un método nativo de la organización no')
for (const m of ['cash', 'transfer', 'pse', 'bancolombia_transfer', 'bancolombia_collect', 'mesa', '', null]) {
  check(!metodo.metodoPuedeSerPasarela(m), `${JSON.stringify(m)} no es pasarela`)
}

// ── A quién ─────────────────────────────────────────────────────────────────
igual(motivo(pedido()), null, 'pasarela sin pagar a los 12 minutos: sí')
igual(motivo(pedido({ paymentStatus: 'failed' })), null, 'pago rechazado con el pedido vivo: sí')
igual(motivo(pedido({ paymentStatus: 'paid' })), 'pago', 'pagado: no')
igual(motivo(pedido({ status: 'expired', paymentStatus: 'failed' })), 'estado', 'vencido: no')
igual(motivo(pedido({ status: 'confirmed' })), 'estado', 'confirmado: no')
igual(motivo(pedido({ stockReleasedAt: iso(1 * min) })), 'liberado', 'stock liberado: no')
igual(motivo(pedido({ source: 'pos' })), 'no_es_sitio', 'otro origen: no')
igual(motivo(pedido({ email: '' })), 'sin_correo', 'sin correo: no')
igual(motivo(pedido({ email: 'no-es-correo' })), 'sin_correo', 'correo ilegible: no')
igual(motivo(pedido({ email: 'cliente.nuevo@mail.com3043677302' })), 'sin_correo', 'teléfono pegado al correo: no')
igual(motivo(pedido({ email: 'ana@tienda.co' })) === 'sin_correo', false, 'correo .co: sí')
igual(motivo(pedido({ paymentMethod: 'cash' })), 'nativo', 'efectivo: no')
igual(motivo(pedido({ paymentMethod: 'transfer' })), 'nativo', 'transferencia: no')
igual(motivo(pedido({ paymentMethod: 'pse' })), 'nativo', 'PSE manual: no')
igual(motivo(pedido({ paymentMethod: 'contraentrega' }), { nativo: true, plazoMinutos: 1440 }), 'nativo', 'método sin conexión: no')
igual(motivo(pedido(), { nativo: null, plazoMinutos: 30 }), 'nativo', 'si la base no respondió, no')
igual(motivo(pedido({ deliveryType: 'dine_in' })), 'mesa', 'comer aquí: no')
igual(motivo(pedido({ restaurantTableId: '22222222-2222-2222-2222-222222222222' })), 'mesa', 'con mesa: no')
igual(motivo(pedido({ deliveryType: 'pickup', notasInternas: '[Comer aquí] Mesa: 4' })), 'mesa', 'ronda guardada como recoger: no')
igual(motivo(pedido({ recordatorios: [{ createdAt: iso(1 * min) }] })), 'ya_enviado', 'una sola vez por pedido')

// ── Cuándo ──────────────────────────────────────────────────────────────────
igual(reglas.esperaRecordatorioMs(30), 10 * min, 'plazo de 30: a los 10 minutos')
igual(reglas.esperaRecordatorioMs(12), 6 * min, 'plazo de 12: a la mitad')
igual(motivo(pedido({ createdAt: iso(9 * min) })), 'aun_no', 'a los 9 minutos todavía no')
igual(motivo(pedido({ createdAt: iso(10 * min) })), null, 'a los 10 minutos sí')
igual(motivo(pedido({ createdAt: iso(28 * min + 1) })), 'vencido', 'con menos de 2 minutos por delante no')
igual(motivo(pedido({ createdAt: iso(31 * min) })), 'vencido', 'después de vencer no')
igual(motivo(pedido({ createdAt: iso(6 * min) }), { nativo: false, plazoMinutos: 12 }), null, 'plazo corto: a la mitad sí')
igual(motivo(pedido({ createdAt: iso(5 * min) }), { nativo: false, plazoMinutos: 12 }), 'aun_no', 'plazo corto: antes de la mitad no')
igual(motivo(pedido({ createdAt: iso(3 * 60 * min) }), { nativo: false, plazoMinutos: 1440 }), null, 'plazo largo configurado: sigue vivo y entra')
igual(motivo(pedido({ createdAt: iso(7 * 60 * min) }), { nativo: false, plazoMinutos: 1440 }), 'vencido', 'más de 6 horas: fuera de la ventana')
igual(motivo(pedido(), { nativo: false, plazoMinutos: null }), 'sin_plazo', 'sin plazo de la base no se adivina')
igual(reglas.venceMs(iso(12 * min), 30), ahora.getTime() + 18 * min, 'vence = creado + plazo')

// ── Plan de la corrida ──────────────────────────────────────────────────────
const ctx = new Map([[reglas.clavePar(7, 'mercadopago'), pasarela], [reglas.clavePar(7, 'bold'), pasarela]])
const plan = (lista, lote) => reglas.planRecordatorios(lista, ahora, ctx, lote)

igual(plan([pedido()]).enviar, [{ id: pedido().id, plazoMinutos: 30 }], 'un pedido elegible sale con su plazo')
{
  const viejo = pedido({ id: 'a', createdAt: iso(20 * min) })
  const nuevo = pedido({ id: 'b', createdAt: iso(11 * min), email: 'Cliente@Ejemplo.com' })
  const r = plan([viejo, nuevo])
  igual(r.enviar.map((e) => e.id), ['b'], 'mismo comprador: solo el pedido más reciente')
  igual(r.motivos.a, 'hay_otro_mas_reciente', 'el viejo queda por el nuevo')
}
{
  const viejo = pedido({ id: 'a', createdAt: iso(20 * min) })
  const pagado = pedido({ id: 'b', createdAt: iso(5 * min), paymentStatus: 'paid', status: 'confirmed' })
  igual(plan([viejo, pagado]).enviar, [], 'si después pagó otro pedido, no se le recuerda el viejo')
}
{
  const recordado = pedido({ id: 'a', createdAt: iso(60 * min), status: 'expired', recordatorios: [{ createdAt: iso(50 * min) }] })
  const nuevo = pedido({ id: 'b', createdAt: iso(11 * min) })
  const r = plan([recordado, nuevo])
  igual(r.enviar, [], 'a ese correo ya se le recordó hace menos de 2 horas')
  igual(r.motivos.b, 'correo_reciente', 'motivo del tope por correo')
}
{
  const otraOrg = pedido({ id: 'b', organizationId: 8, createdAt: iso(5 * min) })
  igual(plan([pedido({ id: 'a' }), otraOrg]).enviar.map((e) => e.id), ['a'], 'un pedido en otra tienda no cuenta como hermano')
}
{
  const lista = [1, 2, 3].map((n) => pedido({ id: `p${n}`, email: `c${n}@ejemplo.com`, createdAt: iso((10 + n) * min) }))
  const r = plan(lista, 2)
  igual(r.enviar.map((e) => e.id), ['p3', 'p2'], 'tope por corrida: primero los que vencen antes')
  igual(r.motivos.p1, 'tope', 'el resto espera a la siguiente corrida')
}
igual(
  reglas.paresPorConsultar([pedido(), pedido({ id: 'x', paymentMethod: 'cash' }), pedido({ id: 'y', paymentMethod: 'bold' })], ahora),
  [{ organizationId: 7, metodo: 'mercadopago' }, { organizationId: 7, metodo: 'bold' }],
  'solo se pregunta a la base por los pares que pasan el filtro',
)

// ── Reclamo ─────────────────────────────────────────────────────────────────
const filas = [
  { id: 'b', createdAt: '2026-11-24T20:00:00.100Z' },
  { id: 'a', createdAt: '2026-11-24T20:00:00.200Z' },
]
check(reglas.ganaReclamo(filas, 'b'), 'gana la fila más vieja')
check(!reglas.ganaReclamo(filas, 'a'), 'la otra no envía')
check(reglas.ganaReclamo([{ id: 'b', createdAt: 't' }, { id: 'a', createdAt: 't' }], 'a'), 'a igual hora, el id menor')
check(!reglas.ganaReclamo([], 'a'), 'sin filas no se envía')

// ── Textos del recordatorio ─────────────────────────────────────────────────
const vence = consulta.apartadoHasta(iso(12 * min), 30)
const hora = ventana.horaPedido(vence, 'America/Bogota')
igual(hora, '3:18 p. m.', 'la hora va en la zona de la sede')
igual(ventana.diaPedido(vence, 'America/Bogota', ahora), 'Hoy', 'vence hoy en la sede')
const t = textos.textosCorreoRecordatorioPago({
  orderNumber: 'W-120',
  nombreTienda: 'Tienda Norte',
  total: 125000,
  hasta: hora,
  mismoDia: true,
})
igual(t.asunto, 'Termina tu pago del pedido W-120 — Tienda Norte', 'asunto')
igual(t.titulo, 'Termina tu pago', 'título')
igual(t.boton, 'Pagar ahora', 'botón')
check(t.mensajeHtml.includes('$125.000'), `el total va en pesos: ${t.mensajeHtml}`)
check(t.mensajeHtml.includes('Apartamos tus productos hasta las <strong>3:18 p. m.</strong>'), `apartado hasta la hora: ${t.mensajeHtml}`)
const una = textos.textosCorreoRecordatorioPago({ orderNumber: 'W-1', nombreTienda: '', total: 1, hasta: '1:05 p. m.', mismoDia: true, esRestaurante: true })
check(una.mensajeHtml.includes('Guardamos tu pedido hasta la <strong>1:05 p. m.</strong>'), `restaurante y «la 1»: ${una.mensajeHtml}`)
igual(una.asunto, 'Termina tu pago del pedido W-1', 'sin tienda no queda el guion colgando')
const otroDia = textos.textosCorreoRecordatorioPago({ orderNumber: 'W-2', nombreTienda: 'T', total: 1, hasta: '25 nov · 9:00 a. m.', mismoDia: false })
check(otroDia.mensajeHtml.includes('hasta el <strong>25 nov · 9:00 a. m.</strong>'), 'si vence otro día, fecha y hora')
const inyeccion = textos.textosCorreoRecordatorioPago({ orderNumber: '<b>\r\nBcc: x', nombreTienda: 'T\nBcc: y', total: 1, hasta: '<i>', mismoDia: true })
check(!inyeccion.mensajeHtml.includes('<b>') && !inyeccion.mensajeHtml.includes('<i>'), 'número y hora no entran como HTML')
check(!/[\r\n]/.test(inyeccion.asunto), 'el asunto no parte el encabezado')

// Enlace del botón: página del pedido con su token.
const ruta = token.rutaSeguimiento(7, { id: '11111111-1111-1111-1111-111111111111', order_number: 'W-120' })
check(ruta.startsWith('/pedido/W-120?t='), 'el botón abre /pedido/<n> con el token')
check(token.tokenSeguimientoValido(7, '11111111-1111-1111-1111-111111111111', new URLSearchParams(ruta.split('?')[1]).get('t')), 'el token abre ese pedido')

// ── «Recibimos tu pedido» por tipo de negocio ───────────────────────────────
const comercio = textos.textosCorreoRecibido({ orderNumber: 'W-9' })
check(!comercio.mensajeHtml.includes('restaurante'), 'una tienda que no es restaurante no habla de restaurante')
check(comercio.mensajeHtml.includes('lo estamos revisando') && comercio.mensajeHtml.includes('cuando lo confirmemos'), `comercio: ${comercio.mensajeHtml}`)
igual(comercio.boton, 'Seguir mi pedido', 'comercio: botón de seguimiento')
const resto = textos.textosCorreoRecibido({ orderNumber: 'W-9', esRestaurante: true })
check(resto.mensajeHtml.includes('llegó al restaurante'), 'restaurante: el texto de siempre')
const porPagar = textos.textosCorreoRecibido({ orderNumber: 'W-9', faltaPagoEnLinea: true })
check(porPagar.mensajeHtml.includes('falta tu pago') && !porPagar.mensajeHtml.includes('restaurante'), `pasarela pendiente en comercio: ${porPagar.mensajeHtml}`)
igual(porPagar.boton, 'Ver mi pedido y pagar', 'pasarela pendiente: el botón lleva a pagar')
const porPagarResto = textos.textosCorreoRecibido({ orderNumber: 'W-9', faltaPagoEnLinea: true, esRestaurante: true })
check(porPagarResto.mensajeHtml.includes('falta tu pago') && porPagarResto.mensajeHtml.includes('el restaurante lo confirma'), 'pasarela pendiente en restaurante')
check(!textos.textosCorreoRecibido({ orderNumber: '<script>' }).mensajeHtml.includes('<script>'), 'el número no entra como HTML')

// ── Fuente ──────────────────────────────────────────────────────────────────
const leer = (r) => readFile(join(ROOT, r), 'utf8')
const correo = await leer('lib/email/send-order-confirmation.ts')
const cron = await leer('app/api/cron/recordatorio-pago/route.ts')
const corrida = await leer('lib/orders/procesarRecordatoriosPago.ts')
const envio = await leer('lib/orders/correoRecordatorioPago.ts')
const registro = await leer('lib/email/registrarCorreoPedido.ts')
const pedidos = await leer('app/api/orders/route.ts')
const estado = await leer('lib/email/send-order-status-email.ts')
const vercel = JSON.parse(await leer('vercel.json'))

check(!correo.includes('llegó al restaurante'), 'el sobre del correo ya no fija «llegó al restaurante»')
check(correo.includes('textosCorreoRecibido') && correo.includes('textosCorreoRecordatorioPago'), 'el sobre usa los textos puros')
check(!estado.includes('El restaurante no pudo aceptar'), 'el correo de estado rechazado no habla de restaurante')
check(pedidos.includes('esRestaurante: contexto.esRestaurante') && pedidos.includes('faltaPagoEnLinea,'), 'el pedido nuevo pasa el tipo de negocio y el pago pendiente')
check(pedidos.includes('consultarMetodoPasarela(') && pedidos.includes('.catch(() => false)'), 'si la consulta del método falla, el correo sale como antes')
check(cron.includes('cronAutorizado') && cron.includes('otroProyecto()'), 'el cron falla cerrado y el otro proyecto no envía')
// Lo programa pg_cron cada 5 minutos ('recordatorio-pago-sitio', migración del ERP
// 20261124171000_cron_recordatorio_pago.sql), como la compra pendiente: no va en vercel.json.
check(!(vercel.crons || []).some((c) => c.path === '/api/cron/recordatorio-pago'), 'el recordatorio no va en vercel.json (lo llama pg_cron)')
check(!(vercel.crons || []).some((c) => c.path === '/api/cron/carritos-abandonados'), 'la compra pendiente sigue fuera de vercel.json')
check(corrida.indexOf('reclamarCorreoPedido(') < corrida.indexOf('enviarRecordatorioPago(sb'), 'se reclama antes de enviar')
check(corrida.includes("'23514'") && corrida.includes('tipo_no_admitido'), 'sin el tipo en la base no se envía nada')
check(corrida.includes('ganaReclamo('), 'se comprueba que el reclamo es de esta corrida')
check(corrida.includes('fn_web_order_plazo_minutos') && corrida.includes('fn_web_order_metodo_nativo'), 'el plazo y la pasarela salen de la base')
check(corrida.includes('.limit(FILAS_RECORDATORIO)') && corrida.includes(".eq('source', 'website')"), 'una consulta acotada por corrida')
check(corrida.includes('claveResend') && !corrida.includes('process.env.RESEND_API_KEY'), 'la clave sale de claveResend')
check(envio.includes('rutaSeguimiento(') && envio.includes('cargarMarcaPedido(') && envio.includes('origenSitio('), 'el correo lleva la marca, el dominio y el token')
check(envio.includes("pedido.status === 'pending'"), 'antes de enviar se vuelve a mirar el pedido')
check(registro.includes("'recordatorio_pago'"), 'el registro conoce el tipo nuevo')

if (problemas.length > 0) {
  console.error(`verify-recordatorio-pago: ${problemas.length} problemas en ${casos} casos`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-recordatorio-pago: ${casos} casos bien`)
