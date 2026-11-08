/**
 * verify-reenvio-wompi.mjs — la tienda pasa al ERP los eventos de Wompi que no son suyos.
 *
 *   npm run verify:reenvio-wompi
 *
 * Sin base de datos ni red: importa el módulo real (`lib/payments/wompi-reenvio-erp.ts`) con un
 * `fetch` falso, y lee el fuente de la ruta para comprobar DÓNDE se reenvía.
 *
 * Casos:
 *  1. Referencia ajena → se reenvía con el cuerpo byte a byte y la firma; sin cookies ni
 *     authorization; con la cabecera marcador. El código del ERP vuelve a Wompi.
 *  2. Referencia de la tienda → no se reenvía (pedido encontrado; prefijos antes del reenvío).
 *  3. Evento ya reenviado → no se reenvía.
 *  4. ERP caído / 5xx / tarda → 5xx para que Wompi reintente.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CABECERA_REENVIADO,
  RUTA_WEBHOOK_WOMPI_ERP,
  debeReenviarAlErp,
  reenviarWompiAlErp,
  urlWebhookWompiErp,
  yaReenviado,
} from '../lib/payments/wompi-reenvio-erp.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

// Los registros del módulo no ensucian la salida; se guardan para revisar que no filtran nada.
const registros = []
const original = { log: console.log, error: console.error }
console.log = (...a) => registros.push(a.join(' '))
console.error = (...a) => registros.push(a.join(' '))

const ERP = 'https://erp.ejemplo.test/api/integrations/wompi/webhook'
const CHECKSUM = '3476DDA50F64CD7CBD160689640506FEBEA93239BC524FC0469B2C68A3CC8BD0'
const SECRETO_FALSO = 'test_events_NO_ES_REAL'
// Espacios, tildes y orden de claves raros a propósito: tiene que llegar idéntico.
const textoEvento = `{"event":"transaction.updated","data":{"transaction":{"id":"1234-1610641025-49201","reference":"POS-1700000000000-77","status":"APPROVED","amount_in_cents":4490000,"currency":"COP","customer_email":"pagador@ejemplo.test","payment_method_type":"NEQUI"}},"environment":"prod",  "signature":{"properties":["transaction.id","transaction.status","transaction.amount_in_cents"],"checksum":"${CHECKSUM}"},"timestamp":1530291411,"sent_at":"2018-07-20T16:45:05.000Z","nota":"canción ñ"}\n`
const bytes = new TextEncoder().encode(textoEvento)

function cabecerasWompi(extra = {}) {
  return new Headers({
    'content-type': 'application/json; charset=utf-8',
    'x-event-checksum': CHECKSUM,
    'user-agent': 'Wompi',
    host: 'tienda.ejemplo.test',
    cookie: 'sb-access-token=xyz',
    authorization: `Bearer ${SECRETO_FALSO}`,
    'x-forwarded-for': '1.2.3.4',
    ...extra,
  })
}

function fetchFalso(respuesta) {
  const llamadas = []
  const impl = async (url, init) => {
    llamadas.push({ url, init })
    if (respuesta instanceof Error) throw respuesta
    if (typeof respuesta === 'function') return respuesta(url, init)
    return new Response(respuesta.cuerpo ?? '{}', {
      status: respuesta.status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { impl, llamadas }
}

async function main() {
  // ── 1. Referencia ajena: reenvío fiel ──
  {
    const f = fetchFalso({ status: 200, cuerpo: '{"received":true}' })
    const r = await reenviarWompiAlErp({
      cuerpo: bytes,
      cabeceras: cabecerasWompi(),
      hostEntrante: 'tienda.ejemplo.test',
      referencia: 'POS-1700000000000-77',
      url: ERP,
      fetchImpl: f.impl,
    })
    check(f.llamadas.length === 1, '1: debe hacer exactamente una llamada al ERP')
    const ll = f.llamadas[0]
    check(ll?.url === ERP, '1: URL del ERP')
    check(ll?.init?.method === 'POST', '1: método POST')
    const enviado = ll?.init?.body
    check(enviado instanceof Uint8Array, '1: el cuerpo viaja como bytes')
    check(
      enviado instanceof Uint8Array && enviado.length === bytes.length && enviado.every((b, i) => b === bytes[i]),
      '1: el cuerpo debe llegar byte a byte'
    )
    const h = ll?.init?.headers
    check(h?.get('x-event-checksum') === CHECKSUM, '1: la cabecera de firma viaja intacta')
    check(h?.get('content-type') === 'application/json; charset=utf-8', '1: content-type intacto')
    check(h?.get(CABECERA_REENVIADO) === 'wompi_co', '1: lleva la cabecera marcador')
    for (const nombre of ['cookie', 'authorization', 'host', 'x-forwarded-for']) {
      check(!h?.has(nombre), `1: no debe reenviar la cabecera ${nombre}`)
    }
    check(ll?.init?.redirect === 'manual', '1: no sigue redirecciones')
    check(ll?.init?.signal instanceof AbortSignal, '1: lleva tiempo límite')
    check(r.status === 200 && r.reenviado === true, '1: devuelve el 200 del ERP')
    check(r.cuerpo === '{"received":true}', '1: devuelve el cuerpo del ERP')
  }

  // El 401 del ERP (ninguna conexión firmó) vuelve tal cual: no se disfraza de 200.
  {
    const f = fetchFalso({ status: 401, cuerpo: '{"error":"webhook_unauthorized"}' })
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: ERP, fetchImpl: f.impl })
    check(r.status === 401, '1b: el 401 del ERP vuelve a Wompi')
  }

  // ── 2. Referencia de la tienda: no se reenvía ──
  check(
    debeReenviarAlErp({ pedido: { id: 'w1' }, error: null, cabeceras: cabecerasWompi() }) === false,
    '2: con pedido web encontrado no se reenvía'
  )
  check(
    debeReenviarAlErp({ pedido: null, error: { code: 'PGRST116' }, cabeceras: cabecerasWompi() }) === true,
    '2: sin filas (PGRST116) sí se reenvía'
  )
  check(
    debeReenviarAlErp({ pedido: null, error: null, cabeceras: cabecerasWompi() }) === true,
    '2: sin pedido y sin error sí se reenvía'
  )
  check(
    debeReenviarAlErp({ pedido: null, error: { code: '57014', message: 'timeout' }, cabeceras: cabecerasWompi() }) === false,
    '2: un error real de la base no se reenvía (podría ser un pedido de la tienda)'
  )

  // En la ruta, el reenvío está DESPUÉS de todos los flujos de la tienda y de buscar el pedido.
  {
    const ruta = readFileSync(join(ROOT, 'app/api/webhooks/wompi_co/route.ts'), 'utf8')
    const pos = (s) => ruta.indexOf(s)
    const reenvio = pos('reenviarWompiAlErp({')
    check(reenvio > 0, '2: la ruta llama a reenviarWompiAlErp')
    check(ruta.split('reenviarWompiAlErp({').length === 2, '2: un solo punto de reenvío en la ruta')
    for (const flujo of [
      'esReferenciaDeposito(reference)',
      'esReferenciaAbonoMesa(reference)',
      'isReservationReference(reference)',
      'isMembershipReference(reference)',
      'isTicketReference(reference)',
      'isParkingPassReference(reference)',
      'isInvoiceReference(reference)',
      ".from('web_orders')",
    ]) {
      check(pos(flujo) > 0 && pos(flujo) < reenvio, `2: «${flujo}» debe resolverse antes del reenvío`)
    }
    check(pos('debeReenviarAlErp({ pedido: webOrder, error: orderError') > 0, '2: la decisión usa el resultado de la búsqueda del pedido')
    check(pos('cuerpo: cuerpoCrudo') > reenvio, '2: se reenvían los bytes crudos, no el JSON re-serializado')
    check(pos("event !== 'transaction.updated'") < reenvio, '2: los eventos que no son de transacción siguen ignorándose')
  }

  // ── 3. Evento ya reenviado: no se reenvía ──
  {
    const h = cabecerasWompi({ [CABECERA_REENVIADO]: 'wompi_co' })
    check(yaReenviado(h) === true, '3: detecta la cabecera marcador')
    check(debeReenviarAlErp({ pedido: null, error: { code: 'PGRST116' }, cabeceras: h }) === false, '3: no reenvía lo ya reenviado')
    check(yaReenviado(cabecerasWompi()) === false, '3: sin marcador no lo da por reenviado')
  }
  // La URL del ERP apunta al mismo host de la tienda: tampoco se llama.
  {
    const f = fetchFalso({ status: 200 })
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'erp.ejemplo.test:443', url: ERP, fetchImpl: f.impl })
    check(f.llamadas.length === 0 && r.status === 404, '3b: no se reenvía a sí misma')
  }

  // ── 4. ERP caído → 5xx ──
  {
    const f = fetchFalso({ status: 500, cuerpo: '{"received":true,"processed":false}' })
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: ERP, fetchImpl: f.impl })
    check(r.status === 500, '4: el 500 del ERP vuelve como 500')
    check(f.llamadas.length === 1, '4: un solo intento, sin reintentos en bucle')
  }
  {
    const f = fetchFalso(new TypeError('fetch failed'))
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: ERP, fetchImpl: f.impl })
    check(r.status === 502, '4: ERP inalcanzable → 502')
    check(f.llamadas.length === 1, '4: inalcanzable: un solo intento')
  }
  {
    const lento = (_url, init) =>
      new Promise((_res, rej) => {
        init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
      })
    const f = fetchFalso(lento)
    const inicio = Date.now()
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: ERP, fetchImpl: f.impl, tiempoLimiteMs: 50 })
    check(r.status === 504, '4: ERP que no responde a tiempo → 504')
    check(Date.now() - inicio < 2000, '4: el tiempo límite corta la espera')
  }
  {
    const f = fetchFalso({ status: 308 })
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: ERP, fetchImpl: f.impl })
    check(r.status === 502, '4: una redirección del ERP no se toma por respuesta (502)')
  }
  {
    const f = fetchFalso({ status: 200 })
    const r = await reenviarWompiAlErp({ cuerpo: bytes, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: null, fetchImpl: f.impl })
    check(r.status === 503 && f.llamadas.length === 0, '4: sin URL válida del ERP → 503 sin llamar')
  }
  {
    const f = fetchFalso({ status: 200 })
    const grande = new Uint8Array(300 * 1024)
    const r = await reenviarWompiAlErp({ cuerpo: grande, cabeceras: cabecerasWompi(), hostEntrante: 'tienda.ejemplo.test', url: ERP, fetchImpl: f.impl })
    check(r.status === 413 && f.llamadas.length === 0, '4: un cuerpo desmedido no se reenvía')
  }

  // ── URL del ERP ──
  check(urlWebhookWompiErp('https://app.ejemplo.test/') === `https://app.ejemplo.test${RUTA_WEBHOOK_WOMPI_ERP}`, 'url: base con barra final')
  check(urlWebhookWompiErp('https://app.ejemplo.test/ruta/rara') === `https://app.ejemplo.test${RUTA_WEBHOOK_WOMPI_ERP}`, 'url: solo el origen')
  check(urlWebhookWompiErp('') === `https://app.goadmin.io${RUTA_WEBHOOK_WOMPI_ERP}`, 'url: vacía → ERP por defecto (como erp-auto-confirm)')
  check(urlWebhookWompiErp('http://app.ejemplo.test') === null, 'url: http fuera de localhost no')
  check(urlWebhookWompiErp('http://localhost:3000') === `http://localhost:3000${RUTA_WEBHOOK_WOMPI_ERP}`, 'url: http en localhost sí')
  check(urlWebhookWompiErp('no es url') === null, 'url: inválida → null')

  // ── Registros: nada sensible ──
  const todo = registros.join('\n')
  for (const sensible of [CHECKSUM, SECRETO_FALSO, 'pagador@ejemplo.test', 'sb-access-token', '"signature"']) {
    check(!todo.includes(sensible), `logs: no deben contener ${sensible}`)
  }

  console.log = original.log
  console.error = original.error
  if (problemas.length > 0) {
    console.error(`verify-reenvio-wompi: ${problemas.length} de ${casos} comprobaciones fallaron`)
    for (const p of problemas) console.error(`  ✗ ${p}`)
    process.exit(1)
  }
  console.log(`verify-reenvio-wompi: ${casos} comprobaciones OK`)
}

main().catch((err) => {
  console.log = original.log
  console.error = original.error
  console.error(err)
  process.exit(1)
})
