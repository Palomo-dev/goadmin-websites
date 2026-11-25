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
 * - Computador (≥ lg, Figma D4/D5): el resultado y /pedido/<n> en dos columnas con las mismas
 *   piezas; el celular conserva el orden de siempre (§ 7).
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

// ─── 6. Arreglos del 2026-11-24 (probado en vivo por el dueño) ───────────────────────────────
// 6.1 Pestañas: la misma cuadrícula en las dos, para que no salten bajo el puntero.
check(!/if \(modo === 'guia'\) \{\s*return/.test(pantalla), 'pestañas: la guía ya no cambia a otra maqueta (las pestañas no saltan)')
check(/const panel = modo === 'guia'\s*\?\s*children \?\? <PanelPrimerIngreso modo="guia" \/>/.test(pantalla), 'pestañas: con la guía, el resultado o «Aquí verás tu envío» en el mismo lugar del panel')
check(/aria-selected=\{modo === clave\}/.test(pantalla) && !/role="tab"[\s\S]{0,400}transition-colors/.test(pantalla), 'pestañas: aria-selected sigue al estado y el resaltado no se desvanece (sin transition-colors)')
check(/Aquí verás tu envío/.test(pantalla), 'pestañas: panel de primer ingreso de la guía')

// 6.2 Dirección completa en la consulta validada; incompleta con el enlace del correo; nada sin token.
check(/<OrderTracker\s+incrustado\s+direccionCompleta/.test(pantalla), 'dirección: la consulta validada pide la dirección completa')
check(/direccionCompleta: conDireccionCompleta = false/.test(tracker), 'dirección: /pedido/<n> sin la prop sigue con la incompleta')
check(/const direccionVista = data\.verificado\s*\?/.test(tracker) && /:\s*null\s*\n/.test(tracker.slice(tracker.indexOf('const direccionVista'), tracker.indexOf('const direccionVista') + 300)), 'dirección: sin token válido, ninguna dirección')
check(!/order\.deliveryAddress\s*\?\?|titulo=\{order\.deliveryAddress/.test(tracker), 'dirección: la completa nunca se pinta sin pasar por el token')
const rastreoPublico = leer('lib/orders/rastreoPublico.ts')
check(/export function direccionCompleta\(dir: unknown\)/.test(rastreoPublico), 'dirección: direccionCompleta en lib/orders/rastreoPublico.ts')
const rutaTracking = leer('app/api/orders/[id]/tracking/route.ts')
check(/deliveryAddress: verificado \? order\.delivery_address : null/.test(rutaTracking), 'dirección: la ruta solo entrega la dirección con el token válido')

// 6.3 Fotos de los productos: sin carga diferida y sin recuadro gris si falla.
check(/<FotoLinea url=\{i\.imageUrl\} \/>/.test(tracker), 'fotos: cada línea usa FotoLinea')
const foto = tracker.slice(tracker.indexOf('function FotoLinea'), tracker.indexOf('function FilaInfo'))
check(!/loading="lazy"/.test(foto) && /onError=\{\(\) => setFallo\(true\)\}/.test(foto) && /<Package /.test(foto), 'fotos: sin loading="lazy" y con el ícono si la foto no carga')

// 6.4 Motivo de cancelación sin códigos de pasarela (la regla pura en verify-consulta-pedido).
check(/motivoCancelacionPublico\(order\.cancellation_reason, order\.payment_status\)/.test(rutaTracking), 'motivo: la ruta filtra el motivo antes de enviarlo')
check(!/SALE_REJECTED|DECLINED/.test(tracker + pantallaCruda), 'motivo: la pantalla no conoce códigos de pasarela')

// 6.5 Ícono de cuenta: una sola fuente en todas las rutas y en los menús inferiores.
const eventos = sinComentarios(leer('components/site/cuenta/eventos.ts'))
check(/export function alTocarEnlaceCuenta\(/.test(eventos) && /if \(anfitriones === 0\) return/.test(eventos) && /e\.preventDefault\(\)/.test(eventos), 'cuenta: alTocarEnlaceCuenta abre el acceso del layout o deja el enlace (modo «Página»)')
check(/e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey/.test(eventos), 'cuenta: Ctrl/⌘/Mayús siguen abriendo la página en otra pestaña')
const tabs = sinComentarios(leer('components/site/header/mobile/MobileTabs.tsx'))
check(/<TabButton href=\{ruta\('\/auth'\)\} onClickEnlace=\{\(e\) => alTocarEnlaceCuenta\(e, ruta\('\/auth'\)\)\}/.test(tabs) && /onClick=\{onClickEnlace\}/.test(tabs), 'cuenta: «Cuenta» de las pestañas del celular sigue la opción del editor')
const menuInf = sinComentarios(leer('components/site/MenuInferior.tsx'))
check(/b\.action === 'account' && d\.tipo === 'ruta' && \(d\.href === '\/auth' \|\| d\.href === '\/mi-cuenta'\)/.test(menuInf) && /alTocarEnlaceCuenta\(e, href\(d\)\)/.test(menuInf), 'cuenta: «Cuenta» del menú inferior V2 sigue la opción del editor')
const zonas = sinComentarios(leer('components/site/header/HeaderPorZonas.tsx'))
check((zonas.match(/onClick=\{\(e\) => alTocarEnlaceCuenta\(e, '\/mi-cuenta'\)\}/g) || []).length === 2, 'cuenta: la cabecera por zonas sigue la opción del editor')
const layoutCliente = sinComentarios(leer('components/site/OrganizationLayoutCliente.tsx'))
check(/opCuenta\.modo !== 'pagina' && \(\s*<AccesoCuenta/.test(layoutCliente), 'cuenta: el acceso lo monta el layout de TODAS las páginas con el modo de los ajustes')

// ─── 7. Dos columnas en el computador (Figma D4 3106:84541 y D5 3106:84869, 2026-11-25) ──────
// Mismas piezas y mismo estilo de la columna única, repartidas: izquierda estado, pasos y
// productos; derecha pago, entrega, ayuda y el final. En el celular, nada cambia.
const PIEZAS = ['piezaCabecera', 'piezaPago', 'piezaEstado', 'piezaLogistica', 'piezaAvisos', 'piezaFactura', 'piezaProductos', 'piezaEntrega', 'piezaSeguimiento', 'piezaFinal']
/** Fuente de una pieza: desde `const piezaX = (` hasta su cierre `</>\n  )`. */
function pieza(nombre) {
  const inicio = tracker.search(new RegExp(`const ${nombre} = \\(\\r?\\n`))
  if (inicio < 0) return ''
  const fin = tracker.slice(inicio).search(/\r?\n {4}<\/>\r?\n {2}\)\r?\n/)
  return fin < 0 ? '' : tracker.slice(inicio, inicio + fin)
}
check(PIEZAS.every((p) => pieza(p).length > 0), 'dos columnas: las 10 piezas existen (const piezaX = ( … </> ))')
check(/dosColumnas = false/.test(tracker) && /const esComputador = useEsComputador\(dosColumnas\)/.test(tracker), 'dos columnas: opcional (sin la prop, una columna: Mi cuenta)')
check(/const CONSULTA_COMPUTADOR = '\(min-width: 1024px\)'/.test(tracker), 'dos columnas: desde 1024 px, el lg de Tailwind')
check(/function useEsComputador\(activo: boolean\): boolean \{\r?\n\s*const \[es, setEs\] = useState\(false\)/.test(tracker), 'dos columnas: el servidor y la primera pintura usan la columna única (sin desajuste de hidratación)')

// Celular: el orden de siempre, sin otra maqueta.
const celular = tracker.match(/return \(\r?\n\s*<div className=\{contenedor\} data-order-tracker=\{incrustado \? 'incrustado' : ''\}>\r?\n\s*<div className="flex flex-col gap-3">([\s\S]*?)<\/div>\r?\n\s*<\/div>\r?\n\s*\)\r?\n\}\s*$/)
const ordenCelular = celular ? [...celular[1].matchAll(/\{(pieza\w+)\}/g)].map((m) => m[1]) : []
check(ordenCelular.join(',') === PIEZAS.join(','), `celular: una columna con las 10 piezas en el orden de siempre${celular ? ` (${ordenCelular.join(', ')})` : ' (no se encontró)'}`)
check(/const contenedor = incrustado \? 'w-full pb-16' : 'container mx-auto max-w-xl px-4 pt-6 pb-28'\r?\n/.test(tracker), 'celular: el contenedor de siempre (max-w-xl)')

// Computador: la cuadrícula, qué va a cada lado y la columna derecha fija si cabe.
const compu = tracker.match(/if \(esComputador\) \{\r?\n([\s\S]*?)\r?\n {2}\}\r?\n/)
const fuenteCompu = compu ? compu[1] : ''
check(/className=\{`\$\{contenedor\} lg:max-w-6xl`\}/.test(fuenteCompu), 'computador: el contenedor se ensancha solo desde lg')
check(/<div className="grid gap-6 lg:grid-cols-\[minmax\(0,1fr\)_380px\] lg:items-start">/.test(fuenteCompu), 'computador: grid lg:grid-cols-[minmax(0,1fr)_380px] (columna derecha de 380 px, Figma)')
const izquierda = fuenteCompu.match(/data-columna-pedido="estado">([\s\S]*?)<\/div>/)
const derecha = fuenteCompu.match(/<ColumnaInfoFija className="flex min-w-0 flex-col gap-3">([\s\S]*?)<\/ColumnaInfoFija>/)
const lista = (m) => (m ? [...m[1].matchAll(/\{(pieza\w+)\}/g)].map((x) => x[1]) : [])
const IZQ = ['piezaCabecera', 'piezaEstado', 'piezaAvisos', 'piezaProductos', 'piezaSeguimiento']
const DER = ['piezaPago', 'piezaLogistica', 'piezaFactura', 'piezaEntrega', 'piezaFinal']
check(lista(izquierda).join(',') === IZQ.join(','), `computador: izquierda estado, pasos, productos y seguimiento (${lista(izquierda).join(', ')})`)
check(lista(derecha).join(',') === DER.join(','), `computador: derecha pago, entrega, ayuda y el final (${lista(derecha).join(', ')})`)
check([...IZQ, ...DER].sort().join(',') === [...PIEZAS].sort().join(','), 'computador: ninguna pieza se pierde ni se repite')
check(/import \{ ColumnaInfoFija \} from '@\/components\/sections\/product-detail\/ColumnaInfoFija'/.test(tracker), 'computador: la columna derecha fija es la de la ficha (fija si cabe; si no, sube hasta su final)')
const subOrden = (orden, sub) => orden.filter((p) => sub.includes(p)).join(',') === sub.join(',')
check(subOrden(PIEZAS, IZQ) && subOrden(PIEZAS, DER), 'computador: dentro de cada columna, el mismo orden del celular')

// Qué lleva cada pieza (para que una pieza no cambie de columna por un descuido).
check(/<h1 /.test(pieza('piezaCabecera')) && /aria-label="Avance del pedido"/.test(pieza('piezaCabecera')) && /<LineaActualiza/.test(pieza('piezaCabecera')), 'izquierda: estado, número, pasos y «Se actualiza solo»')
check(/vista === 'pagar'/.test(pieza('piezaPago')) && /vista === 'pago_fallido'/.test(pieza('piezaPago')) && /vista === 'vencido'/.test(pieza('piezaPago')) && /anticipoPendiente && anticipo/.test(pieza('piezaPago')) && /Pagas al recibir/.test(pieza('piezaPago')), 'derecha: pago pendiente, rechazado, vencido y contraentrega con anticipo')
check(/te lo lleva/.test(pieza('piezaLogistica')) && /Tu código de entrega/.test(pieza('piezaLogistica')) && /contraentrega\?\.pendiente/.test(pieza('piezaLogistica')), 'derecha: domicilio propio (quién lo lleva), código de entrega y pagas al recibir')
check(/Ver mi factura/.test(pieza('piezaFactura')), 'derecha: la factura')
check(/>Entrega</.test(pieza('piezaEntrega')) && /Información de envío/.test(pieza('piezaEntrega')) && /Rastrear en la transportadora/.test(pieza('piezaEntrega')) && /<DeliveryInfo/.test(pieza('piezaEntrega')), 'derecha: entrega, transportadora con guía y «Rastrear en la transportadora»')
check(/Escribir por WhatsApp/.test(pieza('piezaFinal')) && /Volver a comprar estos productos/.test(pieza('piezaFinal')) && /data-seguir-comprando=""/.test(pieza('piezaFinal')), 'derecha: ayuda (WhatsApp), «Volver a comprar» y «Seguir comprando» al final')
check(/<FotoLinea url=\{i\.imageUrl\} \/>/.test(pieza('piezaProductos')) && /Subtotal/.test(pieza('piezaProductos')) && /¿Cómo te fue con tu compra\?/.test(pieza('piezaProductos')), 'izquierda: productos con totales y la calificación')
check(/vista === 'entregado'/.test(pieza('piezaEstado')) && /vista === 'cancelado'/.test(pieza('piezaEstado')), 'izquierda: el aviso del estado (entregado, cancelado, en camino…)')
check(/No pudimos entregar tu pedido/.test(pieza('piezaAvisos')) && /<EstimatedTime/.test(pieza('piezaAvisos')), 'izquierda: novedad y tiempo estimado')
check(/<DeliveryMap/.test(pieza('piezaSeguimiento')) && /Historial de la entrega/.test(pieza('piezaSeguimiento')) && /Intentos de entrega/.test(pieza('piezaSeguimiento')), 'izquierda: mapa, historial e intentos de entrega')

// Quién usa las dos columnas: /consultar-pedido y /pedido/<n>; Mi cuenta no (va junto a su menú).
check(/<OrderTracker\s+incrustado\s+direccionCompleta\s+dosColumnas\b/.test(pantalla), '/consultar-pedido: el resultado en dos columnas')
check(/data-consulta="resultado"/.test(pantalla) && /max-w-xl flex-col gap-3 text-slate-900 lg:max-w-5xl" data-seguir-pedido="" data-consulta="resultado"/.test(pantalla), '/consultar-pedido: el resultado se ensancha solo desde lg (el formulario no cambia)')
const paginaPedido = leer('app/pedido/[id]/page.tsx')
check(/<OrderTracker[\s\S]*?\bdosColumnas\r?\n\s*\/>/.test(paginaPedido), '/pedido/<n>: dos columnas')
check(/container mx-auto hidden max-w-xl px-4 pt-6 md:block lg:max-w-6xl/.test(paginaPedido), '/pedido/<n>: las migas al mismo ancho que las columnas')
check(!/dosColumnas/.test(leer('app/mi-cuenta/pedidos/[id]/page.tsx')), 'Mi cuenta: sigue en una columna')

console.log(`\n${casos - fallos}/${casos} casos OK`)
if (fallos) process.exit(1)
