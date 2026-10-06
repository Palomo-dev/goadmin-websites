/**
 * verify-carta.mjs — compuerta de la carta de restaurante contra el esquema y los datos reales.
 *
 *   node --env-file=.env.local scripts/verify-carta.mjs
 *   npm run verify:carta
 *
 * Opcional: CARTA_ORG_IDS=134,140 (ids, nunca nombres).
 *
 * Qué comprueba (solo lecturas, service role):
 *
 * 1. Contrato con el esquema: ejecuta tal cual, con `limit=1`, los `select` del fuente:
 *    - `getMenuCatalogProducts` (lib/supabase/queries.ts: MENU_CATALOG_COLUMNS + embebidos),
 *    - `getProductosConEleccion` (grupos obligatorios),
 *    - los precios de sede (`product_branch_prices`) y la mesa del QR
 *      (app/api/restaurant-tables/resolve/route.ts).
 *    Una columna inexistente → PostgREST 42703 → falla.
 * 2. Sin corte de 500: pagina la carta como el cargador (orden por id, MENU_CATALOG_PAGE por
 *    página, tope MENU_CATALOG_MAX) y exige que traiga TODOS los platos activos sin padre de la
 *    organización (conteo exacto de PostgREST) mientras quepan en el tope, y que las categorías
 *    con platos con precio sean las mismas que da la base (org 134: 73 hoy).
 * 3. RPC: `fn_precios_vigentes_lote` responde con las columnas que lee el sitio.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ORG_IDS = (process.env.CARTA_ORG_IDS || '134,140').split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)

const problems = []
const notes = []
const fail = (m) => problems.push(m)

async function rest(path, { contar = false, metodo = 'GET', cuerpo } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method: metodo,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      ...(contar ? { Prefer: 'count=exact' } : {}),
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  const rango = res.headers.get('content-range') || ''
  const total = Number(rango.split('/')[1])
  return { ok: res.ok, status: res.status, json, total: Number.isFinite(total) ? total : null }
}
const sel = (s) => encodeURIComponent(s.replace(/\s+/g, ' ').trim())

/** Bloque entre la primera aparición de `desde` y el siguiente `hasta` en el fuente. */
function bloque(fuente, desde, hasta) {
  const i = fuente.indexOf(desde)
  if (i === -1) return null
  const j = fuente.indexOf(hasta, i + desde.length)
  return j === -1 ? null : fuente.slice(i + desde.length, j)
}

