/** Endpoint y validación reales; RPC sustituida. El smoke de DB se corre por MCP y rollback. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
let org = 140, permitido = true, disponible = true, error = null
const llamadas = []
const mocks = {
  '@/lib/get-org-context': { getOrgIdDelHost: async () => org },
  '@/lib/rateLimit': { checkRateLimit: () => ({ allowed: permitido }), getClientIP: () => 'prueba' },
  '@/lib/supabase/server': { createAdminClient: () => disponible ? { rpc: async (...args) => { llamadas.push(args); return { data: 3, error } } } : null },
}
function cargar(filename) {
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod.require = (id) => mocks[id] || (id.startsWith('@/') ? cargar(path.join(root, `${id.slice(2)}.ts`)) : require(id))
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return mod.exports
}
const { rutaPresencia, sesionPresenciaValida } = cargar(path.join(root, 'lib/website/presenciaPagina.ts'))
const { POST } = cargar(path.join(root, 'app/api/website/presencia/route.ts'))
const body = { ruta: '/productos/42', sesion: '11111111-1111-4111-8111-111111111111' }
const request = (valor) => new Request('http://localhost/api/website/presencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valor) })
let casos = 0
const check = (actual, esperado, mensaje) => { casos++; assert.deepEqual(actual, esperado, mensaje) }
;(async () => {
  check(rutaPresencia('/carrito/'), '/carrito', 'ruta canónica')
  check(rutaPresencia('/vista-previa/token-privado/productos/42'), '/productos/42', 'preview nunca guarda el token ni divide conteos')
  check(rutaPresencia('/vista-previa/token-privado'), '/', 'home del borrador canónica')
  for (const ruta of ['https://ajeno.test', '//ajeno.test', '/producto?email=privado', '/producto#detalle', '/'+ 'a'.repeat(501), '/\n']) check(rutaPresencia(ruta), null, 'no acepta query, datos personales ni URL ajena')
  check(sesionPresenciaValida('sesion-invalida'), false, 'sesión aleatoria debe ser UUID')
  const ok = await POST(request(body))
  check(ok.status, 200, 'heartbeat correcto')
  check(await ok.json(), { total: 3 }, 'solo expone un agregado')
  check(llamadas[0][0], 'website_registrar_presencia', 'usa RPC transaccional')
  check(llamadas[0][1].p_organization_id, 140, 'org sale del host')
  check(llamadas[0][1].p_page_path, body.ruta, 'cuenta solo página actual')
  check(/^[0-9a-f]{64}$/.test(llamadas[0][1].p_session_hash), true, 'sesión se guarda como hash')
  check(llamadas[0][1].p_session_hash.includes(body.sesion), false, 'sin identificador original')
  check(ok.headers.get('Cache-Control'), 'private, no-store', 'no mezcla respuesta CDN')
  const antes = llamadas.length
  check((await POST(request({ ...body, organizationId: 141 }))).status, 403, 'body no cambia organización')
  check(llamadas.length, antes, 'sin RPC de otro tenant')
  for (const invalido of [null, [], 'texto', {}, { ...body, sesion: 'ajena' }, { ...body, ruta: '/?token=privado' }]) check((await POST(request(invalido))).status, 400, 'rechaza payload inválido')
  org = null
  check((await POST(request(body))).status, 404, 'host no resoluble')
  org = 141
  await POST(request(body))
  check(llamadas.at(-1)[1].p_organization_id, 141, 'otra org usa su contexto')
  check(llamadas.at(-1)[1].p_session_hash === llamadas[0][1].p_session_hash, false, 'hash aislado por tenant')
  disponible = false
  check((await POST(request(body))).status, 503, 'sin service role falla cerrado')
  disponible = true; error = { code: 'prueba' }
  const originalError = console.error; console.error = () => {}
  check((await POST(request(body))).status, 503, 'error RPC no inventa total')
  console.error = originalError
  permitido = false
  check((await POST(request(body))).status, 429, 'limita tráfico')
  console.log(`Presencia real: ${casos} comprobaciones correctas.`)
})().catch((e) => { console.error(e); process.exitCode = 1 })
