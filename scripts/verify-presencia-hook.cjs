/** Ejecuta el efecto real con reloj y transporte controlados; no afirma validar el navegador. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
let efecto, total, ruta = '/productos/42', intervalo, contadorFetch = 0
let respuesta = { total: 3 }, fallar = false, suspender = false
const eventos = new Map(), storage = new Map(), peticiones = []
global.document = { visibilityState: 'visible', addEventListener: (k,f) => eventos.set(k,f), removeEventListener: (k) => eventos.delete(k) }
global.sessionStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) }
const intervaloReal = global.setInterval, limpiarReal = global.clearInterval, fetchReal = global.fetch
global.setInterval = (fn, ms) => { intervalo = { fn, ms }; return 1 }
global.clearInterval = () => { intervalo = null }
global.fetch = async (url, options) => { contadorFetch++; peticiones.push({ url, ...options }); if (suspender) return new Promise((_,rechazar) => options.signal.addEventListener('abort', () => rechazar(Error('abort')), { once: true })); if (fallar) throw Error('red'); return { ok: true, json: async () => respuesta } }
const mocks = {
  react: { useEffect: (f) => { efecto = f }, useState: (v) => [v, (x) => { total = x }] },
  'next/navigation': { usePathname: () => ruta },
}
function cargar(filename) {
  const mod = new Module(filename, module)
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod.require = (id) => mocks[id] || (id.startsWith('@/') ? cargar(path.join(root, `${id.slice(2)}.ts`)) : require(id))
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return mod.exports
}
const { usePersonasViendo } = cargar(path.join(root, 'lib/hooks/usePersonasViendo.ts'))
let casos = 0
const check = (actual, esperado, mensaje) => { casos++; assert.deepEqual(actual, esperado, mensaje) }
const turno = async () => { for (let i=0;i<8;i++) await Promise.resolve() }
;(async () => {
  check(usePersonasViendo(false), null, 'apagado no muestra contador')
  efecto(); await turno()
  check(contadorFetch, 0, 'apagado no hace llamadas')
  check(intervalo, undefined, 'apagado no programa heartbeat')
  check(usePersonasViendo(true), null, 'inicialmente no inventa número')
  const limpiar = efecto(); await turno()
  check(total, 3, 'solo muestra dato confirmado')
  check(intervalo.ms, 30000, 'heartbeat cada30 segundos')
  check(peticiones[0].url, '/api/website/presencia', 'API local')
  const body = JSON.parse(peticiones[0].body)
  check(body.ruta, ruta, 'cuenta la ruta activa')
  check('organizationId' in body, false, 'no envía organización controlada por cliente')
  check(typeof body.sesion, 'string', 'sesión anónima aleatoria')
  await intervalo.fn(); await turno()
  check(JSON.parse(peticiones.at(-1).body).sesion, body.sesion, 'misma sesión en heartbeat')
  document.visibilityState = 'hidden'
  const previas = contadorFetch
  await intervalo.fn(); await turno()
  check(contadorFetch, previas, 'pestaña oculta no registra presencia')
  document.visibilityState = 'visible'
  await eventos.get('visibilitychange')(); await turno()
  check(contadorFetch, previas+1, 'reanuda al volver visible')
  respuesta = { total: '50' }
  await intervalo.fn(); await turno()
  check(total, null, 'respuesta inválida no simula personas')
  fallar = true
  await intervalo.fn(); await turno()
  check(total, null, 'error de red oculta contador')
  suspender = true
  void intervalo.fn(); await turno()
  limpiar(); await turno()
  check(intervalo, null, 'limpia intervalo al desmontar')
  check(eventos.size, 0, 'limpia listener al desmontar')
  check(peticiones.at(-1).signal.aborted, true, 'cancela petición al desmontar')
  console.log(`Hook de presencia: ${casos} comprobaciones correctas.`)
})().finally(() => { global.setInterval = intervaloReal; global.clearInterval = limpiarReal; global.fetch = fetchReal }).catch(e=>{ console.error(e); process.exitCode=1 })
