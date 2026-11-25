/**
 * verify-cuenta-cliente.mjs — cuenta del cliente en la tienda (Figma «16 Sitio web» 2975:71910,
 * aprobado el 2026-11-24): código al correo, Mi cuenta, Mis pedidos, Mis datos, Direcciones y
 * seguir un pedido sin cuenta (/consultar-pedido, antes /rastrear).
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
 * organización y /tracking y /rastrear que redirigen a /consultar-pedido.
 *
 * Regla del dueño (2026-11-24): el comprador NUNCA recibe correos de Supabase Auth ni de la
 * plataforma. El código es de la tienda (lib/cuenta/codigoTienda.ts, tabla
 * web_customer_login_codes) y lo envía la tienda con Resend y su marca. Este script FALLA si en
 * app/, lib/ o components/ aparece cualquier llamada que dispare un correo de Supabase
 * (`signInWithOtp`, `signUp`, `resetPasswordForEmail`, `updateUser(`, `.resend(`,
 * `inviteUserByEmail`, `reauthenticate`), si el correo del código menciona la plataforma, o si un
 * correo a compradores trae cableada una dirección de la plataforma.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-cuenta-cliente-'))
let r
let correoCodigo
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
  await writeFile(join(dir, 'correoCodigoAcceso.mjs'), await quitar('lib/email/correoCodigoAcceso.ts'))
  correoCodigo = await import(pathToFileURL(join(dir, 'correoCodigoAcceso.mjs')).href)
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

// ─── Código propio de la tienda (sin correos de Supabase) ─────────────────────────────────────
igual(r.MAX_INTENTOS_CODIGO, 5, 'máximo 5 intentos por código')
igual(r.MINUTOS_VIGENCIA_CODIGO, 10, 'el código vence a los 10 minutos')
igual(r.propositoCodigo('verify'), 'verify', 'propósito verify')
igual(r.propositoCodigo('reset'), 'reset', 'propósito reset')
igual(r.propositoCodigo('cualquiera'), 'login', 'propósito desconocido = login')
{
  const ahora = Date.parse('2026-11-24T12:00:00Z')
  const vigente = { expires_at: '2026-11-24T12:05:00Z', attempts: 0, used_at: null }
  igual(r.estadoAntesDeProbar(null, ahora), 'vencido', 'sin código vigente: vencido')
  igual(r.estadoAntesDeProbar(vigente, ahora), 'probar', 'código vigente: se prueba')
  igual(r.estadoAntesDeProbar({ ...vigente, expires_at: '2026-11-24T11:59:59Z' }, ahora), 'vencido', 'código vencido')
  igual(r.estadoAntesDeProbar({ ...vigente, used_at: '2026-11-24T11:59:00Z' }, ahora), 'vencido', 'código ya usado: un solo uso')
  igual(r.estadoAntesDeProbar({ ...vigente, attempts: 4 }, ahora), 'probar', 'cuarto intento fallido: aún se prueba el quinto')
  igual(r.estadoAntesDeProbar({ ...vigente, attempts: 5 }, ahora), 'intentos', 'cinco intentos: hay que pedir otro')
  igual(r.puedeEnviarCodigo([], ahora), 'ok', 'primer código: se envía')
  igual(r.puedeEnviarCodigo(['2026-11-24T11:59:30Z'], ahora), 'espera', 'otro código antes del minuto: espera')
  igual(r.puedeEnviarCodigo(['2026-11-24T11:58:00Z'], ahora), 'ok', 'pasado el minuto: se envía')
  const cinco = ['11:51', '11:53', '11:55', '11:57', '11:58'].map((h) => `2026-11-24T${h}:00Z`)
  igual(r.puedeEnviarCodigo(cinco, ahora), 'limite', 'cinco códigos en 10 minutos: límite')
  igual(r.puedeEnviarCodigo(['2026-11-24T11:40:00Z', ...cinco.slice(1)], ahora), 'ok', 'fuera de la ventana no cuenta')
  for (const k of ['vencido', 'no_coincide', 'intentos']) {
    check(!/cuenta|registr|exist/i.test(r.mensajeResultadoCodigo(k)), `el mensaje «${k}» no revela si el correo tiene cuenta`)
  }
}

// ─── Correo del código: solo la marca de la tienda ────────────────────────────────────────────
{
  const sobre = { nombre: 'Tienda Norte', logoUrl: 'https://cdn.ejemplo.com/logo.png', color: '#112233', texto: '#ffffff', correo: 'ventas@tienda-norte.co' }
  const login = correoCodigo.correoCodigoAcceso({ sobre, codigo: '048213', proposito: 'login', minutos: 10 })
  igual(login.asunto, 'Tu código para entrar a Tienda Norte', 'asunto del código para entrar')
  check(login.html.includes('048213') && login.texto.includes('048213'), 'el código va en el correo (con el cero inicial)')
  check(login.html.includes('Vence en 10 minutos') && login.texto.includes('Vence en 10 minutos'), 'el correo dice que vence en 10 minutos')
  check(login.html.includes('https://cdn.ejemplo.com/logo.png') && login.html.includes('#112233'), 'logo y color de la tienda')
  for (const proposito of ['login', 'verify', 'reset']) {
    const c = correoCodigo.correoCodigoAcceso({ sobre, codigo: '123456', proposito, minutos: 10 })
    const todo = `${c.asunto}\n${c.html}\n${c.texto}`
    check(!/go\s*admin|goadmin|supabase/i.test(todo), `correo del código (${proposito}) sin la marca de la plataforma`)
    check(c.asunto.includes('Tienda Norte'), `asunto (${proposito}) con el nombre de la tienda`)
  }
  const raro = correoCodigo.correoCodigoAcceso({ sobre: { ...sobre, nombre: 'Tienda <b>\r\nBcc: x' }, codigo: '123456', proposito: 'login', minutos: 10 })
  check(!/[\r\n]/.test(raro.asunto) && !raro.html.includes('<b>'), 'el nombre de la tienda se escapa y no rompe el asunto')
}

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

// ─── Mi cuenta V2 y menú del avatar (Figma 3044:78726, aprobado 2026-11-24) ──────────────────
igual(r.identidadCuenta({ first_name: 'Laura', last_name: 'Pérez' }, 'laura@correo.com'), { nombre: 'Laura Pérez', titulo: 'Laura Pérez', iniciales: 'LP', correo: 'laura@correo.com' }, 'avatar: nombre de la ficha e iniciales')
igual(r.identidadCuenta({ first_name: '', last_name: '' }, 'laura@correo.com'), { nombre: null, titulo: 'laura@correo.com', iniciales: 'L', correo: 'laura@correo.com' }, 'sin nombre (entró con el código): el correo y su inicial')
igual(r.identidadCuenta(null, null).titulo, 'Mi cuenta', 'sin ficha ni correo: «Mi cuenta»')
igual(r.textoClienteDesde('2026-03-10T15:00:00Z', 'America/Bogota'), 'Cliente desde marzo de 2026', '«Cliente desde marzo de 2026»')
igual(r.textoClienteDesde('2026-04-01T02:00:00Z', 'America/Bogota'), 'Cliente desde marzo de 2026', 'cliente desde: en la zona de la tienda, no en UTC')
igual(r.textoClienteDesde(null), null, 'sin fecha no se inventa')
igual(r.fechaCortaCuenta('2026-11-12T15:00:00Z', 'America/Bogota'), '12 nov', 'fecha corta «12 nov» sin punto')

const fichaCompleta = { first_name: 'Laura', phone: '300 555 1234', customer_type: 'person', identification_type: 'cc', identification_number: '1020304050' }
const pasosNueva = r.pasosCuenta({ verificado: true, ficha: { first_name: '', phone: null } })
igual(pasosNueva.map((p) => p.hecho), [true, false, false], 'cuenta nueva: 1 de 3 (correo confirmado)')
igual(r.avisoCompletarCuenta(pasosNueva), 'lista', 'cuenta nueva: «Completa tu cuenta»')
igual(r.avisoCompletarCuenta(r.pasosCuenta({ verificado: true, ficha: { ...fichaCompleta, identification_number: '' } })), 'factura', 'solo falta la factura: la tarjeta «Faltan tus datos de factura»')
igual(r.avisoCompletarCuenta(r.pasosCuenta({ verificado: true, ficha: fichaCompleta })), null, 'cuenta completa: sin aviso')
igual(r.avisoCompletarCuenta(r.pasosCuenta({ verificado: true, ficha: { ...fichaCompleta, phone: '' } })), 'lista', 'sin celular: «Completa tu cuenta»')
igual(r.pasosCuenta({ verificado: false, ficha: fichaCompleta })[0].hecho, false, 'correo sin confirmar: el paso queda pendiente')

const grupos3 = r.gruposMenuCuenta(3)
igual(grupos3.map((g) => g.titulo), ['Compras', 'Mi información'], 'tienda: grupos Compras y Mi información')
igual(grupos3[0].items.map((i) => i.clave), ['pedidos', 'favoritos', 'cupones', 'facturas'], 'Compras: el orden del Figma')
igual(grupos3[1].items.map((i) => i.clave), ['datos', 'direcciones', 'factura'], 'Mi información: Mis datos, Direcciones y Datos de factura')
igual(grupos3[1].items[2].href, '/mi-cuenta/perfil#factura', 'Datos de factura: acceso propio a su sección')
igual(r.gruposMenuCuenta(5).map((g) => g.titulo), ['Gimnasio', 'Mi información'], 'gimnasio: sus secciones y Mi información')
igual(r.gruposMenuCuenta(0).map((g) => g.clave), ['informacion'], 'tipo desconocido: solo Mi información')
for (const t of [0, 1, 2, 3, 4, 5, 6, 7]) {
  const enGrupos = new Set(['inicio', ...r.gruposMenuCuenta(t).flatMap((g) => g.items.map((i) => i.clave))])
  check(r.menuCuenta(t).every((i) => enGrupos.has(i.clave)), `tipo ${t}: los grupos no pierden ninguna sección del menú`)
  check(r.itemsMenuAvatar(t).every((i) => r.menuCuenta(t).some((m) => m.clave === i.clave)), `tipo ${t}: el menú del avatar solo lleva secciones del negocio`)
}
igual(r.itemsMenuAvatar(3).map((i) => i.clave), ['pedidos', 'favoritos', 'datos', 'direcciones', 'cupones', 'facturas'], 'menú del avatar: el orden del Figma')
check(r.vendeConPedidos(1) && r.vendeConPedidos(3) && !r.vendeConPedidos(2), '«Seguir un pedido» solo en tiendas y restaurantes')

const cifrasV2 = { pedidos: 12, enCurso: 1, ultimoPedidoEn: '2026-11-12T15:00:00Z', favoritos: 6, cupones: 2, cuponVenceEnDias: 3, direcciones: 2, principal: 'Casa', facturas: 3 }
const datosFila = { nombre: 'Laura Pérez', telefono: '300 555 1234', facturaCompleta: false, zona: 'America/Bogota' }
igual(r.detalleAcceso('pedidos', cifrasV2, datosFila), { detalle: '1 en curso · el último, 12 nov', cifra: '12', aviso: null }, 'Mis pedidos: «1 en curso · el último, 12 nov»')
igual(r.detalleAcceso('cupones', cifrasV2, datosFila).detalle, '1 vence en 3 días', 'Cupones: «1 vence en 3 días»')
igual(r.detalleAcceso('direcciones', cifrasV2, datosFila).detalle, 'Casa es la principal', 'Direcciones: la principal')
igual(r.detalleAcceso('datos', cifrasV2, datosFila).detalle, 'Laura Pérez · 300 555 1234', 'Mis datos: nombre y celular')
igual(r.detalleAcceso('factura', cifrasV2, datosFila).aviso, 'Faltan datos', 'Datos de factura: «Faltan datos»')
igual(r.detalleAcceso('factura', cifrasV2, { ...datosFila, facturaCompleta: true }).aviso, null, 'Datos de factura completos: sin aviso')
const ceros = { pedidos: 0, enCurso: 0, ultimoPedidoEn: null, favoritos: 0, cupones: 0, cuponVenceEnDias: null, direcciones: 0, principal: null, facturas: 0 }
for (const clave of ['pedidos', 'favoritos', 'cupones', 'facturas', 'direcciones']) {
  const d = r.detalleAcceso(clave, ceros, { ...datosFila, nombre: null })
  check(d.cifra === null && !!d.detalle && !/\b0\b/.test(d.detalle), `${clave} en cero: una invitación, no «0»`)
}
igual(r.detalleAcceso('datos', ceros, { ...datosFila, nombre: null }).detalle, 'Agrega tu nombre y celular', 'Mis datos sin nombre: «Agrega tu nombre y celular»')
igual(r.detalleAcceso('reservas', { ...ceros, otras: { reservas: 4 } }, datosFila).cifra, '4', 'verticales: conservan su cifra')
igual(r.detalleMosaico('pedidos', cifrasV2, datosFila).texto, '12 · 1 en curso', 'hoja del celular: «12 · 1 en curso»')
igual(r.detalleMosaico('favoritos', cifrasV2, datosFila).texto, '6 productos', 'hoja del celular: «6 productos»')
igual(r.detalleMosaico('datos', cifrasV2, datosFila), { texto: 'Faltan datos', aviso: true }, 'hoja del celular: Mis datos «Faltan datos»')
igual(r.filasMenuCuenta(3, cifrasV2, datosFila)[0].filas[0].cifra, '12', 'filas listas para pintar: cifra de Mis pedidos')

igual(r.enlacePoliticas([{ slug: 'contacto' }, { slug: 'terminos', page_type: 'legal' }, { slug: 'envios' }]), '/envios', 'políticas: envíos primero')
igual(r.enlacePoliticas([{ slug: 'nosotros', children: [{ slug: 'politica-de-privacidad' }] }]), '/politica-de-privacidad', 'políticas: también en submenús')
igual(r.enlacePoliticas([{ slug: 'contacto' }]), null, 'sin páginas legales: sin fila')
igual(r.enlacePoliticas([{ slug: 'https://otro.com/terminos', is_external: true }]), null, 'enlaces externos no cuentan')

// ─── Fuente de las rutas ──────────────────────────────────────────────────────────────────────
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const rutasHost = [
  'app/api/auth/codigo/route.ts',
  'app/api/auth/codigo/verificar/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/register/route.ts',
  'app/api/cuenta/buscar-pedido/route.ts',
  'app/api/cuenta/menu/route.ts',
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
check(/emitirCodigo\([^)]*proposito: 'login'/.test(codigo) && /enviarCodigoAcceso\(/.test(codigo), 'enviar el código: código propio de la tienda, enviado con su marca')
const verificar = sinComentarios(leer('app/api/auth/codigo/verificar/route.ts'))
check(/checkRateLimit\(`codigo-verificar:ip:/.test(verificar) && /checkRateLimit\(`codigo-verificar:correo:/.test(verificar), 'verificar el código: límite por IP y por correo')
check(/verificarCodigo\(/.test(verificar) && /abrirSesionSinCorreo\(/.test(verificar), 'verificar: código propio y sesión sin correo de Supabase')
check(/vincularClienteDeSesion\(admin, orgId, sesion\.user, \{\s*verificado: true/.test(verificar), 'verificar: crea o vincula la ficha de la organización del host con el correo verificado')
for (const ruta of ['app/api/auth/codigo/verificar/route.ts', 'app/api/auth/login/route.ts', 'app/auth/callback/route.ts', 'app/api/auth/forgot-password/restablecer/route.ts']) {
  check(/vincularClienteDeSesion\(/.test(leer(ruta)), `${ruta}: la misma ruta para crear o vincular la ficha`)
}
const registro = sinComentarios(leer('app/api/auth/register/route.ts'))
check(/emitirCodigo\([^)]*proposito: 'verify'/.test(registro) && /enviarCodigoAcceso\(/.test(registro), 'registrarse: confirma el correo con el código de la tienda')
check(!/vincularClienteDeSesion\(/.test(registro), 'registrarse: la ficha se vincula solo con el correo verificado (al confirmar el código)')
const olvido = sinComentarios(leer('app/api/auth/forgot-password/route.ts'))
check(/getOrgIdDelHost\(\)/.test(olvido) && /emitirCodigo\([^)]*proposito: 'reset'/.test(olvido), 'olvidé mi contraseña: código de la tienda (reset), organización del host')
check(/checkRateLimit\(`recuperar:ip:/.test(olvido) && /checkRateLimit\(`recuperar:correo:/.test(olvido), 'olvidé mi contraseña: límite por IP y por correo')
const restablecer = sinComentarios(leer('app/api/auth/forgot-password/restablecer/route.ts'))
check(/getOrgIdDelHost\(\)/.test(restablecer) && /verificarCodigo\([^)]*proposito: 'reset'/.test(restablecer) && /abrirSesionSinCorreo\(/.test(restablecer), 'nueva contraseña: código reset y sesión sin correo')
const codigoTienda = sinComentarios(leer('lib/cuenta/codigoTienda.ts'))
check(/createHmac\('sha256'/.test(codigoTienda) && /SUPABASE_SERVICE_ROLE_KEY/.test(codigoTienda) && /timingSafeEqual/.test(codigoTienda), 'código: HMAC con pepper del servidor y comparación en tiempo constante')
check(/randomInt\(/.test(codigoTienda) && !/Math\.random/.test(codigoTienda), 'código: aleatorio criptográfico')
check((codigoTienda.match(/\.eq\('organization_id', organizationId\)/g) || []).length >= 4, 'código: cada consulta filtra por organización')
check(/\.eq\('attempts', intentos\)/.test(codigoTienda) && /\.is\('used_at', null\)/.test(codigoTienda), 'código: intento contado sin carreras y un solo uso')
const sesionSinCorreo = sinComentarios(leer('lib/auth/sesionSinCorreo.ts'))
check(/createUser\(\{[\s\S]*?email_confirm: true/.test(sesionSinCorreo), 'sesión: usuario nuevo con admin.createUser y correo confirmado (sin correo)')
check(/generateLink\(\{ type: 'magiclink'/.test(sesionSinCorreo) && /verifyOtp\(\{ type: 'magiclink', token_hash/.test(sesionSinCorreo), 'sesión: generateLink (no envía) + verifyOtp con token_hash')
check(/password && \(!entrada\.soloClaveSiNueva \|\| !fila\.email_confirmed_at\)/.test(sesionSinCorreo) && /soloClaveSiNueva: !!registro/.test(sinComentarios(leer('app/api/auth/codigo/verificar/route.ts'))), 'registro: no cambia la contraseña de una cuenta ya confirmada (p. ej. usuario del ERP)')

// Ningún correo de Supabase Auth para compradores (app/, lib/, components/).
const PROHIBIDAS = [
  [/\bsignInWithOtp\s*\(/, 'signInWithOtp'],
  [/\.signUp\s*\(/, 'signUp'],
  [/\bresetPasswordForEmail\s*\(/, 'resetPasswordForEmail'],
  [/\bupdateUser\s*\(/, 'updateUser('],
  [/\.resend\s*\(/, '.resend('],
  [/\binviteUserByEmail\s*\(/, 'inviteUserByEmail'],
  [/\breauthenticate\s*\(/, 'reauthenticate'],
]
function archivosFuente(carpeta) {
  const raiz = join(ROOT, carpeta)
  if (!existsSync(raiz)) return []
  const lista = []
  for (const nombre of readdirSync(raiz)) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue
    const ruta = join(raiz, nombre)
    if (statSync(ruta).isDirectory()) lista.push(...archivosFuente(`${carpeta}/${nombre}`))
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nombre)) lista.push(`${carpeta}/${nombre}`)
  }
  return lista
}
let revisados = 0
for (const archivo of ['app', 'lib', 'components'].flatMap(archivosFuente)) {
  revisados++
  const fuente = sinComentarios(leer(archivo))
  for (const [patron, nombre] of PROHIBIDAS) {
    if (patron.test(fuente)) check(false, `${archivo}: llama ${nombre} (dispara un correo de Supabase al comprador)`)
  }
}
check(revisados > 100, `se revisaron los fuentes de app/, lib/ y components/ (${revisados})`)

// Correos a compradores: remitente central, sin direcciones ni marca de la plataforma cableadas.
const respaldo = sinComentarios(leer('lib/email/remitenteRespaldo.ts'))
check(/process\.env\.CORREO_RESPALDO_TIENDAS/.test(respaldo) && /console\.warn\(/.test(respaldo), 'respaldo: lee CORREO_RESPALDO_TIENDAS y avisa si falta')
// Van al equipo de la tienda, no a un comprador: pueden nombrar la plataforma.
const AL_EQUIPO = new Set(['lib/email/send-contact-notice.ts', 'lib/email/send-restaurant-team-notice.ts'])
for (const archivo of archivosFuente('lib/email').filter((a) => /\/send-[^/]+\.ts$/.test(a))) {
  if (AL_EQUIPO.has(archivo)) continue
  const fuente = sinComentarios(leer(archivo))
  check(!/@goadmin\.(io|app|co)/i.test(fuente), `${archivo}: sin dirección de la plataforma cableada`)
  check(!/GO ?Admin/i.test(fuente), `${archivo}: sin la marca de la plataforma en el correo`)
  check(/remitenteTienda\(|correoRespaldoTiendas\(/.test(fuente), `${archivo}: remitente con el nombre de la tienda (lib/email/remitenteRespaldo.ts)`)
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

// /rastrear dejó de ser página (2026-11-24): «Consultar pedido» lo incluye y /tracking va directo.
const tracking = leer('app/tracking/page.tsx')
check(/redirect\(/.test(tracking) && /\/consultar-pedido\?guia=/.test(tracking), '/tracking redirige a /consultar-pedido con la guía (enlaces viejos)')
const rastrear = leer('app/rastrear/page.tsx')
check(/redirect\(/.test(rastrear) && /\/consultar-pedido/.test(rastrear), '/rastrear redirige a /consultar-pedido (enlaces viejos)')
check(/getShipmentByTracking\(guia, organization\.id, zonaOrg\)/.test(leer('app/consultar-pedido/page.tsx')), '/consultar-pedido: guía con la organización del host')
check(!/recipient_name|recipient_relationship/.test(leer('components/site/rastreo/ResultadoGuia.tsx')), 'rastreo por guía: no pinta quién recibió')

const detalle = leer('app/mi-cuenta/pedidos/[id]/page.tsx')
check(/<OrderTracker/.test(detalle) && /pedidoDeCuenta\(/.test(detalle), 'detalle en la cuenta: la página del pedido rediseñada, solo si es de la cuenta')
check(!/buildSimpleTimeline/.test(detalle), 'detalle en la cuenta: sin la línea de tiempo duplicada')

const layout = leer('app/mi-cuenta/layout.tsx')
check(!/\p{Extended_Pictographic}/u.test(layout), 'layout de Mi cuenta sin emojis')
check(/menuCuenta\(/.test(layout), 'layout de Mi cuenta: menú por tipo de negocio')

// Mi cuenta V2: avatar, menú y pestañas
const rutaMenu = sinComentarios(leer('app/api/cuenta/menu/route.ts'))
check(/getCuentaCliente\(orgId\)/.test(rutaMenu) && /no-store/.test(rutaMenu), 'avatar: datos de la sesión y de la organización del host, sin caché compartida')
const almacen = sinComentarios(leer('components/site/cuenta/avatar/datosAvatar.ts'))
check(/if \(!user\) \{[\s\S]*?return[\s\S]*?\}[\s\S]*?cargarAvatar\(user\.id\)/.test(almacen), 'avatar: sin sesión no consulta nada (visitantes anónimos)')
check(/sessionStorage/.test(almacen) && /VIGENCIA_AVATAR_MS/.test(almacen), 'avatar: lo leído se guarda por sesión unos minutos')
check(/cifrasCuenta\(/.test(layout) && /ProveedorMenuCuenta/.test(layout), 'layout: cifras del menú lateral y pestañas del celular')
check(/export const cifrasCuenta = cache\(/.test(cuenta), 'cifras: una vez por petición (layout e Inicio comparten)')
check(/from\('invoice_sales'\)[\s\S]{0,80}\.eq\('organization_id', organizationId\)\.in\('sale_id', ventas/.test(cuenta), 'facturas: contadas desde las ventas de sus pedidos, por organización')
for (const archivo of ['app/mi-cuenta/pedidos/page.tsx', 'app/mi-cuenta/perfil/page.tsx', 'app/mi-cuenta/direcciones/DireccionesClient.tsx']) {
  check(/<PestanasCuenta/.test(leer(archivo)), `${archivo}: pestañas deslizables en el celular`)
}
const inicioV2 = leer('app/mi-cuenta/page.tsx')
check(!/\p{Extended_Pictographic}/u.test(inicioV2) && !/\p{Extended_Pictographic}/u.test(leer('components/site/cuenta/MenuMiCuenta.tsx')), 'Mi cuenta V2 sin emojis')
check(!/Agregar foto/.test(sinComentarios(inicioV2 + leer('app/mi-cuenta/perfil/page.tsx'))),'sin foto del cliente (no hay dónde guardarla)')

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
