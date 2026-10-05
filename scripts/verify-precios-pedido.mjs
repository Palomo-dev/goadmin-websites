/**
 * verify-precios-pedido.mjs — compuerta: el precio que cobra /api/orders es el que muestra el sitio.
 *
 *   node --env-file=.env.local scripts/verify-precios-pedido.mjs
 *   npm run verify:precios
 *
 * Opcional: PRECIOS_ORG_IDS=135,137,120 (ids, nunca nombres) y PRECIOS_N=25 (productos por org).
 *
 * Qué comprueba, contra la base real (solo lecturas, service role):
 *
 * 1. Contrato con el esquema: ejecuta los `select` de lib/products/precio-servidor-lectura.ts
 *    tal como están en el fuente. Una columna inexistente → PostgREST 42703 → falla.
 * 2. Igualdad de precio: para N productos activos de cada organización compara
 *    - lo que MUESTRA el sitio: la consulta de listados de lib/supabase/queries.ts
 *      (`product_prices (id, price, compare_price, effective_to)` con `effective_to IS NULL`),
 *      ordenada con el propio `normalizeProductPrices` del fuente, `[0].price`; en una variante sin
 *      precio, el del padre (StickyAddToCart); con modificador, base + `extra_price` (MenuView);
 *      con carta por sede, `aplicarCartaSede`;
 *    - con lo que COBRA el servidor: `resolverLineasPedido` de lib/products/precio-servidor.ts
 *      (el módulo real, no una copia), alimentado con los `select` del punto 1.
 *    Cualquier diferencia, o un producto que el sitio vende y el servidor rechaza, hace fallar.
 *
 * Cómo carga el TypeScript sin dependencias nuevas: `module.stripTypeScriptTypes` de Node 22
 * sobre los módulos PUROS (sin `@/` de Next ni `next/headers`), reescribiendo sus imports `@/`
 * a archivos temporales. De lib/supabase/queries.ts solo se extrae `normalizeProductPrices`.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ORG_IDS = (process.env.PRECIOS_ORG_IDS || '135,137,120').split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
const N = Math.max(1, Number(process.env.PRECIOS_N || 25))

const problems = []
const notes = []
const fail = (m) => problems.push(m)

// ─── Carga de los módulos puros ─────────────────────────────────────────────────────────────

const MODULOS_PUROS = {
  'get-current-price': 'lib/get-current-price.ts',
  'carta-sede': 'lib/products/carta-sede.ts',
  'visibilidad-web': 'lib/products/visibilidad-web.ts',
  'precio-servidor': 'lib/products/precio-servidor.ts',
}

function aMjs(ts) {
  const js = stripTypeScriptTypes(ts, { mode: 'strip' })
  return js.replace(/from\s+'@\/lib\/(?:products\/)?([a-z-]+)'/g, (_, nombre) => {
    if (!MODULOS_PUROS[nombre]) throw new Error(`import no puro en un módulo puro: @/…/${nombre}`)
    return `from './${nombre}.mjs'`
  })
}

async function cargarModulos(dir) {
  for (const [nombre, ruta] of Object.entries(MODULOS_PUROS)) {
    await writeFile(join(dir, `${nombre}.mjs`), aMjs(await readFile(join(ROOT, ruta), 'utf8')))
  }
  // normalizeProductPrices: la función tal cual del fuente de queries.ts.
  const queries = await readFile(join(ROOT, 'lib/supabase/queries.ts'), 'utf8')
  const ini = queries.indexOf('export function normalizeProductPrices')
  const fin = queries.indexOf('\n}\n', ini)
  if (ini === -1 || fin === -1) throw new Error('No se encontró normalizeProductPrices en lib/supabase/queries.ts')
  await writeFile(join(dir, 'normalize.mjs'), stripTypeScriptTypes(queries.slice(ini, fin + 3), { mode: 'strip' }))
  const imp = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)).href)
  return {
    servidor: await imp('precio-servidor'),
    carta: await imp('carta-sede'),
    visibilidad: await imp('visibilidad-web'),
    normalize: (await imp('normalize')).normalizeProductPrices,
  }
}

/** Valor de `export const NOMBRE = '...'` o `` `...` `` en un fuente, con `${X}` resuelto. */
function constante(fuente, nombre, vars = {}) {
  const m = fuente.match(new RegExp(`export const ${nombre}\\s*=\\s*(?:\`([^\`]*)\`|'([^']*)')`))
  if (!m) return null
  return (m[1] ?? m[2]).replace(/\$\{(\w+)\}/g, (_, v) => {
    if (!(v in vars)) throw new Error(`Variable sin resolver en ${nombre}: ${v}`)
    return vars[v]
  }).replace(/\s+/g, ' ').trim()
}

