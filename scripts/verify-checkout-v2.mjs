/**
 * verify-checkout-v2.mjs — Checkout v2, fase 1 (Figma «16 Sitio web» › «Checkout v2 — 3 pasos y 1
 * paso» 3117-87133; lámina D 3127-92158; aprobado por el dueño el 2026-11-24).
 *
 *   npm run verify:checkout-v2
 *
 * Prueba lo PURO con los módulos reales (components/site/checkout/reglasCheckout.ts,
 * camposCheckout.ts, facturaEmpresa.ts, pedidoPendiente.ts, municipios.ts y barraPago.ts) y revisa
 * en el fuente que el checkout siga conectado a esas reglas y conserve lo de hoy. Sin red ni base.
 *
 * Reglas nuevas que cubre:
 * - textoBotonPago(): «Pagar $ X» solo si cobra en línea; efectivo y transferencia, «Confirmar
 *   pedido»; contraentrega con anticipo, lo de textoBotonAnticipo.
 * - validarDatosCheckout(): una sola para 3 pasos y 1 paso, SIN endurecer lo que hoy deja comprar
 *   (coordinador, 2026-11-24): apellido opcional (una palabra = first_name, last_name vacío), celular
 *   de 7 a 10 dígitos de cualquier país, ciudad en texto libre y sin exigir país; solo «+57» (sin
 *   número) ya no pasa; recoger en tienda sin dirección; factura a nombre de empresa con DV.
 * - Paso en la URL (?paso=datos|pago|revisar) y sin saltarse lo que falta.
 * - Pago rechazado: copia del pedido antes de vaciar el carrito, reintento solo si el SERVIDOR dice
 *   que el pedido sigue pendiente, cobro del MISMO pedido por /api/checkout/init (el navegador nunca
 *   escribe el método del pedido).
 * - Sin complemento ni factura, lo que viaja a /api/orders es lo de siempre.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cobraEnLinea,
  direccionConComplemento,
  errorDe,
  partirNombre,
  pasoDeUrl,
  pasoPermitido,
  seccionCompleta,
  CAMPOS_CONTACTO,
  textoBotonPago,
  tituloResumenErrores,
  unirNombre,
  urlConPaso,
  validarDatosCheckout,
} from '../components/site/checkout/reglasCheckout.ts'
import { CAMPOS_CHECKOUT_POR_DEFECTO, camposDelCheckout, campo } from '../components/site/checkout/camposCheckout.ts'
import {
  FACTURA_VACIA,
  avisoDV,
  calcularDV,
  dvAlCambiarNumero,
  documentoFactura,
  erroresFactura,
  lineaFacturaNotas,
  notasConFactura,
} from '../components/site/checkout/facturaEmpresa.ts'
import {
  VIGENCIA_PEDIDO_PENDIENTE_MS,
  admiteReintento,
  carritoAlVolver,
  guardarPedidoPendiente,
  leerPedidoPendiente,
  numeroPedidoValido,
} from '../components/site/checkout/pedidoPendiente.ts'
import { PAIS_POR_DEFECTO, buscarMunicipios, crearCargadorUbicacion, etiquetaMunicipio, municipioExacto, normalizarTexto, paisParaLista } from '../components/site/checkout/municipios.ts'
import { contenidoBarraPago } from '../components/site/checkout/barraPago.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')

let casos = 0
const fallos = []
function igual(nombre, obtenido, esperado) {
  casos += 1
  try {
    assert.deepStrictEqual(obtenido, esperado)
  } catch {
    fallos.push(`${nombre}\n      esperado ${JSON.stringify(esperado)}\n      obtuvo   ${JSON.stringify(obtenido)}`)
  }
}

// ── 1. Botón que dice la verdad ─────────────────────────────────────────────────────────────────
const total = '$ 116.500'
igual('efectivo sin condiciones: Confirmar pedido', textoBotonPago({ codigo: 'cash', tipo: 'native', textoAnticipo: null, total }), 'Confirmar pedido')
igual('efectivo sin métodos en la lista: Confirmar pedido', textoBotonPago({ codigo: 'cash', tipo: null, textoAnticipo: null, total }), 'Confirmar pedido')
igual('contraentrega con anticipo: el texto del anticipo', textoBotonPago({ codigo: 'cash', tipo: 'native', textoAnticipo: 'Pagar anticipo $ 9.000 con Bold', total }), 'Pagar anticipo $ 9.000 con Bold')
igual('contraentrega disponible sin anticipo: Confirmar pedido', textoBotonPago({ codigo: 'cash', tipo: 'native', textoAnticipo: 'Confirmar pedido', total }), 'Confirmar pedido')
igual('pasarela: Pagar $ X', textoBotonPago({ codigo: 'bold_link', tipo: 'gateway', textoAnticipo: null, total }), 'Pagar $ 116.500')
igual('transferencia: Confirmar pedido (antes «Pagar $ X» sin cobro en línea)', textoBotonPago({ codigo: 'transfer', tipo: 'native', textoAnticipo: null, total }), 'Confirmar pedido')
igual('otro método nativo: Confirmar pedido', textoBotonPago({ codigo: 'datafono', tipo: 'native', textoAnticipo: null, total }), 'Confirmar pedido')
igual('nunca «Pagar» sin cobro en línea', ['cash', 'transfer', 'datafono'].map((c) => textoBotonPago({ codigo: c, tipo: 'native', textoAnticipo: null, total }).startsWith('Pagar')), [false, false, false])
igual('candado: pasarela sí, transferencia no, anticipo sí', [
  cobraEnLinea({ codigo: 'wompi_co', tipo: 'gateway', textoAnticipo: null }),
  cobraEnLinea({ codigo: 'transfer', tipo: 'native', textoAnticipo: null }),
  cobraEnLinea({ codigo: 'cash', tipo: 'native', textoAnticipo: 'Pagar anticipo $ 9.000' }),
  cobraEnLinea({ codigo: 'cash', tipo: 'native', textoAnticipo: 'Confirmar pedido' }),
], [true, false, true, false])

// Barra del celular: transferencia también dice «Confirmar pedido» en A, B y C.
for (const estilo of ['dos_filas', 'dos_lineas', 'partido']) {
  const c = contenidoBarraPago(estilo, { tipo: 'confirmar', total, productos: 3, envio: 'incluido', medio: 'transferencia' })
  igual(`barra ${estilo}: transferencia confirma con check`, [c.boton.texto, c.boton.icono], ['Confirmar pedido', 'check'])
}
igual('barra C: transferencia con el total a la derecha', contenidoBarraPago('partido', { tipo: 'confirmar', total, productos: 1, envio: null, medio: 'transferencia' }).boton.monto, total)
igual('barra C: pago normal sin cambios', contenidoBarraPago('partido', { tipo: 'pago', total, productos: 2, envio: 'gratis', pasarela: 'Bold', ahorro: null }).boton.texto, 'Pagar')

// ── 2. Nombre, dirección y pasos ────────────────────────────────────────────────────────────────
igual('nombre y apellido se parte', partirNombre('  Laura   Pérez Gómez '), { firstName: 'Laura', lastName: 'Pérez Gómez' })
igual('un solo nombre', partirNombre('Laura'), { firstName: 'Laura', lastName: '' })
igual('vacío', partirNombre('   '), { firstName: '', lastName: '' })
igual('unir lo guardado', unirNombre('Laura', 'Pérez'), 'Laura Pérez')
igual('ida y vuelta', unirNombre(...Object.values(partirNombre('Ana María López')).slice(0, 2)), 'Ana María López')
igual('sin complemento: la dirección tal cual (lo de hoy)', direccionConComplemento('Cra 7 # 45-12', ''), 'Cra 7 # 45-12')
igual('sin complemento (null): tal cual', direccionConComplemento('Cra 7 # 45-12', null), 'Cra 7 # 45-12')
igual('con complemento', direccionConComplemento('Cra 7 # 45-12', ' Apto 301 '), 'Cra 7 # 45-12, Apto 301')
igual('paso de la URL', ['datos', 'pago', 'revisar', 'PAGO', 'carrito', '', null].map(pasoDeUrl), [1, 2, 3, 2, null, null, null])
igual('URL del paso 2', urlConPaso('/checkout', '', 2), '/checkout?paso=pago')
igual('URL del paso 1: la de siempre', urlConPaso('/checkout', '?paso=revisar', 1), '/checkout')
igual('URL conserva el pedido pendiente', urlConPaso('/checkout', '?pedido=WO-000512', 3), '/checkout?pedido=WO-000512&paso=revisar')
igual('sin datos no se salta a Pago', pasoPermitido(2, false, true), 1)
igual('sin método no se salta a Revisar', pasoPermitido(3, true, false), 2)
igual('con todo, el pedido', pasoPermitido(3, true, true), 3)

// ── 3. Validación única (3 pasos y 1 paso) ──────────────────────────────────────────────────────
const base = {
  nombreCompleto: 'Laura Pérez',
  email: 'laura.perez@correo.com',
  phone: '+573184442109',
  address: 'Cra 7 # 45-12',
  city: 'Bogotá, D.C.',
  countryCode: 'COL',
  factura: FACTURA_VACIA,
  entrega: 'delivery',
}
igual('datos completos a domicilio: sin errores', validarDatosCheckout(base), [])
igual('teléfono guardado con espacio (formato viejo): válido', validarDatosCheckout({ ...base, phone: '+57 3184442109' }), [])
igual('recoger en tienda: no pide dirección ni municipio', validarDatosCheckout({ ...base, entrega: 'pickup', address: '', city: '', countryCode: '' }), [])
igual('comer aquí: no pide dirección', validarDatosCheckout({ ...base, entrega: 'dine_in', address: '', city: '' }), [])
const campos = (d) => validarDatosCheckout(d).map((e) => e.campo)
igual('una sola palabra deja comprar (como hoy)', validarDatosCheckout({ ...base, nombreCompleto: 'Laura' }), [])
igual('una sola palabra: first_name y last_name vacío', partirNombre('Laura'), { firstName: 'Laura', lastName: '' })
igual('sin nombre', errorDe(validarDatosCheckout({ ...base, nombreCompleto: ' ' }), 'nombre'), 'Escribe tu nombre y tu apellido.')
igual('«+57» solo no pasa', campos({ ...base, phone: '+57' }), ['celular'])
igual('«+57 » con espacio tampoco', campos({ ...base, phone: '+57 ' }), ['celular'])
igual('celular de 8 dígitos: pasa como hoy', campos({ ...base, phone: '+57 31844421' }), [])
igual('7 a 10 dígitos de cualquier país: pasan', ['+1 5551234', '+52 5512345678', '+34 6123456', '3001234567', '6012345'].map((p) => campos({ ...base, phone: p })), [[], [], [], [], []])
igual('menos de 7 dígitos (no válido): no pasa', campos({ ...base, phone: '+57 318444' }), ['celular'])
igual('«+57» pegado sin número: no pasa', campos({ ...base, phone: '+57 ' }), ['celular'])
igual('celular vacío', errorDe(validarDatosCheckout({ ...base, phone: '' }), 'celular'), 'Escribe tu celular para coordinar la entrega.')
igual('correo sin @: dice qué falta', errorDe(validarDatosCheckout({ ...base, email: 'laura.perez.correo.com' }), 'email'), 'Le falta la @. Ejemplo: nombre@correo.com')
igual('a domicilio sin municipio', campos({ ...base, city: '' }), ['ciudad'])
igual('ciudad escrita a mano (fuera de la lista): pasa como hoy', campos({ ...base, city: 'Vereda La Esperanza', countryCode: 'COL' }), [])
igual('sin país (la lista no cargó): no se exige, como hoy en 3 pasos', campos({ ...base, countryCode: '' }), [])
igual('a domicilio sin dirección', campos({ ...base, address: '  ' }), ['direccion'])
igual('el orden es el de la pantalla', campos({ ...base, email: '', phone: '', nombreCompleto: '', address: '', city: '' }), ['email', 'celular', 'nombre', 'direccion', 'ciudad'])
igual('mesa y hora (reglas de hoy) con mensaje', campos({ ...base, entrega: 'dine_in', mesaFaltante: true, momentoBloqueado: true }), ['mesa', 'momento'])
igual('resumen de errores', [tituloResumenErrores(3), tituloResumenErrores(1)], ['Revisa 3 datos para continuar', 'Revisa 1 dato para continuar'])
igual('sección contacto completa aunque falte la dirección', seccionCompleta(validarDatosCheckout({ ...base, address: '' }), CAMPOS_CONTACTO), true)
// Fase 2: un apellido opcional lo decide la lista de campos (la del ERP), no el checkout.
igual('fase 2: el ERP puede exigir apellido', errorDe(validarDatosCheckout({ ...base, nombreCompleto: 'Laura' }, camposDelCheckout([{ clave: 'nombre', exigirApellido: true }])), 'nombre'), 'Escribe también tu apellido.')
igual('apellido opcional por defecto', campo(CAMPOS_CHECKOUT_POR_DEFECTO, 'nombre').exigirApellido, false)

// ── 4. Factura a nombre de empresa ──────────────────────────────────────────────────────────────
igual('DV de la DIAN (800.197.268 → 4)', calcularDV('800197268'), 4)
igual('DV de la DIAN (890.903.938 → 8)', calcularDV('890.903.938'), 8)
igual('DV con puntos y espacios', calcularDV(' 900.123.456 '), calcularDV('900123456'))
const nit = { activa: true, tipo: 'NIT', numero: '890903938', dv: '8', razonSocial: 'Empresa de ejemplo S.A.S.', correo: 'factura@empresa.com' }
igual('NIT completo: sin errores', erroresFactura(nit), {})
igual('DV distinto al calculado: avisa pero NO bloquea', [Object.keys(erroresFactura({ ...nit, dv: '3' })), !!avisoDV({ ...nit, dv: '3' })], [[], true])
igual('DV correcto: sin aviso', avisoDV(nit), null)
igual('DV vacío: sí bloquea', Object.keys(erroresFactura({ ...nit, dv: '' })), ['factura_dv'])
igual('DV que no es número: bloquea', Object.keys(erroresFactura({ ...nit, dv: 'x' })), ['factura_dv'])
// Prueba en vivo (org 358): con 900123456 el DV «8» salía solo de marca de agua y al pagar «Revisa 1
// dato para continuar: DV».
const vacioNit = { tipo: 'NIT', numero: '', dv: '' }
igual('NIT 900123456: el DV se llena con 8', dvAlCambiarNumero(vacioNit, '900123456'), '8')
igual('escribiendo dígito a dígito también', ['9', '90', '9001234', '90012345', '900123456'].reduce((f, n) => ({ ...f, numero: n, dv: dvAlCambiarNumero(f, n) }), vacioNit).dv, '8')
igual('con puntos también', dvAlCambiarNumero(vacioNit, '900.123.456'), '8')
igual('menos de 9 dígitos: sin DV automático', dvAlCambiarNumero(vacioNit, '90012345'), '')
igual('el DV automático sigue al número', dvAlCambiarNumero({ tipo: 'NIT', numero: '900123456', dv: '8' }, '890903938'), '8')
igual('y se borra si el número baja de 9', dvAlCambiarNumero({ tipo: 'NIT', numero: '900123456', dv: '8' }, '90012345'), '')
igual('el DV que escribió el cliente se respeta', dvAlCambiarNumero({ tipo: 'NIT', numero: '900123456', dv: '3' }, '9001234567'), '3')
igual('cédula: el DV no se toca', dvAlCambiarNumero({ tipo: 'CC', numero: '', dv: '' }, '1020304050'), '')
igual('el NIT con su DV automático pasa la validación', erroresFactura({ ...nit, numero: '900123456', dv: dvAlCambiarNumero(vacioNit, '900123456') }), {})
igual('sin razón social ni correo', Object.keys(erroresFactura({ ...nit, razonSocial: '', correo: 'x' })), ['factura_razon', 'factura_correo'])
igual('cédula: sin DV', erroresFactura({ ...nit, tipo: 'CC', numero: '1020304050', dv: '' }), {})
igual('pasaporte alfanumérico', erroresFactura({ ...nit, tipo: 'PA', numero: 'AB12345', dv: '' }), {})
igual('casilla sin marcar: nada que validar', erroresFactura({ ...FACTURA_VACIA, numero: 'x' }), {})
igual('la factura entra en la validación única', campos({ ...base, factura: { ...nit, dv: '' } }), ['factura_dv'])
igual('un DV distinto no bloquea el pedido', campos({ ...base, factura: { ...nit, dv: '1' } }), [])
{
  const campoFactura = fuente('components/site/checkout/FacturaEmpresaCampos.tsx')
  igual('el campo llena el DV (no marca de agua) y muestra el aviso', campoFactura.includes('dv: dvAlCambiarNumero(factura, numero)') && campoFactura.includes('avisoDV(factura)') && !campoFactura.includes('placeholder={calcularDV'), true)
}
igual('documento legible', documentoFactura(nit), 'NIT 890.903.938-8')
igual('línea de las notas', lineaFacturaNotas(nit), '[Factura electrónica] NIT 890.903.938-8 · Empresa de ejemplo S.A.S. · factura@empresa.com')
igual('sin factura: las notas tal cual (lo de hoy)', notasConFactura('Llamar al llegar', FACTURA_VACIA), 'Llamar al llegar')
igual('sin factura y sin notas: tal cual', notasConFactura('', FACTURA_VACIA), '')
igual('con factura: notas + línea', notasConFactura('Llamar al llegar', nit), 'Llamar al llegar\n' + lineaFacturaNotas(nit))
igual('con factura y sin notas', notasConFactura('', nit), lineaFacturaNotas(nit))
igual('la línea no se repite', notasConFactura(notasConFactura('Hola', nit), nit), 'Hola\n' + lineaFacturaNotas(nit))

// ── 5. Lista declarativa de campos (fase 2 lee la configuración) ────────────────────────────────
igual('sin configuración: la lista por defecto', camposDelCheckout(null), CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => ({ ...c })))
igual('sin configuración (lista vacía): igual', camposDelCheckout([]), CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => ({ ...c })))
igual('autocompletar y teclado', ['email', 'celular', 'nombre', 'direccion', 'ciudad'].map((k) => [campo(CAMPOS_CHECKOUT_POR_DEFECTO, k).autoComplete, campo(CAMPOS_CHECKOUT_POR_DEFECTO, k).inputMode]), [['email', 'email'], ['tel-national', 'tel'], ['name', 'text'], ['address-line1', 'text'], ['address-level2', 'text']])
igual('nombre, dirección y municipio no se pueden esconder', ['nombre', 'direccion', 'ciudad'].map((k) => campo(camposDelCheckout([{ clave: k, visible: false, obligatorio: false }]), k)).map((c) => [c.visible, c.obligatorio]), [[true, true], [true, true], [true, true]])
igual('correo o celular: al menos uno', campo(camposDelCheckout([{ clave: 'email', obligatorio: false }, { clave: 'celular', visible: false }]), 'email').obligatorio, true)
igual('una etiqueta propia se aplica', campo(camposDelCheckout([{ clave: 'barrio', etiqueta: 'Barrio o vereda' }]), 'barrio').etiqueta, 'Barrio o vereda')

// ── 6. Pago rechazado: copia del pedido y reintento ─────────────────────────────────────────────
const memoria = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
const alm = memoria()
const ahora = 1_800_000_000_000
const carrito = [{ id: 1, name: 'Café', price: 24000, quantity: 2 }]
guardarPedidoPendiente(alm, 'tienda', { orderNumber: 'WO-000512', trackingToken: 't0k', gateway: 'bold_link', total, cartKey: 'cart_tienda', carrito, guardadoEn: ahora })
igual('la copia es del pedido', leerPedidoPendiente(alm, 'tienda', 'WO-000512', ahora + 60_000)?.carrito, carrito)
igual('otro pedido: nada', leerPedidoPendiente(alm, 'tienda', 'WO-000513', ahora), null)
igual('otra tienda: nada', leerPedidoPendiente(alm, 'otra', 'WO-000512', ahora), null)
igual('vencida: nada', leerPedidoPendiente(alm, 'tienda', 'WO-000512', ahora + VIGENCIA_PEDIDO_PENDIENTE_MS + 1), null)
alm.setItem('checkout_pedido_pendiente_tienda', '{roto')
igual('copia ilegible: nada (no rompe el checkout)', leerPedidoPendiente(alm, 'tienda', 'WO-000512', ahora), null)
igual('almacén lleno: no lanza', (() => { guardarPedidoPendiente({ setItem: () => { throw new Error('lleno') }, getItem: () => null, removeItem: () => {} }, 't', { orderNumber: 'WO-1', trackingToken: null, gateway: 'mp', total, cartKey: 'k', carrito: [], guardadoEn: ahora }); return 'ok' })(), 'ok')
igual('reintento solo con el pedido pendiente y el pago rechazado o sin pagar', [
  admiteReintento({ status: 'pending', paymentStatus: 'failed' }),
  admiteReintento({ status: 'pending', paymentStatus: 'pending' }),
  admiteReintento({ status: 'pending', paymentStatus: 'paid' }),
  admiteReintento({ status: 'pending', paymentStatus: 'partial' }),
  admiteReintento({ status: 'expired', paymentStatus: 'failed' }),
  admiteReintento({ status: 'cancelled', paymentStatus: 'failed' }),
  admiteReintento({ status: 'confirmed', paymentStatus: 'paid' }),
], [true, true, false, false, false, false, false])
igual('carrito vacío: vuelve el de la copia', carritoAlVolver([], carrito), carrito)
igual('sin carrito: vuelve el de la copia', carritoAlVolver(null, carrito), carrito)
igual('carrito nuevo del cliente: se respeta', carritoAlVolver([{ id: 9 }], carrito), null)
igual('número de pedido de la URL', [numeroPedidoValido('WO-000512'), numeroPedidoValido('<script>'), numeroPedidoValido(''), numeroPedidoValido('a'.repeat(41))], ['WO-000512', null, null, null])

// ── 7. Municipios (lista oficial con buscador) ──────────────────────────────────────────────────
const lista = [
  { code: '11001', name: 'Bogotá, D.C.', state_code: '11', state_name: 'Bogotá, D.C.' },
  { code: '05001', name: 'Medellín', state_code: '05', state_name: 'Antioquia' },
  { code: '05266', name: 'Envigado', state_code: '05', state_name: 'Antioquia' },
  { code: '05079', name: 'Barbosa', state_code: '05', state_name: 'Antioquia' },
  { code: '68077', name: 'Barbosa', state_code: '68', state_name: 'Santander' },
]
igual('sin tildes', normalizarTexto(' Medellín  '), 'medellin')
igual('buscar sin tilde', buscarMunicipios(lista, 'medellin').map((m) => m.code), ['05001'])
igual('buscar «bog»', buscarMunicipios(lista, 'bog')[0].code, '11001')
igual('por departamento', buscarMunicipios(lista, 'antioquia').map((m) => m.code), ['05001', '05266', '05079'])
igual('sin texto: Bogotá y Medellín arriba', buscarMunicipios(lista, '').slice(0, 2).map((m) => m.code), ['11001', '05001'])
igual('etiqueta con departamento', [etiquetaMunicipio(lista[2]), etiquetaMunicipio(lista[0])], ['Envigado · Antioquia', 'Bogotá, D.C.'])
igual('«Bogotá» guardado de antes se reconoce', municipioExacto(lista, 'Bogotá')?.code, '11001')
igual('«medellin» se reconoce', municipioExacto(lista, 'medellin')?.code, '05001')
igual('nombre repetido sin departamento: no se adivina', municipioExacto(lista, 'Barbosa'), null)
igual('nombre repetido con departamento', municipioExacto(lista, 'Barbosa', '68')?.code, '68077')

// Carga del país y de la lista (fallo en vivo 2026-11-24, org 358 en localhost: el campo se quedaba
// en «Cargando municipios…»; detect respondía null y se pedía la lista sin país). Fetch simulado.
igual('país para la lista: alfa-3; alfa-2 conocido se traduce; vacío nunca', ['COL', 'col', 'CO', '', null, ' ', 'C0L', 'XX'].map(paisParaLista), ['COL', 'COL', 'COL', null, null, null, null, null])
{
  const llamadas = []
  const respuesta = (ok, cuerpo) => Promise.resolve({ ok, json: () => Promise.resolve(cuerpo) })
  const red = (detect, lista) => (url) => {
    llamadas.push(url)
    if (url.startsWith('/api/locations/detect')) return detect()
    return lista(url)
  }
  const LISTA = [{ code: '11001', name: 'Bogotá, D.C.', state_code: '11', state_name: 'Bogotá, D.C.' }]
  let c = crearCargadorUbicacion(red(() => respuesta(true, { country_code: null }), () => respuesta(true, LISTA)), 50, 50)
  igual('detect null (localhost): Colombia', await c.pais(), PAIS_POR_DEFECTO)
  igual('producción: detect devuelve alfa-3 y se usa tal cual', await crearCargadorUbicacion(red(() => respuesta(true, { country_code: 'MEX' }), () => respuesta(true, [])), 50, 50).pais(), 'MEX')
  igual('detect con alfa-2: se traduce', await crearCargadorUbicacion(red(() => respuesta(true, { country_code: 'CO' }), () => respuesta(true, [])), 50, 50).pais(), 'COL')
  igual('detect que falla: Colombia', await crearCargadorUbicacion(red(() => Promise.reject(new Error('red')), () => respuesta(true, [])), 50, 50).pais(), 'COL')
  igual('detect que nunca responde: Colombia a tiempo', await crearCargadorUbicacion(red(() => new Promise(() => {}), () => respuesta(true, [])), 30, 30).pais(), 'COL')
  llamadas.length = 0
  c = crearCargadorUbicacion(red(() => respuesta(true, { country_code: null }), () => respuesta(true, LISTA)), 50, 50)
  await Promise.all([c.pais(), c.pais(), c.pais(), c.pais()])
  const [l1, l2, l3] = await Promise.all([c.municipios('COL'), c.municipios('COL'), c.municipios('col')])
  igual('una sola consulta de país y una sola de la lista (4 montajes)', llamadas, ['/api/locations/detect', '/api/locations/municipios?country_code=COL'])
  igual('la lista llega a todos', [l1.length, l2.length, l3.length], [1, 1, 1])
  llamadas.length = 0
  igual('sin país nunca se pide la lista', [await c.municipios(''), await c.municipios(null), await c.municipios(undefined)], [[], [], []])
  igual('…y no sale ninguna petición', llamadas, [])
  igual('lista con 400: vacía (campos de siempre, texto libre)', await crearCargadorUbicacion(red(() => respuesta(true, {}), () => respuesta(false, { error: 'x' })), 50, 50).municipios('COL'), [])
  igual('lista que falla: vacía', await crearCargadorUbicacion(red(() => respuesta(true, {}), () => Promise.reject(new Error('red'))), 50, 50).municipios('COL'), [])
  igual('lista que nunca responde: vacía a tiempo (nunca «Cargando»)', await crearCargadorUbicacion(red(() => respuesta(true, {}), () => new Promise(() => {})), 30, 30).municipios('COL'), [])
}
{
  const b = fuente('components/site/checkout/MunicipioBuscador.tsx')
  igual('el campo usa el cargador único y una red de seguridad', b.includes('const cargador = crearCargadorUbicacion(') && b.includes('ESPERA_MAXIMA_MS') && !b.includes('detectado.current') && !b.includes("'Cargando municipios…'"), true)
  igual('lo escrito mientras carga vale como ciudad', b.includes('const m = lista ? municipioExacto(lista, texto, null) : null'), true)
  const det = fuente('app/api/locations/detect/route.ts')
  igual('detect en producción responde el código de la tabla countries (alfa-3)', /ISO2_TO_ISO3/.test(det) && det.includes('country_code: country.code') && det.includes("CO: 'COL'"), true)
}

// ── 8. Conexiones en el fuente (y lo que se conserva) ───────────────────────────────────────────
const wiz = fuente('components/site/CheckoutWizard.tsx')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const wizCodigo = sinComentarios(wiz)
igual('el botón sale de textoBotonPago', wiz.includes('const textoPagar = textoBotonPago(entradaBoton)'), true)
igual('ya no arma «Pagar $ X» a mano', /`Pagar \$\{fmtPrice\(total\)\}`/.test(wiz), false)
igual('una validación para 3 pasos y 1 paso', (wizCodigo.match(/validarDatosCheckout\(/g) || []).length, 1)
igual('ya no existe la regla aparte del 1 paso', wiz.includes('canSubmitOnePage'), false)
igual('handleSubmit no crea el pedido con datos incompletos (y su else sigue igual)', /if \(!datosCompletos\) \{\s*\/\/[^\n]*\n\s*mostrarFaltantes\(\)\s*return\s*\} else \{/.test(wiz), true)
igual('celular con TelefonoPais', wiz.includes('<TelefonoPais') && !wiz.includes('PhoneCountryInput'), true)
igual('paso en la URL y «atrás» del navegador', wiz.includes("pasoDeUrl(urlParams.get('paso'))") && wiz.includes("addEventListener('popstate'"), true)
igual('el carrito ya no es un paso (sin + / − en el checkout)', wiz.includes('updateQuantity'), false)
igual('Enlace en vez de next/link', /from ['"]next\/link['"]/.test(wiz), false)
igual('sin emojis en el checkout', /\p{Extended_Pictographic}/u.test(wizCodigo), false)
igual('pasos con nombre', wiz.includes('<PasosCheckout'), true)
igual('un solo resumen', (wiz.match(/<ResumenPedido\b/g) || []).length, 1)
igual('1 paso: sin barra fija en computador', wiz.includes('z-40 px-4 py-3 hidden md:block'), false)
igual('celular: la barra A/B/C sigue', wiz.includes('<BarraPagoMovil') && wiz.includes('normalizarEstiloBarraPago(settings.barraPagoMovil)'), true)
igual('se conserva: ?metodo= del chat', wiz.includes('metodoDeTraspaso(metodoParam, metodoEnCliente)'), true)
igual('se conserva: contraentrega (motivo, desglose, anticipo)', wiz.includes('<MotivoContraentrega') && wiz.includes('<DetalleContraentrega') && wiz.includes("source: 'anticipo_pedido'"), true)
igual('se conserva: domicilio por zona y transportadora', wiz.includes("fetch('/api/shipping/quote'") && wiz.includes('opcionesDomicilio={opcionesDomicilio}') && wiz.includes('onGrupoDomicilio={setGrupoEnvio}'), true)
igual('se conserva: cupón y promociones', wiz.includes("fetch('/api/coupons/validate'") && wiz.includes('<DescuentosPorPromocion') && wiz.includes('<PromoDeLinea'), true)
igual('se conserva: modos steps y one_page (3 pasos por defecto)', wiz.includes("checkoutMode: 'steps'") && wiz.includes("settings.checkoutMode === 'one_page'"), true)
igual('se conserva: final del pedido A', wiz.includes('<OrderConfirmation'), true)
igual('recoger en tienda no pide dirección', /\{orderType === 'delivery' && \(\s*<div className=\{`space-y-4/.test(wiz), true)
igual('lo que viaja a /api/orders: customerData + complemento + factura', wiz.includes('customer: clientePedido') && wiz.includes('const clientePedido = { ...customerData, address: direccionPedido, notes: notasConFactura(customerData.notes, factura) }'), true)
igual('copia del pedido ANTES de vaciar el carrito', (() => {
  const i = wiz.indexOf('guardarPedidoPendiente(window.localStorage')
  const j = wiz.indexOf("// Limpiar carrito antes de redirigir")
  return i > 0 && j > i
})(), true)
igual('el reintento lo decide el servidor', wiz.includes('/tracking?ligero=1') && wiz.includes('admiteReintento({ status: o.status, paymentStatus: o.paymentStatus })'), true)
igual('reintento del MISMO pedido por /api/checkout/init', /body: JSON\.stringify\(\{ orderNumber: reintento\.orderNumber, gateway, returnUrl/.test(wiz), true)
igual('el navegador nunca escribe el método del pedido', /payment_method/.test(wizCodigo), false)
const resultado = fuente('app/checkout/resultado/page.tsx')
igual('resultado: «Intentar de nuevo» vuelve a Revisar con el pedido', resultado.includes('?pedido=${encodeURIComponent(order.order_number)}&paso=revisar'), true)
const init = fuente('app/api/checkout/init/route.ts')
igual('init (sin cambios): cambia el método en el servidor tras validar', /\.update\(\{\s*payment_method: gateway,/.test(init) && init.includes("code: 'PEDIDO_CERRADO'"), true)
igual('contraentrega: «Ingresar» va a /auth (no a /cuenta, que no existe)', wiz.includes('hrefIngresar={isAuthenticated ? null : hrefIngresar}') && !wiz.includes("'/cuenta'") && wiz.includes("conPrefijo('/auth', prefijoSede)"), true)
const buscador = fuente('components/site/checkout/MunicipioBuscador.tsx')
igual('municipio: texto libre si no está en la lista, y los campos de siempre si la lista no carga', buscador.includes("onCambio({ countryCode: pais, stateCode: '', stateName: '', city: texto.trim() })") && buscador.includes('(lista !== null && lista.length === 0)') && buscador.includes('<LocationCheckoutFields'), true)
const municipiosRuta = fuente('app/api/locations/municipios/route.ts')
igual('municipios: columnas verificadas por MCP', municipiosRuta.includes(".from('municipalities')") && municipiosRuta.includes(".select('code, name, state_code, state_name')"), true)

if (fallos.length > 0) {
  console.error(`✗ verify-checkout-v2: ${fallos.length} de ${casos} fallaron`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-checkout-v2: ${casos} comprobaciones (botón, validación única, pasos en la URL, factura, campos, pago rechazado, municipios, conexiones)`)
