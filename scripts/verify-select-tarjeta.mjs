/**
 * verify-select-tarjeta.mjs — contrato entre la «línea bajo el nombre» de la tarjeta
 * (`card_subtitle`) y el select del listado, verificado contra el esquema real.
 *
 *   node --env-file=.env.local scripts/verify-select-tarjeta.mjs
 *   COLUMNAS_PRODUCTS_JSON=<archivo> node scripts/verify-select-tarjeta.mjs
 *
 * Por qué existe: la tarjeta lee `products.brand`, `reference`, `length_cm`, `width_cm`,
 * `height_cm` y `description` del producto que le llega del listado. Si el select del listado no
 * las pide, la línea simplemente no se pinta y nadie lo nota; si pide una que no existe, PostgREST
 * responde 42703 y el catálogo entero se cae (la clase de fallo de verify-tracking).
 *
 * Como verify-tracking, NO duplica la consulta: lee `PRODUCT_LIST_COLUMNS` y los selects del
 * propio `lib/supabase/queries.ts` y las columnas que pide la tarjeta del propio
 * `lib/website/tarjetaPlantillasTienda.ts`, y comprueba:
 *  1. que cada columna de `COLUMNAS_SUBTITULO_TARJETA` esté en `PRODUCT_LIST_COLUMNS`;
 *  2. que los listados que alimentan las tarjetas usen `PRODUCT_LIST_COLUMNS`;
 *  3. contra el esquema real, que todas las columnas de `PRODUCT_LIST_COLUMNS` existan:
 *     - con `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`: ejecuta el select en
 *       PostgREST (`limit=1`, solo lectura) — un 42703 lo hace fallar;
 *     - sin credenciales, con `COLUMNAS_PRODUCTS_JSON`: un archivo con la salida de
 *       `select column_name from information_schema.columns where table_schema='public' and
 *       table_name='products'` (por ejemplo, la del MCP de Supabase) — [{column_name}] o [nombre];
 *     - sin ninguna de las dos, falla diciendo qué falta (no se reporta «pasa» sin mirar la base).
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
const notas = []
const fallar = (m) => problemas.push(m)

const queries = await readFile(join(ROOT, 'lib', 'supabase', 'queries.ts'), 'utf8')
const tarjeta = await readFile(join(ROOT, 'lib', 'website', 'tarjetaPlantillasTienda.ts'), 'utf8')

// 1. Columnas del listado y columnas de la tarjeta, leídas del fuente.
const lista = queries.match(/export const PRODUCT_LIST_COLUMNS = \[([\s\S]*?)\]\.join/)
const columnasListado = lista ? [...lista[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : []
if (!columnasListado.length) fallar('no encontré PRODUCT_LIST_COLUMNS en lib/supabase/queries.ts')

const bloque = tarjeta.match(/export const COLUMNAS_SUBTITULO_TARJETA = \{([\s\S]*?)\} as const/)
const columnasTarjeta = bloque ? [...new Set([...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]))] : []
if (!columnasTarjeta.length) fallar('no encontré COLUMNAS_SUBTITULO_TARJETA en lib/website/tarjetaPlantillasTienda.ts')
for (const c of columnasTarjeta) {
  if (!columnasListado.includes(c)) fallar(`card_subtitle lee products.${c} y PRODUCT_LIST_COLUMNS no la pide`)
}

// 2. Los listados que pintan tarjetas usan PRODUCT_LIST_COLUMNS.
function cuerpo(inicio) {
  const i = queries.indexOf(inicio)
  if (i === -1) return null
  const j = queries.indexOf('\nexport ', i + 1)
  const k = queries.indexOf('\nconst ', i + 1)
  const l = queries.indexOf('\nasync function ', i + 1)
  const fin = Math.min(...[j, k, l].filter((n) => n > i), queries.length)
  return queries.slice(i, fin)
}
const LISTADOS = {
  'listado general (getOrganizationProductsUncached)': 'const getOrganizationProductsUncached',
  'listado por categorías (getOrganizationProductsInCategoriesUncached)': 'const getOrganizationProductsInCategoriesUncached',
  'listado de sección (getListadoSeccion)': 'export async function getListadoSeccion(',
  'ofertas (OFFER_SELECT)': 'const OFFER_SELECT',
  'fichas de la página de categoría (SELECT_FICHA_LISTADO)': 'const SELECT_FICHA_LISTADO',
}
for (const [nombre, inicio] of Object.entries(LISTADOS)) {
  const c = cuerpo(inicio)
  if (!c) fallar(`no encontré ${nombre} en queries.ts`)
  else if (!c.includes('${PRODUCT_LIST_COLUMNS}')) fallar(`${nombre} no usa PRODUCT_LIST_COLUMNS`)
}

// 3. Contra el esquema real.
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const JSON_COLUMNAS = process.env.COLUMNAS_PRODUCTS_JSON
if (URL_BASE && KEY) {
  const select = encodeURIComponent(columnasListado.join(','))
  const res = await fetch(`${URL_BASE}/rest/v1/products?select=${select}&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const texto = await res.text()
  if (!res.ok) fallar(`PostgREST rechazó el select del listado (${res.status}): ${texto.slice(0, 300)}`)
  else notas.push(`PostgREST aceptó las ${columnasListado.length} columnas del listado`)
} else if (JSON_COLUMNAS) {
  let filas
  try {
    filas = JSON.parse(await readFile(JSON_COLUMNAS, 'utf8'))
  } catch (e) {
    fallar(`no pude leer ${JSON_COLUMNAS}: ${e.message}`)
  }
  if (Array.isArray(filas)) {
    const reales = new Set(filas.map((f) => (typeof f === 'string' ? f : f?.column_name)).filter(Boolean))
    const faltan = columnasListado.filter((c) => !reales.has(c))
    for (const c of faltan) fallar(`products.${c} no existe en el esquema real (${JSON_COLUMNAS})`)
    if (!faltan.length) notas.push(`esquema de ${JSON_COLUMNAS}: ${reales.size} columnas; las ${columnasListado.length} del listado existen`)
  } else if (filas) {
    fallar(`${JSON_COLUMNAS} no es una lista`)
  }
} else {
  fallar(
    'Sin acceso al esquema real: pon NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (node --env-file=.env.local) ' +
      'o COLUMNAS_PRODUCTS_JSON con las columnas de products sacadas por MCP. Sin eso no se afirma nada.',
  )
}

for (const n of notas) console.log(n)
if (problemas.length) {
  console.error(problemas.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log(`ok: card_subtitle (${columnasTarjeta.join(', ')}) está en el select del listado y el select existe en el esquema real`)
