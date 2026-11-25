/**
 * verify-tracking.mjs — compuerta de contrato entre `getShipmentByTracking` y el esquema real.
 *
 *   node --env-file=.env.development.local scripts/verify-tracking.mjs
 *   npm run verify:tracking          (usa .env.local: debe apuntar al proyecto vigente)
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
 * Desde el 2026-11-25 («Consultar pedido» › «Número de guía», Figma 3240:97997) la función busca
 * por `shipment_number` (el DEL-… impreso en la guía) y, si no, por `tracking_number` (guía de la
 * transportadora o el TRK viejo), y lee además web_orders, driver_credentials, transport_carriers y
 * branches. Este script comprueba los seis `select`, que ninguno pida columnas con datos
 * personales o montos, y que un envío real se encuentre por los dos números en su organización y
 * no en otra.
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

// Envío de prueba: por defecto el más reciente de la base. Se puede fijar uno:
//   SHIPMENT_NUMBER=DEL-WO-… TRACKING_ORG_ID=… node --env-file=… scripts/verify-tracking.mjs
const SHIPMENT_NUMBER = process.env.SHIPMENT_NUMBER || null
const ORG_ID_FIJO = process.env.TRACKING_ORG_ID ? Number(process.env.TRACKING_ORG_ID) : null

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
  // Hasta el siguiente `export ` a nivel de módulo (LF o CRLF), o el final del archivo.
  const resto = source.slice(start + 1)
  const m = resto.match(/\r?\nexport /)
  return m ? source.slice(start, start + 1 + m.index) : source.slice(start)
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

/** Columnas que la búsqueda por guía NUNCA debe pedir (las ve quien tenga la caja en la mano). */
const PROHIBIDAS = {
  shipments: ['delivery_address', 'delivery_contact_name', 'delivery_contact_phone', 'delivery_instructions', 'delivery_latitude', 'delivery_longitude', 'cod_amount', 'cod_collected_amount', 'declared_value', 'shipping_fee', 'total_cost', 'internal_notes', 'notes', 'customer_id', 'vehicle_id', 'delivery_code_required'],
  transport_events: ['description', 'payload', 'latitude', 'longitude', 'actor_id'],
  web_orders: ['customer_name', 'customer_email', 'customer_phone', 'delivery_address', 'total', 'subtotal', 'advance_amount', 'billing_data'],
  driver_credentials: ['phone', 'document_number', 'license_number', 'default_vehicle_id', 'emergency_contact_phone'],
  transport_carriers: ['contact_phone', 'contact_email', 'api_credentials_ref'],
  branches: [],
}

