/**
 * verify-pasarelas-bold-mp.mjs — Bold y Mercado Pago confirman pedidos de la tienda.
 *
 *   npm run verify:pasarelas-bold-mp
 *
 * Sin base ni red: importa los módulos reales con una base simulada en memoria y un `fetch` falso.
 * (No reemplaza la prueba con llaves de prueba de cada proveedor: esa necesita sus credenciales.)
 *
 * Casos:
 *  1. Firma de Bold: la forma documentada (HMAC-SHA256 del cuerpo en Base64 con la llave secreta)
 *     y la del cuerpo crudo; sin firma, sin llave o con otra llave, nunca pasa.
 *  2. Estados: Bold (eventos y consulta) y Mercado Pago; VOID_REJECTED y «authorized» no cambian nada.
 *  3. Monto: un aprobado por menos del total no cubre el pedido.
 *  4. URL de aviso de Mercado Pago: solo hosts públicos, con la organización como pista.
 *  5. `firmanteBold`: la organización sale de la llave que firmó, nunca del cuerpo.
 *  6. `aplicarPagoPedidoWeb`: transición única, nunca bajar de pagado, ERP/correo una sola vez,
 *     reembolso solo desde pagado, monto insuficiente sin cambios.
 *  7. Consultas de /checkout/resultado (Mercado Pago y Bold) con su autenticación correcta.
 *  8. Las rutas usan todo lo anterior (firma antes de tocar nada; pedido filtrado por organización).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { createHmac } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})

const reglas = await import('../lib/payments/pasarelasTienda.ts')
const { firmanteBold, BOLD_CONECTOR_LINK_ID, BOLD_CONECTOR_POS_ID } = await import('../lib/payments/firmanteBold.ts')
const { aplicarPagoPedidoWeb } = await import('../lib/payments/pagoPedidoWeb.ts')
const { consultarMercadoPago, consultarBold } = await import('../lib/payments/consultaPasarelaTienda.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const efectos = () => globalThis.__efectosPago ?? []
const contar = (nombre) => efectos().filter((e) => e.nombre === nombre).length
const silenciar = async (fn) => {
  const [log, warn, error] = [console.log, console.warn, console.error]
  console.log = console.warn = console.error = () => {}
  try {
    return await fn()
  } finally {
    Object.assign(console, { log, warn, error })
  }
}

// ─── Base simulada (subconjunto de PostgREST que usan estos módulos) ────────
function condicionOr(texto) {
  const partes = []
  let nivel = 0
  let actual = ''
  for (const c of texto) {
    if (c === '(') nivel++
    if (c === ')') nivel--
    if (c === ',' && nivel === 0) {
      partes.push(actual)
      actual = ''
    } else actual += c
  }
  partes.push(actual)
  const pruebas = partes.map((p) => {
    const [col, op, ...resto] = p.split('.')
    const valor = resto.join('.')
    if (op === 'is' && valor === 'null') return (f) => f[col] == null
    if (op === 'eq') return (f) => String(f[col]) === valor
    if (op === 'neq') return (f) => String(f[col]) !== valor
    if (op === 'in') return (f) => valor.replace(/[()]/g, '').split(',').includes(String(f[col]))
    throw new Error(`condición no soportada: ${p}`)
  })
  return (f) => pruebas.some((t) => t(f))
}

function baseFalsa(tablas) {
  const registro = { inserts: [], updates: [] }
  const from = (tabla) => {
    const filas = (tablas[tabla] ??= [])
    const filtros = []
    let modo = 'select'
    let valores = null
    let conSelect = false
    let unico = null
    let limite = null
    const q = {
      select() { conSelect = true; return q },
      eq(c, v) { filtros.push((f) => f[c] === v); return q },
      in(c, vs) { filtros.push((f) => vs.includes(f[c])); return q },
      is(c, v) { filtros.push((f) => (v === null ? f[c] == null : f[c] === v)); return q },
      or(cond) { filtros.push(condicionOr(cond)); return q },
      order() { return q },
      limit(n) { limite = n; return q },
      single() { unico = 'single'; return q },
      maybeSingle() { unico = 'maybe'; return q },
      update(v) { modo = 'update'; valores = v; return q },
      insert(v) { modo = 'insert'; valores = v; return q },
      then(ok, ko) { return Promise.resolve(ejecutar()).then(ok, ko) },
    }
    const ejecutar = () => {
      if (modo === 'insert') {
        for (const v of [].concat(valores)) filas.push({ id: `${tabla}-${filas.length + 1}`, ...v })
        registro.inserts.push({ tabla, valores })
        return { data: null, error: null }
      }
      let sel = filas.filter((f) => filtros.every((fn) => fn(f)))
      if (modo === 'update') {
        sel.forEach((f) => Object.assign(f, valores))
        registro.updates.push({ tabla, valores, filas: sel.length })
        return { data: conSelect ? sel.map((f) => ({ id: f.id })) : null, error: null }
      }
      if (limite != null) sel = sel.slice(0, limite)
      if (unico === 'single') return sel.length === 1 ? { data: sel[0], error: null } : { data: null, error: { code: 'PGRST116' } }
      if (unico === 'maybe') return { data: sel[0] ?? null, error: null }
      return { data: sel, error: null }
    }
    return q
  }
  return { from, rpc: async () => ({ data: null, error: null }), registro, tablas }
}

// ─── 1. Firma de Bold ──────────────────────────────────────────────────────
const cuerpo = Buffer.from(JSON.stringify({ type: 'SALE_APPROVED', data: { payment_id: 'TX1', metadata: { reference: 'WO-1' } } }))
const firmaDoc = (llave, c = cuerpo) => createHmac('sha256', llave).update(Buffer.from(c).toString('base64')).digest('hex')
const firmaCruda = (llave, c = cuerpo) => createHmac('sha256', llave).update(c).digest('hex')
check(reglas.firmaBoldValida(cuerpo, firmaDoc('llave-a'), 'llave-a'), '1a: la firma documentada (Base64) no pasa')
check(reglas.firmaBoldValida(cuerpo, firmaCruda('llave-a'), 'llave-a'), '1b: la firma del cuerpo crudo no pasa')
check(reglas.firmaBoldValida(cuerpo, firmaDoc('llave-a').toUpperCase(), 'llave-a'), '1c: la firma en mayúsculas no pasa')
check(!reglas.firmaBoldValida(cuerpo, firmaDoc('llave-b'), 'llave-a'), '1d: pasa con la firma de otra llave')
check(!reglas.firmaBoldValida(cuerpo, '', 'llave-a') && !reglas.firmaBoldValida(cuerpo, null, 'llave-a'), '1e: pasa sin firma')
check(!reglas.firmaBoldValida(cuerpo, firmaDoc(''), '') && !reglas.firmaBoldValida(cuerpo, firmaDoc('x'), null), '1f: pasa sin llave')
check(!reglas.firmaBoldValida(cuerpo, 'zz' + firmaDoc('llave-a').slice(2), 'llave-a'), '1g: pasa una firma que no es hexadecimal')
check(!reglas.firmaBoldValida(Buffer.from(cuerpo.toString().replace('WO-1', 'WO-2')), firmaDoc('llave-a'), 'llave-a'), '1h: pasa un cuerpo alterado')

// ─── 2. Estados ────────────────────────────────────────────────────────────
check(reglas.estadoEventoBold('SALE_APPROVED') === 'paid' && reglas.estadoEventoBold('SALE_REJECTED') === 'failed', '2a: eventos de venta de Bold')
check(reglas.estadoEventoBold('VOID_APPROVED') === 'refunded', '2b: anulación aprobada de Bold no es reembolso')
check(reglas.estadoEventoBold('VOID_REJECTED') === 'pending', '2c: una anulación rechazada cambia el pedido (la venta sigue aprobada)')
check(
  reglas.estadoComprobanteBold('APPROVED') === 'paid' &&
    reglas.estadoComprobanteBold('REJECTED') === 'failed' &&
    reglas.estadoComprobanteBold('FAILED') === 'failed' &&
    reglas.estadoComprobanteBold('VOIDED') === 'refunded' &&
    reglas.estadoComprobanteBold('NO_TRANSACTION_FOUND') === 'pending' &&
    reglas.estadoComprobanteBold('PROCESSING') === 'pending',
  '2d: estados de la consulta de Bold'
)
check(
  reglas.estadoMercadoPago('approved') === 'paid' &&
    reglas.estadoMercadoPago('rejected') === 'failed' &&
    reglas.estadoMercadoPago('cancelled') === 'failed' &&
    reglas.estadoMercadoPago('refunded') === 'refunded' &&
    reglas.estadoMercadoPago('charged_back') === 'refunded' &&
    reglas.estadoMercadoPago('in_process') === 'pending',
  '2e: estados de Mercado Pago'
)
check(reglas.estadoMercadoPago('authorized') === 'pending', '2f: «authorized» (sin capturar) marca pagado')

// ─── 3. Monto ──────────────────────────────────────────────────────────────
check(reglas.montoCubreTotal(50000, 50000) && reglas.montoCubreTotal(50000, '49999.6'), '3a: el monto exacto (o redondeado) no cubre')
check(reglas.montoCubreTotal(52000, 50000), '3b: un monto con propina no cubre')
check(!reglas.montoCubreTotal(1, 50000), '3c: un peso cubre un pedido de 50.000')
check(!reglas.montoCubreTotal(null, 50000) && !reglas.montoCubreTotal('x', 50000) && !reglas.montoCubreTotal(0, 0), '3d: un monto desconocido cubre')

// ─── 4. URL de aviso de Mercado Pago ───────────────────────────────────────
check(reglas.urlNotificacionMercadoPago('tienda.ejemplo.test', 389) === 'https://tienda.ejemplo.test/api/webhooks/mercadopago?org=389', '4a: URL de un dominio público')
check(reglas.urlNotificacionMercadoPago('Tienda.Ejemplo.test:443', 7) === 'https://tienda.ejemplo.test/api/webhooks/mercadopago?org=7', '4b: puerto y mayúsculas')
check(reglas.urlNotificacionMercadoPago('a.ejemplo.test, b.ejemplo.test', 7) === 'https://a.ejemplo.test/api/webhooks/mercadopago?org=7', '4c: x-forwarded-host con varios valores')
check(
  [null, '', 'localhost:3000', 'app.localhost', '127.0.0.1', 'sin-punto', 'malo/../x.test', 'x.test?y=1'].every((h) => reglas.urlNotificacionMercadoPago(h, 7) === null),
  '4d: arma URL para un host local o inválido'
)
check(reglas.urlNotificacionMercadoPago('tienda.ejemplo.test', 0) === null, '4e: arma URL sin organización')
check(reglas.organizacionDeAviso('389') === 389 && reglas.organizacionDeAviso('3x') === null && reglas.organizacionDeAviso('0') === null, '4f: pista de organización')

// ─── 5. firmanteBold ───────────────────────────────────────────────────────
{
  const db = baseFalsa({
    integration_connections: [
      { id: 'c1', organization_id: 101, connector_id: BOLD_CONECTOR_LINK_ID, status: 'active' },
      { id: 'c2', organization_id: 202, connector_id: BOLD_CONECTOR_LINK_ID, status: 'connected' },
      { id: 'c3', organization_id: 303, connector_id: BOLD_CONECTOR_POS_ID, status: 'active' },
      { id: 'c4', organization_id: 404, connector_id: BOLD_CONECTOR_LINK_ID, status: 'inactive' },
    ],
    integration_credentials: [
      { connection_id: 'c1', purpose: 'secret_key', secret_ref: 'llave-101', status: 'active' },
      { connection_id: 'c2', purpose: 'secret_key', secret_ref: 'llave-202', status: 'active' },
      { connection_id: 'c2', purpose: 'identity_key', secret_ref: 'id-202', status: 'active' },
      { connection_id: 'c3', purpose: 'secret_key', secret_ref: 'llave-303', status: 'active' },
      { connection_id: 'c4', purpose: 'secret_key', secret_ref: 'llave-404', status: 'active' },
    ],
  })
  const f202 = await firmanteBold(db, cuerpo, firmaDoc('llave-202'))
  check(f202?.organizationId === 202 && f202?.connectionId === 'c2', '5a: no identifica la organización por su llave')
  check((await firmanteBold(db, cuerpo, firmaDoc('llave-303')))?.organizationId === 303, '5b: no reconoce la llave del datáfono (eventos del POS)')
  check((await firmanteBold(db, cuerpo, firmaDoc('llave-404'))) === null, '5c: acepta la llave de una conexión inactiva')
  check((await firmanteBold(db, cuerpo, firmaDoc('id-202'))) === null, '5d: acepta la llave de identidad como firma')
  check((await firmanteBold(db, cuerpo, firmaDoc('otra'))) === null, '5e: acepta una llave desconocida')
  check((await firmanteBold(db, cuerpo, null)) === null, '5f: acepta un evento sin firma')
  check((await firmanteBold(baseFalsa({}), cuerpo, firmaDoc('llave-101'))) === null, '5g: sin conexiones de Bold acepta algo')
}

// ─── 6. aplicarPagoPedidoWeb ───────────────────────────────────────────────
const pedidoBase = (extra = {}) => ({ id: 'w1', organization_id: 101, branch_id: 5, total: 50000, payment_status: 'pending', status: 'pending', order_number: 'WO-1', ...extra })
const resultado = (extra = {}) => ({
  estado: 'paid',
  transaccionId: 'TX1',
  monto: 50000,
  moneda: 'COP',
  metodoPago: 'card',
  metodoPedido: 'card',
  respuesta: { ok: true },
  proveedor: 'Bold',
  ...extra,
})
const pedidoDe = (db) => db.tablas.web_orders[0]

{
  globalThis.__efectosPago = []
  const db = baseFalsa({ web_orders: [pedidoBase()], payments: [] })
  const r1 = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado(), 'webhook'))
  check(r1.desenlace === 'actualizado' && r1.transicion, '6a: un aprobado no hace la transición')
  check(pedidoDe(db).payment_status === 'paid' && pedidoDe(db).status === 'confirmed', '6b: el pedido no queda pagado y confirmado')
  check(db.tablas.payments.length === 1 && db.tablas.payments[0].status === 'paid' && db.tablas.payments[0].amount === 50000, '6c: no registra un pago')
  check(contar('erpAutoConfirm') === 1 && contar('correoPagado') === 1, '6d: no avisa al ERP o no manda el correo una vez')

  // El mismo aviso otra vez, o la página de resultado después del webhook.
  const r2 = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado(), 'resultado'))
  check(r2.desenlace === 'ya_pagado' && !r2.transicion, '6e: un aviso repetido vuelve a hacer la transición')
  check(db.tablas.payments.length === 1 && contar('erpAutoConfirm') === 1 && contar('correoPagado') === 1, '6f: un aviso repetido duplica pago, ERP o correo')

  // Un rechazo viejo que llega tarde no baja de pagado.
  const r3 = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ estado: 'failed', transaccionId: 'TX0' }), 'webhook'))
  check(r3.desenlace === 'ya_pagado' && pedidoDe(db).payment_status === 'paid', '6g: un rechazo tardío baja el pedido de pagado')
  check(contar('erpReleaseStock') === 0, '6h: un rechazo tardío libera stock de un pedido pagado')

  // Reembolso: una sola vez.
  const r4 = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ estado: 'refunded' }), 'webhook'))
  check(r4.desenlace === 'actualizado' && pedidoDe(db).payment_status === 'refunded' && contar('erpRefund') === 1, '6i: el reembolso no se aplica')
  const r5 = await silenciar(() => aplicarPagoPedidoWeb(db, { ...pedidoDe(db), payment_status: 'paid' }, resultado({ estado: 'refunded' }), 'webhook'))
  check(r5.desenlace === 'carrera' && contar('erpRefund') === 1, '6j: un reembolso repetido vuelve a reversar en el ERP')
}
{
  globalThis.__efectosPago = []
  const db = baseFalsa({ web_orders: [pedidoBase()], payments: [] })
  const r = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ monto: 1 }), 'webhook'))
  check(r.desenlace === 'monto_insuficiente' && pedidoDe(db).payment_status === 'pending', '6k: un pago de $1 marca pagado un pedido de $50.000')
  check(db.tablas.payments.length === 0 && efectos().length === 0, '6l: un pago insuficiente registra pago o avisa al ERP')
  const sinMonto = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ monto: null }), 'webhook'))
  check(sinMonto.desenlace === 'monto_insuficiente', '6m: un aprobado sin monto marca pagado')
}
{
  globalThis.__efectosPago = []
  const db = baseFalsa({ web_orders: [pedidoBase()], payments: [] })
  await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ estado: 'failed', transaccionId: 'TX-R' }), 'webhook'))
  check(pedidoDe(db).payment_status === 'failed' && pedidoDe(db).status === 'cancelled' && contar('erpReleaseStock') === 1, '6n: un rechazo no cancela ni libera el stock')
  const otraVez = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ estado: 'failed', transaccionId: 'TX-R' }), 'webhook'))
  check(otraVez.desenlace === 'carrera' && contar('erpReleaseStock') === 1, '6o: un rechazo repetido libera stock dos veces')
  // El cliente reintenta con la misma referencia y paga.
  const reintento = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ transaccionId: 'TX-OK' }), 'webhook'))
  check(reintento.desenlace === 'actualizado' && pedidoDe(db).payment_status === 'paid', '6p: el pago tras un rechazo no marca pagado')
}
{
  globalThis.__efectosPago = []
  const db = baseFalsa({ web_orders: [pedidoBase()], payments: [] })
  const r = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado({ estado: 'pending' }), 'resultado'))
  check(r.desenlace === 'sin_cambio' && db.registro.updates.length === 0 && efectos().length === 0, '6q: un pendiente cambia algo')
  // Pedido de otra organización con el mismo id: la actualización filtra por organización.
  const ajeno = await silenciar(() => aplicarPagoPedidoWeb(db, { ...pedidoDe(db), organization_id: 999 }, resultado(), 'webhook'))
  check(ajeno.desenlace === 'carrera' && pedidoDe(db).payment_status === 'pending', '6r: la actualización no filtra por organización')
}
{
  // Ya pagado por el POS (pago completado), aunque el pedido diga pendiente.
  globalThis.__efectosPago = []
  const db = baseFalsa({
    web_orders: [pedidoBase()],
    payments: [{ id: 'p0', organization_id: 101, source: 'web_order', source_id: 'w1', status: 'completed', reference: null, processor_response: null }],
  })
  const r = await silenciar(() => aplicarPagoPedidoWeb(db, pedidoDe(db), resultado(), 'webhook'))
  check(r.desenlace === 'ya_pagado' && db.tablas.payments.length === 1 && efectos().length === 0, '6s: un pedido ya cobrado se cobra otra vez')
  check(db.tablas.payments[0].reference === 'TX1', '6t: no adjunta la transacción al pago existente')
}

// ─── 7. Consultas de /checkout/resultado ───────────────────────────────────
{
  const db = baseFalsa({
    integration_connections: [
      { id: 'mp1', organization_id: 101, connector_id: 'b00cfe3f-efa6-4656-93da-f42bf3073ab4', status: 'active' },
      { id: 'b1', organization_id: 101, connector_id: BOLD_CONECTOR_LINK_ID, status: 'active' },
    ],
    integration_credentials: [
      { connection_id: 'mp1', purpose: 'access_token', credential_type: 'api_key', secret_ref: 'TOKEN-MP', status: 'active' },
      { connection_id: 'b1', purpose: 'identity_key', credential_type: 'api_key', secret_ref: 'ID-BOLD', status: 'active' },
      { connection_id: 'b1', purpose: 'secret_key', credential_type: 'secret', secret_ref: 'SECRETA-BOLD', status: 'active' },
    ],
  })
  const pedidas = []
  const fetchOriginal = globalThis.fetch
  let respuesta = null
  globalThis.fetch = async (url, init) => {
    pedidas.push({ url: String(url), auth: init?.headers?.Authorization })
    return new Response(JSON.stringify(respuesta), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    respuesta = {
      results: [
        { id: 2, status: 'rejected', external_reference: 'WO-1', date_created: '2026-11-19T10:00:00Z', transaction_amount: 50000 },
        { id: 3, status: 'approved', external_reference: 'WO-1', date_created: '2026-11-19T09:00:00Z', transaction_amount: 50000, payment_method_id: 'visa', currency_id: 'COP' },
        { id: 4, status: 'approved', external_reference: 'OTRO', date_created: '2026-11-19T11:00:00Z', transaction_amount: 1 },
      ],
    }
    const mp = await silenciar(() => consultarMercadoPago(db, { organization_id: 101, order_number: 'WO-1' }))
    check(mp?.estado === 'paid' && mp?.transaccionId === '3' && mp?.monto === 50000, '7a: Mercado Pago no elige el aprobado de esa referencia')
    check(pedidas[0]?.url.startsWith('https://api.mercadopago.com/v1/payments/search?external_reference=WO-1'), '7b: Mercado Pago no busca por referencia')
    check(pedidas[0]?.auth === 'Bearer TOKEN-MP', '7c: Mercado Pago no usa el access_token de la organización')

    respuesta = { payment_status: 'APPROVED', total: 50000, transaction_id: 'BTX9', payment_method: 'PSE', reference_id: 'WO-1' }
    const bold = await silenciar(() => consultarBold(db, { organization_id: 101, order_number: 'WO-1' }))
    check(bold?.estado === 'paid' && bold?.transaccionId === 'BTX9' && bold?.monto === 50000, '7d: Bold aprobado no se interpreta')
    check(pedidas[1]?.url === 'https://payments.api.bold.co/v2/payment-voucher/WO-1', '7e: Bold no consulta el comprobante del pedido')
    check(pedidas[1]?.auth === 'x-api-key ID-BOLD', '7f: Bold no usa la llave de identidad (o usa la secreta)')

    respuesta = { payment_status: 'NO_TRANSACTION_FOUND' }
    check((await silenciar(() => consultarBold(db, { organization_id: 101, order_number: 'WO-1' }))) === null, '7g: Bold sin transacción cambia algo')
    check((await silenciar(() => consultarBold(db, { organization_id: 999, order_number: 'WO-1' }))) === null, '7h: consulta con la conexión de otra organización')
  } finally {
    globalThis.fetch = fetchOriginal
  }
}

// ─── 8. Las rutas ──────────────────────────────────────────────────────────
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
{
  const bold = leer('app/api/webhooks/bold/route.ts')
  const pos = (t) => bold.indexOf(t)
  check(!/secretKey && boldSignature/.test(bold), '8a: el receptor de Bold vuelve a dejar pasar eventos sin firma')
  check(pos('await firmanteBold(') > 0 && pos('await firmanteBold(') < pos('isReservationReference(reference)'), '8b: la firma de Bold no se verifica antes de tocar nada')
  check(/status: 401/.test(bold), '8c: sin firma válida no responde 401')
  check(/\.eq\('organization_id', organizationId\)\s*\.eq\('order_number', reference\)/.test(bold), '8d: el pedido de Bold no se busca en la organización que firmó')
  check(/aplicarPagoPedidoWeb\(/.test(bold) && /reenviarBoldAlErp\(/.test(bold), '8e: Bold no usa la pieza común o no reenvía al ERP')

  const mp = leer('app/api/webhooks/mercadopago/route.ts')
  check(/\.eq\('organization_id', organizationId\)\s*\.eq\('order_number', reference\)/.test(mp), '8f: el pedido de Mercado Pago no se busca en la organización dueña del pago')
  check(/aplicarPagoPedidoWeb\(/.test(mp) && !/mapMPStatus/.test(mp), '8g: Mercado Pago no usa la pieza común')

  const init = leer('app/api/checkout/init/route.ts')
  check(/preference\.notification_url = notificationUrl/.test(init) && /urlNotificacionMercadoPago\(/.test(init), '8h: la preferencia de Mercado Pago sale sin URL de aviso')
  // El ERP enlaza el método «Mercado Pago» con el código `mp` (payment_methods): sin esto, «Pasarela no soportada».
  check(/\n\s*mp: 'b00cfe3f-efa6-4656-93da-f42bf3073ab4',/.test(init) && /\n\s*mp: 'mp_checkout',/.test(init), '8h2: checkout/init no acepta el código `mp` del ERP')

  const resultadoPagina = leer('app/checkout/resultado/page.tsx')
  check(/consultarBold\(/.test(resultadoPagina) && /consultarMercadoPago\(/.test(resultadoPagina) && /aplicarPagoPedidoWeb\(/.test(resultadoPagina), '8i: /checkout/resultado no consulta a Bold ni a Mercado Pago')

  const wompi = leer('app/api/webhooks/wompi_co/route.ts')
  check(/reenviarWompiAlErp\(\{/.test(wompi) && !/aplicarPagoPedidoWeb/.test(wompi), '8j: el webhook de Wompi cambió de flujo')
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ Bold y Mercado Pago: ${casos} comprobaciones`)
