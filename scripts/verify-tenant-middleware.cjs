/** Middleware real y NextResponse reales; Supabase sustituido, sin base ni red. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const root = path.resolve(__dirname, '..')
const claves = ['x-subdomain', 'x-custom-domain', 'x-outlet-path', 'x-outlet-subdomain', 'x-custom-outlet-domain']
const falsas = Object.fromEntries(claves.map((k) => [k, 'org-ajena']))
function from(tabla) {
  let select = '', filtros = {}
  const api = {
    select: (v) => { select = v; return api },
    eq: (k, v) => { filtros[k] = v; return api },
    not: () => api,
    maybeSingle: async () => ({ data: tabla === 'branches' && filtros.custom_domain === 'branch.own.example' ? { organization_id: 140 }
      : tabla === 'organizations' && filtros.id === 140 ? { subdomain: 'org-propia' }
      : tabla === 'organization_domains' && filtros.host === 'own.example' ? { organization_id: 140 } : null, error: null }),
    then: (resolve) => Promise.resolve({ data: tabla === 'branches' && select.includes('slug') ? [
      { slug: 'sede-norte', organization_id: 140, organizations: { subdomain: 'org-propia' } },
      { slug: 'sede-ajena', organization_id: 999, organizations: { subdomain: 'org-ajena' } },
    ] : [], error: null }).then(resolve),
  }
  return api
}
const file = path.join(root, 'middleware.ts')
const mod = new Module(file, module)
mod.filename = file
mod.paths = Module._nodeModulePaths(path.dirname(file))
const supabaseMock = {
  createServerClient: (_url, _key, options) => ({
    from,
    auth: {
      getUser: async () => {
        options.cookies.setAll([{ name: 'sesion-refrescada', value: 'ficticia', options: { httpOnly: true, path: '/' } }])
        return { data: { user: null } }
      },
    },
  }),
}
mod.require = (id) => id === '@supabase/ssr' ? supabaseMock
  : id === '@/lib/outlet/rutaSitio' ? { esSlugReservado: (slug) => ['api', 'productos', 'checkout', 'carrito', 'vista-previa'].includes(slug) } : require(id)
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
const { middleware } = mod.exports
const previo = process.env.NODE_ENV
let casos = 0
const check = (value, expected, message) => { casos++; assert.deepEqual(value, expected, message) }
const cabecera = (response, key) => response.headers.get(`x-middleware-request-${key}`)
async function pedir(host, ruta = '/api/website/presencia', adicionales = falsas) {
  return middleware(new NextRequest(`https://${host}${ruta}`, { headers: { ...adicionales, host, cookie: 'sesion-vieja=ficticia' } }))
}
;(async () => {
  process.env.NODE_ENV = 'production'
  const sistema = await pedir('org-propia.goadmin.io')
  check(cabecera(sistema, 'x-subdomain'), 'org-propia', 'org deriva del Host real')
  for (const k of claves.filter((x) => x !== 'x-subdomain')) check(cabecera(sistema, k), null, `sistema descarta ${k} forjada`)
  check(sistema.cookies.get('sesion-refrescada')?.value, 'ficticia', 'conserva cookie refrescada en respuesta')
  check(cabecera(sistema, 'cookie').includes('sesion-refrescada=ficticia'), true, 'servidor recibe cookie renovada')
  const dominio = await pedir('own.example')
  check(cabecera(dominio, 'x-custom-domain'), 'own.example', 'dominio custom deriva del Host')
  check(cabecera(dominio, 'x-subdomain'), null, 'dominio custom no hereda x-subdomain entrante')
  check(cabecera(dominio, 'x-outlet-path'), null, 'dominio custom no hereda sede entrante')
  const subSede = await pedir('sede.org-propia.goadmin.io')
  check(cabecera(subSede, 'x-subdomain'), 'org-propia', 'subsubdominio conserva organización')
  check(cabecera(subSede, 'x-outlet-subdomain'), 'sede', 'subsubdominio deriva sede del host')
  check(cabecera(subSede, 'x-custom-domain'), null, 'subsubdominio ignora custom domain forjado')
  const branch = await pedir('branch.own.example')
  check(cabecera(branch, 'x-custom-domain'), 'org-propia', 'dominio de sede utiliza org resuelta por lookup')
  check(cabecera(branch, 'x-custom-outlet-domain'), 'branch.own.example', 'dominio de sede conserva host validable')
  const prefijo = await pedir('org-propia.goadmin.io', '/sede-norte/checkout')
  check(new URL(prefijo.headers.get('x-middleware-rewrite')).pathname, '/checkout', 'prefijo de sede propia se reescribe')
  check(cabecera(prefijo, 'x-outlet-path'), 'sede-norte', 'rewrite envía sede propia al request')
  check(cabecera(prefijo, 'x-custom-domain'), null, 'rewrite elimina custom domain forjado')
  check(prefijo.cookies.get('sesion-refrescada')?.value, 'ficticia', 'rewrite conserva cookie refrescada')
  const ajena = await pedir('org-propia.goadmin.io', '/sede-ajena/checkout')
  check(ajena.headers.get('x-middleware-rewrite'), null, 'no reescribe hacia sede de otra organización')
  check(cabecera(ajena, 'x-outlet-path'), null, 'no conserva sede ajena enviada por header')
  const prefijoCustom = await pedir('own.example', '/sede-norte/checkout')
  check(cabecera(prefijoCustom, 'x-outlet-path'), 'sede-norte', 'prefijo de dominio custom exige lookup de su organización')
  const favicon = await pedir('own.example', '/favicon.ico')
  check(new URL(favicon.headers.get('x-middleware-rewrite')).pathname, '/api/favicon', 'favicon se reescribe')
  check(cabecera(favicon, 'x-custom-domain'), 'own.example', 'favicon recibe tenant seguro')
  check(favicon.cookies.get('sesion-refrescada')?.value, 'ficticia', 'favicon conserva cookie refrescada')
  const preview = await pedir('org-propia.goadmin.io', '/vista-previa/token.privado/productos/1')
  check(preview.headers.get('Cache-Control'), 'private, no-store, max-age=0', 'preview conserva privacidad de caché')
  check(preview.headers.get('Referrer-Policy'), 'no-referrer', 'preview no filtra token por referrer')
  check(preview.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive', 'preview conserva noindex')
  check(cabecera(preview, 'x-custom-domain'), null, 'preview también descarta dominio forjado')
  const estatico = await pedir('org-propia.goadmin.io', '/archivo.js')
  for (const k of claves) check(cabecera(estatico, k), null, `salida temprana no reenvía ${k} forjada`)
  const raiz = await pedir('goadmin.io')
  for (const k of claves) check(cabecera(raiz, k), null, `dominio sistema raíz no inventa ${k}`)
  const puerto = await pedir('ORG-PROPIA.GOADMIN.IO:443')
  check(cabecera(puerto, 'x-subdomain'), 'org-propia', 'normaliza mayúsculas y puerto')
  const tld = await pedir('org-propia.goadmin.co.uk')
  check(cabecera(tld, 'x-subdomain'), 'org-propia', 'conserva dominio de sistema con TLD compuesto')
  const localProduccion = await pedir('localhost:3000', '/api/website/presencia?subdomain=org-ajena&outlet=ajena')
  check(cabecera(localProduccion, 'x-subdomain'), null, 'producción no habilita simulación localhost')
  check(cabecera(localProduccion, 'x-outlet-subdomain'), null, 'producción no habilita sede simulada')
  const falsoLocal = await pedir('localhost.evil.example', '/api/website/presencia?subdomain=org-ajena')
  check(cabecera(falsoLocal, 'x-subdomain'), null, 'hostname que contiene localhost no permite simular tenant')
  process.env.NODE_ENV = 'test'
  const local = await pedir('localhost:3000', '/api/website/presencia?subdomain=org-propia&outlet=sede-norte')
  check(cabecera(local, 'x-subdomain'), 'org-propia', 'desarrollo permite simulación explícita localhost')
  check(cabecera(local, 'x-outlet-subdomain'), 'sede-norte', 'desarrollo conserva simulación de sede')
  check(cabecera(local, 'x-custom-domain'), null, 'desarrollo tampoco deja pasar custom domain forjado')
  console.log(`Autoridad tenant del middleware: ${casos} comprobaciones correctas (sin base ni red).`)
})().finally(() => { if (previo === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previo }).catch((e) => { console.error(e); process.exitCode = 1 })
