/**
 * verify-servicios-seccion.mjs — la sección `services_list` recibe sus servicios, con una sola
 * consulta cacheada y solo en las páginas que la tienen.
 *
 *   npm run verify:servicios                                  (sin credenciales: contrato)
 *   node --env-file=.env.local scripts/verify-servicios-seccion.mjs   (además, contra la base)
 *
 * Por qué existe: `app/[[...slug]]/page.tsx` nunca cargaba `data.services`, así que los 50
 * sitios con la sección pintaban «No hay servicios configurados aún» (encontrado el
 * 2026-10-07). Como `verify-tracking.mjs`, LEE los `select` del propio fuente en vez de
 * copiarlos:
 *
 * 1. Cableado: page.tsx pide `getServiciosDeSeccion` solo con `tiene('services_list')` y lo
 *    deja en `data.services`; la consulta va envuelta en `cache(cacheCatalog(...))`.
 * 2. Filtros: organización del contexto y solo activos (`status = 'active'` en productos,
 *    `is_active = true` en `organization_services`).
 * 3. Columnas: cada columna de los `select` existe en el esquema real. La lista de columnas
 *    reales se verificó por MCP (proyecto jgmgphmzusbluqhuqihj) el 2026-10-07.
 * 4. Con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, ejecuta los dos `select`
 *    contra PostgREST: un nombre de columna inexistente responde 42703 y el script falla.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFile(join(ROOT, r), 'utf8')

// Columnas reales (MCP, 2026-10-07).
const ESQUEMA = {
  products: ['id', 'organization_id', 'sku', 'name', 'category_id', 'unit_code', 'created_at', 'updated_at', 'description', 'barcode', 'status', 'tag_id', 'parent_product_id', 'tax_id', 'is_parent', 'variant_data', 'uuid', 'station', 'track_stock', 'is_composite', 'production_type', 'product_type', 'brand', 'reference', 'track_serial', 'serial_pattern', 'auto_generate_serial', 'warranty_months', 'rating_avg', 'reviews_count', 'busqueda_nombre', 'busqueda_marca', 'busqueda_descripcion', 'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'service_type', 'track_lots', 'sale_mode', 'qty_decimals', 'price_ref_qty', 'price_ref_unit_code', 'min_sale_qty', 'default_tare_qty', 'tare_required', 'require_scale', 'scale_plu'],
  product_prices: ['id', 'product_id', 'price', 'effective_from', 'effective_to', 'created_at', 'compare_price'],
  organization_services: ['id', 'organization_id', 'service_id', 'custom_name', 'custom_icon', 'custom_category', 'is_active', 'created_at', 'price', 'linked_product_id'],
  services: ['id', 'name', 'icon', 'category', 'is_default', 'created_at'],
}

const fallos = []
let casos = 0
const exigir = (cond, msg) => {
  casos++
  if (!cond) fallos.push(msg)
}

/** Cuerpo de una función de módulo (`async function nombre` o `export async function nombre`). */
function cuerpo(fuente, firma) {
  const i = fuente.indexOf(firma)
  if (i === -1) return null
  const fin = fuente.slice(i + firma.length).search(/\n(export |async function |function |const [A-Za-z]+ = )/)
  return fuente.slice(i, fin === -1 ? fuente.length : i + firma.length + fin)
}

