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
 *
 * 2026-11-25 — cuatro arreglos del dueño (tienda de la org 358):
 * - Tiempo de entrega: una sola regla (lib/shipping/tiempoEntrega.ts) para tarjeta, aviso y resumen;
 *   el DEFAULT «Entrega en 3-5 días hábiles» de la columna ya no se muestra como si fuera suyo.
 * - «¿Ya compraste aquí?» y el «Ingresar» de contraentrega abren la ventana de acceso de la tienda
 *   (si está montada) y el cliente se queda en el pago con sus datos; si no, /auth?siguiente=.
 * - − / + y «Quitar» en el resumen con la regla del carrito (lib/carrito/cantidadLinea.ts).
 * - Cupón plegado tras «¿Tienes un cupón de descuento?»; aplicado, se ve aplicado con «Quitar».
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
import {
  DESCRIPCION_ENVIO_POR_DEFECTO,
  descripcionEnvioPropia,
  duracionLegible,
  leerTiemposEntregaTienda,
  tiempoConfiguradoTexto,
  tiempoEntregaCheckout,
} from '../lib/shipping/tiempoEntrega.ts'
import { mezclarDatosCuenta } from '../components/site/checkout/sesionCheckout.ts'
import { cambiarCantidadLinea, cupoLinea, puedeSumarLinea, quitarLineaCarrito } from '../lib/carrito/cantidadLinea.ts'

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

