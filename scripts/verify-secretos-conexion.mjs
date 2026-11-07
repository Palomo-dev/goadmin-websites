/**
 * verify-secretos-conexion.mjs — lector dual de credenciales de pasarela (lib/payments/secretosConexion.ts).
 *
 *   npm run verify:secretos
 *
 * Sin red ni base: carga el módulo PURO real con `module.stripTypeScriptTypes` de Node 22 y un
 * cliente falso. Lo que se garantiza:
 *  1. Las credenciales guardadas hoy (valor en claro) se devuelven IGUAL y sin ninguna RPC.
 *  2. Un `secret_ref` uuid (bóveda) se resuelve con fn_get_provider_secret(conexión, propósito).
 *  3. Un uuid que la bóveda no resuelve nunca se usa como secreto (queda '').
 *  4. Los lectores de la tienda usan el módulo (checkout/init y webhooks de pasarela).
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-secretos-'))
let m
try {
  const ts = await readFile(join(ROOT, 'lib/payments/secretosConexion.ts'), 'utf8')
  await writeFile(join(dir, 'secretosConexion.mjs'), stripTypeScriptTypes(ts, { mode: 'strip' }))
  m = await import(pathToFileURL(join(dir, 'secretosConexion.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

const CONEXION = 'cccccccc-cccc-4ccc-8ccc-000000000001'
const UUID_A = '44444444-4444-4444-8444-000000000001'
const UUID_B = '44444444-4444-4444-8444-000000000002'

function clienteFalso(boveda = {}) {
  const llamadas = []
  return {
    llamadas,
    rpc: async (fn, args) => {
      llamadas.push([fn, args])
      if (fn !== 'fn_get_provider_secret') return { data: null, error: { message: 'no existe' } }
      return { data: boveda[args.p_purpose] ?? null, error: null }
    },
  }
}

let n = 0
const caso = async (nombre, fn) => {
  await fn()
  n++
  console.log(`  ✓ ${nombre}`)
}
console.error = () => {} // el aviso de «uuid sin valor» es esperado en un caso

// 1. Forma de hoy: idéntica y sin RPC (como las 4 organizaciones con Wompi).
await caso('valores en claro: iguales y sin RPC', async () => {
  const c = clienteFalso()
  const filas = [
    { purpose: 'public_key', secret_ref: 'pub_prod_FALSO1', credential_type: 'api_key' },
    { purpose: 'private_key', secret_ref: 'prv_prod_FALSO2', credential_type: 'api_key' },
    { purpose: 'events_secret', secret_ref: 'prod_events_FALSO3', credential_type: 'secret' },
    { purpose: 'integrity_secret', secret_ref: 'prod_integrity_FALSO4', credential_type: 'secret' },
  ]
  const r = await m.resolverCredenciales(c, CONEXION, filas)
  assert.deepEqual(r, filas)
  assert.equal(c.llamadas.length, 0)
  assert.equal(await m.valorDeCredencial(c, CONEXION, 'secret_key', 'sk_live_FALSO'), 'sk_live_FALSO')
  assert.equal(c.llamadas.length, 0)
})

await caso('sin filas: lista vacía (los lectores siguen devolviendo «sin credenciales»)', async () => {
  assert.deepEqual(await m.resolverCredenciales(clienteFalso(), CONEXION, null), [])
})

// 2. Bóveda.
await caso('uuid de la bóveda: se resuelve por conexión y propósito', async () => {
  const c = clienteFalso({ access_token: 'APP_USR-BOVEDA', webhook_secret: 'whsec_BOVEDA' })
  const r = await m.resolverCredenciales(c, CONEXION, [
    { purpose: 'access_token', secret_ref: UUID_A },
    { purpose: 'webhook_secret', secret_ref: UUID_B },
    { purpose: 'public_key', secret_ref: 'APP_USR-PUBLICA' },
  ])
  assert.deepEqual(r.map((f) => f.secret_ref), ['APP_USR-BOVEDA', 'whsec_BOVEDA', 'APP_USR-PUBLICA'])
  assert.deepEqual(c.llamadas, [
    ['fn_get_provider_secret', { p_connection_id: CONEXION, p_purpose: 'access_token' }],
    ['fn_get_provider_secret', { p_connection_id: CONEXION, p_purpose: 'webhook_secret' }],
  ])
})

// 3. Nunca el uuid como secreto.
await caso('uuid sin valor en la bóveda: queda vacío, nunca el uuid', async () => {
  const c = clienteFalso({})
  assert.equal(await m.valorDeCredencial(c, CONEXION, 'secret_key', UUID_A), '')
  const lanza = { rpc: async () => { throw new Error('red') } }
  assert.equal(await m.valorDeCredencial(lanza, CONEXION, 'secret_key', UUID_A), '')
})

// 4. Los lectores usan el módulo y ya no llaman a la RPC inexistente.
await caso('checkout/init y webhooks de pasarela usan el lector dual', async () => {
  const lectores = [
    'app/api/checkout/init/route.ts',
    'app/api/webhooks/bold/route.ts',
    'app/api/webhooks/mercadopago/route.ts',
    'app/api/webhooks/meta/route.ts',
    'app/api/webhooks/paypal/route.ts',
    'app/api/webhooks/payu/route.ts',
    'app/api/webhooks/stripe/route.ts',
    'app/api/meta/send-event/route.ts',
    'lib/meta/send-capi-event.ts',
    'lib/google-ads/upload-conversion.ts',
  ]
  for (const ruta of lectores) {
    const src = await readFile(join(ROOT, ruta), 'utf8')
    assert.match(src, /from '@\/lib\/payments\/secretosConexion'/, `${ruta} importa el lector dual`)
    assert.doesNotMatch(src, /rpc\(\s*'get_decrypted_secret'/, `${ruta} no llama a la RPC inexistente`)
  }
  // Wompi ya era dual por su cuenta.
  assert.match(await readFile(join(ROOT, 'lib/payments/wompi-firma.ts'), 'utf8'), /fn_get_provider_secret/)
})

// 5. Meta: «Qué se envía» del asistente del ERP (compras apagadas → no se envía) y el estado real.
await caso('Meta respeta meta_envios.compras y el estado connected', async () => {
  for (const ruta of ['lib/meta/send-capi-event.ts', 'app/api/meta/send-event/route.ts']) {
    const src = await readFile(join(ROOT, ruta), 'utf8')
    assert.match(src, /meta_envios\?\.compras === false/, `${ruta} respeta el interruptor de compras`)
    assert.match(src, /\.in\('status', \['active', 'connected'\]\)/, `${ruta} acepta el estado connected`)
  }
})

console.log(`verify-secretos-conexion: ${n} casos OK`)
