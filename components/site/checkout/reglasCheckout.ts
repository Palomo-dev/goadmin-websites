/**
 * Reglas del checkout v2 en funciones puras (Figma «16 Sitio web» › Checkout v2 3117-87133, lámina D
 * 3127-92158; aprobado por el dueño el 2026-11-24). Las usan el checkout de 3 pasos y el de 1 paso
 * (la MISMA regla para los dos: antes el de 1 paso exigía el país y el de 3 no) y
 * `scripts/verify-checkout-v2.mjs`.
 *
 * - Pasos con nombre: «Datos y entrega», «Pago», «Revisar y confirmar». El carrito ya no es un paso.
 * - Paso en la URL (`?paso=datos|pago|revisar`) para que el «atrás» del teléfono vuelva de paso.
 * - «Nombre y apellido» en un campo que se parte al guardar (first_name / last_name).
 * - `textoBotonPago()`: el botón dice la verdad. «Pagar $ X» solo si se cobra en línea; efectivo y
 *   transferencia, «Confirmar pedido»; contraentrega con anticipo, «Pagar anticipo $ X».
 * - `validarDatosCheckout()`: mensajes por campo que dicen qué hacer, sin endurecer lo que hoy deja
 *   comprar: el apellido es opcional (fase 2 lo puede exigir), la ciudad acepta texto libre y el
 *   celular pasa con 7 a 10 dígitos de cualquier país; solo «+57» (sin número) ya no pasa.
 */

import { esTelefonoValido, mensajeErrorTelefono, parsearTelefono } from '../../../lib/utils/telefono'
import { campo, CAMPOS_CHECKOUT_POR_DEFECTO, type CampoCheckout, type ClaveCampo } from './camposCheckout'
import { correoValido, erroresFactura, type CampoFactura, type DatosFactura } from './facturaEmpresa'

// ─── Pasos ───────────────────────────────────────────────────────────────────────────────────

export type ClavePaso = 'datos' | 'pago' | 'revisar'
export type NumeroPaso = 1 | 2 | 3

export const PASOS_CHECKOUT: readonly { numero: NumeroPaso; clave: ClavePaso; nombre: string }[] = [
  { numero: 1, clave: 'datos', nombre: 'Datos y entrega' },
  { numero: 2, clave: 'pago', nombre: 'Pago' },
  { numero: 3, clave: 'revisar', nombre: 'Revisar y confirmar' },
]

/** `?paso=` → número de paso. Sin valor o con uno que no se reconoce: null. */
export function pasoDeUrl(valor: string | null | undefined): NumeroPaso | null {
  const p = PASOS_CHECKOUT.find((x) => x.clave === (valor || '').trim().toLowerCase())
  return p ? p.numero : null
}

export function claveDePaso(n: number): ClavePaso {
  return PASOS_CHECKOUT.find((x) => x.numero === n)?.clave ?? 'datos'
}

/**
 * La URL del checkout con el paso (y el pedido pendiente, si lo hay), conservando lo demás de la
 * búsqueda. `paso` 1 sin pedido: sin `?paso=` (la URL de siempre).
 */
export function urlConPaso(pathname: string, busqueda: string, paso: NumeroPaso): string {
  const params = new URLSearchParams(busqueda)
  if (paso === 1) params.delete('paso')
  else params.set('paso', claveDePaso(paso))
  const q = params.toString()
  return q ? `${pathname}?${q}` : pathname
}

/**
 * Hasta qué paso se puede llegar con lo que hay: sin datos completos, a «Datos y entrega»; sin
 * método de pago válido, a «Pago». Así un enlace o el «adelante» del navegador nunca salta lo que
 * falta.
 */
export function pasoPermitido(pedido: NumeroPaso, datosCompletos: boolean, pagoListo: boolean): NumeroPaso {
  if (pedido >= 2 && !datosCompletos) return 1
  if (pedido === 3 && !pagoListo) return 2
  return pedido
}

// ─── Nombre y dirección ──────────────────────────────────────────────────────────────────────