async function main() {
  if (!URL_BASE || !KEY) {
    fail('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Corre con: node --env-file=.env.local scripts/verify-carta.mjs')
    return
  }
  const queries = await readFile(join(ROOT, 'lib/supabase/queries.ts'), 'utf8')
  const resolver = await readFile(join(ROOT, 'app/api/restaurant-tables/resolve/route.ts'), 'utf8')

  // ── 1. Contratos ──
  const columnas = bloque(queries, 'const MENU_CATALOG_COLUMNS = [', ']')
  const funcion = bloque(queries, 'const getMenuCatalogProductsUncached', 'const stockBranchIds')
  const embebidos = funcion && bloque(funcion, '${MENU_CATALOG_COLUMNS},', '`)')
  const page = Number(bloque(queries, 'const MENU_CATALOG_PAGE = ', '\n'))
  const max = Number(bloque(queries, 'export const MENU_CATALOG_MAX = ', '\n'))
  if (!columnas || !embebidos || !Number.isInteger(page) || !Number.isInteger(max)) {
    fail('No se pudo extraer el select de getMenuCatalogProducts de lib/supabase/queries.ts')
    return
  }
  const SEL_CARTA = `${columnas.replace(/['\s]/g, '').split(',').filter(Boolean).join(', ')}, ${embebidos}`
  const eleccion = bloque(queries, "from('product_modifier_groups')\n    .select('", "')")
  const mesa = bloque(resolver, ".from('restaurant_tables')\n      .select('", "')")
  if (!eleccion || !mesa) {
    fail('No se pudieron extraer los select de getProductosConEleccion o de la mesa del QR')
    return
  }
  for (const [tabla, s] of [
    ['products', SEL_CARTA],
    ['product_modifier_groups', eleccion],
    ['product_branch_prices', 'product_id, branch_id, organization_id, effective_from, effective_to'],
    ['restaurant_tables', mesa],
  ]) {
    const r = await rest(`${tabla}?select=${sel(s)}&limit=1`)
    if (!r.ok) fail(`select de ${tabla} rechazado por la base (${r.status}): ${JSON.stringify(r.json)}`)
  }
  if (problems.length) return

  // ── 3. RPC de precios por sede ──
  const rpc = await rest('rpc/fn_precios_vigentes_lote', {
    metodo: 'POST',
    cuerpo: { p_organization_id: ORG_IDS[0], p_branch_id: null, p_product_ids: [], p_heredar_padre: true },
  })
  if (!rpc.ok) fail(`fn_precios_vigentes_lote (${rpc.status}): ${JSON.stringify(rpc.json)}`)

  // ── 2. Sin corte ──
  for (const orgId of ORG_IDS) {
    const base = `products?select=${sel(SEL_CARTA)}&organization_id=eq.${orgId}&status=eq.active&parent_product_id=is.null&product_prices.effective_to=is.null`
    const filas = []
    for (let desde = 0; desde < max; desde += page) {
      const r = await rest(`${base}&order=id.asc&offset=${desde}&limit=${Math.min(page, max - desde)}`)
      if (!r.ok) { fail(`org ${orgId}: carta (${r.status}): ${JSON.stringify(r.json)}`); break }
      filas.push(...r.json)
      if (r.json.length < page) break
    }
    const total = (await rest(`products?select=id&organization_id=eq.${orgId}&status=eq.active&parent_product_id=is.null&limit=1`, { contar: true })).total
    if (total === null) { fail(`org ${orgId}: sin conteo exacto`); continue }
    const esperado = Math.min(total, max)
    if (filas.length !== esperado) fail(`org ${orgId}: la carta trae ${filas.length} platos y la base tiene ${total} (tope ${max})`)
    const ids = new Set(filas.map((p) => p.id))
    if (ids.size !== filas.length) fail(`org ${orgId}: la paginación repite platos`)

    const conPrecio = filas.filter((p) => Array.isArray(p.product_prices) && p.product_prices.length > 0)
    const catsCarta = new Set(conPrecio.map((p) => p.category_id).filter((c) => c !== null))
    // Base: categorías con al menos un plato activo, sin padre y con precio vigente (inner join).
    const catsBase = new Set()
    for (let desde = 0; ; desde += 1000) {
      const r = await rest(
        `products?select=category_id,product_prices!inner(id)&organization_id=eq.${orgId}&status=eq.active&parent_product_id=is.null&product_prices.effective_to=is.null&order=id.asc&offset=${desde}&limit=1000`
      )
      if (!r.ok) { fail(`org ${orgId}: categorías (${r.status})`); break }
      r.json.forEach((p) => p.category_id !== null && catsBase.add(p.category_id))
      if (r.json.length < 1000) break
    }
    if (total <= max && catsCarta.size !== catsBase.size) {
      fail(`org ${orgId}: la carta muestra ${catsCarta.size} categorías con platos y la base tiene ${catsBase.size}`)
    }
    notes.push(`org ${orgId}: ${filas.length} platos (${conPrecio.length} con precio) en ${catsCarta.size} categorías; base: ${total} platos, ${catsBase.size} categorías`)
  }
}

main()
  .catch((e) => fail(`Error inesperado: ${e?.stack || e}`))
  .finally(() => {
    for (const n of notes) console.log(`·  ${n}`)
    if (problems.length) {
      console.error(`\n✗ verify-carta: ${problems.length} problema(s)`)
      for (const p of problems) console.error(`  - ${p}`)
      process.exit(1)
    }
    console.log('\n✓ verify-carta: la carta trae todos los platos y sus select existen en la base')
  })
