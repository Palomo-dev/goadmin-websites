/** Ejecuta cacheStructural real: etiquetas por org, sedes y centinela undefined. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const entries = new Map()
const options = []
const unstable_cache = (fn, keys, config) => {
  options.push({ keys, ...config })
  return async (...args) => {
    const key = JSON.stringify([keys, args])
    if (entries.has(key)) return entries.get(key).value
    const value = await fn(...args)
    entries.set(key, { value, tags: config.tags })
    return value
  }
}
function load(file) {
  const mod = new Module(file, module)
  mod.filename = file
  mod.require = (id) => id === 'next/cache' ? { unstable_cache } : require(id)
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
  return mod.exports
}
const { cacheStructural, estructuraSitioTag } = load(path.join(root, 'lib/supabase/cache.ts'))
let cases = 0
const check = (value, expected, message) => { cases++; assert.deepEqual(value, expected, message) }
const invalidate = (tag) => { for (const [k, v] of entries) if (v.tags.includes(tag)) entries.delete(k) }
;(async () => {
  let reads = 0
  const read = cacheStructural('prueba', async (org, branch) => ({ org, branch, read: ++reads }), 60, (org) => org)
  const first = await read(140, null)
  const other = await read(999, null)
  check((await read(140, null)).read, first.read, 'cachea la misma organización')
  check((await read(140, undefined)).branch, undefined, 'conserva undefined')
  check((await read(140, null)).branch, null, 'undefined no colisiona con null')
  invalidate(estructuraSitioTag(140))
  check((await read(140, null)).read > first.read, true, 'publicar invalida la organización elegida')
  check((await read(999, null)).read, other.read, 'la otra organización conserva su caché')
  check(options[0].tags, ['prueba', 'estructura-sitio-140'], 'mantiene etiqueta manual y agrega etiqueta acotada')
  check(options[0].keys, ['prueba', 'estructura-org-v1'], 'no reutiliza entradas antiguas sin etiqueta por org')
  check(options[0].revalidate, 60, 'conserva TTL')
  const old = cacheStructural('sinScope', async () => 'dato', 300)
  await old()
  check(options.at(-1).keys, ['sinScope'], 'lecturas no cambiadas conservan la clave anterior')
  check(options.at(-1).tags, ['sinScope'], 'lecturas no cambiadas conservan sus etiquetas')

  // Ejecuta los wrappers exportados, sin cargar ni consultar la base.
  const source = fs.readFileSync(path.join(root, 'lib/supabase/queries.ts'), 'utf8')
  const block = source.slice(source.indexOf('export const getOrganizationBySubdomain = cacheStructural'), source.indexOf('// Caché del catálogo (ver lib/supabase/cache.ts'))
  const functions = [...block.matchAll(/cacheStructural\('[^']+', (\w+),/g)].map((x) => x[1])
  const resolvers = {}
  const fakeCache = (name, fn, _ttl, resolver) => { resolvers[name] = resolver; return fn }
  const output = ts.transpileModule(block, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('exports', 'cacheStructural', 'CONTENT_TTL', 'SETTINGS_TTL', ...functions, output)({}, fakeCache, 60, 300, ...functions.map(() => async () => null))
  for (const name of ['getWebsitePageBySlug', 'getWebsitePageByType', 'getWebsitePages', 'getWebsitePagesByIds', 'getWebsiteHeaderNav', 'getWebsiteHeaderNavTree', 'getWebsiteFooterNav', 'getWebsiteFooterNavTree', 'getWebsiteMenus', 'getWebsiteMenusByLocation', 'getOrganizationCategories', 'getCategoryBySlug', 'getSubcategories', 'getParentCategory', 'getMenuCategories']) {
    check(resolvers[name](140), 140, `${name}: etiqueta de la organización y no de la sede`)
  }
  check(resolvers.getMenuById('menu-ficticio', 140, 9), 140, 'getMenuById toma la org del segundo argumento')
  console.log(`Caché estructural: ${cases} comprobaciones correctas.`)
})().catch((e) => { console.error(e); process.exitCode = 1 })
