/**
 * verify-anticipo-tardio.mjs — anticipo pagado con el pedido VENCIDO (ERP 20261125121000, Figma
 * «05 POS y ventas» 3181-202769 › 11a / 12a).
 *
 *   node scripts/verify-anticipo-tardio.mjs
 *
 * Sin base ni red: importa `lib/contraentrega/anticipoWebhook.ts` real con la base simulada y los
 * efectos falsos de verify-anticipo-confirmacion (mismos cargadores). Comprueba:
 *  1. La regla pura (`accionAnticipoTardio`): reactivable → correo «reactivado» + aviso al ERP; sin
 *     stock o fuera de plazo → correo «revisando» + aviso al ERP; cualquier otro estado → nada.
 *  2. Bold / Mercado Pago: reactivable confirma en el ERP UNA vez (el mismo notifyErpAutoConfirm del
 *     anticipo a tiempo) y manda el correo «reactivado», no el de «pagado»; sin stock avisa al ERP
 *     (WhatsApp «revisando») y manda «revisando»; ya_pagado / pagado_pedido_cerrado, nada nuevo.
 *  3. Los correos: asunto y textos de 11a y 12a, con la marca de la tienda y sin la de la plataforma.
 *  4. El anticipo tardío va en el `else` de «pagado» (ese ramal lo vigila verify-anticipo-confirmacion)
 *     y las rutas del dinero (app/api/webhooks/*) no cambian.
 *  5. Nunca se devuelve dinero desde la tienda.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
register(pathToFileURL(join(ROOT, 'scripts/verify-anticipo-confirmacion.cargador.mjs')).href, import.meta.url, {
  data: { stub: pathToFileURL(join(ROOT, 'scripts/verify-anticipo-confirmacion.efectos.mjs')).href },
})

const { aplicarAnticipoPasarela } = await import('../lib/contraentrega/anticipoWebhook.ts')
const { accionAnticipoTardio, armarCorreoAnticipoTardio } = await import('../lib/contraentrega/anticipoTardio.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const efectos = (nombre) => (globalThis.__efectosPago ?? []).filter((e) => e.nombre === nombre)
const silenciar = async (fn) => {
  const [log, warn, error] = [console.log, console.warn, console.error]
  console.log = console.warn = console.error = () => {}
  try {
    return await fn()
  } finally {
    Object.assign(console, { log, warn, error })
  }
}

// 1. Regla pura
check(accionAnticipoTardio('pagado_tarde_reactivable')?.correo === 'reactivado', 'reactivable → correo «reactivado»')
check(accionAnticipoTardio('pagado_vencido_sin_stock')?.correo === 'revisando', 'sin stock → correo «revisando»')
check(accionAnticipoTardio('pagado_vencido_fuera_de_plazo')?.correo === 'revisando', 'fuera de plazo → correo «revisando»')
for (const s of ['pagado', 'ya_pagado', 'pagado_pedido_cerrado', 'rechazado', 'sin_cambio', 'reembolso_registrado', null, undefined, '']) {
  check(accionAnticipoTardio(s) === null, `${String(s)} → sin acción nueva`)
}

// 2. Bold / Mercado Pago con la base simulada
const PEDIDO = '4b5f1c2e-0000-4000-8000-00000000b002'
function base(respuestaRpc) {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: async () => ({ data: { id: PEDIDO, organization_id: 358 }, error: null }),
  }
  return { from: () => consulta, rpc: async () => respuestaRpc }
}
const aviso = {
  organizationId: 358,
  referencia: `ANT-${PEDIDO}`,
  estado: 'paid',
  transaccionId: 'tx-2',
  monto: 20000,
  moneda: 'COP',
  pasarela: 'bold_link',
  metodo: 'nequi',
  respuesta: {},
}
for (const [status, erp, correo] of [
  ['pagado_tarde_reactivable', 1, 'reactivado'],
  ['pagado_vencido_sin_stock', 1, 'revisando'],
  ['pagado_vencido_fuera_de_plazo', 1, 'revisando'],
  ['pagado_pedido_cerrado', 0, null],
  ['ya_pagado', 0, null],
  ['pagado', 1, null],
]) {
  globalThis.__efectosPago = []
  const r = await silenciar(() => aplicarAnticipoPasarela(base({ data: { ok: true, status }, error: null }), aviso))
  check(r.status === 200, `${status}: responde 200`)
  check(efectos('erpAutoConfirm').length === erp, `${status}: ${erp} aviso(s) al ERP (hubo ${efectos('erpAutoConfirm').length})`)
  const tardios = efectos('correoAnticipoTardio')
  check(tardios.length === (correo ? 1 : 0), `${status}: ${correo ? 'un' : 'ningún'} correo de anticipo tardío (hubo ${tardios.length})`)
  if (correo) {
    check(tardios[0]?.args?.[0] === PEDIDO && tardios[0]?.args?.[1] === correo, `${status}: correo «${correo}» del pedido`)
    check(efectos('correoAnticipoPagado').length === 0, `${status}: no manda el correo «Pagaste hoy…» del anticipo a tiempo`)
    check(efectos('erpAutoConfirm')[0]?.args?.[0] === PEDIDO, `${status}: avisa al ERP con el id del pedido`)
  }
}

// 3. Correos (puro)
const sobre = { nombre: 'Tienda de prueba', logoUrl: null, color: '#1E293B', texto: '#ffffff' }
const datos = {
  nombreCliente: 'Laura Pérez',
  numeroPedido: 'WO-1',
  anticipo: '$ 9.000',
  alRecibir: '$ 142.000',
  horaPago: '10:02 p. m.',
  horaVencio: '9:43 p. m.',
  listoAprox: 'hoy alrededor de las 10:40 p. m.',
  entregaAprox: null,
  lineas: '2 × Café',
  urlPedido: 'https://tienda.test/pedido/1?t=x',
  pie: 'Tienda de prueba · Sede',
}
const r1 = armarCorreoAnticipoTardio('reactivado', datos, sobre)
check(r1.asunto === 'Tu pedido WO-1 sigue en pie', '11a: asunto «sigue en pie»')
check(r1.texto.includes('Hola Laura,') && r1.texto.includes('sigue en pie') && r1.texto.includes('Pagas al recibir: $ 142.000'), '11a: saludo, frase y lo que paga al recibir')
check(r1.html.includes('Ver mi pedido') && r1.html.includes('Tienda de prueba'), '11a: botón y marca de la tienda')
const r2 = armarCorreoAnticipoTardio('revisando', datos, sobre)
check(r2.asunto === 'Recibimos tu pago del pedido WO-1', '12a: asunto «Recibimos tu pago»')
check(r2.texto.includes('había vencido a las 9:43 p. m.') && r2.texto.includes('te lo devolvemos completo'), '12a: vencimiento y promesa de devolución completa')
check(!r2.html.includes('Ver mi pedido'), '12a: sin botón de pedido')
for (const r of [r1, r2]) check(!/go ?admin/i.test(r.html + r.texto + r.asunto), 'sin la marca de la plataforma')
check(!armarCorreoAnticipoTardio('reactivado', { ...datos, nombreCliente: '<b>x</b>' }, sobre).html.includes('<b>x</b>'), 'escapa el HTML del nombre')

// 4 y 5. Fuentes
const webhook = readFileSync(join(ROOT, 'lib/contraentrega/anticipoWebhook.ts'), 'utf8')
check((webhook.match(/avisarAnticipoTardio\(/g) || []).length === 2, 'anticipoWebhook: el anticipo tardío en los dos ramales (Wompi y Bold/MP)')
check(/\} else \{\s*(\/\/[^\n]*\n\s*)+await avisarAnticipoTardio\(pedido\.id, resultado\?\.status\)\s*\}/.test(webhook), 'Wompi: va en el else de «pagado»')
check(/\} else \{\s*(\/\/[^\n]*\n\s*)+await avisarAnticipoTardio\(pedido\.id, data\?\.status\)\s*\}/.test(webhook), 'Bold/MP: va en el else de «pagado»')
for (const ruta of ['bold', 'mercadopago', 'wompi_co']) {
  const r = readFileSync(join(ROOT, `app/api/webhooks/${ruta}/route.ts`), 'utf8')
  check(!r.includes('anticipoTardio') && !r.includes('AnticipoTardio'), `${ruta}: la ruta del dinero no cambia`)
}
const sinComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
for (const archivo of ['lib/contraentrega/anticipoTardio.ts', 'lib/contraentrega/avisoAnticipoTardio.ts', 'lib/contraentrega/correoAnticipoTardio.ts']) {
  const f = sinComentarios(readFileSync(join(ROOT, archivo), 'utf8'))
  check(!/refund|reembols|anticipo_devolver|\/refund/i.test(f), `${archivo}: no devuelve dinero`)
}
const correoFuente = readFileSync(join(ROOT, 'lib/contraentrega/correoAnticipoTardio.ts'), 'utf8')
check(correoFuente.includes('correoRespaldoTiendas()') && correoFuente.includes('cargarMarcaPedido('), 'correo: marca de la tienda y respaldo sin marca de la plataforma')

if (problemas.length) {
  console.error(`✗ verify-anticipo-tardio: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-anticipo-tardio: ${casos} comprobaciones (reactivar o revisar, nunca devolver desde la tienda)`)
