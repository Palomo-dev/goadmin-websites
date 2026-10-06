/**
 * verify-reservas-deposito — contrato del depósito de reservas de mesa y del
 * teléfono con país (ERP: migración D7 `20261006170000_reservas_deposito_web`).
 *
 *   npm run verify:reservas-deposito
 *   ERP_REPO=/ruta/a/go-admin-erp npm run verify:reservas-deposito
 *
 * Sin dependencias nuevas:
 * 1. Lógica pura de `lib/restaurant/deposito-modelo.ts` (cotización, monto por
 *    persona, referencia `MESA-…`, estados de Wompi).
 * 2. Teléfono: `lib/utils/telefono.ts` (copia del ERP) da E.164 por país.
 * 3. Fuentes: la ruta guarda el teléfono en E.164; el webhook despacha `MESA-`
 *    antes que nada, falla cerrado (401) y deduplica por `external_event_id`;
 *    `/api/checkout/init` tiene la fuente con su `else`; las RPC se llaman con
 *    parámetros por nombre.
 * 4. Si el ERP está al lado: cada RPC que llama el sitio existe en la migración
 *    con EXACTAMENTE esos parámetros (un nombre mal escrito daría PGRST202 y el
 *    sitio caería en silencio a «sin depósito»).
 * 5. Con `.env.local` (SUPABASE_URL y SERVICE_ROLE): la RPC de cotización
 *    responde (o PGRST202 si la migración aún no está aplicada: se avisa).
 */
import { readFile, writeFile, mkdtemp, mkdir, rm, access } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'go-admin-erp'))
let fallos = 0
let total = 0
const notas = []
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}
const existe = (p) => access(p).then(() => true, () => false)
const leer = (rel) => readFile(join(ROOT, rel), 'utf8')

// Módulos TS → .mjs dentro del repo (para que resuelva node_modules).
const tmp = await mkdtemp(join(ROOT, 'node_modules', '.verify-deposito-'))
let modelo, tel
try {
  await mkdir(join(tmp, 'utils'), { recursive: true })
  await mkdir(join(tmp, 'data'), { recursive: true })
  await writeFile(join(tmp, 'modelo.mjs'), stripTypeScriptTypes(await leer('lib/restaurant/deposito-modelo.ts'), { mode: 'strip' }))
  await writeFile(join(tmp, 'data/countryPhoneCodes.mjs'), stripTypeScriptTypes(await leer('lib/data/countryPhoneCodes.ts'), { mode: 'strip' }))
  const telTs = (await leer('lib/utils/telefono.ts')).replace("'../data/countryPhoneCodes'", "'../data/countryPhoneCodes.mjs'")
  await writeFile(join(tmp, 'utils/telefono.mjs'), stripTypeScriptTypes(telTs, { mode: 'strip' }))
  modelo = await import(pathToFileURL(join(tmp, 'modelo.mjs')).href)
  tel = await import(pathToFileURL(join(tmp, 'utils/telefono.mjs')).href)
} finally {
  await rm(tmp, { recursive: true, force: true })
}

// ─── 1. Modelo del depósito ──────────────────────────────────────────────────
const c = modelo.parseCotizacion({
  requiere: true, monto_base: 20000, por_persona: true, moneda: 'cop', reembolsable: true, horas_reembolso: 4,
  politica: 'Guardamos la mesa 15 min', pasarela: 'wompi_co', minutos_para_pagar: 30,
})
check(c.requiere && c.moneda === 'COP' && c.porPersona && c.horasReembolso === 4, 'parseCotizacion lee la respuesta de la RPC')
check(modelo.montoParaPersonas(c, 4) === 80000, 'por persona: 4 × 20.000 = 80.000')
check(modelo.montoParaPersonas({ ...c, porPersona: false }, 4) === 20000, 'monto fijo: no multiplica')
check(modelo.parseCotizacion({ requiere: false, motivo: 'SIN_PASARELA' }).requiere === false, 'sin pasarela → sin depósito')
check(modelo.parseCotizacion(null).requiere === false, 'respuesta vacía → sin depósito')
check(modelo.parseCotizacion({ requiere: true, monto_base: 0 }).requiere === false, 'monto 0 → sin depósito')
check(/80\.000/.test(modelo.textoDeposito(c, 4)) && /4 h antes/.test(modelo.textoDeposito(c, 4)), 'texto: monto y plazo de reembolso')
check(/No es reembolsable/.test(modelo.textoDeposito({ ...c, reembolsable: false }, 2)), 'texto: no reembolsable')
const ref = 'MESA-' + 'A'.repeat(32)
check(modelo.esReferenciaDeposito(ref) && !modelo.esReferenciaDeposito('RES-ABCDEF12') && !modelo.esReferenciaDeposito('MESA-123'), 'referencia MESA-<32 hex>')
check(modelo.esReferenciaDeposito('MESA-' + '0123456789ABCDEF0123456789ABCDEF'), 'referencia con dígitos y A-F')
check(modelo.estadoDepositoWompi('APPROVED') === 'paid' && modelo.estadoDepositoWompi('DECLINED') === 'failed' &&
  modelo.estadoDepositoWompi('ERROR') === 'failed' && modelo.estadoDepositoWompi('VOIDED') === 'refunded' &&
  modelo.estadoDepositoWompi('PENDING') === 'pending' && modelo.estadoDepositoWompi(undefined) === 'pending', 'estados de Wompi')
