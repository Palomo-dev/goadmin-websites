/** Aislamiento de stock: contexto del host, reservas y sede; sin credenciales ni red. */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')
const ROOT = path.resolve(__dirname, '..')
function compile(file, mocks) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)((id) => id in mocks ? mocks[id] : require(id), module, module.exports)
  return module.exports
}
const { getAvailableStock } = compile('lib/stock.ts', {})
const visibilidad = compile('lib/products/visibilidad-web.ts', {})
let context = { organization: { id: 140 }, branchId: 7 }
let admin = true
let error = null
let calls = []
const fixtures = [
  { id: 1, organization_id: 140, status: 'active', track_stock: true, stock_levels: [{ branch_id: 7, qty_on_hand: 8, qty_reserved: 5 }, { branch_id: 8, qty_on_hand: 99, qty_reserved: 0 }] },
  { id: 2, organization_id: 140, status: 'active', track_stock: false, stock_levels: [] },
  { id: 4, organization_id: 140, status: 'inactive', track_stock: true, stock_levels: [{ branch_id: 7, qty_on_hand: 99, qty_reserved: 0 }] },
  { id: 5, organization_id: 140, status: 'active', parent_product_id: 6, padre: { status: 'deleted' }, track_stock: true, stock_levels: [{ branch_id: 7, qty_on_hand: 99, qty_reserved: 0 }] },
  { id: 3, organization_id: 999, status: 'active', track_stock: true, stock_levels: [{ branch_id: 7, qty_on_hand: 42, qty_reserved: 0 }] },
]
const { GET } = compile('app/api/products/stock/route.ts', {
  'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200, headers: opts.headers ?? {} }) } },
  '@/lib/get-org-context': { getOrgContext: async () => context },
  '@/lib/stock': { getAvailableStock },
  '@/lib/products/visibilidad-web': visibilidad,
  '@/lib/supabase/queries': { getWebStockBranchIds: async (org) => { calls.push(['web', org]); return [8] } },
  '@/lib/supabase/server': { createAdminClient: () => admin ? { from: (table) => {
    calls.push(['from', table]); let organizationId, status
    const q = {
      select: (s) => { calls.push(['select', s]); return q },
      eq: (key, value) => { calls.push(['eq', key, value]); if (key === 'organization_id') organizationId = value; if (key === 'status') status = value; return q },
      in: async (_, ids) => ({ data: fixtures.filter((p) => p.organization_id === organizationId && p.status === status && ids.includes(p.id)), error }),
    }
    return q
  } } : null },
})
const request = (qs) => ({ nextUrl: new URL(`https://tienda.invalid/api/products/stock?${qs}`) })
let cases = 0
function check(value, message) { cases++; assert.ok(value, message) }
async function run() {
  const good = await GET(request('productIds=1,2,3,4,5'))
  check(good.status === 200, 'consulta válida')
  check(good.body.data[1] === 3, 'resta reservas y usa solo la sede del host')
  check(good.body.data[2] === null, 'sin control de inventario no inventa stock')
  check(!(3 in good.body.data), 'nunca devuelve producto de otra org')
  check(!(4 in good.body.data), 'no enumera existencias de productos inactivos')
  check(!(5 in good.body.data), 'no enumera variantes de un padre eliminado')
  check(good.headers['Cache-Control'] === 'private, no-store', 'stock nunca queda en CDN')
  check(calls.some((c) => c[0] === 'eq' && c[1] === 'organization_id' && c[2] === 140), 'query filtra tenant del contexto')
  calls = []
  check((await GET(request('organizationId=999&productIds=1'))).status === 403, 'rechaza organización del query ajena')
  check(calls.length === 0, 'tenant ajeno no llega a la base')
  for (const ids of ['1,NaN', '-1', '1.5', '1,,2', Array.from({ length: 101 }, (_, i) => i + 1).join(',')]) check((await GET(request(`productIds=${ids}`))).status === 400, 'rechaza ids inválidos o demasiados')
  context = { organization: { id: 140 }, branchId: null }
  const main = await GET(request('productIds=1'))
  check(main.body.data[1] === 99 && calls.some((c) => c[0] === 'web' && c[1] === 140), 'principal usa sucursales habilitadas para web')
  context = null
  check((await GET(request('productIds=1'))).status === 404, 'host sin sitio falla cerrado')
  context = { organization: { id: 140 }, branchId: 7 }; admin = false
  check((await GET(request('productIds=1'))).status === 503, 'sin admin no cae a lectura anónima')
  console.log(`✓ ${cases} pruebas de aislamiento de stock público`)
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
