/**
 * verify-tracking.mjs — compuerta de contrato entre `getShipmentByTracking` y el esquema real.
 *
 *   node --env-file=.env.local scripts/verify-tracking.mjs
 *   npm run verify:tracking
 *
 * Por qué existe: `getShipmentByTracking` devolvía `null` para cualquier guía porque
 * seleccionaba nueve columnas que no existen. `tsc` no lo detecta —`types/database.ts`
 * está escrito a mano y no incluye ninguna tabla de transporte, y la función usa
 * `as any`— y el repo no tiene framework de tests. Esta es la comprobación que faltaba.
 *
 * No duplica la consulta: LEE los `select` del propio `lib/supabase/queries.ts` y los
 * ejecuta contra la base real. Si alguien vuelve a poner un nombre de columna que no
 * existe, PostgREST responde 42703 y este script falla — que es exactamente el modo
 * de fallo que se nos escapó a producción.
 *
 * No importa el módulo TypeScript directamente a propósito: depende de los alias `@/`
 * y de `next/headers`, que no resuelven fuera del build de Next. Verificar el contrato
 * con el esquema es lo que aporta valor aquí; el resto de la función es glue.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const QUERIES = join(ROOT, 'lib', 'supabase', 'queries.ts')

// Guía real de producción. Se puede sobreescribir:
//   TRACKING_NUMBER=... TRACKING_ORG_ID=... node --env-file=.env.local scripts/verify-tracking.mjs
const TRACKING_NUMBER = process.env.TRACKING_NUMBER || 'TRK-1788987335821-4941'
const ORG_ID = Number(process.env.TRACKING_ORG_ID || 135)

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const problems = []
const notes = []

function fail(msg) {
  problems.push(msg)
}

/** Extrae el cuerpo de la función getShipmentByTracking del fuente. */
function extractFunction(source) {
  const start = source.indexOf('export async function getShipmentByTracking')
  if (start === -1) return null
  // Hasta el siguiente `export ` a nivel de módulo, o el final del archivo.
  const next = source.indexOf('\nexport ', start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}

/** Saca la lista de columnas del `.select(...)` que sigue a `.from('<tabla>')`. */
function extractSelectFor(fnBody, table) {
  const from = fnBody.indexOf(`.from('${table}')`)
  if (from === -1) return null
  const rest = fnBody.slice(from)
  const m = rest.match(/\.select\(\s*(`([^`]*)`|'([^']*)')/)
  if (!m) return null
  return (m[2] ?? m[3]).replace(/\s+/g, ' ').trim()
}

async function rest(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  if (!URL_BASE || !KEY) {
    fail(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
        'Corre con: node --env-file=.env.local scripts/verify-tracking.mjs'
    )
    return
  }

  const source = await readFile(QUERIES, 'utf8')
  const fnBody = extractFunction(source)
  if (!fnBody) {
    fail('No se encontró getShipmentByTracking en lib/supabase/queries.ts')
    return
  }

  // ── 1. Filtro por organización ────────────────────────────────────────────────
  // Sin él, el sitio de una organización rastrea guías de otra, y tracking_number
  // no es único entre organizaciones.
  if (!/\.eq\(\s*'organization_id'/.test(fnBody)) {
    fail('getShipmentByTracking no filtra por organization_id: fuga entre organizaciones')
  }

  // ── 2. `.single()` sobre un índice no único ───────────────────────────────────
  if (/\.single\(\)/.test(fnBody)) {
    fail(
      '.single() sobre tracking_number: idx_shipments_tracking NO es único, ' +
        'y .single() lanza tanto con 0 filas como con más de una. Usa .maybeSingle().'
    )
  }

  // ── 3. Contrato de columnas contra el esquema real ────────────────────────────
  const shipmentSelect = extractSelectFor(fnBody, 'shipments')
  const podSelect = extractSelectFor(fnBody, 'proof_of_delivery')
  const eventSelect = extractSelectFor(fnBody, 'transport_events')

  if (!shipmentSelect) {
    fail('No se pudo extraer el select de shipments')
  } else {
    const q =
      `shipments?select=${encodeURIComponent(shipmentSelect)}` +
      `&tracking_number=eq.${encodeURIComponent(TRACKING_NUMBER)}` +
      `&organization_id=eq.${ORG_ID}`
    const r = await rest(q)
    if (!r.ok) {
      fail(
        `El select de shipments no es válido contra el esquema (HTTP ${r.status}): ` +
          `${JSON.stringify(r.json)}`
      )
    } else if (!Array.isArray(r.json) || r.json.length === 0) {
      fail(
        `La guía ${TRACKING_NUMBER} (org ${ORG_ID}) no devolvió ningún envío. ` +
          'Si la guía ya no existe, pasa otra con TRACKING_NUMBER y TRACKING_ORG_ID.'
      )
    } else {
      notes.push(
        `shipments OK — guía ${TRACKING_NUMBER}, estado "${r.json[0].status}", ` +
          `destino ${r.json[0].delivery_city || 'sin ciudad'}`
      )

      // Aislamiento: la misma guía pedida desde otra organización no debe aparecer.
      const otra = await rest(
        `shipments?select=id&tracking_number=eq.${encodeURIComponent(TRACKING_NUMBER)}` +
          `&organization_id=neq.${ORG_ID}`
      )
      if (otra.ok && Array.isArray(otra.json) && otra.json.length > 0) {
        fail(
          `La guía ${TRACKING_NUMBER} también existe en otra organización: el filtro ` +
            'por organization_id es imprescindible y este caso lo demuestra.'
        )
      }
    }
  }

  if (!eventSelect) {
    fail('No se pudo extraer el select de transport_events')
  } else {
    const r = await rest(
      `transport_events?select=${encodeURIComponent(eventSelect)}&reference_type=eq.shipment&limit=1`
    )
    if (!r.ok) {
      fail(
        `El select de transport_events no es válido (HTTP ${r.status}): ${JSON.stringify(r.json)}`
      )
    } else {
      // Hoy los envíos web nacen sin eventos (la ruta de auto-confirmación no los
      // registra), así que 0 eventos es un resultado válido, no un fallo.
      notes.push('transport_events OK — el select compila contra el esquema')
    }
  }

  if (!podSelect) {
    fail('No se pudo extraer el select de proof_of_delivery')
  } else {
    const r = await rest(`proof_of_delivery?select=${encodeURIComponent(podSelect)}&limit=1`)
    if (!r.ok) {
      fail(
        `El select de proof_of_delivery no es válido (HTTP ${r.status}): ${JSON.stringify(r.json)}`
      )
    } else {
      notes.push('proof_of_delivery OK — el select compila contra el esquema')
    }
  }
}

await main()

for (const n of notes) console.log(`  ✓ ${n}`)

if (problems.length > 0) {
  console.error('\nverify:tracking FALLÓ\n')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error('')
  process.exit(1)
}

console.log('\nverify:tracking OK\n')
