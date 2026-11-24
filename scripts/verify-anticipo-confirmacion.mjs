/**
 * verify-anticipo-confirmacion.mjs — el anticipo pagado confirma el pedido en el ERP (pedido del
 * dueño, 2026-11-24: «cuando el anticipo aparezca pagado, se pone confirmado el pedido»).
 *
 *   npm run verify:anticipo-confirmacion
 *
 * Sin base ni red: importa `lib/contraentrega/anticipoWebhook.ts` real con una base simulada y los
 * efectos de salida falsos de verify-pasarelas-bold-mp (mismo cargador, más el del correo del
 * anticipo). Comprueba:
 *  1. Bold / Mercado Pago (`aplicarAnticipoPasarela`): SOLO la transición a pagado (`pagado`) llama
 *     `notifyErpAutoConfirm`, una vez y con el id del pedido; un reintento (`ya_pagado`), un
 *     rechazo, un pedido cerrado o un error de la RPC no lo llaman.
 *  2. Wompi (`procesarAnticipoWompi`): en el fuente, la llamada va dentro del mismo ramal
 *     `status === 'pagado'` que el correo, y no hay otra.
 *  3. Las rutas del dinero (app/api/webhooks/*) no llaman la confirmación para el anticipo: todo
 *     pasa por anticipoWebhook.ts.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
// Después (corre antes): el correo del anticipo, que importa el cliente de servidor de Next.
register(pathToFileURL(join(ROOT, 'scripts/verify-anticipo-confirmacion.cargador.mjs')).href, import.meta.url, {
  data: { stub: pathToFileURL(join(ROOT, 'scripts/verify-anticipo-confirmacion.efectos.mjs')).href },
})

const { aplicarAnticipoPasarela } = await import('../lib/contraentrega/anticipoWebhook.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const confirmaciones = () => (globalThis.__efectosPago ?? []).filter((e) => e.nombre === 'erpAutoConfirm')
const silenciar = async (fn) => {
  const [log, warn, error] = [console.log, console.warn, console.error]
  console.log = console.warn = console.error = () => {}
  try {
    return await fn()
  } finally {
    Object.assign(console, { log, warn, error })
  }
}

const PEDIDO = '4b5f1c2e-0000-4000-8000-00000000a001'

function base(respuestaRpc) {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: async () => ({ data: { id: PEDIDO, organization_id: 358 }, error: null }),
  }
  return {
    from: () => consulta,
    rpc: async () => respuestaRpc,
  }
}

const aviso = {
  organizationId: 358,
  referencia: `ANT-${PEDIDO}`,
  estado: 'paid',
  transaccionId: 'tx-1',
  monto: 20000,
  moneda: 'COP',
  pasarela: 'bold_link',
  metodo: 'pse',
  respuesta: {},
}

// 1. Bold / Mercado Pago
for (const [status, esperadas] of [
  ['pagado', 1],
  ['ya_pagado', 0],
  ['rechazado', 0],
  ['sin_cambio', 0],
  ['pagado_pedido_cerrado', 0],
  ['reembolso_registrado', 0],
]) {
  globalThis.__efectosPago = []
  const r = await silenciar(() => aplicarAnticipoPasarela(base({ data: { ok: true, status }, error: null }), aviso))
  check(r.status === 200, `${status}: responde 200 (recibió ${r.status})`)
  check(confirmaciones().length === esperadas, `${status}: ${esperadas} confirmación(es) en el ERP (hubo ${confirmaciones().length})`)
  const correos = (globalThis.__efectosPago ?? []).filter((e) => e.nombre === 'correoAnticipoPagado').length
  check(correos === esperadas, `${status}: el correo «Pagaste hoy…» sale igual que antes (${esperadas}, hubo ${correos})`)
  if (esperadas === 1) {
    check(confirmaciones()[0]?.args?.[0] === PEDIDO, `${status}: confirma el pedido del anticipo`)
  }
}
{
  globalThis.__efectosPago = []
  const r = await silenciar(() => aplicarAnticipoPasarela(base({ data: null, error: { code: 'XX000' } }), aviso))
  check(r.status === 500, 'RPC con error: 500 para que la pasarela reintente')
  check(confirmaciones().length === 0, 'RPC con error: sin confirmación')
}
{
  // Reintento del webhook: la base responde ya_pagado la segunda vez → una sola confirmación.
  globalThis.__efectosPago = []
  let n = 0
  const db = { ...base(null), rpc: async () => ({ data: { ok: true, status: n++ === 0 ? 'pagado' : 'ya_pagado' }, error: null }) }
  await silenciar(() => aplicarAnticipoPasarela(db, aviso))
  await silenciar(() => aplicarAnticipoPasarela(db, aviso))
  await silenciar(() => aplicarAnticipoPasarela(db, aviso))
  check(confirmaciones().length === 1, `tres avisos del mismo pago: una sola confirmación (hubo ${confirmaciones().length})`)
}

// 2. Wompi: mismo ramal que el correo
const fuente = readFileSync(join(ROOT, 'lib/contraentrega/anticipoWebhook.ts'), 'utf8')
check(
  /resultado\?\.status === 'pagado'\) \{\s*await enviarCorreoAnticipoPagado\(pedido\.id\)\s*await notifyErpAutoConfirm\(pedido\.id\)\s*\} else \{/.test(fuente),
  'Wompi: la confirmación va en el ramal «pagado», junto al correo, con su else',
)
check((fuente.match(/notifyErpAutoConfirm\(/g) || []).length === 2, 'anticipoWebhook: exactamente dos llamadas (Wompi y Bold/MP)')

// 3. Las rutas del dinero no confirman el anticipo por su cuenta
for (const ruta of ['bold', 'mercadopago', 'wompi_co']) {
  const r = readFileSync(join(ROOT, `app/api/webhooks/${ruta}/route.ts`), 'utf8')
  const ramal = r.slice(r.indexOf('esReferenciaAnticipo('), r.indexOf('esReferenciaAnticipo(') + 1500)
  check(!ramal.includes('notifyErpAutoConfirm'), `${ruta}: el ramal ANT- no llama la confirmación (la hace anticipoWebhook.ts)`)
}

if (problemas.length) {
  console.error(`✗ verify-anticipo-confirmacion: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-anticipo-confirmacion: ${casos} comprobaciones (solo la transición a pagado confirma, una vez)`)
