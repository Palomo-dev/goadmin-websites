/**
 * verify-consulta-pedido.mjs — consulta pública del pedido (Figma «21 Logística» › 10, 2026-11-24).
 *
 *   npm run verify:consulta-pedido
 *
 * Sin base de datos. Carga las reglas puras (`lib/orders/consultaPedido.ts`) y lee el fuente de
 * las rutas para comprobar:
 * - un solo estado arriba: «Pendiente · Pago pendiente» con «Confirmado» abajo ya no es posible;
 * - pasarela sin pagar → «Pagar»; pago rechazado → «Tu pago no pasó»; vencido → retomar;
 *   efectivo o transferencia → «Recibimos tu pedido» (sin botón de pagar);
 * - barra de 4 pasos para cada estado;
 * - «Sucursal 562» y parecidos no se muestran; un nombre real sí;
 * - el apartado = creación + plazo, y el texto de lo que falta;
 * - /api/checkout/init no cobra un pedido web cerrado (con su `else` de antes);
 * - la consulta ligera (cada 15 s) no relee productos, medios de pago ni factura;
 * - la consulta usa el plazo único de la base (`fn_web_order_plazo_minutos`).
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-consulta-pedido-'))
let c
try {
  const estados = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/orders/estados-pedido.ts'), 'utf8'), { mode: 'strip' })
  const consulta = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/orders/consultaPedido.ts'), 'utf8'), { mode: 'strip' })
    .replaceAll("from '@/lib/orders/estados-pedido'", "from './estados-pedido.mjs'")
  await writeFile(join(dir, 'estados-pedido.mjs'), estados)
  await writeFile(join(dir, 'consultaPedido.mjs'), consulta)
  c = await import(pathToFileURL(join(dir, 'consultaPedido.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

let casos = 0
function caso(nombre, fn) {
  fn()
  casos++
  console.log(`  ✓ ${nombre}`)
}

console.log('Consulta del pedido')

caso('pasarela sin pagar: «Pagar», no «Pendiente» con «Confirmado»', () => {
  const v = c.vistaPedido({ status: 'pending', paymentStatus: 'pending', esPasarela: true })
  assert.equal(v, 'pagar')
  const e = c.encabezadoPedido(v, { nombre: 'Ana Gómez', pagado: false, deliveryType: 'delivery_own', esRestaurante: false, status: 'pending' })
  assert.equal(e.insignia, 'Esperando tu pago')
  assert.equal(e.titulo, 'Falta tu pago para confirmar el pedido')
  const pasos = c.pasosPedido(v, 'delivery_own', false)
  assert.deepEqual(pasos.map((p) => p.etiqueta), ['Pago', 'Confirmado', 'En camino', 'Entregado'])
  assert.equal(pasos[0].estado, 'actual')
  assert.ok(pasos.slice(1).every((p) => p.estado === 'pendiente'), 'nada «Confirmado» mientras falta el pago')
})

caso('pago rechazado y pedido vencido', () => {
  assert.equal(c.vistaPedido({ status: 'pending', paymentStatus: 'failed', esPasarela: true }), 'pago_fallido')
  assert.equal(c.pasosPedido('pago_fallido', 'delivery_own', false)[0].estado, 'error')
  assert.equal(c.vistaPedido({ status: 'expired', paymentStatus: 'failed', esPasarela: true }), 'vencido')
  assert.equal(c.encabezadoPedido('vencido', { nombre: '', pagado: false, deliveryType: 'pickup', esRestaurante: false, status: 'expired' }).titulo, 'Se venció el plazo para pagar')
})

caso('efectivo o transferencia: «Recibimos tu pedido», sin pagar en línea', () => {
  assert.equal(c.vistaPedido({ status: 'pending', paymentStatus: 'pending', esPasarela: false }), 'recibido')
  assert.match(c.encabezadoPedido('recibido', { nombre: 'Ana Gómez', pagado: false, deliveryType: 'delivery_own', esRestaurante: false, status: 'pending' }).titulo, /Ana! Recibimos/)
})

caso('pagado y en preparación, en camino, entregado y cancelado', () => {
  assert.equal(c.vistaPedido({ status: 'confirmed', paymentStatus: 'paid', esPasarela: true }), 'preparando')
  const e = c.encabezadoPedido('preparando', { nombre: 'Ana Gómez', pagado: true, deliveryType: 'delivery_own', esRestaurante: false, status: 'confirmed' })
  assert.equal(e.insignia, 'Pago recibido')
  assert.equal(c.vistaPedido({ status: 'in_delivery', paymentStatus: 'paid', esPasarela: true }), 'en_camino')
  assert.equal(c.vistaPedido({ status: 'delivered', paymentStatus: 'paid', esPasarela: true }), 'entregado')
  assert.ok(c.pasosPedido('entregado', 'delivery_own', false).every((p) => p.estado === 'hecho'))
  assert.equal(c.encabezadoPedido('entregado', { nombre: '', pagado: true, deliveryType: 'pickup', esRestaurante: false, status: 'delivered' }).insignia, 'Recogido')
  assert.equal(c.vistaPedido({ status: 'cancelled', paymentStatus: 'pending', esPasarela: true }), 'cancelado')
  assert.equal(c.encabezadoPedido('cancelado', { nombre: '', pagado: false, deliveryType: 'pickup', esRestaurante: false, status: 'refunded' }).insignia, 'Reembolsado')
})

caso('cada vista tiene 4 pasos', () => {
  for (const v of ['pagar', 'pago_fallido', 'vencido', 'recibido', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado']) {
    for (const tipo of ['delivery_own', 'pickup', 'dine_in']) {
      assert.equal(c.pasosPedido(v, tipo, tipo === 'dine_in').length, 4, `${v}/${tipo}`)
    }
  }
})

caso('recoger en tienda «Listo»: Listo es el paso actual y Recogido queda pendiente (2026-11-24)', () => {
  for (const [tipo, final, medio] of [['pickup', 'Recogido', 'Listo'], ['dine_in', 'Servido', 'Listo'], ['delivery_own', 'Entregado', 'En camino']]) {
    const pasos = c.pasosPedido('listo', tipo, false, tipo === 'dine_in' ? 'Mesa 4' : null)
    assert.deepEqual(pasos.map((p) => p.estado), ['hecho', 'hecho', 'actual', 'pendiente'], tipo)
    assert.equal(pasos[2].etiqueta, medio, tipo)
    assert.equal(pasos[3].etiqueta, final, tipo)
  }
  // Recoger en tienda en todos los estados: nunca un paso de color DESPUÉS de uno gris.
  for (const v of ['pagar', 'pago_fallido', 'vencido', 'recibido', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado']) {
    const estados = c.pasosPedido(v, 'pickup', false).map((p) => p.estado)
    const primeroPendiente = estados.indexOf('pendiente')
    if (primeroPendiente >= 0) assert.ok(estados.slice(primeroPendiente).every((e) => e === 'pendiente'), `${v}: ${estados.join(',')}`)
  }
  assert.ok(c.pasosPedido('entregado', 'pickup', false).every((p) => p.estado === 'hecho'))
})

caso('motivo de cancelación: nunca códigos de pasarela ni notas internas', () => {
  const rechazo = 'El pago no fue aprobado. No se hizo ningún cobro.'
  for (const m of [
    'Pago rechazado por Bold: SALE_REJECTED',
    'Pago rechazado por Bold: REJECTED',
    'Pago rechazado por Wompi: DECLINED',
    'Pago rechazado por Wompi: ERROR',
    'Pago rechazado por Mercado Pago: rejected · cc_rejected_high_risk',
    'Pago rechazado por PayU: DECLINED (5) Transacción rechazada',
    'Pago rechazado por Stripe: payment_intent.payment_failed (card_declined)',
  ]) {
    const t = c.motivoCancelacionPublico(m, 'failed')
    assert.equal(t, rechazo, m)
    assert.doesNotMatch(t, /bold|wompi|mercado|payu|stripe|SALE_|DECLINED|ERROR|rejected/i)
  }
  assert.equal(c.motivoCancelacionPublico('Expirado por falta de pago', 'failed'), 'El pedido no se pagó a tiempo. No se hizo ningún cobro.')
  assert.equal(c.motivoCancelacionPublico('Anticipo sin pagar', 'failed'), 'El anticipo no se pagó a tiempo. No se hizo ningún cobro.')
  // Notas internas o desconocidas: nada (la pantalla pone su frase de siempre).
  assert.equal(c.motivoCancelacionPublico('prueba', 'pending'), null)
  assert.equal(c.motivoCancelacionPublico('Cliente pidió cancelar por WhatsApp, devolver a caja 2', 'pending'), null)
  assert.equal(c.motivoCancelacionPublico('', 'failed'), null)
  assert.equal(c.motivoCancelacionPublico(null, 'failed'), null)
  // Pagado: la frase de la devolución, nunca «no se hizo ningún cobro».
  assert.equal(c.motivoCancelacionPublico('Pago rechazado por Wompi: ERROR', 'paid'), null)
})

caso('nombre público de la sede', () => {
  assert.equal(c.nombrePublicoSede('Sucursal 562'), null)
  assert.equal(c.nombrePublicoSede('sede #3'), null)
  assert.equal(c.nombrePublicoSede('Bodega 2'), null)
  assert.equal(c.nombrePublicoSede('  '), null)
  assert.equal(c.nombrePublicoSede('Tienda Centro'), 'Tienda Centro')
  assert.equal(c.nombrePublicoSede('Sucursal Norte'), 'Sucursal Norte')
})

caso('apartado y tiempo restante', () => {
  assert.equal(c.apartadoHasta('2026-11-24T12:25:54.000Z', 30), '2026-11-24T12:55:54.000Z')
  assert.equal(c.apartadoHasta(null, 30), null)
  assert.equal(c.apartadoHasta('2026-11-24T12:25:54.000Z', 0), null)
  const ahora = Date.parse('2026-11-24T12:00:00.000Z')
  assert.equal(c.minutosRestantes('2026-11-24T12:58:30.000Z', ahora), 58)
  assert.equal(c.minutosRestantes('2026-11-24T11:00:00.000Z', ahora), 0)
  assert.equal(c.textoRestante(58), 'Quedan 58 minutos.')
  assert.equal(c.textoRestante(190), 'Quedan 3 h 10 min.')
  assert.equal(c.textoRestante(0), 'Queda menos de un minuto.')
})

const init = await readFile(join(ROOT, 'app/api/checkout/init/route.ts'), 'utf8')
caso('/api/checkout/init no cobra un pedido web cerrado, y deja lo demás igual', () => {
  assert.match(init, /esPedidoWeb && ESTADOS_SIN_ENTREGA\.has\(String\(order\.status \|\| ''\)\)/)
  assert.match(init, /code: 'PEDIDO_CERRADO'/)
  assert.match(init, /\} else \{\s*\/\/ Pedido abierto u otra fuente de cobro: sigue como antes\./)
})

const tracking = await readFile(join(ROOT, 'app/api/orders/[id]/tracking/route.ts'), 'utf8')
caso('la consulta ligera no relee productos, medios de pago ni factura', () => {
  assert.match(tracking, /porPagar && !ligero \? getWebsitePaymentMethods\(orgId\)/)
  assert.match(tracking, /ligero\s*\?\s*Promise\.resolve\(\{ data: null, error: null \}\)\s*:\s*supabase\s*\.from\('web_order_items'\)/)
  assert.match(tracking, /verificado && !ligero && order\.sale_id/)
})

caso('el motivo de cancelación sale por el filtro público (sin «SALE_REJECTED» al comprador)', () => {
  assert.match(tracking, /cancellationReason: ESTADOS_SIN_ENTREGA\.has\(order\.status\) \? motivoCancelacionPublico\(order\.cancellation_reason, order\.payment_status\) : null/)
  assert.doesNotMatch(tracking, /cancellationReason: [^\n]*\? order\.cancellation_reason\b/)
})

caso('el apartado sale del plazo único de la base y la sede pasa por el filtro público', () => {
  assert.match(tracking, /rpc\('fn_web_order_plazo_minutos'/)
  assert.match(tracking, /sede: nombrePublicoSede\(sede\?\.name\)/)
})

const tracker = await readFile(join(ROOT, 'app/pedido/[id]/OrderTracker.tsx'), 'utf8')
caso('la pantalla paga con /api/checkout/init y la consulta repetida es ligera', () => {
  assert.match(tracker, /fetch\('\/api\/checkout\/init'/)
  assert.match(tracker, /ligero=1/)
  assert.doesNotMatch(tracker, /📋|✅|🎉/, 'sin emojis en la barra de pasos')
})

caso('final de la página (opción A, Figma 3067:82354): sin «Actualizar» suelto, «Seguir comprando» a todo el ancho y la línea «Se actualiza solo»', () => {
  assert.doesNotMatch(tracker, /<RefreshCw className="h-3\.5 w-3\.5 mr-1" \/> Actualizar/)
  assert.match(tracker, /<Enlace\s+href=\{rutaSeguirPidiendo\}\s+className="flex w-full/)
  assert.match(tracker, /\{!isFinal && \(\s*<LineaActualiza/)
  assert.match(tracker, /Se actualiza solo/)
  // «Seguir comprando» es lo último de la página: después solo cierran los contenedores.
  assert.match(tracker, /'Seguir pidiendo'\}\s*<\/Enlace>\s*<\/div>\s*<\/div>\s*\)\s*\}\s*$/)
})

console.log(`\n${casos} casos OK`)