// ─── REST ───────────────────────────────────────────────────────────────────────────────────

async function rest(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { ok: res.ok, status: res.status, json }
}
const sel = (s) => encodeURIComponent(s)
const enLista = (ids) => `in.(${ids.join(',')})`

// ─── Verificación ───────────────────────────────────────────────────────────────────────────

async function main() {
  if (!URL_BASE || !KEY) {
    fail('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Corre con: node --env-file=.env.local scripts/verify-precios-pedido.mjs')
    return
  }
  const dir = await mkdtemp(join(tmpdir(), 'verify-precios-'))
  try {
    const M = await cargarModulos(dir)
    const lectura = await readFile(join(ROOT, 'lib/products/precio-servidor-lectura.ts'), 'utf8')
    const vars = { SELECT_PADRE_ESTADO: M.visibilidad.SELECT_PADRE_ESTADO }
    const SEL_PRODUCTO = constante(lectura, 'SELECT_PRODUCTO_PRECIO', vars)
    const SEL_PRECIO = constante(lectura, 'SELECT_PRECIO_VIGENTE', vars)
    const SEL_GRUPOS = constante(lectura, 'SELECT_GRUPOS_MODIFICADORES', vars)
    if (!SEL_PRODUCTO || !SEL_PRECIO || !SEL_GRUPOS) {
      fail('No se pudieron extraer los select de lib/products/precio-servidor-lectura.ts')
      return
    }

    // 1. Contrato de columnas
    for (const [tabla, s] of [['products', SEL_PRODUCTO], ['product_prices', SEL_PRECIO], ['product_modifier_groups', SEL_GRUPOS]]) {
      const r = await rest(`${tabla}?select=${sel(s)}&limit=1`)
      if (!r.ok) fail(`select de ${tabla} rechazado por la base (${r.status}): ${JSON.stringify(r.json)}`)
    }
    if (problems.length) return

    let comparados = 0
    for (const orgId of ORG_IDS) {
      // 2a. Lo que muestra el sitio (consulta de listados de queries.ts)
      // Columnas y filtros de getProductsByIds (queries.ts): activos, con el estado del padre para
      // descartar variantes de un padre eliminado, como hace el sitio (esProductoVisibleEnWeb).
      const SEL_WEB = `id, organization_id, status, parent_product_id, product_prices (id, price, compare_price, effective_to), ${M.visibilidad.SELECT_PADRE_ESTADO}`
      const web = await rest(
        `products?select=${sel(SEL_WEB)}` +
        `&organization_id=eq.${orgId}&status=eq.active&product_prices.effective_to=is.null&order=id.desc&limit=${N}`
      )
      if (!web.ok) { fail(`org ${orgId}: lectura del sitio falló (${web.status}): ${JSON.stringify(web.json)}`); continue }
      // Con modificadores: añade productos con grupos para que siempre haya casos con extras.
      const conGrupos = await rest(`product_modifier_groups?select=product_id&organization_id=eq.${orgId}&limit=${Math.ceil(N / 2)}`)
      const idsGrupos = conGrupos.ok ? conGrupos.json.map((g) => Number(g.product_id)) : []
      const extra = idsGrupos.length
        ? await rest(
            `products?select=${sel(SEL_WEB)}` +
            `&id=${enLista(idsGrupos)}&organization_id=eq.${orgId}&status=eq.active&product_prices.effective_to=is.null`
          )
        : { ok: true, json: [] }
      const vistos = M.normalize(
        [...web.json, ...(extra.ok ? extra.json : [])]
          .filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i)
          .filter((p) => M.visibilidad.esProductoVisibleEnWeb(p, orgId))
      )
      if (vistos.length === 0) { notes.push(`org ${orgId}: sin productos activos`); continue }

      const ids = vistos.map((p) => Number(p.id))
      const padresIds = [...new Set(vistos.map((p) => p.parent_product_id).filter((x) => x != null))]
      const padresWeb = padresIds.length
        ? await rest(`products?select=${sel('id, product_prices (id, price, compare_price, effective_to)')}&id=${enLista(padresIds)}&product_prices.effective_to=is.null`)
        : { ok: true, json: [] }
      const precioWebPadre = new Map(M.normalize(padresWeb.ok ? padresWeb.json : []).map((p) => [Number(p.id), p.product_prices?.[0]?.price]))

      // 2b. Lo que cobra el servidor, con los select del fuente
      const [prods, precios, grupos, cartaFilas] = await Promise.all([
        rest(`products?select=${sel(SEL_PRODUCTO)}&organization_id=eq.${orgId}&id=${enLista(ids)}`),
        rest(`product_prices?select=${sel(SEL_PRECIO)}&product_id=${enLista([...ids, ...padresIds])}&effective_to=is.null`),
        rest(`product_modifier_groups?select=${sel(SEL_GRUPOS)}&organization_id=eq.${orgId}&product_id=${enLista(ids)}`),
        rest(`website_branch_products?select=${sel(M.carta.SELECT_CARTA_SEDE + ', branch_id')}&organization_id=eq.${orgId}&product_id=${enLista(ids)}&limit=${N}`),
      ])
      for (const [n, r] of [['products', prods], ['product_prices', precios], ['product_modifier_groups', grupos], ['website_branch_products', cartaFilas]]) {
        if (!r.ok) fail(`org ${orgId}: ${n} (${r.status}): ${JSON.stringify(r.json)}`)
      }
      if (problems.length) return
      const agrupar = (filas, clave) => filas.reduce((m, f) => m.set(Number(f[clave]), [...(m.get(Number(f[clave])) || []), f]), new Map())
      const datos = {
        productos: new Map(prods.json.map((p) => [Number(p.id), p])),
        precios: agrupar(precios.json, 'product_id'),
        grupos: agrupar(grupos.json, 'product_id'),
      }

      // Casos: cada producto solo, y con su primer modificador activo con precio si lo tiene.
      const casos = []
      for (const p of vistos) {
        const propio = p.product_prices?.[0]?.price
        const base = propio ?? (p.parent_product_id != null ? precioWebPadre.get(Number(p.parent_product_id)) : undefined)
        if (base === undefined || base === null) { notes.push(`org ${orgId}: producto ${p.id} sin precio en el sitio (no se vende)`); continue }
        casos.push({ item: { id: p.id, price: Number(base), quantity: 1 }, etiqueta: `producto ${p.id}`, carta: null })
        const mod = (datos.grupos.get(Number(p.id)) || []).flatMap((g) => (g.product_modifiers || []).filter((m) => m.is_active).map((m) => ({ g, m })))
          .find(({ m }) => Number(m.extra_price) > 0)
        if (mod) {
          casos.push({
            item: { id: p.id, price: Number(base) + Number(mod.m.extra_price), quantity: 1, newModifiers: [{ groupId: mod.g.id, modifierId: mod.m.id, extraPrice: Number(mod.m.extra_price) }] },
            etiqueta: `producto ${p.id} + modificador ${mod.m.id}`, carta: null,
          })
        }
      }
      // Carta por sede: precio que muestra `aplicarCartaSede` frente al que cobra el servidor.
      const porSede = agrupar(cartaFilas.json, 'branch_id')
      for (const [branchId, filas] of porSede) {
        const carta = { branchId, filas: new Map(filas.map((f) => [Number(f.product_id), f])) }
        for (const p of M.carta.aplicarCartaSede(vistos, carta)) {
          const fila = carta.filas.get(Number(p.id))
          if (!fila || M.carta.agotadoEnSede(fila) || p.product_prices?.[0]?.price == null) continue
          casos.push({ item: { id: p.id, price: Number(p.product_prices[0].price), quantity: 1 }, etiqueta: `producto ${p.id} en sede ${branchId}`, carta })
        }
      }
      if (porSede.size === 0) notes.push(`org ${orgId}: sin carta por sede en la muestra`)

      for (const caso of casos) {
        const r = M.servidor.resolverLineasPedido([caso.item], datos, { organizationId: orgId, carta: caso.carta })
        comparados++
        if (r.problemas.length) {
          fail(`org ${orgId}, ${caso.etiqueta}: el sitio lo vende y el servidor lo rechaza (${r.problemas[0].motivo}: ${r.problemas[0].detalle})`)
          continue
        }
        const d = M.servidor.desfasesDePrecio(r.lineas)
        if (d.length) fail(`org ${orgId}, ${caso.etiqueta}: el sitio muestra ${d[0].precioAnterior} y el servidor cobra ${d[0].precioNuevo}`)
      }
      notes.push(`org ${orgId}: ${casos.length} casos comparados`)
    }
    if (comparados === 0) fail('No se comparó ningún precio: revisa PRECIOS_ORG_IDS')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

main()
  .catch((e) => fail(`Error inesperado: ${e?.stack || e}`))
  .finally(() => {
    for (const n of notes) console.log(`·  ${n}`)
    if (problems.length) {
      console.error(`\n✗ verify-precios-pedido: ${problems.length} problema(s)`)
      for (const p of problems) console.error(`  - ${p}`)
      process.exit(1)
    }
    console.log('\n✓ verify-precios-pedido: el precio que cobra /api/orders coincide con el que muestra el sitio')
  })
