/**
 * verify-consultar-pedido.mjs — «Consultar pedido v2» (Figma «16 Sitio web» 3102:84056, 2026-11-24).
 *
 *   npm run verify:consultar-pedido
 *
 * Sin base de datos ni dependencias: lee el fuente y comprueba la seguridad y el contrato de la
 * página única de consulta.
 * - Nada lista pedidos por correo: /api/orders/lookup responde 410 sin tocar la base y nadie lo
 *   llama; la búsqueda exige número + correo o teléfono y compara en el servidor.
 * - Mismo mensaje si el pedido no existe o si el contacto no coincide (servidor y pantalla).
 * - Límite de intentos por IP y por número; organización del host, nunca del body.
 * - El resultado se pinta en la misma página con `OrderTracker` incrustado y el token de
 *   seguimiento de siempre; el token no viaja en la URL.
 * - /rastrear y /tracking redirigen a /consultar-pedido conservando la búsqueda.
 * - Estados del diseño: errores por campo y generales (muchas búsquedas, sin conexión con
 *   «Reintentar»), silueta al buscar, foco y aviso accesible al resultado.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

let fallos = 0
let casos = 0
function check(ok, texto) {
  casos++
  if (ok) console.log(`  ok  ${texto}`)
  else {
    fallos++
    console.error(`  FALLA  ${texto}`)
  }
}

// ─── 1. Búsqueda por correo retirada ─────────────────────────────────────────────────────────
const lookup = sinComentarios(leer('app/api/orders/lookup/route.ts'))
check(/status:\s*410/.test(lookup), '/api/orders/lookup responde 410')
check(!/supabase|from\(|web_orders/.test(lookup), '/api/orders/lookup ya no consulta la base')

function archivos(dir) {
  const salida = []
  for (const nombre of readdirSync(join(ROOT, dir))) {
    const ruta = join(dir, nombre)
    if (statSync(join(ROOT, ruta)).isDirectory()) salida.push(...archivos(ruta))
    else if (/\.(tsx?|mjs|js)$/.test(nombre)) salida.push(ruta)
  }
  return salida
}
const fuentes = ['app', 'components', 'lib'].flatMap(archivos).map((r) => relative(ROOT, join(ROOT, r)).replace(/\\/g, '/'))
const quienLlamaLookup = fuentes.filter((r) => r !== 'app/api/orders/lookup/route.ts' && /orders\/lookup/.test(sinComentarios(leer(r))))
check(quienLlamaLookup.length === 0, `nadie llama /api/orders/lookup${quienLlamaLookup.length ? ` (lo llaman: ${quienLlamaLookup.join(', ')})` : ''}`)
check(!fuentes.includes('app/consultar-pedido/OrderLookupClient.tsx'), 'la pantalla vieja que listaba pedidos ya no existe')

// ─── 2. Servidor: número + contacto, mismo mensaje, límite, organización del host ─────────────
const buscar = sinComentarios(leer('app/api/cuenta/buscar-pedido/route.ts'))
check(/getOrgIdDelHost\(\)/.test(buscar) && !/body\??\.organization/i.test(buscar), 'búsqueda: la organización sale del host, no del body')
check(/checkRateLimit\(`buscar-pedido:ip:/.test(buscar) && /checkRateLimit\(`buscar-pedido:numero:/.test(buscar), 'búsqueda: límite por IP y por número de pedido')
check(/status:\s*429/.test(buscar), 'búsqueda: «muchas búsquedas» es 429')
check(/normalizarNumeroPedido\(body\?\.numero\)/.test(buscar) && /tipoContacto\(body\?\.contacto\)/.test(buscar), 'búsqueda: exige el número y un correo o teléfono')
check(/\.eq\('organization_id', orgId\)/.test(buscar) && /\.eq\('order_number', numero\)/.test(buscar), 'búsqueda: igualdad exacta del número, en la organización del host')
check(/\.limit\(1\)/.test(buscar) && /\.maybeSingle\(\)/.test(buscar), 'búsqueda: a lo sumo un pedido (nunca una lista)')
check(!/\.(ilike|eq|in)\('customer_(email|phone)'/.test(buscar), 'búsqueda: nunca filtra por correo o teléfono (se compara después, con el número)')
check(/if \(!pedido \|\| !contactoCoincide\(pedido, body\?\.contacto\)\) \{\s*return NextResponse\.json\(\{ error: NO_ENCONTRADO_SIN_CUENTA \}, \{ status: 404/.test(buscar), 'búsqueda: «no existe» y «no coincide» son la MISMA respuesta')
check(/tokenSeguimiento\(orgId, pedido\.id\)/.test(buscar), 'búsqueda: devuelve el token de seguimiento de siempre (no uno nuevo)')
check(!/customer_(name|email|phone)\s*:/.test(buscar), 'búsqueda: la respuesta no trae datos personales')

// ─── 3. Pantalla: resultado en la misma página, estados y accesibilidad ───────────────────────
const pantallaCruda = leer('app/consultar-pedido/SeguirPedido.tsx')
const pantalla = sinComentarios(pantallaCruda)
check(/fetch\('\/api\/cuenta\/buscar-pedido'/.test(pantalla) && /JSON\.stringify\(\{ numero, contacto \}\)/.test(pantalla), 'pantalla: busca con número y contacto en el servidor')
check(/<OrderTracker\s+incrustado/.test(pantalla) && /token=\{resultado\.token\}/.test(pantalla), 'pantalla: el pedido se muestra aquí con OrderTracker incrustado y el token')
check(!/history\.(push|replace)State|[?&]t=/.test(pantalla), 'pantalla: el token no se pone en la URL')
check(/res\.status === 404\) setError\(\{ tipo: 'no_encontrado' \}\)/.test(pantalla), 'pantalla: un solo aviso para «no existe» y «no coincide»')
check((pantalla.match(/No encontramos un pedido con esos datos/g) || []).length === 1, 'pantalla: el texto de «no encontrado» existe una sola vez')
check(/res\.status === 429\) setError\(\{ tipo: 'muchas' \}\)/.test(pantalla) && /Hiciste muchas búsquedas/.test(pantalla), 'pantalla: «Hiciste muchas búsquedas»')
check(/setError\(\{ tipo: 'conexion' \}\)/.test(pantalla) && /Revisa tu conexión a internet/.test(pantalla) && />\s*Reintentar\s*</.test(pantalla), 'pantalla: sin conexión con «Reintentar»')
check(/aria-invalid=\{errores\.numero/.test(pantalla) && /aria-invalid=\{errores\.contacto/.test(pantalla), 'pantalla: errores por campo con aria-invalid')
check(/htmlFor="rastrear-numero"/.test(pantalla) && /htmlFor="rastrear-contacto"/.test(pantalla), 'pantalla: campos con label')
check((pantalla.match(/role="alert"/g) || []).length >= 4, 'pantalla: los errores generales se anuncian (role="alert")')
check(/aria-live="polite"/.test(pantalla) && /refResultado\.current\?\.focus\(\)/.test(pantalla), 'pantalla: aviso y foco al resultado')
check(/disabled=\{enviando\}/.test(pantalla) && /<SiluetaPedido \/>/.test(pantalla), 'pantalla: buscando = campos bloqueados y silueta')
check(/Aquí verás tu pedido/.test(pantalla), 'pantalla: mensaje de primer ingreso')
check(/¿Dónde encuentro mi número\?/.test(pantalla) && /aria-expanded=\{ayudaNumero\}/.test(pantalla), 'pantalla: «¿Dónde encuentro mi número?»')
check(/\/mi-cuenta\/pedidos/.test(pantalla) && /Iniciar sesión/.test(pantalla), 'pantalla: «Iniciar sesión» para ver todos los pedidos')
check(!/from 'next\/link'/.test(pantallaCruda), 'pantalla: enlaces con @/components/site/Enlace, no next/link')
check(!/go\s*admin/i.test(pantallaCruda + leer('components/site/rastreo/SiluetaPedido.tsx')), 'pantalla: sin marca GO Admin ante compradores')
check(!/\borders\.map\(|\.slice\(0, 10\)/.test(pantalla), 'pantalla: no pinta listas de pedidos')

// ─── 4. OrderTracker: la misma pieza de /pedido/<n> ───────────────────────────────────────────
const tracker = leer('app/pedido/[id]/OrderTracker.tsx')
check(/incrustado = false/.test(tracker), 'OrderTracker: «incrustado» es opcional (sin él, /pedido/<n> igual que antes)')
check(/incrustado \? 'w-full pb-16' : 'container mx-auto max-w-xl px-4 pt-6 pb-28'/.test(tracker), 'OrderTracker: el contenedor de /pedido/<n> no cambia')
check(/Rastrear en la transportadora/.test(tracker) && /Ver en la transportadora/.test(tracker), 'OrderTracker: «Rastrear en la transportadora» incrustado; /pedido/<n> conserva su enlace')

// ─── 5. Una sola página: /rastrear y /tracking redirigen conservando la búsqueda ─────────────
const rastrear = sinComentarios(leer('app/rastrear/page.tsx'))
check(/redirect\(q \? `\/consultar-pedido\?\$\{q\}` : '\/consultar-pedido'\)/.test(rastrear) && /new URLSearchParams\(\)/.test(rastrear), '/rastrear → /consultar-pedido con la misma query')
check(!/OrganizationLayout|SeguirPedido/.test(rastrear), '/rastrear ya no pinta una página propia')
const tracking = sinComentarios(leer('app/tracking/page.tsx'))
check(/\/consultar-pedido\?guia=\$\{encodeURIComponent\(q\)\}/.test(tracking) && /'\/consultar-pedido\?modo=guia'/.test(tracking), '/tracking → /consultar-pedido (guía o pestaña de guía)')
const pagina = sinComentarios(leer('app/consultar-pedido/page.tsx'))
check(/getShipmentByTracking\(guia, organization\.id\)/.test(pagina), '/consultar-pedido: la guía se busca con la organización del host')
check(/robots: \{ index: false, follow: false \}/.test(pagina), '/consultar-pedido: no se indexa')
check(/action="\/consultar-pedido"/.test(pantalla), 'la búsqueda por guía se queda en /consultar-pedido')
const enlacesViejos = fuentes.filter((r) => !r.startsWith('app/rastrear/') && /href="\/rastrear"/.test(leer(r)))
check(enlacesViejos.length === 0, `ningún enlace propio apunta a /rastrear${enlacesViejos.length ? ` (${enlacesViejos.join(', ')})` : ''}`)

console.log(`\n${casos - fallos}/${casos} casos OK`)
if (fallos) process.exit(1)