const creado = modelo.parseDepositoCreado({ monto: 80000, moneda: 'COP', referencia: ref, vence: '2026-10-06T20:00:00Z', pasarela: 'wompi_co', estado_al_pagar: 'confirmed', reembolsable: true })
check(creado && creado.monto === 80000 && creado.estadoAlPagar === 'confirmed', 'parseDepositoCreado')
check(modelo.parseDepositoCreado({ monto: 1, referencia: 'RES-1', pasarela: 'wompi_co' }) === null, 'depósito sin referencia MESA- → null')
check(modelo.FUENTE_COBRO_DEPOSITO === 'restaurant_reservation', 'fuente de cobro')

// ─── 2. Teléfono con país ────────────────────────────────────────────────────
check(tel.aE164('300 1234567') === '+573001234567', 'nacional de Colombia → E.164')
check(tel.aE164('+57 300 123 4567') === '+573001234567', 'con indicativo y espacios → E.164')
check(tel.aE164('+1 (201) 555-0123') === '+12015550123', '+1 → E.164')
check(tel.aE164('123') === null, 'incompleto → null')
check(tel.esTelefonoValido('+573001234567') && !tel.esTelefonoValido('+57 300'), 'validación por país')
check(tel.normalizarTelefono('+573001234567') === '+57 3001234567', 'E.164 → «+57 3001234567» (Wompi separa por el espacio)')
check(/incompleto/.test(tel.mensajeErrorTelefono('+57 300') ?? ''), 'mensaje de número incompleto')

