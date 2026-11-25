/**
 * verify-intentos-pago.mjs — historial de intentos de pago del pedido web y «el rechazo no cancela».
 *
 *   npm run verify:intentos-pago
 *
 * Diseño aprobado 2026-11-24 (Figma «05 POS y ventas» › 3087:201491; ERP 20261125001000). Sin base
 * ni red: importa los módulos reales con el cargador de verify-pasarelas-bold-mp (transpila los .ts
 * y cambia los efectos de salida por registros) y una base simulada.
 *
 * Casos:
 *  1. Lo que se guarda de cada pasarela (tabla «Qué trae el aviso de cada pasarela»): Bold sin
 *     motivo ni pendiente; Mercado Pago con `status_detail` como código; Wompi con el texto del
 *     motivo y el banco en PSE; «enlace creado» con la pasarela normalizada.
 *  2. Nunca la respuesta completa: ni correo, ni teléfono, ni nombre, ni documento del pagador.
 *  3. `registrarIntentoPago`: una sola RPC (`fn_web_order_intento_registrar`), nunca lanza.
 *  4. `aplicarPagoPedidoWeb` registra también los pendientes (que no cambian el pedido).
 *  5. Las rutas: init registra «enlace creado» tras generar la URL; Bold, Mercado Pago y Wompi
 *     registran después de verificar firma/conexión; Wompi ya no cancela ni libera stock al rechazo;
 *     /checkout/resultado no acepta una transacción de otra referencia.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})

const r = await import('../lib/payments/intentosPagoReglas.ts')
const { registrarIntentoPago } = await import('../lib/payments/intentosPago.ts')
const { aplicarPagoPedidoWeb, camposPedidoPorPago } = await import('../lib/payments/pagoPedidoWeb.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const silenciar = async (fn) => {
  const [log, warn, error] = [console.log, console.warn, console.error]
  console.log = console.warn = console.error = () => {}
  try {
    return await fn()
  } finally {
    Object.assign(console, { log, warn, error })
  }
}

// ─── 1. Lo que se guarda de cada pasarela ────────────────────────────────────
{
  const aprobadoTarjeta = r.intentoDeBold({
    type: 'SALE_APPROVED',
    subject: 'X',
    data: {
      payment_id: '82J4T9QX',
      payment_method: 'CARD_WEB',
      amount: { total: 128900, currency: 'COP' },
      card: { brand: 'VISA', masked_pan: '450799******4417', cardholder_name: 'Ana Pérez' },
      payer_email: 'ana@correo.test',
      metadata: { reference: 'WO-1' },
    },
  })
  check(aprobadoTarjeta?.evento === 'approved' && aprobadoTarjeta.pasarela === 'bold', '1a: Bold aprobado no es «approved»')
  check(aprobadoTarjeta?.medio === 'card' && aprobadoTarjeta.marca === 'visa' && aprobadoTarjeta.ultimos4 === '4417', '1b: Bold no saca medio, marca y últimos 4')
  check(aprobadoTarjeta?.referencia === '82J4T9QX' && aprobadoTarjeta.monto === 128900 && aprobadoTarjeta.moneda === 'COP', '1c: Bold no saca referencia y monto')

  const rechazoNequi = r.intentoDeBold({ type: 'SALE_REJECTED', data: { payment_id: 'B2', payment_method: 'NEQUI', amount: { total: 9000 } } })
  check(rechazoNequi?.evento === 'declined' && rechazoNequi.medio === 'nequi' && !rechazoNequi.motivo && !rechazoNequi.codigoMotivo, '1d: Bold rechazado inventa un motivo o pierde el medio')
  check(r.intentoDeBold({ type: 'VOID_REJECTED', data: { payment_id: 'B3' } }) === null, '1e: una anulación rechazada de Bold cuenta como intento')
  check(r.intentoDeBold({ type: 'SALE_APPROVED', data: { payment_id: 'B4', payment_method: 'QR' } })?.medio === 'qr', '1f: Bold QR')
  check(r.intentoDeComprobanteBold({ payment_status: 'REJECTED', payment_method: 'PSE', transaction_id: 'T1', total: 5000 })?.evento === 'declined', '1g: comprobante de Bold rechazado')
  check(r.intentoDeComprobanteBold({ payment_status: 'PROCESSING' }) === null, '1h: comprobante de Bold en proceso cuenta como intento')

  const mpRechazo = r.intentoDeMercadoPago({
    id: 1325846950,
    status: 'rejected',
    status_detail: 'cc_rejected_insufficient_amount',
    payment_method_id: 'visa',
    payment_type_id: 'credit_card',
    card: { last_four_digits: '4417', cardholder: { name: 'Ana', identification: { number: '1020334556' } } },
    payer: { email: 'ana@correo.test', phone: { number: '3005551234' } },
    transaction_amount: 128900,
    currency_id: 'COP',
  })
  check(mpRechazo?.evento === 'declined' && mpRechazo.codigoMotivo === 'cc_rejected_insufficient_amount', '1i: Mercado Pago no guarda el código del motivo')
  check(mpRechazo?.medio === 'card' && mpRechazo.marca === 'visa' && mpRechazo.ultimos4 === '4417' && mpRechazo.referencia === '1325846950', '1j: Mercado Pago no saca tarjeta y referencia')
  check(r.intentoDeMercadoPago({ id: 2, status: 'in_process', status_detail: 'pending_contingency', payment_method_id: 'pse', payment_type_id: 'bank_transfer' })?.evento === 'pending', '1k: Mercado Pago en proceso no es «pending»')
  check(r.intentoDeMercadoPago({ id: 3, status: 'pending', payment_method_id: 'pse', payment_type_id: 'bank_transfer' })?.medio === 'pse', '1l: Mercado Pago PSE')
  check(r.intentoDeMercadoPago({ id: 4, status: 'cancelled', status_detail: 'expired' })?.evento === 'expired', '1m: Mercado Pago cancelado por vencimiento')
  check(r.intentoDeMercadoPago({ id: 5, status: 'refunded' })?.evento === 'voided' && r.intentoDeMercadoPago({ id: 6, status: 'raro' }) === null, '1n: Mercado Pago reembolsado / desconocido')

  const wompiRechazo = r.intentoDeWompi({
    id: '11982-1764022870-40211',
    status: 'DECLINED',
    status_message: 'Fondos insuficientes',
    reference: 'WO-1',
    amount_in_cents: 12890000,
    currency: 'COP',
    payment_method_type: 'CARD',
    payment_method: { type: 'CARD', extra: { brand: 'VISA', last_four: '4417', card_holder: 'ANA PEREZ', bin: '450799' } },
    customer_email: 'ana@correo.test',
    customer_data: { full_name: 'Ana Pérez', phone_number: '+573005551234', legal_id: '1020334556' },
    billing_data: { legal_id: '1020334556' },
    shipping_address: { address_line_1: 'Cra 45 #12-30' },
  })
  check(wompiRechazo?.evento === 'declined' && wompiRechazo.motivo === 'Fondos insuficientes', '1o: Wompi no guarda el texto del motivo')
  check(wompiRechazo?.medio === 'card' && wompiRechazo.marca === 'visa' && wompiRechazo.ultimos4 === '4417' && wompiRechazo.monto === 128900, '1p: Wompi no saca tarjeta y monto')
  const wompiPse = r.intentoDeWompi({ id: 'W2', status: 'PENDING', payment_method_type: 'PSE', payment_method: { extra: { financial_institution_name: 'Bancolombia' } }, amount_in_cents: 100 })
  check(wompiPse?.evento === 'pending' && wompiPse.banco === 'Bancolombia' && wompiPse.medio === 'pse' && !wompiPse.motivo, '1q: Wompi PSE pendiente sin banco o con motivo')
  check(r.intentoDeWompi({ id: 'W3', status: 'APPROVED', status_message: 'ok' })?.motivo === null, '1r: Wompi aprobado guarda motivo')
  check(r.intentoDeWompi({ id: 'W4', status: 'ERROR', status_message: 'Tiempo límite excedido' })?.evento === 'error', '1s: Wompi ERROR')

  const enlace = (c) => r.intentoEnlaceCreado(c, 128900).pasarela
  check(enlace('wompi_co') === 'wompi' && enlace('mp_checkout') === 'mercadopago' && enlace('bold_link') === 'bold' && enlace('mp') === 'mercadopago', '1t: «enlace creado» no normaliza la pasarela')
  check(r.intentoEnlaceCreado('bold_link', '9000').evento === 'link_created' && r.intentoEnlaceCreado('bold_link', '9000').monto === 9000, '1u: «enlace creado» sin evento o monto')
  check(r.ultimos4De('•••• 4417') === '4417' && r.ultimos4De('abc') === null && r.ultimos4De(null) === null, '1v: últimos 4')

  // ─── 2. Nunca la respuesta completa ─────────────────────────────────────────
  const PERMITIDOS = new Set(['pasarela', 'evento', 'motivo', 'codigoMotivo', 'medio', 'marca', 'ultimos4', 'banco', 'referencia', 'monto', 'moneda'])
  for (const [nombre, d] of [['Bold', aprobadoTarjeta], ['Mercado Pago', mpRechazo], ['Wompi', wompiRechazo]]) {
    const json = JSON.stringify(d)
    check(Object.keys(d).every((k) => PERMITIDOS.has(k)), `2a: ${nombre} guarda campos de más`)
    check(!/correo\.test|3005551234|1020334556|P[ée]rez|PEREZ|450799|Cra 45/i.test(json), `2b: ${nombre} guarda datos del pagador`)
  }
  const largo = r.intentoDeWompi({ id: 'W5', status: 'DECLINED', status_message: 'x'.repeat(500) })
  check(largo?.motivo?.length === 200, '2c: el motivo no se recorta')
}

// ─── 3. registrarIntentoPago ─────────────────────────────────────────────────
{
  const llamadas = []
  const db = { rpc: async (fn, args) => { llamadas.push({ fn, args }); return { data: { ok: true }, error: null } } }
  await registrarIntentoPago(db, { organizationId: 120, webOrderId: 'w1' }, r.intentoEnlaceCreado('wompi_co', 1000))
  check(llamadas.length === 1 && llamadas[0].fn === 'fn_web_order_intento_registrar', '3a: no llama la RPC única')
  const a = llamadas[0]?.args ?? {}
  check(a.p_organization_id === 120 && a.p_web_order_id === 'w1' && a.p_concepto === 'order' && a.p_evento === 'link_created' && a.p_pasarela === 'wompi', '3b: parámetros de la RPC')
  await registrarIntentoPago(db, { organizationId: 120, webOrderId: 'w1', concepto: 'advance' }, r.intentoDeWompi({ id: 'T', status: 'DECLINED' }))
  check(llamadas[1]?.args.p_concepto === 'advance', '3c: el anticipo no va como «advance»')
  await registrarIntentoPago(db, { organizationId: 120, webOrderId: 'w1' }, null)
  await registrarIntentoPago(db, { organizationId: 0, webOrderId: 'w1' }, r.intentoEnlaceCreado('bold', 1))
  check(llamadas.length === 2, '3d: registra sin datos o sin organización')
  let lanzo = false
  try {
    await silenciar(() => registrarIntentoPago({ rpc: async () => { throw new Error('red') } }, { organizationId: 1, webOrderId: 'x' }, r.intentoEnlaceCreado('bold', 1)))
    await silenciar(() => registrarIntentoPago({ rpc: async () => ({ data: null, error: { code: '42501' } }) }, { organizationId: 1, webOrderId: 'x' }, r.intentoEnlaceCreado('bold', 1)))
  } catch {
    lanzo = true
  }
  check(!lanzo, '3e: un fallo del registro tumba el cobro')
}

// ─── 4. aplicarPagoPedidoWeb registra también los pendientes ─────────────────
{
  const llamadas = []
  const pedido = { id: 'w9', organization_id: 120, branch_id: 1, total: 50000, payment_status: 'pending', status: 'pending', order_number: 'WO-9' }
  const db = {
    rpc: async (fn, args) => { llamadas.push({ fn, args }); return { data: { ok: true }, error: null } },
    from: () => { throw new Error('un pendiente no debe tocar tablas') },
  }
  const intento = r.intentoDeMercadoPago({ id: 7, status: 'in_process', status_detail: 'pending_contingency' })
  const res = await silenciar(() =>
    aplicarPagoPedidoWeb(db, pedido, { estado: 'pending', transaccionId: '7', monto: 50000, moneda: 'COP', metodoPago: 'card', metodoPedido: 'mp', respuesta: {}, proveedor: 'Mercado Pago', intento }, 'webhook')
  )
  check(res.desenlace === 'sin_cambio', '4a: un pendiente cambia el pedido')
  check(llamadas.length === 1 && llamadas[0].args.p_evento === 'pending' && llamadas[0].args.p_web_order_id === 'w9' && llamadas[0].args.p_organization_id === 120, '4b: el pendiente no queda en el historial')
  check(Object.keys(camposPedidoPorPago('failed', 'X')).length === 0, '4c: un rechazo escribe estado o cancelación en el pedido')
  check(camposPedidoPorPago('paid', 'X').status === 'confirmed', '4d: un pago no confirma el pedido')
}

// ─── 5. Las rutas ────────────────────────────────────────────────────────────
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
{
  const init = leer('app/api/checkout/init/route.ts')
  const p = (t) => init.indexOf(t)
  check(p('intentoEnlaceCreado(resolvedGateway') > p('if (!checkoutUrl)') && p('if (!checkoutUrl)') > 0, '5a: init registra «enlace creado» antes de tener la URL')
  check(/if \(esPedidoWeb \|\| isAnticipo\) \{\s*await registrarIntentoPago\(/.test(init), '5b: init registra intentos de otras fuentes de cobro')

  const bold = leer('app/api/webhooks/bold/route.ts')
  check((bold.match(/intento: intentoDeBold\(body\)/g) || []).length === 2, '5c: Bold no pasa el intento al pedido y al anticipo')
  check(bold.indexOf('await firmanteBold(') < bold.indexOf('intentoDeBold(body)'), '5d: Bold registra antes de verificar la firma')

  const mp = leer('app/api/webhooks/mercadopago/route.ts')
  check((mp.match(/intento: intentoDeMercadoPago\(paymentData\)/g) || []).length === 2, '5e: Mercado Pago no pasa el intento al pedido y al anticipo')

  const wompi = leer('app/api/webhooks/wompi_co/route.ts')
  const pw = (t) => wompi.indexOf(t)
  check(pw('intentoDeWompi(transaction)') > pw('if (SIGNATURE_ENFORCED) {'), '5f: Wompi registra antes de verificar la firma')
  check(!/status: 'cancelled'/.test(wompi) && !/Pago rechazado por Wompi/.test(wompi), '5g: Wompi vuelve a cancelar el pedido al rechazo')
  check(!/notifyErpReleaseStock/.test(wompi), '5h: Wompi vuelve a liberar el stock al rechazo')
  check(/paymentStatus === 'failed' \? \{\} : \{ payment_method:/.test(wompi), '5i2: un rechazo de Wompi cambia el método (y con él el plazo) del pedido')
  check(/camposPedidoPorPago\(paymentStatus/.test(wompi) && /\.eq\('status', ESTADO_PEDIDO_QUE_ADMITE_RECHAZO\)/.test(wompi), '5i: Wompi no usa la regla común del rechazo')

  const pago = leer('lib/payments/pagoPedidoWeb.ts')
  check(!/cancellation_reason/.test(pago) && !/notifyErpReleaseStock\(/.test(pago), '5j: aplicarPagoPedidoWeb vuelve a cancelar o liberar al rechazo')

  const anticipo = leer('lib/contraentrega/anticipoWebhook.ts')
  check((anticipo.match(/concepto: 'advance'/g) || []).length === 2, '5k: el anticipo no registra sus intentos (Wompi y Bold/MP)')

  const resultado = leer('app/checkout/resultado/page.tsx')
  check(/if \(tx\.reference !== order\.order_number\) \{/.test(resultado), '5l: /checkout/resultado acepta una transacción de otra referencia')
  check(!/status: 'cancelled'/.test(resultado), '5m: /checkout/resultado vuelve a cancelar al rechazo')

  // Nadie más escribe la tabla: solo la RPC (y el vencimiento en la base).
  const registradores = [init, bold, mp, wompi, pago, anticipo, resultado, leer('lib/payments/intentosPago.ts')]
  check(registradores.every((t) => !/from\('web_order_payment_attempts'\)/.test(t)), '5n: alguien escribe la tabla de intentos sin la RPC')
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ Intentos de pago: ${casos} comprobaciones`)
