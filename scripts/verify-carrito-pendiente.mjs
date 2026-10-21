/**
 * verify-carrito-pendiente.mjs — a quién se le escribe, y qué dice el correo.
 *
 *   npm run verify:carrito-pendiente
 *
 * Sin base de datos. Carga las funciones puras y comprueba:
 * - un pedido de pasarela, dos horas después, sí se escribe;
 * - efectivo, mesa, sin correo y quien ya pagó después, no;
 * - fuera de las 48 horas no entra (y ese motivo no se sella);
 * - el asunto, el párrafo y el botón son los de la compra pendiente;
 * - el correo de pago confirmado sigue diciendo lo de antes.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-carrito-pendiente-'))
let reglas
let textos
let token
try {
  const estados = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/orders/estados-pedido.ts'), 'utf8'), { mode: 'strip' })
  const compra = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/orders/compraPendiente.ts'), 'utf8'), { mode: 'strip' })
    .replaceAll("from '@/lib/orders/estados-pedido'", "from './estados-pedido.mjs'")
  const textosSrc = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/email/textosCorreoPedido.ts'), 'utf8'), { mode: 'strip' })
  process.env.ORDER_TRACKING_SECRET = 'secreto-de-prueba-para-el-enlace'
  const tokenSrc = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/orders/tokenSeguimiento.ts'), 'utf8'), { mode: 'strip' })
  await writeFile(join(dir, 'estados-pedido.mjs'), estados)
  await writeFile(join(dir, 'compraPendiente.mjs'), compra)
  await writeFile(join(dir, 'textosCorreoPedido.mjs'), textosSrc)
  await writeFile(join(dir, 'tokenSeguimiento.mjs'), tokenSrc)
  reglas = await import(pathToFileURL(join(dir, 'compraPendiente.mjs')).href)
  textos = await import(pathToFileURL(join(dir, 'textosCorreoPedido.mjs')).href)
  token = await import(pathToFileURL(join(dir, 'tokenSeguimiento.mjs')).href)
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

const ahora = new Date('2026-10-20T15:00:00.000Z')
const hora = 60 * 60 * 1000
function iso(deltaMs) {
  return new Date(ahora.getTime() - deltaMs).toISOString()
}

function pedido(parcial) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 7,
    status: 'expired',
    paymentStatus: 'failed',
    paymentMethod: 'wompi',
    source: 'website',
    email: 'cliente@ejemplo.com',
    deliveryType: 'delivery_own',
    restaurantTableId: null,
    notasInternas: null,
    cancelledAt: iso(2 * hora),
    createdAt: iso(3 * hora),
    yaEnviado: false,
    ...parcial,
  }
}

const pasarela = [{ organizationId: 7, code: 'wompi', sinPasarela: false }]
const motivo = (p, metodos = pasarela, pagos = []) => reglas.motivoNoEscribir(p, ahora, metodos, pagos)

igual(reglas.decisionRetoma('expired', 'failed'), 'retomar', 'cancelado o expirado sin pago: se rearma')
igual(reglas.decisionRetoma('cancelled', 'failed'), 'retomar', 'cancelado sin pago: se rearma')
igual(reglas.decisionRetoma('delivered', 'paid'), 'pagado', 'pagado: no se rearma')
igual(reglas.decisionRetoma('pending', 'pending'), 'en_curso', 'un pago en curso no abre otro carrito')
igual(reglas.decisionRetoma('preparing', 'failed'), 'en_curso', 'un pedido en preparación no abre otro carrito')

igual(motivo(pedido()), null, 'pasarela, dos horas después, se escribe')
igual(motivo(pedido({ cancelledAt: iso(2 * hora - 1) })), 'fuera_de_ventana', 'antes de las dos horas no')
igual(motivo(pedido({ cancelledAt: iso(48 * hora) })), null, 'a las 48 horas todavía entra')
igual(motivo(pedido({ cancelledAt: iso(48 * hora + 1) })), 'fuera_de_ventana', 'después de 48 horas no entra')
check(!reglas.MOTIVOS_SELLADOS.includes('fuera_de_ventana'), 'lo que quedó fuera de la ventana no se sella')

igual(motivo(pedido({ email: '' })), 'sin_correo', 'sin correo no')
igual(motivo(pedido({ email: 'no-es-correo' })), 'sin_correo', 'correo ilegible no')
igual(motivo(pedido({ source: 'pos' })), 'no_es_sitio', 'un pedido que no salió del sitio no')
igual(motivo(pedido({ status: 'pending' })), 'estado', 'un pedido que sigue pendiente no')
igual(motivo(pedido({ paymentStatus: 'pending' })), 'pago', 'un pago que no falló no')
igual(motivo(pedido({ paymentMethod: 'cash' })), 'nativo', 'efectivo no')
igual(motivo(pedido({ paymentMethod: 'transfer' })), 'nativo', 'transferencia no')
igual(motivo(pedido({ paymentMethod: 'mesa' })), 'nativo', 'pagar en la mesa no')
igual(motivo(pedido({ paymentMethod: '' })), 'nativo', 'sin método no es pasarela')
igual(
  motivo(pedido({ paymentMethod: 'contraentrega' }), [{ organizationId: 7, code: 'contraentrega', sinPasarela: true }]),
  'nativo',
  'un método sin conexión de pasarela no',
)
igual(motivo(pedido({ paymentMethod: 'wompi' }), [{ organizationId: 7, code: 'wompi', sinPasarela: false }]), null, 'wompi con conexión sí')
igual(motivo(pedido({ deliveryType: 'dine_in' })), 'mesa', 'comer aquí no')
igual(motivo(pedido({ restaurantTableId: '22222222-2222-2222-2222-222222222222' })), 'mesa', 'con mesa no')
igual(motivo(pedido({ deliveryType: 'pickup', notasInternas: '[Comer aquí] Mesa: 4' })), 'mesa', 'la ronda guardada como recoger no')
igual(motivo(pedido({ yaEnviado: true })), 'ya_enviado', 'una sola vez')

const pagoDespues = {
  id: '33333333-3333-3333-3333-333333333333',
  organizationId: 7,
  email: 'Cliente@ejemplo.com',
  createdAt: iso(1 * hora),
}
igual(motivo(pedido(), pasarela, [pagoDespues]), 'ya_pago_despues', 'si ese correo pagó después, no')
igual(
  motivo(pedido(), pasarela, [{ ...pagoDespues, organizationId: 8 }]),
  null,
  'un pago en otra organización no cuenta',
)
igual(
  motivo(pedido(), pasarela, [{ ...pagoDespues, id: pedido().id, createdAt: iso(1 * hora) }]),
  null,
  'el mismo pedido no cuenta como otro pago',
)

const destino = reglas.destinoRetomar(
  { id: 4, slug: 'Norte', publicada: true },
  ['checkout', 'retomar'],
)
igual(destino, { ruta: '/norte/checkout', branchId: 4 }, 'sede publicada: checkout de esa sede')
igual(
  reglas.destinoRetomar({ id: 4, slug: 'retomar', publicada: true }, ['retomar']),
  { ruta: '/checkout', branchId: null },
  'un slug reservado no es sede',
)
igual(
  reglas.destinoRetomar({ id: 4, slug: 'norte', publicada: false }, []),
  { ruta: '/checkout', branchId: null },
  'sede no publicada: checkout del sitio',
)

const linea = reglas.lineaRetoma({
  productId: 9,
  nombre: 'Pan',
  precioUnitario: 3500.5,
  cantidad: 1.5,
  sku: 'PAN',
  modificadores: [{ groupId: 1, groupName: 'Extra', modifierId: 2, name: 'Queso', extraPrice: 500 }],
  sinPrecio: [],
  notas: 'sin cebolla',
})
igual(linea.quantity, 1.5, 'la cantidad por peso se conserva')
igual(linea.unitPrice, 3500.5, 'el precio es el recalculado')
igual(linea.modifiers[0].modifierId, 2, 'la opción viaja para que el checkout la vuelva a cobrar')
check(reglas.lineaRetoma({
  productId: 0, nombre: 'X', precioUnitario: 1, cantidad: 1, sku: null, modificadores: [], sinPrecio: [], notas: null,
}) === null, 'sin producto no hay línea')

igual(
  reglas.datosClienteRetomar('Ana María López', 'ana@ejemplo.com', '300'),
  { firstName: 'Ana', lastName: 'María López', email: 'ana@ejemplo.com', phone: '300' },
  'el nombre del pedido se parte para el checkout',
)

const copia = textos.textosCorreoCompraPendiente({ orderNumber: 'A-1', nombreTienda: 'Tienda Norte' })
igual(copia.titulo, 'Tu compra quedó pendiente', 'título')
igual(copia.boton, 'Retomar mi compra', 'botón')
igual(copia.asunto, 'Tu compra quedó pendiente — Tienda Norte', 'asunto con la tienda')
check(copia.mensajeHtml.includes('no se completó') && copia.mensajeHtml.includes('siguen disponibles'), 'el párrafo dice que no se completó')
check(copia.mensajeHtml.includes('<strong>A-1</strong>'), 'el número va en el párrafo')

const inyeccion = textos.textosCorreoCompraPendiente({
  orderNumber: '<script>',
  nombreTienda: 'Tienda\r\nBcc: otro@ejemplo.com',
})
check(!inyeccion.mensajeHtml.includes('<script>'), 'el número no entra como HTML')
check(!inyeccion.asunto.includes('\n') && !inyeccion.asunto.includes('\r'), 'el asunto no parte el encabezado')
igual(inyeccion.asunto, 'Tu compra quedó pendiente — Tienda Bcc: otro@ejemplo.com', 'el salto de línea del nombre se aplana')

const ruta = token.rutaRetomar(7, '11111111-1111-1111-1111-111111111111')
check(typeof ruta === 'string' && ruta.startsWith('/retomar/11111111-1111-1111-1111-111111111111?t='), 'el enlace lleva el id y el token')
const t = new URLSearchParams(ruta.split('?')[1]).get('t')
check(token.tokenSeguimientoValido(7, '11111111-1111-1111-1111-111111111111', t), 'el token abre ese pedido')
check(!token.tokenSeguimientoValido(8, '11111111-1111-1111-1111-111111111111', t), 'el token no sirve en otra organización')

const correo = await readFile(join(ROOT, 'lib/email/send-order-confirmation.ts'), 'utf8')
check(correo.includes('¡Pago confirmado!'), 'el pago confirmado conserva su título')
check(correo.includes('Recibimos tu pedido'), 'el pedido recibido conserva su título')
check(correo.includes('Seguir mi pedido'), 'el botón de seguimiento sigue')
check(correo.includes('compraPendiente') && correo.includes('textosCorreoCompraPendiente'), 'el pendiente usa los textos nuevos')
check(correo.includes('!data.compraPendiente && (data.tipoEntrega'), 'el pendiente no anuncia la entrega')

const cron = await readFile(join(ROOT, 'app/api/cron/carritos-abandonados/route.ts'), 'utf8')
const cola = await readFile(join(ROOT, 'lib/orders/procesarColaCompraPendiente.ts'), 'utf8')
const minuto = await readFile(join(ROOT, 'app/api/revalidate/sitios-v2/route.ts'), 'utf8')
const authCron = await readFile(join(ROOT, 'lib/orders/cronAutorizado.ts'), 'utf8')
const clave = await readFile(join(ROOT, 'lib/orders/claveResend.ts'), 'utf8')
check(cola.includes('VENTANA_COMPRA_PENDIENTE_MS') && cola.includes('ESPERA_COMPRA_PENDIENTE_MS'), 'la cola usa la espera y la ventana')
check(cola.includes('abandoned_email_sent_at'), 'la cola sella el pedido')
check(cola.includes('claveResend') && !cola.includes('process.env.RESEND_API_KEY'), 'la cola no se rinde si falta la variable de entorno')
check(clave.includes('fn_leer_secreto_vault') && clave.includes('resend_api_key'), 'la clave también se lee del vault')
check(!clave.includes('console.log') && !clave.includes('console.error(data'), 'la clave no se escribe en el log')
check(cron.includes('cronAutorizado'), 'el cron de 15 minutos comprueba el secreto')
check(authCron.includes('CRON_SECRET') && authCron.includes('fn_secreto_vault_coincide'), 'el cron falla cerrado y acepta el secreto de la base')
check(cron.includes('procesarColaCompraPendiente'), 'el cron de 15 minutos usa la cola')
check(cola.includes("eq('source', 'website')"), 'la cola solo mira pedidos del sitio')
check(minuto.includes('procesarColaCompraPendiente') && minuto.includes('cronAutorizado'), 'el cron de cada minuto también decide la cola')

const vercel = await readFile(join(ROOT, 'vercel.json'), 'utf8')
check(vercel.includes('"/api/cron/carritos-abandonados"') && vercel.includes('"*/15 * * * *"'), 'el cron corre cada 15 minutos')
check(vercel.includes('"/api/revalidate/sitios-v2"') && vercel.includes('"* * * * *"'), 'el cron de cada minuto sigue declarado')

const slugs = await readFile(join(ROOT, 'lib/outlet/rutaSitio.ts'), 'utf8')
check(slugs.includes("'retomar'"), 'retomar está reservado: una sede no puede tapar el enlace')

if (problemas.length > 0) {
  console.error(`verify-carrito-pendiente: ${problemas.length} problemas en ${casos} casos`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-carrito-pendiente: ${casos} casos bien`)