/** `select` que sigue a `.from('<tabla>')`, con `${CONSTANTE}` resueltas desde `constantes`. */
function selectDe(cuerpoFn, tabla, constantes) {
  const i = cuerpoFn.indexOf(`.from('${tabla}')`)
  if (i === -1) return null
  const m = cuerpoFn.slice(i).match(/\.select\(\s*(`([^`]*)`|'([^']*)')/)
  if (!m) return null
  return (m[2] ?? m[3]).replace(/\$\{(\w+)\}/g, (_, n) => constantes[n] ?? `\${${n}}`).replace(/\s+/g, ' ').trim()
}

/** Separa `a, b, rel (x, y), alias:rel(z)` en columnas propias y embebidos. */
function partes(select) {
  const propias = []
  const embebidos = []
  let nivel = 0
  let actual = ''
  for (const ch of select + ',') {
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) {
      const t = actual.trim()
      if (t) {
        const m = t.match(/^(?:\w+:)?(\w+)(?:!\w+)?\s*\((.*)\)$/s)
        if (m) embebidos.push({ tabla: m[1], select: m[2] })
        else propias.push(t)
      }
      actual = ''
    } else actual += ch
  }
  return { propias, embebidos }
}

function columnasExisten(nombre, tabla, select) {
  const { propias, embebidos } = partes(select)
  const malas = propias.filter((c) => c !== '*' && !ESQUEMA[tabla]?.includes(c))
  exigir(malas.length === 0, `${nombre}: columnas que no existen en ${tabla}: ${malas.join(', ')}`)
  for (const e of embebidos) columnasExisten(`${nombre} › ${e.tabla}`, e.tabla, e.select)
}

const pagina = await leer('app/[[...slug]]/page.tsx')
const datos = await leer('lib/website/datosSecciones.ts')
const queries = await leer('lib/supabase/queries.ts')
const listaColumnas = queries.match(/export const PRODUCT_LIST_COLUMNS = \[([\s\S]*?)\]\.join/)
const constantes = {
  PRODUCT_LIST_COLUMNS: listaColumnas ? [...listaColumnas[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).join(', ') : '',
}

// 1. Cableado en la página.
exigir(/tiene\('services_list'\)\s*\?\s*getServiciosDeSeccion\(organization\.id/.test(pagina), 'page.tsx: getServiciosDeSeccion no se pide solo con tiene(\'services_list\')')
exigir(/data\.services\s*=\s*servicios/.test(pagina), 'page.tsx: data.services no recibe los servicios')
exigir((pagina.match(/getServiciosDeSeccion\(/g) || []).length === 1, 'page.tsx: getServiciosDeSeccion no se llama exactamente una vez')
exigir(/export const getServiciosDeSeccion = cache\(\s*cacheCatalog\(/.test(datos), 'datosSecciones: getServiciosDeSeccion no va en cache(cacheCatalog(...)) (una consulta por render y caché entre visitas)')

// 2 y 3. Consultas: filtros y columnas.
const fnSecc = cuerpo(datos, 'async function getServiciosUncached')
exigir(fnSecc !== null, 'datosSecciones: falta getServiciosUncached')
const fnProd = cuerpo(queries, 'export async function getOrganizationServices')
exigir(fnProd !== null, 'queries: falta getOrganizationServices')
if (fnSecc) {
  exigir(fnSecc.includes('getOrganizationServices('), 'getServiciosUncached: los productos SV no salen de getOrganizationServices (la consulta de /servicios)')
  exigir(/\.eq\('organization_id', organizationId\)/.test(fnSecc) && /\.eq\('is_active', true\)/.test(fnSecc), 'organization_services: falta filtrar por organización o por activos')
  const sel = selectDe(fnSecc, 'organization_services', constantes)
  exigir(sel !== null, 'organization_services: no encuentro el select')
  if (sel) {
    exigir(!sel.includes('*'), 'organization_services: select con `*`')
    columnasExisten('organization_services', 'organization_services', sel)
  }
}
let selProd = null
if (fnProd) {
  exigir(/\.eq\('organization_id', organizationId\)/.test(fnProd) && /\.eq\('status', 'active'\)/.test(fnProd) && /\.eq\('unit_code', 'SV'\)/.test(fnProd), 'getOrganizationServices: falta filtrar por organización, activos o unit_code SV')
  selProd = selectDe(fnProd, 'products', constantes)
  exigir(selProd !== null && !/(^|,\s*)\*(,|$)/.test(selProd), 'getOrganizationServices: select con `*` (trae las columnas busqueda_* a la caché)')
  if (selProd) columnasExisten('getOrganizationServices', 'products', selProd)
  exigir(Boolean(selProd?.includes('compare_price')), 'getOrganizationServices: no trae compare_price (precio tachado)')
}

// 4. Contra la base, si hay credenciales.
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
let nota = 'sin credenciales: no se ejecutaron los select contra la base'
if (URL_BASE && KEY && fnSecc && selProd) {
  const org = Number(process.env.SERVICIOS_ORG_ID || 2)
  const pedir = async (ruta) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    return { ok: r.ok, texto: r.ok ? '' : await r.text() }
  }
  const selOS = selectDe(fnSecc, 'organization_services', constantes)
  for (const [tabla, sel, filtro] of [
    ['products', selProd, `organization_id=eq.${org}&unit_code=eq.SV&status=eq.active&product_prices.effective_to=is.null`],
    ['organization_services', selOS, `organization_id=eq.${org}&is_active=eq.true`],
  ]) {
    const r = await pedir(`${tabla}?select=${encodeURIComponent(sel.replace(/\s+/g, ''))}&${filtro}&limit=5`)
    exigir(r.ok, `${tabla}: PostgREST rechaza el select — ${r.texto.slice(0, 200)}`)
  }
  nota = `select ejecutados contra la base (org ${org})`
}

if (fallos.length) {
  console.error(`✗ verify-servicios-seccion: ${fallos.length} fallo(s) en ${casos} comprobaciones\n`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-servicios-seccion: ${casos} comprobaciones (${nota})`)
