/**
 * verify-redireccion-principal.mjs — subdominio y dominios secundarios → dominio principal propio.
 *
 *   npm run verify:redireccion-principal
 *
 * Sin base ni red: importa la regla real (`lib/site/redireccionPrincipal.ts`) con un `fetch`
 * falso para la sonda, y lee el middleware.
 *
 * Casos:
 *  1. Subdominio, secundario y www.secundario → principal, misma ruta y query (la arma el
 *     middleware con pathname + search).
 *  2. El www del principal: sin www sirve → www.principal va al principal; Vercel manda a www →
 *     el destino es www.principal y www.principal no se toca (si no, bucle).
 *  3. Nada: principal mismo, sin principal propio, principal misconfigured o de sede, sonda caída,
 *     POST, rutas excluidas, localhost, vercel.app, host de sede.
 *  4. La sonda: solo cuenta si responde ESTA tienda para ESE dominio.
 *  5. El middleware: redirige con 308 antes de las sedes, salta la sonda y no redirige si falla.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const r = await import('../lib/site/redireccionPrincipal.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const dominio = (host, extra = {}) => ({
  host,
  domainType: 'custom_domain',
  status: 'verified',
  isPrimary: false,
  isActive: true,
  updatedAt: '2026-11-01T00:00:00Z',
  misconfigured: false,
  branchId: null,
  ...extra,
})
const DOMINIOS = [
  dominio('tienda.ejemplo.test', { isPrimary: true }),
  dominio('otra-marca.ejemplo.test'),
  dominio('marca.goadmin.io', { domainType: 'system_subdomain' }),
  dominio('sede-norte.ejemplo.test', { branchId: 7 }),
]
const base = { metodo: 'GET', pathname: '/productos/12', dominios: DOMINIOS, esSede: false, forma: 'directo' }
const destino = (extra) => r.hostDestinoRedireccion({ ...base, ...extra })

// ─── 1. Origen → principal ─────────────────────────────────────────────────
check(destino({ host: 'marca.goadmin.io' }) === 'tienda.ejemplo.test', '1a: el subdominio no va al principal')
check(destino({ host: 'marca.goadmin.co.uk' }) === 'tienda.ejemplo.test', '1b: el subdominio .co.uk no va al principal')
check(destino({ host: 'www.marca.goadmin.io' }) === 'tienda.ejemplo.test', '1c: www.subdominio no va al principal')
check(destino({ host: 'otra-marca.ejemplo.test' }) === 'tienda.ejemplo.test', '1d: el secundario no va al principal')
check(destino({ host: 'www.otra-marca.ejemplo.test' }) === 'tienda.ejemplo.test', '1e: www.secundario no va al principal')
check(destino({ host: 'Otra-Marca.Ejemplo.test:443' }) === 'tienda.ejemplo.test', '1f: mayúsculas o puerto lo rompen')
check(destino({ host: 'marca.goadmin.io', metodo: 'HEAD' }) === 'tienda.ejemplo.test', '1g: HEAD no se redirige')
check(r.CODIGO_REDIRECCION === 308, '1h: la redirección no es 308')

// ─── 2. El www del principal ───────────────────────────────────────────────
check(destino({ host: 'tienda.ejemplo.test' }) === null, '2a: el principal se redirige a sí mismo')
check(destino({ host: 'www.tienda.ejemplo.test', forma: 'directo' }) === 'tienda.ejemplo.test', '2b: www.principal no va al principal cuando el principal sirve sin www')
check(destino({ host: 'www.tienda.ejemplo.test', forma: 'via-www' }) === null, '2c: www.principal se redirige aunque Vercel mande el principal a www (bucle)')
check(destino({ host: 'marca.goadmin.io', forma: 'via-www' }) === 'www.tienda.ejemplo.test', '2d: con Vercel a www, el destino no es www.principal')
check(destino({ host: 'www.otra-marca.ejemplo.test', forma: 'via-www' }) === 'www.tienda.ejemplo.test', '2e: www.secundario con Vercel a www')
check(
  r.principalPropio([dominio('www.tienda.ejemplo.test', { isPrimary: true })]) === 'tienda.ejemplo.test',
  '2f: un principal guardado con www no se normaliza'
)

// ─── 3. Sin redirección ────────────────────────────────────────────────────
check(destino({ host: 'marca.goadmin.io', dominios: DOMINIOS.map((d) => ({ ...d, isPrimary: false })) }) === null, '3a: sin principal propio redirige')
check(destino({ host: 'marca.goadmin.io', dominios: [dominio('marca.goadmin.io', { domainType: 'system_subdomain', isPrimary: true })] }) === null, '3b: un subdominio principal cuenta como propio')
check(destino({ host: 'marca.goadmin.io', dominios: DOMINIOS.map((d) => (d.isPrimary ? { ...d, misconfigured: true } : d)) }) === null, '3c: principal misconfigured redirige')
check(destino({ host: 'marca.goadmin.io', dominios: DOMINIOS.map((d) => (d.isPrimary ? { ...d, status: 'pending' } : d)) }) === null, '3d: principal sin verificar redirige')
check(destino({ host: 'marca.goadmin.io', dominios: DOMINIOS.map((d) => (d.isPrimary ? { ...d, branchId: 3 } : d)) }) === null, '3e: el dominio de una sede cuenta como principal')
check(destino({ host: 'marca.goadmin.io', forma: null }) === null, '3f: con el principal caído (sonda) redirige')
check(destino({ host: 'marca.goadmin.io', metodo: 'POST' }) === null, '3g: POST redirige')
for (const ruta of ['/api', '/api/orders', '/api/webhooks/bold', '/auth', '/auth/callback', '/vista-previa/abc.def', '/_next/data/x.json', '/favicon.ico', '/.well-known/apple-developer-merchantid-domain-association']) {
  check(destino({ host: 'marca.goadmin.io', pathname: ruta }) === null, `3h: ${ruta} se redirige`)
}
check(destino({ host: 'marca.goadmin.io', pathname: '/checkout/resultado' }) === 'tienda.ejemplo.test', '3i: una página normal (resultado del pago) no se redirige')
for (const host of ['localhost:3000', 'marca.localhost', '127.0.0.1', 'goadmin-websites-abc123.vercel.app', 'vercel.app']) {
  check(destino({ host }) === null, `3j: ${host} se redirige`)
}
check(destino({ host: 'sede-norte.ejemplo.test' }) === null, '3k: el dominio de una sede se redirige')
check(destino({ host: 'www.sede-norte.ejemplo.test' }) === null, '3l: www del dominio de una sede se redirige')
check(destino({ host: 'norte.marca.goadmin.io', esSede: true }) === null, '3m: un host marcado como sede se redirige')
check(destino({ host: '' }) === null && destino({ host: null }) === null, '3n: sin host redirige')

// ─── 4. Sonda ──────────────────────────────────────────────────────────────
const respuesta = (status, cabeceras = {}) => new Response(status === 200 ? 'User-agent: *' : null, { status, headers: cabeceras })
const fetchFalso = (mapa) => {
  const pedidas = []
  const f = async (url, init) => {
    pedidas.push({ url: String(url), init })
    const res = mapa[String(url)]
    if (res instanceof Error) throw res
    return res ?? respuesta(404)
  }
  f.pedidas = pedidas
  return f
}
{
  const f = fetchFalso({ 'https://tienda.ejemplo.test/robots.txt': respuesta(200, { 'x-custom-domain': 'tienda.ejemplo.test' }) })
  check((await r.formaDelPrincipal('tienda.ejemplo.test', f)) === 'directo', '4a: principal que sirve sin www no es «directo»')
  check(f.pedidas[0]?.init?.redirect === 'manual' && f.pedidas[0]?.init?.headers?.[r.CABECERA_SONDA] === '1', '4b: la sonda sigue redirecciones o no se marca')
}
{
  const f = fetchFalso({
    'https://tienda.ejemplo.test/robots.txt': respuesta(307, { location: 'https://www.tienda.ejemplo.test/robots.txt' }),
    'https://www.tienda.ejemplo.test/robots.txt': respuesta(200, { 'x-custom-domain': 'tienda.ejemplo.test' }),
  })
  check((await r.formaDelPrincipal('tienda.ejemplo.test', f)) === 'via-www', '4c: Vercel a www no se reconoce')
}
{
  check((await r.formaDelPrincipal('tienda.ejemplo.test', fetchFalso({}))) === null, '4d: un 404 cuenta como vivo')
  const otraApp = fetchFalso({ 'https://tienda.ejemplo.test/robots.txt': respuesta(200, {}) })
  check((await r.formaDelPrincipal('tienda.ejemplo.test', otraApp)) === null, '4e: otra aplicación en el dominio cuenta como esta tienda')
  const otroDominio = fetchFalso({ 'https://tienda.ejemplo.test/robots.txt': respuesta(200, { 'x-custom-domain': 'otra.test' }) })
  check((await r.formaDelPrincipal('tienda.ejemplo.test', otroDominio)) === null, '4f: la tienda de otro dominio cuenta')
  const aOtroLado = fetchFalso({ 'https://tienda.ejemplo.test/robots.txt': respuesta(301, { location: 'https://parqueado.test/' }) })
  check((await r.formaDelPrincipal('tienda.ejemplo.test', aOtroLado)) === null, '4g: una redirección a otro sitio cuenta como viva')
  const sinRed = fetchFalso({ 'https://tienda.ejemplo.test/robots.txt': new Error('ENOTFOUND') })
  check((await r.formaDelPrincipal('tienda.ejemplo.test', sinRed)) === null, '4h: sin DNS cuenta como vivo')
  const lento = async (_u, init) => new Promise((_, ko) => init.signal.addEventListener('abort', () => ko(new Error('abort'))))
  const t0 = Date.now()
  check((await r.formaDelPrincipal('tienda.ejemplo.test', lento, 50)) === null && Date.now() - t0 < 1000, '4i: la sonda no corta a tiempo')
}

// ─── 5. Middleware ─────────────────────────────────────────────────────────
{
  const mw = readFileSync(join(ROOT, 'middleware.ts'), 'utf8')
  const pos = (t) => mw.indexOf(t)
  check(pos('await destinoAlPrincipal(') > 0 && pos('await destinoAlPrincipal(') < pos('const sede = await sedeDelPrefijo('), '5a: la redirección no va antes de las sedes')
  check(/NextResponse\.redirect\(new URL\(`\$\{url\.pathname\}\$\{url\.search\}`, `https:\/\/\$\{destino\}`\), CODIGO_REDIRECCION\)/.test(mw), '5b: no conserva ruta y query o no usa 308')
  check(/!request\.headers\.has\(CABECERA_SONDA\)/.test(mw), '5c: la sonda se redirige (sondas en cadena)')
  check(/!outletSubdomain &&\s*!isCustomOutletDomain &&/.test(mw), '5d: las sedes se redirigen')
  check(/if \(error\) return null/.test(mw) && /catch \(err\) \{\s*console\.error\('\[middleware\] Redirección al principal omitida/.test(mw), '5e: un fallo de la base redirige o rompe')
  check(/'Cache-Control', 'private, max-age=3600'/.test(mw), '5f: la redirección queda guardada para siempre o en la CDN')
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ redirección al principal: ${casos} comprobaciones`)