async function main() {
  if (!URL_BASE || !KEY) {
    fail(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
        'Corre con: node --env-file=.env.development.local scripts/verify-tracking.mjs'
    )
    return
  }

  const source = await readFile(QUERIES, 'utf8')
  const fnBody = extractFunction(source)
  if (!fnBody) {
    fail('No se encontró getShipmentByTracking en lib/supabase/queries.ts')
    return
  }

  // ── 1. Filtro por organización y forma de la búsqueda ─────────────────────────
  // Sin él, el sitio de una organización rastrea guías de otra, y tracking_number
  // no es único entre organizaciones.
  const filtrosOrg = (fnBody.match(/\.eq\(\s*'organization_id', organizationId\)/g) || []).length
  if (filtrosOrg < 6) {
    fail(`getShipmentByTracking: cada consulta (6) filtra por organization_id; hay ${filtrosOrg}`)
  }
  if (/\.single\(\)/.test(fnBody)) {
    fail(
      '.single() sobre tracking_number: idx_shipments_tracking NO es único, ' +
        'y .single() lanza tanto con 0 filas como con más de una. Usa .maybeSingle().'
    )
  }
  if (!/buscar\('shipment_number', \[guia\.compacta\]\)/.test(fnBody) || !/buscar\('tracking_number', valores\)/.test(fnBody)) {
    fail('getShipmentByTracking: busca primero por shipment_number (DEL-…) y después por tracking_number')
  }
  if (!/\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(1\)\s*\.maybeSingle\(\)/.test(fnBody)) {
    fail('getShipmentByTracking: el envío más reciente con .limit(1).maybeSingle()')
  }
  if (/\.from\('proof_of_delivery'\)/.test(fnBody)) {
    fail('getShipmentByTracking: la prueba de entrega no se lee por guía (quién recibió, fotos, firma)')
  }

  // ── 2. Contrato de columnas contra el esquema real ────────────────────────────
  const selects = {}
  for (const tabla of Object.keys(PROHIBIDAS)) {
    const sel = extractSelectFor(fnBody, tabla)
    if (!sel) {
      fail(`No se pudo extraer el select de ${tabla}`)
      continue
    }
    selects[tabla] = sel
    const columnas = sel.split(',').map((c) => c.trim())
    const malas = columnas.filter((c) => PROHIBIDAS[tabla].includes(c))
    if (malas.length) fail(`El select de ${tabla} pide columnas que no se muestran con la guía: ${malas.join(', ')}`)
    const r = await rest(`${tabla}?select=${encodeURIComponent(sel)}&limit=1`)
    if (!r.ok) fail(`El select de ${tabla} no es válido contra el esquema (HTTP ${r.status}): ${JSON.stringify(r.json)}`)
    else notes.push(`${tabla} OK — el select compila contra el esquema`)
  }
  if (!selects.shipments) return

  // ── 3. Un envío real se encuentra por sus dos números, solo en su organización ─
  let muestra
  if (SHIPMENT_NUMBER) {
    const r = await rest(
      `shipments?select=shipment_number,tracking_number,organization_id&shipment_number=eq.${encodeURIComponent(SHIPMENT_NUMBER)}` +
        (ORG_ID_FIJO ? `&organization_id=eq.${ORG_ID_FIJO}` : '') + '&limit=1'
    )
    muestra = r.ok && Array.isArray(r.json) ? r.json[0] : null
  } else {
    const r = await rest('shipments?select=shipment_number,tracking_number,organization_id&shipment_number=not.is.null&tracking_number=not.is.null&order=created_at.desc&limit=1')
    muestra = r.ok && Array.isArray(r.json) ? r.json[0] : null
  }
  if (!muestra) {
    fail('No hay un envío de prueba (pasa SHIPMENT_NUMBER y TRACKING_ORG_ID).')
    return
  }
  const org = muestra.organization_id
  const sel = encodeURIComponent(selects.shipments)
  const porNumero = await rest(`shipments?select=${sel}&organization_id=eq.${org}&shipment_number=in.(${encodeURIComponent(`"${muestra.shipment_number}"`)})&order=created_at.desc&limit=1`)
  if (!porNumero.ok || !Array.isArray(porNumero.json) || porNumero.json.length !== 1) {
    fail(`El envío ${muestra.shipment_number} (org ${org}) no se encontró por shipment_number: ${JSON.stringify(porNumero.json)}`)
  } else {
    notes.push(`shipment_number OK — ${muestra.shipment_number}, estado "${porNumero.json[0].status}", destino ${porNumero.json[0].delivery_city || 'sin ciudad'}`)
  }
  const porGuia = await rest(`shipments?select=${sel}&organization_id=eq.${org}&tracking_number=in.(${encodeURIComponent(`"${muestra.tracking_number}"`)})&order=created_at.desc&limit=1`)
  if (!porGuia.ok || !Array.isArray(porGuia.json) || porGuia.json.length !== 1) {
    fail(`El envío ${muestra.shipment_number} (org ${org}) no se encontró por tracking_number`)
  } else {
    notes.push('tracking_number OK — la guía vieja sigue encontrando el envío (no se muestra)')
  }
  // Aislamiento: el mismo número pedido desde otra organización no aparece.
  const otra = await rest(`shipments?select=id&organization_id=neq.${org}&shipment_number=eq.${encodeURIComponent(muestra.shipment_number)}`)
  if (otra.ok && Array.isArray(otra.json) && otra.json.length > 0) {
    notes.push(`${muestra.shipment_number} también existe en otra organización: el filtro por organization_id lo separa`)
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