// ─── 3. Fuentes ──────────────────────────────────────────────────────────────
const ruta = await leer('app/api/restaurant-reservations/route.ts')
check(/aE164\(/.test(ruta) && /TELEFONO_INVALIDO/.test(ruta) && /p_customer_phone: telefono/.test(ruta), 'la ruta guarda el teléfono en E.164 y rechaza uno inválido')
check(/crearReservaWebConDeposito/.test(ruta) && !/crearReservaWeb\(supabase/.test(ruta), 'la ruta crea por crearReservaWebConDeposito')
check(/if \(deposito\)[\s\S]{0,900}\} else \{/.test(ruta), 'el if del depósito lleva su else')

const wompi = await leer('app/api/webhooks/wompi_co/route.ts')
const iMesa = wompi.indexOf('esReferenciaDeposito(reference)')
check(iMesa > 0 && iMesa < wompi.indexOf('isReservationReference(reference)'), 'el webhook despacha MESA- antes que RES- y el resto')
check(/esReferenciaDeposito\(reference\)\) \{[\s\S]{0,200}\} else \{/.test(wompi), 'el if del depósito en el webhook lleva su else')

// Firma, idempotencia e integration_events viven en el esqueleto compartido con el abono de la
// Carta QR (lib/payments/wompi-cobro-firmado.ts); lo propio del depósito, en deposito-webhook.ts.
const hook = (await leer('lib/restaurant/deposito-webhook.ts')) + '\n' + (await leer('lib/payments/wompi-cobro-firmado.ts'))
check(/verdict !== 'match'[\s\S]{0,300}status: 401/.test(hook), 'webhook del depósito: sin firma válida → 401 (falla cerrado)')
check(!/SIGNATURE_ENFORCED/.test(hook), 'webhook del depósito no depende del modo observación')
check(/external_event_id: transactionId/.test(hook) && /'23505'/.test(hook), 'idempotente por external_event_id (23505)')
check(/status: 'received'/.test(hook) && /'processed' \| 'error'/.test(hook) && !/event_time\s*:/.test(hook), 'integration_events: estados válidos y sin event_time')
check(/\.eq\('deposit_reference', reference\)/.test(hook) && /p_organization_id: reserva\.organizationId/.test(hook), 'la organización sale de la reserva, no del payload')

const init = await leer('app/api/checkout/init/route.ts')
check(/isDepositoMesa\)? \{[\s\S]{0,300}\} else if \(isParkingPass\)/.test(init) || /if \(isDepositoMesa\) \{[\s\S]{0,300}\} else if \(isParkingPass\)/.test(init), 'checkout/init: la escritura de la fuente nueva no toca web_orders')
check(/reservaConDepositoPorCobrar\(supabase, sourceId, hostOrgId\)/.test(init), 'checkout/init lee la reserva con la organización del host')

const llamadas = {}
for (const rel of ['lib/restaurant/deposito-servidor.ts', 'lib/restaurant/deposito-webhook.ts']) {
  const f = await leer(rel)
  for (const m of f.matchAll(/\.rpc\(\s*'([a-z_]+)'\s*,\s*\{([^}]*)\}/g)) {
    llamadas[m[1]] = [...m[2].matchAll(/(p_[a-z_]+)\s*:/g)].map((x) => x[1]).sort()
  }
  for (const m of f.matchAll(/\.rpc\(\s*'([a-z_]+)'\s*,\s*([^{\s])/g)) check(false, `${rel}: ${m[1]} sin parámetros por nombre`)
}
check(Object.keys(llamadas).length >= 3, 'el sitio llama a cotizar, crear y resultado')

// ─── 4. Contra la migración del ERP ──────────────────────────────────────────
const migracion = join(ERP, 'supabase/migrations/20261006170000_reservas_deposito_web.sql')
if (await existe(migracion)) {
  const sql = await readFile(migracion, 'utf8')
  for (const [fn, params] of Object.entries(llamadas)) {
    const m = new RegExp(`create or replace function public\\.${fn}\\(([\\s\\S]*?)\\)\\s*returns`, 'i').exec(sql)
    check(!!m, `la migración define ${fn}`)
    if (!m) continue
    const definidos = [...m[1].matchAll(/(p_[a-z_]+)\s+[a-z]/g)].map((x) => x[1])
    for (const p of params) check(definidos.includes(p), `${fn}: el parámetro ${p} no existe en la migración`)
    const obligatorios = m[1].split(',').filter((l) => /p_[a-z_]+/.test(l) && !/default/i.test(l)).map((l) => /(p_[a-z_]+)/.exec(l)[1])
    for (const p of obligatorios) check(params.includes(p), `${fn}: falta el parámetro obligatorio ${p}`)
  }
  check(/revoke all on function public\.fn_reserva_mesa_crear_web[^;]*anon/.test(sql), 'crear_web revocada a anon')
  check(!/'[^'\n]*;[^'\n]*'/.test(sql.replace(/^--.*$/gm, '')), 'sin «;» dentro de literales')
  check(!/\bdrop\b|\bdelete\s+from\b/i.test(sql.replace(/^--.*$/gm, '')), 'migración aditiva: sin DROP ni DELETE')
  check(await existe(join(ERP, 'supabase/rollbacks/20261006170000_reservas_deposito_web_rollback.sql')), 'la migración tiene su rollback')
} else {
  notas.push(`Sin el ERP en ${ERP}: no se cruzan los parámetros con la migración (ERP_REPO=…).`)
}

// ─── 5. Base real (opcional) ─────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (url && key) {
  const res = await fetch(`${url}/rest/v1/rpc/fn_reserva_mesa_deposito_cotizar`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_organization_id: 140, p_branch_id: null, p_party_size: 2 }),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: String(e) }) }))
  const cuerpo = await res.json().catch(() => ({}))
  if (res.ok) check(typeof cuerpo === 'object' && 'requiere' in cuerpo, 'la RPC de cotización responde { requiere, … }')
  else if (cuerpo?.code === 'PGRST202') notas.push('La migración D7 aún no está aplicada (PGRST202): el sitio reserva sin depósito, como hoy.')
  else notas.push(`No se pudo consultar la base (${res.status}): ${cuerpo?.message ?? ''}`)
} else {
  notas.push('Sin .env.local: no se consulta la base.')
}

for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-reservas-deposito: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-reservas-deposito: ${total} comprobaciones OK`)
