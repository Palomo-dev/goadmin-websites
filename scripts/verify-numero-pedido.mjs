/**
 * verify-numero-pedido.mjs — número del pedido web configurable por organización.
 *
 *   npm run verify:numero-pedido
 *
 * Sin base de datos ni red: importa el módulo real (`lib/orders/numeroPedido.ts`) con un cliente
 * falso, y lee el fuente de las rutas para comprobar DÓNDE se usa.
 *
 * Casos:
 *  1. El RPC entrega el número de la organización (consecutivo `PED-0001`, corto `PED-XXXXXX`).
 *  2. Formato actual (RPC devuelve null), RPC sin aplicar, sin permiso o caído → `WO-{org}-…`.
 *  3. Choque con un número existente (índice único) → se pide otro; otro índice único no reintenta.
 *  4. El checkout crea el pedido con ese número (ya no lo arma él) y los webhooks encuentran el
 *     pedido de un cobro por `order_number`, sin deducir la organización del prefijo `WO-{org}-`:
 *     sirve igual para un número nuevo (`PED-0001`) que para uno viejo (`WO-333-…`).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INDICE_NUMERO_UNICO,
  INTENTOS_NUMERO,
  RPC_SIGUIENTE_NUMERO,
  esNumeroRepetido,
  generarNumeroPedido,
  insertarConNumero,
  numeroLegado,
} from '../lib/orders/numeroPedido.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const avisos = []
console.warn = (...a) => avisos.push(a.map(String).join(' '))

/** Cliente falso: el RPC responde lo que diga `respuestas` en orden. */
function cliente(respuestas) {
  const llamadas = []
  return {
    llamadas,
    rpc: async (fn, args) => {
      llamadas.push({ fn, args })
      const r = respuestas.shift()
      if (r instanceof Error) throw r
      return r ?? { data: null, error: null }
    },
  }
}
const AHORA = () => 1_763_000_000_000
const LEGADO = /^WO-333-[A-Z0-9]+-[A-Z0-9]{4}$/

// ─── 1. Número de la organización ──────────────────────────────────────────
{
  const c = cliente([{ data: 'PED-0001', error: null }])
  check((await generarNumeroPedido(c, 333, AHORA)) === 'PED-0001', '1a: el consecutivo del RPC no se usó')
  check(c.llamadas[0]?.fn === RPC_SIGUIENTE_NUMERO && c.llamadas[0]?.args.p_organization_id === 333, '1b: el RPC no se llamó con la organización')
  const c2 = cliente([{ data: ' PED-K7M2QX ', error: null }])
  check((await generarNumeroPedido(c2, 333, AHORA)) === 'PED-K7M2QX', '1c: el código corto no se usó (o sin recortar)')
}

// ─── 2. Formato de siempre ─────────────────────────────────────────────────
{
  check(LEGADO.test(await generarNumeroPedido(cliente([{ data: null, error: null }]), 333, AHORA)), '2a: formato actual no dio WO-{org}-…')
  check(LEGADO.test(await generarNumeroPedido(cliente([{ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }]), 333, AHORA)), '2b: sin migración no dio WO-{org}-…')
  check(LEGADO.test(await generarNumeroPedido(cliente([{ data: null, error: { code: '42501', message: 'permission denied' } }]), 333, AHORA)), '2c: sin permiso no dio WO-{org}-…')
  check(LEGADO.test(await generarNumeroPedido(cliente([new Error('red caída')]), 333, AHORA)), '2d: RPC que lanza no dio WO-{org}-…')
  check(numeroLegado(333, 1_763_000_000_000, () => 0.5) === `WO-333-${(1_763_000_000_000).toString(36).toUpperCase()}-I000`, '2e: numeroLegado cambió de forma')
}

// ─── 3. Choque de número ───────────────────────────────────────────────────
{
  const choque = { code: '23505', message: `duplicate key value violates unique constraint "${INDICE_NUMERO_UNICO}"` }
  check(esNumeroRepetido(choque), '3a: el choque del índice de número no se reconoce')
  check(!esNumeroRepetido({ code: '23505', message: 'duplicate key value violates unique constraint "idx_web_orders_round_key"' }), '3b: el choque de la ronda de mesa se tomó como número repetido')
  check(!esNumeroRepetido({ code: '23514', message: 'check' }) && !esNumeroRepetido(null), '3c: otro error se tomó como número repetido')

  const c = cliente([{ data: 'PED-AAAAAA', error: null }, { data: 'PED-BBBBBB', error: null }])
  const usados = []
  const r = await insertarConNumero(c, 333, async (n) => {
    usados.push(n)
    return usados.length === 1 ? { data: null, error: choque } : { data: { id: 'x', order_number: n }, error: null }
  }, AHORA)
  check(r.data?.order_number === 'PED-BBBBBB' && usados.join(',') === 'PED-AAAAAA,PED-BBBBBB', '3d: tras el choque no se pidió otro número')

  const siempre = cliente([])
  let intentos = 0
  const r2 = await insertarConNumero(siempre, 333, async () => {
    intentos++
    return { data: null, error: choque }
  }, AHORA)
  check(intentos === INTENTOS_NUMERO && esNumeroRepetido(r2.error), '3e: los reintentos no tienen tope o se perdió el error')

  let otros = 0
  await insertarConNumero(cliente([]), 333, async () => {
    otros++
    return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "idx_web_orders_round_key"' } }
  }, AHORA)
  check(otros === 1, '3f: un choque de otro índice se reintentó')
}

// ─── 4. Checkout y webhooks ────────────────────────────────────────────────
{
  const orders = readFileSync(join(ROOT, 'app/api/orders/route.ts'), 'utf8')
  check(!/function generateOrderNumber/.test(orders) && !/`WO-\$\{/.test(orders), '4a: el checkout sigue armando WO-{org}-… por su cuenta')
  check(/insertarConNumero/.test(orders) && /order_number: numero/.test(orders), '4b: el checkout no crea el pedido con el número de la organización')

  // Cada webhook busca el pedido por la referencia en `order_number`, sin filtrar por organización
  // ni leerla del prefijo: el número nuevo y el viejo se encuentran igual.
  for (const pasarela of ['wompi_co', 'bold', 'payu', 'mercadopago', 'paypal', 'stripe']) {
    const fuente = readFileSync(join(ROOT, `app/api/webhooks/${pasarela}/route.ts`), 'utf8')
    check(/\.eq\(\s*['"]order_number['"]\s*,\s*reference\s*\)/.test(fuente), `4c: el webhook ${pasarela} no busca el pedido por order_number`)
    check(!/\^WO-\(\\d\+\)|split\('-'\)\[1\]/.test(fuente), `4d: el webhook ${pasarela} deduce la organización del prefijo WO-{org}-`)
  }
  const wompi = readFileSync(join(ROOT, 'app/api/webhooks/wompi_co/route.ts'), 'utf8')
  const i = wompi.indexOf(".eq('order_number', reference)")
  const busqueda = wompi.slice(wompi.lastIndexOf(".from('web_orders')", i), wompi.indexOf('.single()', i))
  check(i > 0 && !/organization_id'\s*,/.test(busqueda), '4e: Wompi filtra el pedido por organización antes de conocerla')
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ número de pedido: ${casos} comprobaciones`)