/** «Laura Pérez Gómez» → { firstName: 'Laura', lastName: 'Pérez Gómez' }. Espacios de más fuera. */
export function partirNombre(completo: string): { firstName: string; lastName: string } {
  const partes = (completo || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return { firstName: '', lastName: '' }
  return { firstName: partes[0], lastName: partes.slice(1).join(' ') }
}

/** first_name + last_name → «Nombre y apellido» (para pintar lo guardado). */
export function unirNombre(firstName: string, lastName: string): string {
  return [firstName, lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ')
}

/** «Cra 7 # 45-12» + «Apto 301» → «Cra 7 # 45-12, Apto 301». Sin complemento, la dirección tal cual. */
export function direccionConComplemento(direccion: string, complemento: string | null | undefined): string {
  const c = (complemento || '').trim()
  if (!c) return direccion
  const d = (direccion || '').trim()
  return d ? `${d}, ${c}` : c
}

// ─── Botón del pago ──────────────────────────────────────────────────────────────────────────

export interface EntradaBotonPago {
  /** Código del método elegido (`cash`, `transfer`, `wompi_co`…). */
  codigo: string
  /** Tipo del método en la tienda; null si no está en la lista (sin métodos: efectivo). */
  tipo: 'native' | 'gateway' | null
  /** Contraentrega con condiciones: lo que dice `textoBotonAnticipo` (null sin condiciones). */
  textoAnticipo: string | null
  /** Total ya formateado («$ 116.500»). */
  total: string
}

/**
 * Texto del botón final. Regla única para los 3 pasos, el de 1 paso y la barra del celular:
 * - Efectivo: lo que diga la contraentrega con condiciones («Pagar anticipo $ X» o «Confirmar
 *   pedido»); sin condiciones, «Confirmar pedido» (dueño, 2026-11-24).
 * - Pasarela (cobra en línea): «Pagar $ X».
 * - Transferencia y cualquier otro método que NO cobra en línea: «Confirmar pedido».
 */
export function textoBotonPago(e: EntradaBotonPago): string {
  if (e.codigo === 'cash') return e.textoAnticipo ?? 'Confirmar pedido'
  if (e.tipo === 'gateway') return `Pagar ${e.total}`
  return 'Confirmar pedido'
}

/** ¿El botón cobra en línea? (candado y nota de la ventana segura). */
export function cobraEnLinea(e: Pick<EntradaBotonPago, 'codigo' | 'tipo' | 'textoAnticipo'>): boolean {
  if (e.codigo === 'cash') return !!e.textoAnticipo && e.textoAnticipo.startsWith('Pagar')
  return e.tipo === 'gateway'
}

// ─── Validación ──────────────────────────────────────────────────────────────────────────────

export type CampoValidado = ClaveCampo | CampoFactura | 'mesa' | 'momento' | 'metodo'

export interface DatosValidar {
  nombreCompleto: string
  email: string
  phone: string
  address: string
  city: string
  countryCode: string
  factura: DatosFactura
  /** Tipo de entrega elegido. */
  entrega: 'delivery' | 'pickup' | 'dine_in'
  /** «Comer aquí» sin mesa del QR ni escrita. */
  mesaFaltante?: boolean
  /** Restaurante con la sede cerrada y sin hora programada. */
  momentoBloqueado?: boolean
  /**
   * Parte F (formulario configurado en el ERP): lo que escribió el cliente en los campos que el ERP
   * puede volver obligatorios. Ausentes (`undefined`) no se revisan: lo de siempre.
   */
  complemento?: string
  barrio?: string
  notas?: string
  /** Se ven los campos de la dirección (no eligió una dirección guardada). Por defecto, sí. */
  direccionManual?: boolean
  /** El checkout muestra el barrio (domicilio propio con zona). Por defecto, no. */
  barrioPedido?: boolean
}

export interface ErrorCampo {
  campo: CampoValidado
  /** Nombre corto para el resumen de errores («Correo», «Celular»…). */
  etiqueta: string
  mensaje: string
}

const ETIQUETA_CORTA: Record<CampoValidado, string> = {
  email: 'Correo',
  celular: 'Celular',
  nombre: 'Nombre',
  factura: 'Factura',
  direccion: 'Dirección',
  complemento: 'Apto',
  barrio: 'Barrio',
  ciudad: 'Municipio',
  notas: 'Indicaciones',
  factura_numero: 'Documento',
  factura_dv: 'DV',
  factura_razon: 'Razón social',
  factura_correo: 'Correo de la factura',
  mesa: 'Mesa',
  momento: 'Hora',
  metodo: 'Método de pago',
}

/** Mensaje del correo: qué falta, con un ejemplo. */
function errorCorreo(valor: string): string | null {
  const v = (valor || '').trim()
  if (!v) return 'Escribe tu correo. Ahí te llega la confirmación.'
  if (!v.includes('@')) return 'Le falta la @. Ejemplo: nombre@correo.com'
  if (!correoValido(v)) return 'Revisa el correo. Ejemplo: nombre@correo.com'
  return null
}

/** Dígitos nacionales escritos (sin el indicativo): «+57» o «+57 » cuentan como vacío. */
function digitosNacionales(valor: string): string {
  const v = (valor || '').trim()
  // Con espacio tras el indicativo («+57 3001234567», el formato de guardar) se separa ahí; pegado
  // («+573001234567», E.164) se quita el indicativo que reconozca el país.
  const conEspacio = v.match(/^\+(\d{1,4})[\s-]+(.*)$/)
  if (conEspacio) return conEspacio[2].replace(/\D/g, '')
  const todo = v.replace(/\D/g, '')
  if (!v.startsWith('+')) return todo
  const p = parsearTelefono(v)
  return p ? p.number.replace(/\D/g, '') : todo.length <= 4 ? '' : todo
}

/** Dígitos que hoy dejan comprar con un número de cualquier país (sin endurecer lo que funciona). */
export const MIN_DIGITOS_CELULAR = 7
export const MAX_DIGITOS_CELULAR = 10

/**
 * Celular: vacío o solo el indicativo («+57») no pasa. Pasa si es válido para su país
 * (libphonenumber) o, como hoy, si trae entre 7 y 10 dígitos de cualquier país.
 */
function errorCelular(valor: string, iso: string | undefined): string | null {
  const v = (valor || '').trim()
  const digitos = digitosNacionales(v).length
  if (digitos === 0) return 'Escribe tu celular para coordinar la entrega.'
  if (esTelefonoValido(v, iso)) return null
  if (digitos >= MIN_DIGITOS_CELULAR && digitos <= MAX_DIGITOS_CELULAR) return null
  return mensajeErrorTelefono(v, iso) ?? 'Revisa el celular: faltan o sobran números.'
}

/**
 * Errores de los datos del pedido, en el orden de la pantalla. Lista vacía = se puede seguir. La
 * misma regla para 3 pasos y 1 paso. `campos` es la lista declarativa (fase 2: la del ERP).
 * - Nombre: obligatorio; con `exigirApellido` (fase 2; por defecto no), nombre Y apellido.
 * - Correo: obligatorio y con forma de correo.
 * - Celular: obligatorio; válido para su país o con 7 a 10 dígitos (como hoy); «+57» solo no pasa.
 * - Dirección y municipio: solo a domicilio (recoger en tienda y comer aquí no piden dirección).
 * - Factura a nombre de empresa: solo si se marcó la casilla.
 * - Mesa (comer aquí) y hora (sede cerrada): las reglas de hoy, con su mensaje.
 */
export function validarDatosCheckout(d: DatosValidar, campos: readonly CampoCheckout[] = CAMPOS_CHECKOUT_POR_DEFECTO, isoTelefono?: string): ErrorCampo[] {
  const errores: ErrorCampo[] = []
  const poner = (c: CampoValidado, mensaje: string | null | undefined) => {
    if (mensaje) errores.push({ campo: c, etiqueta: ETIQUETA_CORTA[c], mensaje })
  }

  const cEmail = campo(campos, 'email')
  if (cEmail.visible && (cEmail.obligatorio || (d.email || '').trim())) poner('email', errorCorreo(d.email))

  const cCelular = campo(campos, 'celular')
  if (cCelular.visible && (cCelular.obligatorio || digitosNacionales(d.phone).length > 0)) poner('celular', errorCelular(d.phone, isoTelefono))

  const cNombre = campo(campos, 'nombre')
  const { firstName, lastName } = partirNombre(d.nombreCompleto)
  if (!firstName) poner('nombre', 'Escribe tu nombre y tu apellido.')
  else if (cNombre.exigirApellido === true && !lastName) poner('nombre', 'Escribe también tu apellido.')

  const fe = erroresFactura(d.factura)
  for (const c of ['factura_numero', 'factura_dv', 'factura_razon', 'factura_correo'] as const) poner(c, fe[c])

  if (d.entrega === 'delivery') {
    if (!(d.address || '').trim()) poner('direccion', 'Escribe la dirección para saber cuánto cuesta el envío.')
    // Ciudad: de la lista o escrita a mano (texto libre, como hoy). El país no se exige: el checkout
    // de 3 pasos de hoy no lo pedía.
    if (!(d.city || '').trim()) poner('ciudad', 'Escribe o elige tu ciudad o municipio.')
    // Parte F: apto y barrio solo si el ERP los volvió obligatorios y el cliente los ve; si no, nada
    // (lo de siempre: son opcionales).
    const cComplemento = campo(campos, 'complemento')
    if (cComplemento.visible && cComplemento.obligatorio && d.complemento !== undefined && d.direccionManual !== false && !d.complemento.trim()) {
      poner('complemento', 'Escribe el apto, la casa o la oficina.')
    } else {
      // Opcional, oculto o con una dirección guardada: no se pide.
    }
    const cBarrio = campo(campos, 'barrio')
    if (cBarrio.obligatorio && d.barrioPedido === true && d.barrio !== undefined && !d.barrio.trim()) {
      poner('barrio', 'Escribe tu barrio para saber la zona del envío.')
    } else {
      // Opcional o sin zona: no se pide.
    }
  }

  // Parte F: indicaciones obligatorias (cualquier tipo de entrega) si el ERP las pidió.
  const cNotas = campo(campos, 'notas')
  if (cNotas.visible && cNotas.obligatorio && d.notas !== undefined && !d.notas.trim()) {
    poner('notas', 'Escribe las indicaciones para tu pedido.')
  } else {
    // Opcionales u ocultas: no se piden (lo de siempre).
  }

  if (d.mesaFaltante) poner('mesa', 'Escribe el número de tu mesa.')
  if (d.momentoBloqueado) poner('momento', 'Elige la hora del pedido: ahora la sede está cerrada.')
  return errores
}

/** Mensaje de un campo, o null. */
export function errorDe(errores: readonly ErrorCampo[], c: CampoValidado): string | null {
  return errores.find((e) => e.campo === c)?.mensaje ?? null
}

/** «Revisa 3 datos para continuar» / «Revisa 1 dato para continuar». */
export function tituloResumenErrores(n: number): string {
  return `Revisa ${n} ${n === 1 ? 'dato' : 'datos'} para continuar`
}

/** Campos de la sección «Contacto» (para el check de la tarjeta numerada del 1 paso). */
export const CAMPOS_CONTACTO: readonly CampoValidado[] = ['email', 'celular', 'nombre', 'factura_numero', 'factura_dv', 'factura_razon', 'factura_correo']
/** Campos de la sección «Entrega». */
export const CAMPOS_ENTREGA: readonly CampoValidado[] = ['direccion', 'ciudad', 'complemento', 'barrio', 'notas', 'mesa', 'momento']

export function seccionCompleta(errores: readonly ErrorCampo[], campos: readonly CampoValidado[]): boolean {
  return !errores.some((e) => campos.includes(e.campo))
}