// ── 2026-11-25 · Fallo 1: tiempo de entrega (una sola regla) ────────────────────────────────────
igual('el DEFAULT de la columna no es un tiempo configurado', descripcionEnvioPropia(DESCRIPCION_ENVIO_POR_DEFECTO), null)
igual('el DEFAULT con espacios o mayúsculas tampoco', descripcionEnvioPropia('  ENTREGA EN 3-5 DÍAS HÁBILES '), null)
igual('vacío: nada', [descripcionEnvioPropia(''), descripcionEnvioPropia(null), descripcionEnvioPropia(undefined)], [null, null, null])
igual('texto propio de la tienda: tal cual (lo de hoy)', descripcionEnvioPropia('Despachamos con Servientrega'), 'Despachamos con Servientrega')
// Lo que tiene guardado la org 358 en «Pedidos online» (MCP 2026-11-25).
const tiempos358 = leerTiemposEntregaTienda({
  por_sede: {},
  por_tipo: {
    recoger: { alistar: { valor: 1, unidad: 'dias' } },
    domicilio: { alistar: { valor: 2, unidad: 'dias' }, entrega: { valor: 12, unidad: 'dias' } },
    transportadora: { alistar: { valor: 2, unidad: 'dias' }, entrega: { valor: 15, unidad: 'dias' } },
  },
  contar_desde_apertura: false,
  usar_en_confirmacion_automatica: false,
})
igual('org 358 domicilio: alistar 2 + entrega 12 = 14 días', tiempoConfiguradoTexto(tiempos358, 'own', null), 'Llega en aprox. 14 días')
igual('org 358 transportadora: 2 + 15 = 17 días', tiempoConfiguradoTexto(tiempos358, 'third_party', null), 'Llega en aprox. 17 días')
igual('sin fila de tiempos: null (no se inventa)', [leerTiemposEntregaTienda(null), tiempoConfiguradoTexto(null, 'own', null)], [null, null])
igual('fila vacía: null', leerTiemposEntregaTienda({ por_tipo: {}, por_sede: {} }), null)
igual('solo «Recoger» guardado: sin tiempo de envío', tiempoConfiguradoTexto(leerTiemposEntregaTienda({ por_tipo: { recoger: { alistar: { valor: 1, unidad: 'dias' } } } }), 'own', null), null)
igual('solo alistar (sin entrega): no se usa la entrega de fábrica', tiempoConfiguradoTexto(leerTiemposEntregaTienda({ por_tipo: { domicilio: { alistar: { valor: 2, unidad: 'dias' } } } }), 'own', null), null)
const conSede = leerTiemposEntregaTienda({ por_tipo: { domicilio: { alistar: { valor: 30, unidad: 'minutos' }, entrega: { valor: 2, unidad: 'horas' } } }, por_sede: { '7': { domicilio: { entrega: { valor: 45, unidad: 'minutos' } } }, abc: { domicilio: { entrega: { valor: 1, unidad: 'dias' } } } } })
igual('general en minutos y horas: 30 min + 2 h = 3 horas', tiempoConfiguradoTexto(conSede, 'own', null), 'Llega en aprox. 3 horas')
igual('la sede manda campo por campo: 30 min (general) + 45 min (sede) = 2 horas', tiempoConfiguradoTexto(conSede, 'own', 7), 'Llega en aprox. 2 horas')
igual('sede sin tiempos propios: los generales', tiempoConfiguradoTexto(conSede, 'own', 99), 'Llega en aprox. 3 horas')
igual('clave de sede inválida se ignora', Object.keys(conSede.porSede), ['7'])
igual('unidades en inglés y números en texto (como el ERP)', tiempoConfiguradoTexto(leerTiemposEntregaTienda({ por_tipo: { domicilio: { entrega: { valor: '40', unidad: 'minutes' } } } }), 'own'), 'Llega en aprox. 40 min')
igual('duración: redondea hacia arriba', [duracionLegible(1441), duracionLegible(61), duracionLegible(1440), duracionLegible(0)], ['2 días', '2 horas', '1 día', null])
igual('orden: con zona, la zona decide sola', tiempoEntregaCheckout({ conZona: true, zona: 'Sale hoy · llega en 2–3 días', tarifas: '5 días', configurado: 'Llega en aprox. 14 días' }), 'Sale hoy · llega en 2–3 días')
igual('zona que no reparte: sin tiempo (no se cae a otro)', tiempoEntregaCheckout({ conZona: true, zona: null, tarifas: '5 días', configurado: 'Llega en aprox. 14 días' }), null)
igual('sin zona: días de las tarifas web primero (lo de hoy)', tiempoEntregaCheckout({ conZona: false, zona: null, tarifas: '2–5 días', configurado: 'Llega en aprox. 14 días' }), '2–5 días')
igual('sin zona ni días de tarifa: el de «Pedidos online» (org 358)', tiempoEntregaCheckout({ conZona: false, zona: null, tarifas: null, configurado: 'Llega en aprox. 14 días' }), 'Llega en aprox. 14 días')
igual('sin nada configurado: sin tiempo', tiempoEntregaCheckout({ conZona: false, zona: null, tarifas: null, configurado: null }), null)
const wizTiempo = fuente('components/site/CheckoutWizard.tsx')
igual('tarjeta de domicilio con la regla única (con y sin zona)', (wizTiempo.match(/tiempo: tiempoEntregaCheckout\(/g) ?? []).length, 2)
igual('aviso «Domicilio a …» y resumen leen el mismo tiempo de la tarjeta', wizTiempo.includes("const tiempoDomicilio = orderType === 'delivery' ? opcionesDomicilio.find((o) => o.grupo === grupoEnvio)?.tiempo ?? null : null") && wizTiempo.includes('detalle: tiempoDomicilio, pista: null') && wizTiempo.includes('detalle: envioZona?.ok && cotZona ? llegadaZona(cotZona, fechaCorta) : tiempoDomicilio'), true)
igual('el resumen ya no pinta el DEFAULT «3-5 días hábiles»', wizTiempo.includes('descripcion: descripcionEnvioPropia(settings.shippingDescription)') && !wizTiempo.includes('descripcion: settings.shippingDescription || null'), true)
igual('ningún «3-5 días hábiles» fijo en el checkout', /3-5 d[ií]as/.test(wizTiempo), false)
const paginaCheckout = fuente('app/checkout/page.tsx')
igual('la página lee «Pedidos online» (organization_settings, org del contexto)', paginaCheckout.includes(".from('organization_settings')") && paginaCheckout.includes(".eq('organization_id', organization.id)") && paginaCheckout.includes(".eq('key', CLAVE_TIEMPOS_PEDIDOS)") && paginaCheckout.includes('tiemposEntrega: leerTiemposEntregaTienda('), true)

// ── 2026-11-25 · Fallo 2: «¿Ya compraste aquí?» abre la ventana de acceso ─────────────────────
igual('el enlace abre la ventana de acceso (y si no está montada, sigue a /auth?siguiente=)', wizTiempo.includes('onClick={(e) => alTocarIngresarCheckout(e, hrefIngresar)}') && wizTiempo.includes("const hrefIngresar = `${conPrefijo('/auth', prefijoSede)}?siguiente=${encodeURIComponent(conPrefijo('/checkout', prefijoSede))}`"), true)
igual('contraentrega «Ingresar»: misma ventana', wizTiempo.includes('onIngresar={(e) => alTocarIngresarCheckout(e, hrefIngresar)}'), true)
const contraentregaFuente = fuente('components/site/contraentrega/OpcionContraentrega.tsx')
igual('contraentrega: el onClick solo en «Ingresar»', contraentregaFuente.includes("onClick={accion === 'Ingresar' && onIngresar ? onIngresar : undefined}"), true)
const eventosFuente = fuente('components/site/cuenta/eventos.ts')
igual('sin ventana montada no se intercepta el clic (navega a la página)', /if \(anfitriones === 0\) return\r?\n\s+e\.preventDefault\(\)/.test(eventosFuente), true)
igual('el checkout pide quedarse y su página de respaldo', eventosFuente.includes("alTocarEnlaceCuenta(e, href, 'ingresar', { quedarse: true, paginaRespaldo: href })"), true)
const accesoFuente = fuente('components/site/cuenta/AccesoCuenta.tsx')
igual('al entrar desde el checkout se queda aunque el editor diga «Ir a Mi cuenta»', accesoFuente.includes("if (opciones.despues === 'cuenta' && !quedarse.current) {"), true)
igual('modo que manda a la página: la del checkout con ?siguiente=', accesoFuente.includes('router.push(detalle.paginaRespaldo)') && accesoFuente.includes("router.push(conSesion ? '/mi-cuenta' : rutaAcceso(pedida))"), true)
igual('la página del checkout monta la ventana con la misma condición que el layout', paginaCheckout.includes("const conAccesoCuenta = !ctx.frozenReason && opCuenta.modo !== 'pagina'") && paginaCheckout.includes('<AccesoCuenta opciones={opCuenta}'), true)
igual('tras entrar se vuelven a pedir los datos de la cuenta', wizTiempo.includes("if (evento !== 'SIGNED_IN' || autenticadoRef.current) return") && wizTiempo.includes('void cargarDatosCuenta(true)') && wizTiempo.includes('void cargarDatosCuenta(false)'), true)
const escrito = { firstName: 'Laura', lastName: '', email: 'laura@correo.co', phone: '', address: 'Cra 7 # 45-12', city: 'Medellín', countryCode: 'CO', stateName: 'Antioquia', department: 'Antioquia' }
const cuenta = { firstName: 'Laurita', lastName: 'Pérez', email: 'otra@correo.co', phone: '3001234567', address: 'Calle 1', city: 'Bogotá' }
const dirs = [{ address_line1: 'Calle 10 # 5-20', city: 'Envigado', country_code: 'CO', department: 'Antioquia', is_default: true }]
igual('tras entrar: lo escrito se respeta y se llena lo vacío', mezclarDatosCuenta(escrito, cuenta, dirs, true), { ...escrito, lastName: 'Pérez', phone: '3001234567' })
igual('tras entrar sin dirección escrita: la guardada por defecto', mezclarDatosCuenta({ ...escrito, address: '', city: '' }, cuenta, dirs, true).address, 'Calle 10 # 5-20')
igual('al abrir con sesión: lo de siempre (la cuenta manda y la dirección por defecto encima)', mezclarDatosCuenta(escrito, cuenta, dirs, false), { ...escrito, firstName: 'Laurita', lastName: 'Pérez', email: 'otra@correo.co', phone: '3001234567', address: 'Calle 10 # 5-20', city: 'Envigado' })
igual('al abrir con sesión sin direcciones: los datos de la cuenta', mezclarDatosCuenta(escrito, cuenta, null, false).address, 'Calle 1')

// ── 2026-11-25 · − / + en el resumen (regla del carrito) ───────────────────────────────────────
const lineasCarrito = [
  { id: 5, quantity: 2, stock: 3 },
  { id: '5_9', productId: 5, quantity: 1, stock: 3 },
  { id: 8, quantity: 1 },
]
igual('«−» no baja de 1', cambiarCantidadLinea([{ id: 1, quantity: 1 }], 1, -1)[0].quantity, 1)
igual('«−» resta', cambiarCantidadLinea(lineasCarrito, 5, -1)[0].quantity, 1)
igual('«+» sin stock conocido: sin tope (lo de hoy)', cambiarCantidadLinea(lineasCarrito, 8, 1)[2].quantity, 2)
igual('stock del producto sumando todas sus líneas: 2 + 1 = 3 → ya no sube', [cupoLinea(lineasCarrito, 5), puedeSumarLinea(lineasCarrito, 5), cambiarCantidadLinea(lineasCarrito, 5, 1)[0].quantity], [0, false, 2])
igual('empujón «+6» hasta el cupo', cambiarCantidadLinea([{ id: 3, quantity: 1, stock: 4 }], 3, 6)[0].quantity, 4)
igual('línea por encima del stock: «+» no le quita unidades', cambiarCantidadLinea([{ id: 3, quantity: 6, stock: 4 }], 3, 1)[0].quantity, 6)
igual('quitar saca solo esa línea', quitarLineaCarrito(lineasCarrito, '5_9').map((l) => l.id), [5, 8])
igual('no muta las líneas', (() => { const a = [{ id: 1, quantity: 2 }]; cambiarCantidadLinea(a, 1, 1); return a[0].quantity })(), 2)
igual('el resumen trae − / + y «Quitar» (solo lectura al cobrar o reintentar)', wizTiempo.includes('editarCantidad={submitting || reintento ? null : { onCambiar: cambiarCantidad, onQuitar: removeItem }}') && wizTiempo.includes('puedeSumar: puedeSumarLinea(cartItems, item.id)'), true)
igual('el checkout guarda el carrito igual que removeItem', wizTiempo.includes('const updated = cambiarCantidadLinea(items, id, delta)') && wizTiempo.includes('const updated = quitarLineaCarrito(items, id)'), true)
const resumenFuente = fuente('components/site/checkout/ResumenPedido.tsx')
igual('ResumenPedido pinta los controles con editarCantidad', resumenFuente.includes('{editarCantidad ? <ControlCantidad linea={l} editar={editarCantidad} /> : null}') && resumenFuente.includes('disabled={linea.cantidad <= 1}') && resumenFuente.includes('disabled={!sumar}'), true)
igual('carrito lateral y /carrito usan la misma regla (sin copias)', fuente('components/site/CartDrawer.tsx').includes('cambiarCantidadLinea(items, id, delta)') && fuente('app/carrito/CartPageClient.tsx').includes('saveCart(cambiarCantidadLinea(items, id, delta))'), true)

// ── 2026-11-25 · Cupón plegado ──────────────────────────────────────────────────────────────────
const cuponFuente = fuente('components/site/checkout/RevisarPedido.tsx')
igual('cupón: enlace «¿Tienes un cupón de descuento?» que abre el campo', cuponFuente.includes('¿Tienes un cupón de descuento?') && cuponFuente.includes('if (plegado && !abierto && !codigo.trim() && !error) {'), true)
igual('cupón aplicado: se ve aplicado con «Quitar» sin abrir', cuponFuente.includes('data-cupon-aplicado=""') && cuponFuente.includes('onClick={cuponAplicado.onQuitar}'), true)
igual('cupón sin `plegado`: el campo abierto de antes', cuponFuente.includes('plegado = false,'), true)
igual('el checkout lo usa plegado y con el cupón aplicado (3 pasos y 1 paso comparten seccionPago)', /<CuponCheckout[\s\S]*?\r?\n\s+plegado\r?\n\s+cuponAplicado=\{appliedCoupon \?/.test(wizTiempo) && wizTiempo.includes('{seccionPago}</TarjetaCheckout>'), true)

if (fallos.length > 0) {
  console.error(`✗ verify-checkout-v2: ${fallos.length} de ${casos} fallaron`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-checkout-v2: ${casos} comprobaciones (botón, validación única, pasos en la URL, factura, campos, pago rechazado, municipios, conexiones, tiempo de entrega, acceso, cantidades, cupón)`)
