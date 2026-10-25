/** Endpoint real de invalidación: sin base ni red, con lector público sustituido. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const sitioId = '11111111-1111-4111-8111-111111111111'
const revisionId = '22222222-2222-4222-8222-222222222222'
const filename = path.resolve(__dirname, '../app/api/revalidate/route.ts')
const tags = []
const lecturas = []
let publico = { siteStateId: sitioId, revisionId }
const mocks = {
  'next/cache': { revalidateTag: (tag) => tags.push(tag) },
  '@/lib/supabase/cache': { catalogTag: (org) => `catalogo-${org}`, estructuraSitioTag: (org) => `estructura-sitio-${org}`, CATALOG_TAG_ALL: 'catalogo' },
  '@/lib/website/v2/lectorPublico': {
    getSitioPublicoV2: async (...args) => { lecturas.push(args); return publico },
    tagEstadosV2Org: (org) => `sitio-v2-org-${org}`,
    tagSitioV2: (id) => `sitio-v2-${id}`,
  },
}
const mod = new Module(filename, module)
mod.filename = filename
mod.paths = Module._nodeModulePaths(path.dirname(filename))
mod.require = (id) => mocks[id] || require(id)
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
const { POST } = mod.exports
const anterior = process.env.CRON_SECRET
process.env.CRON_SECRET = 'ficticio'
const request = (body, secret = 'ficticio') => new Request('http://localhost/api/revalidate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-secret': secret }, body: JSON.stringify(body) })
const body = { organization_id: 140, publicacion: { sitioId, revisionId, branchId: null } }
let casos = 0
const check = (actual, esperado, mensaje) => { casos++; assert.deepEqual(actual, esperado, mensaje) }
;(async () => {
  check((await POST(request(body, 'ajeno'))).status, 401, 'sin secreto correcto no lee ni invalida')
  check(tags.length, 0, 'sin invalidaciones no autorizadas')
  check(lecturas.length, 0, 'sin lecturas no autorizadas')
  const ok = await POST(request(body))
  check(ok.status, 200, 'confirmación correcta')
  check(await ok.json(), { ok: true, sitioId, revisionId }, 'ACK contiene IDs exactos')
  check(tags, ['sitio-v2-org-140', `sitio-v2-${sitioId}`, 'estructura-sitio-140', 'catalogo-140'], 'invalida puntero V2, documento, estructura y catálogo')
  check(lecturas, [[140, null]], 'lector con la misma organización y sede')
  for (const invalid of [null, [], 'texto', true]) check((await POST(request(invalid))).status, 400, 'body debe ser un objeto')
  check((await POST(request({ ...body, publicacion: { ...body.publicacion, branchId: 9 } }))).status, 200, 'confirmación de sede')
  check(lecturas.at(-1), [140, 9], 'no cae al principal al confirmar una sede')
  for (const publicacion of [null, {}, { sitioId, revisionId, branchId: -1 }, { sitioId: 'no-uuid', revisionId, branchId: null }, { sitioId, revisionId: 'no-uuid', branchId: null }, { sitioId, revisionId, branchId: '9' }]) {
    check((await POST(request({ organization_id: 140, publicacion }))).status, 400, 'publicación mal formada rechazada')
  }
  for (const dato of [null, { siteStateId: sitioId, revisionId: 'anterior' }, { siteStateId: 'sitio-ajeno', revisionId }]) {
    publico = dato
    check((await POST(request(body))).status, 503, 'lector sin revisión exacta no confirma')
  }
  check((await POST(request({ organization_id: 0, publicacion: body.publicacion }))).status, 400, 'org inválida rechazada')
  check((await POST(request({ organization_id: 140 }))).status, 200, 'catálogo antiguo conserva contrato')
  tags.length = 0
  const estructura = await POST(request({ organization_id: 140, estructura: true }))
  check(await estructura.json(), { ok: true, estructura: true, organizationId: 140 }, 'legacy confirma invalidación estructural sin afirmar una revisión inexistente')
  check(tags, ['estructura-sitio-140', 'catalogo-140'], 'la invalidación legacy no enfría todas las organizaciones')
  delete process.env.CRON_SECRET
  check((await POST(request(body))).status, 401, 'sin secreto configurado falla cerrado')
  console.log(`Publicación confirmada: ${casos} comprobaciones correctas (endpoint real).`)
})().finally(() => { if (anterior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = anterior }).catch((e) => { console.error(e); process.exitCode = 1 })
