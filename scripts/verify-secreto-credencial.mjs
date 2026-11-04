/**
 * verify-secreto-credencial.mjs — credenciales de pasarela desde el Vault o en claro.
 *
 *   npm run verify:secreto-credencial
 *
 * - resolverSecretoCredencial: valor en claro tal cual (sin llamar al Vault); uuid → Vault con
 *   fn_get_provider_secret(conexión, propósito); Vault caído o vacío → '' (nunca el uuid).
 * - checkout/init y el webhook de Bold ya no llaman a get_decrypted_secret (no existe en la base).
 */
import { readFileSync } from 'node:fs'
import { resolverSecretoCredencial, esReferenciaVault } from '../lib/integraciones/secretoCredencial.ts'

let casos = 0
const problemas = []
const check = (c, m) => { casos++; if (!c) problemas.push(m) }
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8')
const UUID = '3f2b1c9e-8d7a-4b6c-9e1f-0a2b3c4d5e6f'
const cliente = (respuesta) => { const llamadas = []; return { llamadas, rpc: async (fn, args) => { llamadas.push([fn, args]); return respuesta } } }

check(esReferenciaVault(UUID) && esReferenciaVault(UUID.toUpperCase()), 'uuid del Vault')
for (const v of ['pub_test_x', 'prv_prod_y', '', null, undefined, 5, `${UUID}x`]) check(!esReferenciaVault(v), `no es uuid: ${JSON.stringify(v)}`)

{
  const c = cliente({ data: 'no', error: null })
  check(await resolverSecretoCredencial(c, 'c1', 'integrity_secret', 'prod_integrity_abc') === 'prod_integrity_abc', 'en claro: tal cual')
  check(c.llamadas.length === 0, 'en claro: no llama al Vault')
}
{
  const c = cliente({ data: 'del-vault', error: null })
  check(await resolverSecretoCredencial(c, 'c1', 'private_key', UUID) === 'del-vault', 'uuid: valor del Vault')
  check(JSON.stringify(c.llamadas) === JSON.stringify([['fn_get_provider_secret', { p_connection_id: 'c1', p_purpose: 'private_key' }]]), 'uuid: fn_get_provider_secret(conexión, propósito)')
}
const errorOriginal = console.error
console.error = () => {}
for (const r of [{ data: null, error: { message: 'denegado' } }, { data: null, error: null }, { data: '', error: null }]) {
  check(await resolverSecretoCredencial(cliente(r), 'c1', 'events_secret', UUID) === '', `uuid y Vault sin valor (${JSON.stringify(r)}): '' y nunca el uuid`)
}
console.error = errorOriginal
check(await resolverSecretoCredencial(cliente({ data: 'x', error: null }), 'c1', 'public_key', null) === '', 'sin secret_ref: vacío')

for (const f of ['app/api/checkout/init/route.ts', 'app/api/webhooks/bold/route.ts']) {
  const src = leer(f)
  check(!src.includes("'get_decrypted_secret'"), `${f}: sin get_decrypted_secret (no existe en la base)`)
  check(src.includes('resolverSecretoCredencial('), `${f}: lee con resolverSecretoCredencial`)
}
check(/resolverSecretoCredencial\(supabase, connectionId, cred\.purpose \|\| cred\.credential_type, cred\.secret_ref\)/.test(leer('app/api/checkout/init/route.ts')), 'checkout/init: cada credencial por su propósito')
check(leer('lib/payments/wompi-firma.ts').includes("rpc('fn_get_provider_secret'"), 'webhook de Wompi: lee events_secret del Vault (wompi-firma.ts)')

if (problemas.length) {
  console.error(`verify-secreto-credencial: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-secreto-credencial: ${casos} casos`)
