/**
 * verify-resenas.mjs — flujo de reseñas reales y de ejemplo (Figma «16 Sitio web» 3123-88477).
 *
 *   npm run verify:resenas
 *
 * Sin dependencias ni red: importa el código REAL (`--experimental-strip-types`, con un gancho que
 * resuelve el alias `@/` y los imports sin extensión) y lee el fuente de las rutas.
 *
 * Comprueba:
 * 1. Organización del host: /api/reviews, /verificar, /fotos y /baja la toman de getOrgIdDelHost y
 *    rechazan un cuerpo con otra organización.
 * 2. Solo compradores exigido en el servidor (403 sin compra verificada) y «Compra verificada» solo
 *    con verificación del servidor.
 * 3. Reseñas de ejemplo intactas: generatedReviews.ts y mixedReviews.ts sin cambios frente a HEAD
 *    (o al BASE_REF), y sin el switch todo es el mismo objeto.
 * 4. Switch «Compra verificada» en las de ejemplo: por defecto encendido; apagado quita la insignia
 *    solo a las de ejemplo; no activa el pintado nuevo de la sección.
 * 5. Tiendas existentes: sin `reviews_default_source` la ficha recibe lo de siempre (`null`).
 * 6. Enlaces firmados, validación del cuerpo, plan del correo y correo sin marca de la plataforma.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const raiz = pathToFileURL(ROOT + '/').href
const ganchos = `
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const RAIZ = ${JSON.stringify(raiz)}
function probar(base) {
  for (const s of ['.ts', '.tsx', '/index.ts', '']) {
    const u = new URL(base + s)
    if (s === '' && !/\.(ts|tsx|js|mjs)$/.test(u.pathname)) continue
    if (existsSync(fileURLToPath(u))) return u.href
  }
  return null
}
export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith('@/')) {
    const r = probar(RAIZ + especificador.slice(2))
    if (r) return { url: r, shortCircuit: true }
  }
  if ((especificador.startsWith('./') || especificador.startsWith('../')) && contexto.parentURL && /\\.tsx?$/.test(contexto.parentURL)) {
    const r = probar(new URL(especificador, contexto.parentURL).href)
    if (r) return { url: r, shortCircuit: true }
  }
  return siguiente(especificador, contexto)
}
`
register('data:text/javascript,' + encodeURIComponent(ganchos), import.meta.url)

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'clave-de-prueba-solo-para-el-verify-0000000000'

let casos = 0
const problemas = []
function check(ok, nombre) {
  casos += 1
  if (!ok) problemas.push(nombre)
}
// Fin de línea normalizado: el árbol puede tener CRLF (core.autocrlf) y las búsquedas usan \n.
const leer = (r) => readFileSync(join(ROOT, r), 'utf8').replace(/\r\n/g, '\n')

const { leerAjustesResenas, configResenasSitio } = await import('../lib/resenas/ajustesResenas.ts')
const { validarResena, organizacionDelCuerpoDistinta, prefijoFotosResena } = await import('../lib/resenas/validarResena.ts')
const { firmarEnlaceResena, enlaceResenaValido, firmarBajaResenas, bajaResenasValida, VIGENCIA_ENLACE_RESENA_MS } = await import('../lib/resenas/firmaResena.ts')
const { planPrimerCorreo, productosDelCorreo, rangoPrimerCorreo } = await import('../lib/resenas/pedirResena.ts')
const { armarCorreoPedirResena } = await import('../lib/resenas/correoPedirResena.ts')
const { aplicarInsigniaEjemplos, configResenasDeSeccion } = await import('../components/site/reviews/types.ts')
const ficha = await import('../lib/website/v2/seccionesFicha.ts')

// ── 1. Organización del host ──
for (const r of ['app/api/reviews/route.ts', 'app/api/reviews/verificar/route.ts', 'app/api/reviews/fotos/route.ts', 'app/api/reviews/baja/route.ts']) {
  const f = leer(r)
  check(f.includes('getOrgIdDelHost()'), `${r}: organización del host`)
  check(!/body\.organizationId\s*\|\|/.test(f) && !/eq\('organization_id', (body|organizationId \?\? body)/.test(f), `${r}: nunca filtra con la organización del cuerpo`)
}
const rutaResenas = leer('app/api/reviews/route.ts')
check(rutaResenas.includes('organizacionDelCuerpoDistinta(body, organizationId)') && rutaResenas.includes("codigo: 'organizacion_distinta' }, 403"), '/api/reviews: cuerpo con otra organización → 403')
check(organizacionDelCuerpoDistinta({ organizationId: 7 }, 8) === true, 'cuerpo 7 con host 8: distinta')
check(organizacionDelCuerpoDistinta({ organizationId: '8' }, 8) === false, 'cuerpo «8» con host 8: igual')
check(organizacionDelCuerpoDistinta({}, 8) === false, 'sin organización en el cuerpo: vale (sale del host)')

// ── 2. Solo compradores y «Compra verificada» ──
check(/ajustes\.quienEscribe === 'buyers' && !verificacion\.verificado\)\s*\{\s*return respuesta\([\s\S]{0,200}codigo: 'solo_compradores'[\s\S]{0,80}403/.test(rutaResenas), '/api/reviews: solo compradores → 403 antes de guardar')
check(rutaResenas.indexOf("'solo_compradores'") < rutaResenas.indexOf(".from('product_reviews')\n      .insert("), '/api/reviews: la comprobación va antes del insert')
check(rutaResenas.includes('is_verified_purchase: verificacion.verificado'), '/api/reviews: la insignia sale solo de la verificación del servidor')
check(!/is_verified_purchase:\s*(true|body)/.test(rutaResenas), '/api/reviews: nunca true fijo ni del cuerpo')
const verif = leer('lib/resenas/verificarCompra.ts')
check(verif.includes("f.status === 'delivered'") && verif.includes(".eq('organization_id', org)"), 'verificarCompra: pedido entregado de la organización del host')
check(verif.includes('enlaceResenaValido(org, e.orderId, e.token) || tokenSeguimientoValido(org, e.orderId, e.trackingToken)'), 'verificarCompra: el id del pedido solo vale con un token firmado')
check(leerAjustesResenas(null).quienEscribe === 'any' && leerAjustesResenas({ reviews_who_can_write: 'buyers' }).quienEscribe === 'buyers', 'ajustes: NULL = cualquiera; buyers = solo compradores')
check(leerAjustesResenas({}).moderar === true && leerAjustesResenas({ reviews_auto_approve: true }).moderar === false, 'ajustes: moderar = al revés de auto-aprobar (lo de hoy)')
check(leerAjustesResenas({}).correo.activo === false && leerAjustesResenas({}).correo.dias === 7, 'ajustes: sin correo por defecto, 7 días')

// ── 3. Reseñas de ejemplo intactas ──
const BASE = process.env.BASE_REF || 'HEAD'
for (const r of ['components/site/reviews/providers/generatedReviews.ts', 'components/site/reviews/providers/mixedReviews.ts', 'lib/review-utils.ts']) {
  let igual = false
  try {
    execFileSync('git', ['diff', '--quiet', BASE, '--', r], { cwd: ROOT })
    igual = true
  } catch {
    igual = false
  }
  check(igual, `${r}: sin cambios frente a ${BASE} (las de ejemplo funcionan como hoy)`)
}
const muestra = {
  reviews: [
    { id: 1, name: 'A', rating: 5, comment: 'x', date: '2026-01-01', likes: 1, verified: true, avatar: 'A', source: 'generated' },
    { id: 2, name: 'B', rating: 4, comment: 'y', date: '2026-01-02', likes: 0, verified: true, avatar: 'B', source: 'real' },
    { id: 3, name: 'C', rating: 3, comment: 'z', date: '2026-01-03', likes: 0, verified: false, avatar: 'C', source: 'generated' },
  ],
  totalReviews: 3,
  avgRating: 4,
  isReal: true,
}
check(aplicarInsigniaEjemplos(muestra, undefined) === muestra, 'switch sin valor: el MISMO resultado (cero cambio)')
check(aplicarInsigniaEjemplos(muestra, true) === muestra, 'switch encendido: el MISMO resultado')
const apagado = aplicarInsigniaEjemplos(muestra, false)
check(apagado.reviews[0].verified === false && apagado.reviews[1].verified === true, 'switch apagado: ejemplo sin insignia, real verificada la conserva')
check(apagado.totalReviews === 3 && apagado.avgRating === 4 && apagado.reviews.length === 3, 'switch apagado: el promedio y el conteo no cambian (los ejemplos siguen contando)')

// ── 4. Switch en la sección ──
check(ficha.ejemplosConVerificada({}) === true && ficha.ejemplosConVerificada(null) === true, 'switch: encendido por defecto')
check(ficha.ejemplosConVerificada({ [ficha.CLAVE_EJEMPLOS_VERIFICADA]: false }) === false, 'switch: apagado con false')
check(!ficha.CLAVES_NUEVAS_RESENAS.includes(ficha.CLAVE_EJEMPLOS_VERIFICADA), 'switch: no activa el pintado nuevo de la sección')
check(ficha.leerOpcionesResenas({ [ficha.CLAVE_EJEMPLOS_VERIFICADA]: false }).conOpciones === false, 'switch: la sección se sigue pintando como hoy')
const seccion = leer('components/sections/product-detail/ProductReviewsSection.tsx')
// La regla vive en configResenasDeSeccion (reviews/types.ts), la misma de la pestaña «Reseñas (N)».
check(seccion.includes('[CLAVE_EJEMPLOS_VERIFICADA]: insignia') && seccion.includes('configResenasDeSeccion('), 'sección: el switch pasa por configResenasDeSeccion')
{
  const base = { reviews_source: 'generated' }
  check(configResenasDeSeccion({ [ficha.CLAVE_EJEMPLOS_VERIFICADA]: false }, base)?.ejemplos_verificada === false, 'sección: `false` llega al orquestador')
  check(configResenasDeSeccion({ [ficha.CLAVE_EJEMPLOS_VERIFICADA]: true }, base) === base, 'sección: `true` no cambia nada (misma base)')
  check(configResenasDeSeccion({}, null) === null, 'sección sin claves: la base de siempre (null)')
  check(configResenasDeSeccion({ reviews_source: 'real', min_visible: 4 }, base)?.reviews_source === 'real', 'sección: su origen manda sobre el de la tienda')
  check(configResenasDeSeccion({ reviews_source: 'otro' }, base) === base, 'sección: origen desconocido se ignora')
}
const orquestador = leer('components/site/reviews/ProductReviews.tsx')
check((orquestador.match(/aplicarInsigniaEjemplos\(/g) || []).length === 3, 'orquestador: el switch se aplica en los tres caminos')

// ── 5. Origen: tiendas existentes como hoy, nuevas en «Solo reales» ──
check(configResenasSitio({ reviews_default_source: null, reviews_auto_approve: false }) === null, 'tienda existente (sin origen): `null`, lo de siempre')
check(configResenasSitio(null) === null, 'sin ajustes: `null`')
check(configResenasSitio({ reviews_default_source: 'real' })?.reviews_source === 'real', 'tienda nueva: «Solo reales»')
check(ficha.origenEfectivoResenas({}, null) === 'generated', 'origen sin nada: ejemplos (como hoy)')
check(ficha.origenEfectivoResenas({ reviews_source: 'mixed' }, 'real') === 'mixed', 'origen de la sección manda')
check(ficha.origenEfectivoResenas({}, 'real') === 'real', 'origen de la tienda si la sección no elige')
check(ficha.grupoOrigenResenas('auto') === 'hasta_n' && ficha.grupoOrigenResenas('mixed') === 'hasta_n', '«Reales + ejemplos hasta tener N» agrupa mixed y auto')
for (const r of ['app/productos/[id]/page.tsx', 'components/sections/product-detail/ProductDetailRenderer.tsx']) {
  check(leer(r).includes('configResenasSitio(organization.website_settings)'), `${r}: origen de la tienda`)
}

// ── 6. Firmas, validación, plan y correo ──
const ORDEN = '0b6b6f2e-2f7e-4c41-9d1a-1f5b9a3c2d11'
const tk = firmarEnlaceResena(120, ORDEN)
check(typeof tk === 'string' && enlaceResenaValido(120, ORDEN, tk), 'enlace firmado válido')
check(!enlaceResenaValido(121, ORDEN, tk), 'enlace de otra organización: no vale')
check(!enlaceResenaValido(120, '0b6b6f2e-2f7e-4c41-9d1a-1f5b9a3c2d12', tk), 'enlace de otro pedido: no vale')
check(!enlaceResenaValido(120, ORDEN, tk, Date.now() + VIGENCIA_ENLACE_RESENA_MS + 60_000), 'enlace vencido: no vale')
check(!enlaceResenaValido(120, ORDEN, 'abc.def'), 'enlace basura: no vale')
const baja = firmarBajaResenas(120, ORDEN)
check(bajaResenasValida(120, ORDEN, baja) && !bajaResenasValida(121, ORDEN, baja), 'baja firmada por organización')

const URL_SB = 'https://ejemplo.supabase.co'
const base = { productId: 10, rating: 5, content: 'Muy buen producto, llegó rápido', authorName: 'Laura M.' }
check(validarResena(base, { organizationId: 120, supabaseUrl: URL_SB }).ok, 'cuerpo válido')
check(!validarResena({ ...base, rating: 6 }, { organizationId: 120, supabaseUrl: URL_SB }).ok, 'calificación 6: rechazada')
check(validarResena({ ...base, content: 'Bueno' }, { organizationId: 120, supabaseUrl: URL_SB }).campo === 'content', 'opinión de 5 letras: «mínimo 10»')
check(validarResena({ ...base, content: undefined }, { organizationId: 120, supabaseUrl: URL_SB }).ok, 'solo estrellas (Consultar pedido): válido')
check(validarResena({ ...base, images: ['https://otro.sitio/x.jpg'] }, { organizationId: 120, supabaseUrl: URL_SB }).campo === 'images', 'foto de otro sitio: rechazada')
check(validarResena({ ...base, images: [prefijoFotosResena(URL_SB, 121) + 'a.jpg'] }, { organizationId: 120, supabaseUrl: URL_SB }).campo === 'images', 'foto de otra organización: rechazada')
check(validarResena({ ...base, images: [prefijoFotosResena(URL_SB, 120) + '2026-11/a.jpg'] }, { organizationId: 120, supabaseUrl: URL_SB }).ok, 'foto propia: aceptada')
check(validarResena({ ...base, images: [1, 2, 3, 4].map((i) => prefijoFotosResena(URL_SB, 120) + i + '.jpg') }, { organizationId: 120, supabaseUrl: URL_SB }).campo === 'images', 'cuatro fotos: rechazadas')

const ahora = new Date('2026-11-25T15:00:00Z')
const r7 = rangoPrimerCorreo(ahora, 7)
const enRango = new Date(Date.parse(r7.hasta) - 3600_000).toISOString()
const pedidos = [
  { id: 'a', email: 'a@correo.com', deliveredAt: enRango },
  { id: 'b', email: 'b@correo.com', deliveredAt: new Date(ahora.getTime() - 2 * 86400000).toISOString() },
  { id: 'c', email: 'c@correo.com', deliveredAt: enRango },
  { id: 'd', email: 'baja@correo.com', deliveredAt: enRango },
  { id: 'e', email: null, deliveredAt: enRango },
  { id: 'f', email: 'f@correo.com', deliveredAt: new Date(ahora.getTime() - 40 * 86400000).toISOString() },
]
const plan = planPrimerCorreo(pedidos, new Set(['c']), new Set(['baja@correo.com']), ahora, 7)
check(JSON.stringify(plan) === JSON.stringify(['a']), 'plan del correo: solo el entregado hace 7 días, sin solicitud, sin baja, con correo y no viejo')
const prods = productosDelCorreo([
  { productId: 1, fichaId: 100, nombre: 'Talla S' },
  { productId: 2, fichaId: 100, nombre: 'Talla M' },
  { productId: 3, fichaId: 3, nombre: 'B' },
  { productId: 4, fichaId: 4, nombre: 'C' },
  { productId: 5, fichaId: 5, nombre: 'D' },
])
check(prods.length === 3 && prods[0].fichaId === 100, 'correo: hasta 3 fichas, variantes van a su ficha padre')

const correo = armarCorreoPedirResena({
  sobre: { nombre: 'Tienda Ejemplo', logoUrl: null, color: '#E8862A', texto: '#ffffff' },
  nombreCliente: 'Laura',
  numeroPedido: 'PED-1',
  entregado: '14 de noviembre',
  productos: [{ nombre: 'Café <molido>', foto: null, estrellas: [1, 2, 3, 4, 5].map((n) => `https://t.co/opinar/x?t=1&p=1&r=${n}`) }],
  enlaceEscribir: 'https://t.co/opinar/x?t=1',
  enlaceBaja: 'https://t.co/api/reviews/baja?s=1&t=2',
  host: 't.co',
  recordatorio: false,
})
check(!/go ?admin|goadmin|supabase/i.test(correo.html + correo.asunto), 'correo: sin la marca de la plataforma')
check((correo.html.match(/r=\d"/g) || []).length === 5, 'correo: cinco estrellas con enlace')
check(correo.html.includes('Café &lt;molido&gt;') && correo.asunto === 'Laura, ¿qué te pareció tu pedido PED-1?', 'correo: escapa el HTML y arma el asunto')
check(correo.html.includes('No quiero recibir más solicitudes de opinión'), 'correo: baja en el pie')
const proceso = leer('lib/resenas/procesarPedirResenas.ts')
check(proceso.includes('sobreCorreoPedido(') && proceso.includes('correoRespaldoTiendas()'), 'correo: remitente de la tienda con el respaldo único')
check(proceso.includes(".eq('reviews_request_enabled', true)"), 'correo: solo tiendas que lo encendieron')

if (problemas.length) {
  console.error(`✗ verify-resenas: ${problemas.length} de ${casos} fallaron`)
  for (const m of problemas) console.error(`  - ${m}`)
  process.exit(1)
}
console.log(`✓ verify-resenas: ${casos} comprobaciones`)
