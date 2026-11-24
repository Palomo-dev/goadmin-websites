/**
 * verify-cuenta-cliente.mjs — cuenta del cliente en la tienda (Figma «16 Sitio web» 2975:71910,
 * aprobado el 2026-11-24): código al correo, Mi cuenta, Mis pedidos, Mis datos, Direcciones y
 * seguir un pedido sin cuenta (/rastrear).
 *
 *   npm run verify:cuenta-cliente
 *
 * Sin base de datos. Carga lib/cuenta/reglasCuenta.ts (puro) y comprueba:
 * - el código: correo y 6 dígitos válidos, cuenta regresiva del reenvío, errores sin pistas;
 * - acceso: correo verificado, crear / vincular / reasignar la ficha, destino interno, Google apagado;
 * - búsqueda sin cuenta: número de pedido, correo o teléfono de la compra (con o sin indicativo),
 *   misma respuesta si no existe o no coincide;
 * - Mis pedidos: pestaña y botones según el estado (pagar, seguir, volver a comprar, factura,
 *   calificar, ver), pedido en curso, buscador;
 * - Mis datos, direcciones (aviso de cobertura) y el menú por tipo de negocio (sin emojis).
 * Y lee el fuente de las rutas: organización del HOST (nunca del body), límite por IP, filtros por
 * organización, OTP de Supabase (sin tablas propias) y /tracking que redirige a /rastrear.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-cuenta-cliente-'))
let r
try {
  const quitar = async (ruta) => stripTypeScriptTypes(await readFile(join(ROOT, ruta), 'utf8'), { mode: 'strip' })
  await writeFile(join(dir, 'estados-pedido.mjs'), await quitar('lib/orders/estados-pedido.ts'))
  await writeFile(
    join(dir, 'consultaPedido.mjs'),
    (await quitar('lib/orders/consultaPedido.ts')).replaceAll("from '@/lib/orders/estados-pedido'", "from './estados-pedido.mjs'"),
  )
  await writeFile(
    join(dir, 'reglasCuenta.mjs'),
    (await quitar('lib/cuenta/reglasCuenta.ts'))
      .replaceAll("from '@/lib/orders/consultaPedido'", "from './consultaPedido.mjs'")
      .replaceAll("from '@/lib/orders/estados-pedido'", "from './estados-pedido.mjs'"),
  )
  r = await import(pathToFileURL(join(dir, 'reglasCuenta.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

const problemas = []
let casos = 0
function check(cond, msg) {
  casos++
  if (!cond) problemas.push(msg)
}
function igual(a, b, msg) {
  check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
}

// ─── Código al correo ─────────────────────────────────────────────────────────────────────────
igual(r.normalizarCorreo('  Ana.Gomez@Correo.COM '), 'ana.gomez@correo.com', 'correo en minúsculas y sin espacios')
igual(r.normalizarCorreo('ana@correo'), null, 'correo sin dominio completo no vale')
igual(r.normalizarCorreo(42), null, 'correo que no es texto no vale')
igual(r.codigoValido('482 193'), '482193', 'el código admite espacios al pegarlo')
igual(r.codigoValido('48219'), null, 'cinco dígitos no son un código')
igual(r.codigoValido('48219a'), null, 'letras no valen en el código')
igual(r.codigoValido(123456), '123456', 'el código como número vale')
igual(r.segundosParaReenviar(null, 1000), 0, 'sin envío previo se puede reenviar')
igual(r.segundosParaReenviar(0, 15_000), 45, 'a los 15 s faltan 45 para reenviar')
igual(r.segundosParaReenviar(0, 61_000), 0, 'pasado el minuto se puede reenviar')
igual(r.textoCuentaRegresiva(45), '0:45', 'cuenta regresiva «0:45»')
igual(r.textoCuentaRegresiva(61), '1:01', 'cuenta regresiva «1:01»')
igual(r.mensajeErrorCodigo({ message: 'Token has expired or is invalid' }), 'El código venció. Pide uno nuevo.', 'código vencido')
check(r.mensajeErrorCodigo({ message: 'Invalid token' }).startsWith('El código no coincide'), 'código errado')
check(r.mensajeErrorCodigo({ status: 429, message: 'x' }).includes('muchos intentos'), 'demasiados intentos')
for (const m of ['User not found', 'Signups not allowed for otp', 'Email not confirmed']) {
  const t = r.mensajeErrorCodigo({ message: m })
  check(!/cuenta|registr|exist/i.test(t), `el error del código no revela si el correo tiene cuenta («${m}» → «${t}»)`)
}
igual(r.LARGO_CODIGO, 6, 'el código es de 6 dígitos')

// ─── Acceso ───────────────────────────────────────────────────────────────────────────────────
check(r.correoVerificado({ email: 'a@b.co', email_confirmed_at: '2026-11-24T10:00:00Z' }), 'correo confirmado = verificado')
check(!r.correoVerificado({ email: 'a@b.co', email_confirmed_at: null }), 'correo sin confirmar no es verificado')
check(!r.correoVerificado(null), 'sin usuario no hay correo verificado')
igual(r.decisionVinculo(null, 'u1'), 'crear', 'sin ficha: se crea con el correo')
igual(r.decisionVinculo({ user_id: null }, 'u1'), 'vincular', 'compró sin cuenta: se vincula (sus pedidos aparecen)')
igual(r.decisionVinculo({ user_id: 'u1' }, 'u1'), 'ya_vinculada', 'ficha propia: nada que hacer')
igual(r.decisionVinculo({ user_id: 'u2' }, 'u1'), 'reasignar', 'ficha de otro usuario: solo se reasigna con el correo verificado')
igual(r.destinoInterno('/mi-cuenta/pedidos'), '/mi-cuenta/pedidos', 'destino interno se respeta')
for (const malo of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', null]) {
  igual(r.destinoInterno(malo), '/mi-cuenta', `destino externo se descarta (${malo})`)
}
check(!r.googleEnAcceso({}), 'Google apagado sin el ajuste')
check(!r.googleEnAcceso({ header_cuenta: { modo: 'panel' } }), 'Google apagado con otras opciones de cuenta')
check(!r.googleEnAcceso({ header_cuenta: { google: 'true' } }), 'Google solo con `true` (no con texto)')
check(r.googleEnAcceso({ header_cuenta: { google: true } }), 'Google encendido con header_cuenta.google = true')
igual(r.errorContrasena({ password: 'abc12', confirmPassword: 'abc12' }), 'La contraseña debe tener al menos 6 caracteres', 'contraseña corta')
igual(r.errorContrasena({ password: 'abcdef', confirmPassword: 'abcdeg' }), 'Las contraseñas no coinciden', 'contraseñas distintas')
igual(r.errorContrasena({ password: 'abcdef', confirmPassword: 'abcdef' }), null, 'contraseña válida')

// ─── Seguir un pedido sin cuenta ──────────────────────────────────────────────────────────────
igual(r.normalizarNumeroPedido(' #wo-358-mwuo4kwg-laxg '), 'WO-358-MWUO4KWG-LAXG', 'número en mayúsculas y sin #')
igual(r.normalizarNumeroPedido('wo'), null, 'número demasiado corto')
igual(r.normalizarNumeroPedido("WO-1' or 1=1"), null, 'número con caracteres raros no vale')
igual(r.tipoContacto('ana@correo.com'), 'correo', 'contacto correo')
igual(r.tipoContacto('+57 300 555 1234'), 'telefono', 'contacto teléfono')
igual(r.tipoContacto('12345'), null, 'cinco dígitos no son teléfono')
igual(r.tipoContacto(''), null, 'vacío no es contacto')
const pedido = { customer_email: 'Ana.Gomez@correo.com', customer_phone: '3005551234' }
check(r.contactoCoincide(pedido, 'ana.gomez@CORREO.com'), 'correo coincide sin distinguir mayúsculas')
check(r.contactoCoincide(pedido, '+57 300 555 12 34'), 'teléfono con indicativo coincide')
check(r.contactoCoincide({ customer_email: null, customer_phone: '+573005551234' }, '300-555-1234'), 'teléfono guardado con indicativo coincide con el local')
check(!r.contactoCoincide(pedido, 'otra@correo.com'), 'otro correo no coincide')
check(!r.contactoCoincide(pedido, '3005551235'), 'otro teléfono no coincide')
check(!r.contactoCoincide({ customer_email: null, customer_phone: null }, 'ana@correo.com'), 'sin datos en el pedido no coincide')
check(!r.contactoCoincide({ customer_email: null, customer_phone: '1234' }, '1234'), 'teléfonos de menos de 7 dígitos nunca coinciden')
check(!/no existe|existe/i.test(r.NO_ENCONTRADO_SIN_CUENTA), 'el mensaje de búsqueda no dice si el pedido existe')

// ─── Mis pedidos: pestañas y botones ──────────────────────────────────────────────────────────
igual(r.grupoPedido('pending'), 'en_curso', 'pendiente: en curso')
igual(r.grupoPedido('in_delivery'), 'en_curso', 'en camino: en curso')
igual(r.grupoPedido('delivered'), 'anteriores', 'entregado: anteriores')
for (const e of ['cancelled', 'rejected', 'refunded', 'expired']) igual(r.grupoPedido(e), 'cancelados', `${e}: cancelados`)
igual(r.leerGrupo('cancelados'), 'cancelados', 'pestaña de la URL')
igual(r.leerGrupo('<script>'), 'en_curso', 'pestaña desconocida: En curso')

const acc = (parcial) => r.accionesPedido({ status: 'pending', paymentStatus: 'pending', esPasarela: false, tieneFactura: false, puedeRecomprar: false, ...parcial })
igual(acc({ esPasarela: true }), ['pagar', 'ver'], 'falta el pago por pasarela: Pagar y Ver pedido')
igual(acc({ esPasarela: true, paymentStatus: 'failed' }), ['pagar', 'ver'], 'pago rechazado: Pagar de nuevo')
igual(acc({}), ['seguir'], 'contraentrega o transferencia pendiente: Seguir pedido')
igual(acc({ status: 'confirmed', paymentStatus: 'paid' }), ['seguir'], 'confirmado: Seguir pedido')
igual(acc({ status: 'in_delivery' }), ['seguir'], 'en camino: Seguir pedido')
igual(acc({ status: 'delivered', paymentStatus: 'paid', tieneFactura: true, puedeRecomprar: true }), ['recomprar', 'factura', 'calificar'], 'entregado: Volver a comprar, Factura y Calificar')
igual(acc({ status: 'delivered', paymentStatus: 'paid' }), ['calificar'], 'entregado sin factura ni enlace firmado: Calificar')
igual(acc({ status: 'cancelled' }), ['ver'], 'cancelado: Ver pedido')
igual(acc({ status: 'expired', esPasarela: true }), ['ver'], 'pago vencido: Ver pedido (se retoma desde la página)')

const av = r.avancePedido({ status: 'in_delivery', paymentStatus: 'paid', esPasarela: false, deliveryType: 'delivery_own', esRestaurante: false, nombre: 'Ana Gómez' })
igual(av.insignia, 'En camino', 'avance: insignia de la página del pedido')
igual(av.pasos.map((p) => p.estado), ['hecho', 'hecho', 'actual', 'pendiente'], 'avance: barra de 4 pasos (Confirmado, Alistando, En camino, Entregado)')
igual(av.pasos.map((p) => p.etiqueta), ['Confirmado', 'Alistando', 'En camino', 'Entregado'], 'avance: etiquetas de la tienda')

const lista = [
  { id: 'a', status: 'delivered', createdAt: '2026-11-20T10:00:00Z' },
  { id: 'b', status: 'confirmed', createdAt: '2026-11-22T10:00:00Z' },
  { id: 'c', status: 'pending', createdAt: '2026-11-23T10:00:00Z' },
  { id: 'd', status: 'cancelled', createdAt: '2026-11-24T10:00:00Z' },
]
igual(r.pedidoEnCurso(lista)?.id, 'c', 'pedido en curso: el más reciente que no terminó')
igual(r.pedidoEnCurso([lista[0], lista[3]]), null, 'sin pedidos en curso: nada arriba')
check(r.coincideBusqueda({ order_number: 'WO-000412', productos: ['Camiseta básica'] }, '412'), 'buscar por número')
check(r.coincideBusqueda({ order_number: 'WO-000412', productos: ['Café de Nariño'] }, 'nariño'), 'buscar por producto sin tildes ni mayúsculas')
check(r.coincideBusqueda({ order_number: 'WO-000412', productos: ['Café de Nariño'] }, 'NARINO'), 'buscar sin tilde encuentra con tilde')
check(!r.coincideBusqueda({ order_number: 'WO-000412', productos: ['Café'] }, 'té'), 'búsqueda que no coincide')
igual(r.textoProductos(1), '1 producto', 'un producto')
igual(r.textoProductos(4), '4 productos', 'varios productos')

// ─── Mis datos ────────────────────────────────────────────────────────────────────────────────
check(!r.facturaCompleta({ identification_type: 'cc', identification_number: null }), 'sin número: faltan datos de factura')
check(r.facturaCompleta({ customer_type: 'person', identification_type: 'cc', identification_number: '1020334556' }), 'persona con cédula: completa')
check(!r.facturaCompleta({ customer_type: 'company', identification_type: 'nit', identification_number: '900123456' }), 'empresa sin razón social: faltan datos')
check(r.facturaCompleta({ customer_type: 'company', identification_type: 'nit', identification_number: '900123456', company_name: 'Empresa de ejemplo' }), 'empresa completa')
igual(r.limpiarDocumento('1.020.334.556'), '1020334556', 'documento sin puntos')
igual(r.limpiarDocumento('ab'), null, 'documento muy corto')
igual(r.leerAvisos(null), { whatsapp: true, correo: true }, 'avisos de pedido encendidos por defecto')
igual(r.leerAvisos({ avisos_pedido: { whatsapp: false } }), { whatsapp: false, correo: true }, 'avisos por WhatsApp apagados')
igual(r.leerCumpleanos('05-14'), { mes: 5, dia: 14 }, 'cumpleaños 14 de mayo')
igual(r.leerCumpleanos('02-30'), null, '30 de febrero no existe')
igual(r.leerCumpleanos('13-01'), null, 'mes 13 no existe')
igual(r.fechaAutorizacionDatos({ autorizacion_datos: { en: '2026-11-03T15:00:00Z' } }), '2026-11-03T15:00:00Z', 'fecha de la autorización de datos')
igual(r.fechaAutorizacionDatos({}), null, 'sin autorización registrada no se inventa fecha')

// ─── Direcciones: aviso de cobertura ──────────────────────────────────────────────────────────
const cot = (p) => ({ precio: 8000, envio_gratis: false, en_zona: true, zona: { es_tarifa_general: false }, pedido_minimo: 0, ...p })
igual(r.textoCobertura(false, null, null).tipo, 'sin_zonas', 'tienda sin zonas: el envío se calcula al pagar')
igual(r.textoCobertura(true, cot({ precio: null }), null).tipo, 'fuera', 'sin precio: no hay domicilio')
igual(r.textoCobertura(true, cot({}), 'Llega hoy · 45–60 min').texto, 'Domicilio de la tienda · $ 8.000 · llega hoy · 45–60 min', 'en zona: costo y cuándo llega')
igual(r.textoCobertura(true, cot({ envio_gratis: true }), null).texto, 'Domicilio de la tienda · envío gratis', 'envío gratis')
igual(r.textoCobertura(true, cot({ en_zona: false, zona: { es_tarifa_general: true } }), null).texto, 'Fuera de zona · tarifa general $ 8.000', 'fuera de zona con tarifa general')
check(r.textoCobertura(true, cot({ pedido_minimo: 30000 }), null).texto.endsWith('pedido mínimo $ 30.000'), 'con pedido mínimo lo dice')

// ─── Menú de Mi cuenta ────────────────────────────────────────────────────────────────────────
const claves = (t) => r.menuCuenta(t).map((i) => i.clave)
igual(claves(3), ['inicio', 'pedidos', 'direcciones', 'favoritos', 'cupones', 'facturas', 'datos'], 'tienda: el orden del Figma')
check(claves(1).includes('reservas') && claves(1).includes('pedidos'), 'restaurante: pedidos y reservas')
check(claves(2).includes('reservas'), 'hotel: reservas')
igual(claves(4).slice(1, 4), ['citas', 'facturas', 'cotizaciones'], 'servicios: citas, facturas y cotizaciones')
igual(claves(5).slice(1, 4), ['membresia', 'clases', 'checkins'], 'gimnasio: membresía, clases y check-ins')
check(claves(6).includes('tickets'), 'transporte: tickets')
igual(claves(7).slice(1, 4), ['pases', 'vehiculos', 'historial'], 'parqueadero: pases, vehículos e historial')
igual(claves(0), ['inicio', 'datos'], 'tipo desconocido: Inicio y Mis datos')
for (const t of [0, 1, 2, 3, 4, 5, 6, 7]) {
  for (const it of r.menuCuenta(t)) {
    check(!/\p{Extended_Pictographic}/u.test(it.texto), `menú sin emojis (${it.texto})`)
    const pagina = it.href === '/favoritos' ? 'app/favoritos/page.tsx' : `app${it.href}/page.tsx`
    check(existsSync(join(ROOT, pagina)), `el menú lleva a una página que existe (${it.href})`)
  }
}
const m3 = r.menuCuenta(3)
igual(r.itemActivo(m3, '/mi-cuenta'), 'inicio', 'Inicio activo en /mi-cuenta')
igual(r.itemActivo(m3, '/mi-cuenta/pedidos/abc'), 'pedidos', 'Mis pedidos activo en el detalle')
igual(r.itemActivo(m3, '/mi-cuenta/perfil'), 'datos', 'Mis datos activo en /mi-cuenta/perfil')
igual(r.iniciales('Ana Gómez'), 'AG', 'iniciales de nombre y apellido')
igual(r.iniciales(null, 'ana@correo.com'), 'A', 'sin nombre: la del correo')

// ─── Fuente de las rutas ──────────────────────────────────────────────────────────────────────
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const rutasHost = [
  'app/api/auth/codigo/route.ts',
  'app/api/auth/codigo/verificar/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/register/route.ts',
  'app/api/cuenta/buscar-pedido/route.ts',
  'app/api/customer/address/route.ts',
  'app/api/customer/profile/route.ts',
  'app/api/customer/password/route.ts',
  'app/auth/callback/route.ts',
]
for (const ruta of rutasHost) {
  const s = sinComentarios(leer(ruta))
  check(/getOrgIdDelHost\(\)/.test(s), `${ruta}: la organización sale del host`)
  check(!/const\s*\{[^}]*\borganizationId\b[^}]*\}\s*=\s*body/.test(s) && !/organization_id\s*:\s*body\./.test(s), `${ruta}: no toma la organización del body`)
}
check(/getOrgContext\(\)/.test(leer('app/api/auth/google/route.ts')), 'Google: organización y ajuste del host')

const codigo = sinComentarios(leer('app/api/auth/codigo/route.ts'))
check(/checkRateLimit\(`codigo:ip:/.test(codigo) && /checkRateLimit\(`codigo:correo:/.test(codigo), 'enviar el código: límite por IP y por correo')
check(/signInWithOtp\(/.test(codigo) && /shouldCreateUser:\s*true/.test(codigo), 'enviar el código: OTP de Supabase que crea la cuenta la primera vez')
const verificar = sinComentarios(leer('app/api/auth/codigo/verificar/route.ts'))
check(/checkRateLimit\(`codigo-verificar:ip:/.test(verificar) && /checkRateLimit\(`codigo-verificar:correo:/.test(verificar), 'verificar el código: límite por IP y por correo')
check(/verifyOtp\(\{\s*email:\s*correo,\s*token:\s*codigo,\s*type:\s*'email'\s*\}\)/.test(verificar), 'verificar: verifyOtp tipo email')
check(/vincularClienteDeSesion\(admin, orgId, data\.user, \{ verificado: true/.test(verificar), 'verificar: crea o vincula la ficha de la organización del host con el correo verificado')
for (const ruta of ['app/api/auth/register/route.ts', 'app/api/auth/login/route.ts', 'app/auth/callback/route.ts']) {
  check(/vincularClienteDeSesion\(/.test(leer(ruta)), `${ruta}: la misma ruta para crear o vincular la ficha`)
}
for (const ruta of ['app/api/auth/codigo/route.ts', 'app/api/auth/codigo/verificar/route.ts', 'lib/auth/clienteSesion.ts']) {
  check(!/\.from\('(?:[a-z_]*otp[a-z_]*|codigos?[a-z_]*)'\)/.test(leer(ruta)), `${ruta}: sin tablas propias de códigos`)
}

const buscar = sinComentarios(leer('app/api/cuenta/buscar-pedido/route.ts'))
check(/checkRateLimit\(`buscar-pedido:ip:/.test(buscar) && /checkRateLimit\(`buscar-pedido:numero:/.test(buscar), 'búsqueda sin cuenta: límite por IP y por número')
check(/\.eq\('organization_id', orgId\)/.test(buscar), 'búsqueda sin cuenta: solo pedidos de la organización del host')
check(/!pedido \|\| !contactoCoincide\(pedido, body\?\.contacto\)/.test(buscar), 'búsqueda sin cuenta: misma respuesta si no existe o no coincide')
check(/rutaSeguimiento\(orgId, pedido\)/.test(buscar), 'búsqueda sin cuenta: abre la página del pedido con su token')
check(!/customer_email|customer_phone/.test(buscar.split('return NextResponse.json({ ruta')[1] ?? ''), 'búsqueda sin cuenta: no devuelve el correo ni el teléfono')

const cuenta = sinComentarios(leer('lib/cuenta/cuentaCliente.ts'))
for (const m of cuenta.matchAll(/\.from\('([a-z_]+)'\)([\s\S]{0,260})/g)) {
  const [, tabla, resto] = m
  if (tabla === 'web_order_items') {
    check(/\.in\('web_order_id', ids\)/.test(resto), 'productos: solo de los pedidos ya filtrados por organización')
    continue
  }
  check(/organization_id/.test(resto), `cuentaCliente: ${tabla} filtra por organización`)
}
check(/correoVerificado\(user\)/.test(cuenta) && /verificado \? Array\.from/.test(cuenta), 'Mis pedidos: los del correo solo con el correo verificado')
check(!/\.update\(/.test(cuenta), 'Mis pedidos: no escribe en web_orders (su trigger contable corre en cada UPDATE)')
check((cuenta.match(/fn_web_order_metodo_nativo/g) || []).length === 1 && /metodosPendientes\.map/.test(cuenta), 'pasarela: una RPC por método, no por pedido')

const direcciones = sinComentarios(leer('app/api/customer/address/route.ts'))
check(/organization_id: orgId/.test(direcciones), 'direcciones: el insert lleva la organización del host')
check((direcciones.match(/\.eq\('organization_id', r\.orgId\)/g) || []).length >= 2, 'direcciones: cambiar y quitar filtran por organización')
check(/\/api\/shipping\/quote/.test(leer('app/mi-cuenta/direcciones/DireccionesClient.tsx')), 'direcciones: la cobertura usa la cotización del checkout')

const perfil = sinComentarios(leer('app/api/customer/profile/route.ts'))
check(!/doc_type:|doc_number:|full_name:/.test(perfil.replace(/body\.doc_(type|number)/g, '')), 'Mis datos: no escribe columnas GENERATED')
check(!/\bemail:/.test(perfil), 'Mis datos: el correo no se cambia aquí')
check(/\.eq\('organization_id', orgId\)/.test(perfil), 'Mis datos: actualiza filtrando por organización')

const tracking = leer('app/tracking/page.tsx')
check(/redirect\(/.test(tracking) && /\/rastrear\?guia=/.test(tracking), '/tracking redirige a /rastrear con la guía (enlaces viejos)')
const rastrear = leer('app/rastrear/page.tsx')
check(/getShipmentByTracking\(guia, organization\.id\)/.test(rastrear), '/rastrear: guía con la organización del host')
check(!/recipient_name|recipient_relationship/.test(leer('components/site/rastreo/ResultadoGuia.tsx')), 'rastreo por guía: no pinta quién recibió')

const detalle = leer('app/mi-cuenta/pedidos/[id]/page.tsx')
check(/<OrderTracker/.test(detalle) && /pedidoDeCuenta\(/.test(detalle), 'detalle en la cuenta: la página del pedido rediseñada, solo si es de la cuenta')
check(!/buildSimpleTimeline/.test(detalle), 'detalle en la cuenta: sin la línea de tiempo duplicada')

const layout = leer('app/mi-cuenta/layout.tsx')
check(!/\p{Extended_Pictographic}/u.test(layout), 'layout de Mi cuenta sin emojis')
check(/menuCuenta\(/.test(layout), 'layout de Mi cuenta: menú por tipo de negocio')

for (const archivo of ['components/site/cuenta/FormularioAcceso.tsx', 'app/auth/AuthForm.tsx']) {
  const s = leer(archivo)
  check(/PasoCorreo/.test(s) && /PasoCodigo/.test(s), `${archivo}: ingresar con código en esta forma de abrir la cuenta`)
}
check(/google=\{google\}/.test(leer('components/site/cuenta/AccesoCuenta.tsx')), 'panel, ventana, diálogo y hoja: reciben el ajuste de Google')

if (problemas.length) {
  console.error(`✗ verify-cuenta-cliente: ${problemas.length} de ${casos} casos fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-cuenta-cliente: ${casos} casos`)
