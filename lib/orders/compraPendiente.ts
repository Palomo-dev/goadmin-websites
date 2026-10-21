/**
 * A quién se le escribe el correo de compra pendiente, y con qué se rearma el carrito.
 *
 * Un solo correo, unas dos horas después de que el pedido pase a cancelado o
 * expirado, y no más allá de 24 horas: la primera ejecución no escribe pedidos
 * viejos. Solo sitio web, con correo, pago por pasarela, y solo si expiró por
 * falta de pago. No a efectivo, transferencia, contraentrega ni rondas de mesa,
 * ni si alguien lo canceló a mano, ni si ese correo ya pagó otro pedido de la
 * misma organización después. Un mismo correo, en la misma tienda, recibe como
 * mucho un mensaje cada 24 horas, y es por el pedido más reciente.
 *
 * Puro. La pasarela es la misma regla que `fn_web_order_metodo_nativo`: método
 * `cash`, `transfer` o `mesa`, o un método de la organización sin conexión de
 * pasarela. Un método vacío no es pasarela: no se escribe.
 */

import { esComerAqui } from '@/lib/orders/estados-pedido'

/** Dos horas después de cancelado o expirado. */
export const ESPERA_COMPRA_PENDIENTE_MS = 2 * 60 * 60 * 1000
/** Tope hacia atrás. Lo anterior a esto no se selecciona ni se marca. */
export const VENTANA_COMPRA_PENDIENTE_MS = 24 * 60 * 60 * 1000
/** Un correo por comprador y tienda en este lapso, aunque haya varios pedidos. */
export const DEDUPE_COMPRA_PENDIENTE_MS = 24 * 60 * 60 * 1000
/** La escribe el vencimiento automático. Cualquier otra razón es manual. */
export const MOTIVO_FALTA_DE_PAGO = 'Expirado por falta de pago'
export const MOTIVO_OMITIDO_DUPLICADO = 'omitido por duplicado'

const METODOS_NATIVOS = new Set(['cash', 'transfer', 'mesa'])

export type MotivoSinCorreoPendiente =
  | 'ya_enviado'
  | 'fuera_de_ventana'
  | 'sin_correo'
  | 'no_es_sitio'
  | 'estado'
  | 'manual'
  | 'pago'
  | 'mesa'
  | 'nativo'
  | 'ya_pago_despues'

export interface PedidoPendiente {
  id: string
  organizationId: number
  status: string
  paymentStatus: string | null
  paymentMethod: string | null
  source: string | null
  email: string | null
  deliveryType: string | null
  restaurantTableId: string | null
  notasInternas: string | null
  cancelledAt: string | null
  createdAt: string | null
  yaEnviado: boolean
  /** Ausente se trata como null: los pedidos viejos del contrato no lo traen. */
  cancelledBy?: string | null
  cancellationReason?: string | null
}

export interface FilaMetodoPago {
  organizationId: number
  code: string
  /** `integration_connection_id` nulo: el método no pasa por pasarela. */
  sinPasarela: boolean
}

export interface PagoPosterior {
  id: string
  organizationId: number
  email: string | null
  createdAt: string | null
}

export interface LineaRetoma {
  productId: number
  name: string
  unitPrice: number
  quantity: number
  sku?: string | null
  imageUrl?: string | null
  uuid?: string | null
  variantAttributes?: Record<string, string> | null
  modifiers?: { groupId: number; groupName: string; modifierId: number; name: string; extraPrice: number }[]
  legacyModifiers?: { typeId: number; typeName: string; valueId: number; valueName: string }[]
  notes?: string | null
}

export interface DatosClienteRetomar {
  firstName: string
  lastName: string
  email: string
  phone: string
}

function correoUtil(valor: string | null): boolean {
  if (!valor) return false
  const limpio = valor.trim()
  if (limpio.length > 254 || limpio.length < 3) return false
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(limpio)
}

function enVentana(cancelledAt: string | null, ahora: Date): boolean {
  if (!cancelledAt) return false
  const t = Date.parse(cancelledAt)
  if (!Number.isFinite(t)) return false
  const edad = ahora.getTime() - t
  return edad >= ESPERA_COMPRA_PENDIENTE_MS && edad <= VENTANA_COMPRA_PENDIENTE_MS
}

/** True si el pago no fue por pasarela (no se escribe). */
export function metodoEsNativo(
  metodo: string | null | undefined,
  organizationId: number,
  filas: FilaMetodoPago[],
): boolean {
  const m = typeof metodo === 'string' ? metodo.trim() : ''
  if (!m) return true
  if (METODOS_NATIVOS.has(m)) return true
  return filas.some((f) => f.organizationId === organizationId && f.code === m && f.sinPasarela)
}

/**
 * Cancelado a mano: hay un usuario, o la razón no es la del vencimiento
 * automático. Un expirado sin razón sigue siendo del sistema.
 */
export function esCancelacionManual(pedido: {
  status: string
  cancelledBy?: string | null
  cancellationReason?: string | null
}): boolean {
  if (pedido.cancelledBy) return true
  const motivo = (pedido.cancellationReason ?? '').trim()
  if (pedido.status === 'expired') return motivo.length > 0 && motivo !== MOTIVO_FALTA_DE_PAGO
  if (pedido.status === 'cancelled') return motivo !== MOTIVO_FALTA_DE_PAGO
  return true
}

export interface PedidoPlanEnvio {
  id: string
  organizationId: number
  email: string
  cancelledAt: string
}

export interface SelloCompraPendiente {
  organizationId: number
  email: string
  sentAt: string
}

/** A quién se le escribe cuando hay varios pedidos del mismo correo. */
export function planDeEnvio(
  pedidos: readonly PedidoPlanEnvio[],
  ahora: Date,
  sellos: readonly SelloCompraPendiente[],
): { enviar: string[]; omitidos: string[] } {
  const grupos = new Map<string, PedidoPlanEnvio[]>()
  for (const pedido of pedidos) {
    const email = pedido.email.trim().toLowerCase()
    if (!email) continue
    const clave = `${pedido.organizationId}\n${email}`
    const lista = grupos.get(clave) ?? []
    lista.push(pedido)
    grupos.set(clave, lista)
  }
  const enviar: string[] = []
  const omitidos: string[] = []
  const ahoraMs = ahora.getTime()
  for (const [clave, lista] of grupos) {
    const salto = clave.indexOf('\n')
    const org = Number(clave.slice(0, salto))
    const email = clave.slice(salto + 1)
    const reciente = sellos.some((sello) => {
      if (sello.organizationId !== org) return false
      if (sello.email.trim().toLowerCase() !== email) return false
      const t = Date.parse(sello.sentAt)
      if (!Number.isFinite(t)) return false
      const edad = ahoraMs - t
      return edad >= 0 && edad <= DEDUPE_COMPRA_PENDIENTE_MS
    })
    const ordenados = [...lista].sort((a, b) => {
      const delta = Date.parse(b.cancelledAt) - Date.parse(a.cancelledAt)
      if (delta !== 0) return delta
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
    })
    if (reciente) {
      for (const pedido of ordenados) omitidos.push(pedido.id)
      continue
    }
    ordenados.forEach((pedido, indice) => (indice === 0 ? enviar : omitidos).push(pedido.id))
  }
  return { enviar, omitidos }
}

function pagoDespues(pedido: PedidoPendiente, pagos: PagoPosterior[]): boolean {
  const correo = (pedido.email || '').trim().toLowerCase()
  const desde = Date.parse(pedido.createdAt || '')
  if (!correo || !Number.isFinite(desde)) return false
  return pagos.some((p) => {
    if (p.id === pedido.id) return false
    if (p.organizationId !== pedido.organizationId) return false
    if ((p.email || '').trim().toLowerCase() !== correo) return false
    const t = Date.parse(p.createdAt || '')
    return Number.isFinite(t) && t > desde
  })
}

/**
 * `null` = se envía. `fuera_de_ventana` no se sella: el pedido simplemente no
 * entra en esta ejecución. El resto de los motivos sí se sellan, para no
 * volver a evaluar el mismo pedido cada cuarto de hora.
 */
export function motivoNoEscribir(
  pedido: PedidoPendiente,
  ahora: Date,
  metodos: FilaMetodoPago[],
  pagos: PagoPosterior[],
): MotivoSinCorreoPendiente | null {
  if (pedido.yaEnviado) return 'ya_enviado'
  if (!enVentana(pedido.cancelledAt, ahora)) return 'fuera_de_ventana'
  if (!correoUtil(pedido.email)) return 'sin_correo'
  if (pedido.source !== 'website') return 'no_es_sitio'
  if (pedido.status !== 'expired' && pedido.status !== 'cancelled') return 'estado'
  if (esCancelacionManual(pedido)) return 'manual'
  if (pedido.paymentStatus !== 'failed') return 'pago'
  if (esComerAqui(pedido.deliveryType, pedido.notasInternas) || pedido.restaurantTableId) return 'mesa'
  if (metodoEsNativo(pedido.paymentMethod, pedido.organizationId, metodos)) return 'nativo'
  if (pagoDespues(pedido, pagos)) return 'ya_pago_despues'
  return null
}

/**
 * El enlace solo rearma el carrito de un pedido que no se pagó.
 * Uno pagado se anuncia como hecho. Cualquier otro (pendiente, en preparación)
 * sigue su curso: no se abre un segundo carrito.
 */
export function decisionRetoma(
  status: string | null | undefined,
  paymentStatus: string | null | undefined,
): 'pagado' | 'retomar' | 'en_curso' {
  if (paymentStatus === 'paid') return 'pagado'
  if (paymentStatus === 'failed' && (status === 'expired' || status === 'cancelled')) return 'retomar'
  return 'en_curso'
}

/** Motivos que dejan el pedido fuera de la cola. La ventana no: aún no le toca, o ya pasó sin sello. */
export const MOTIVOS_SELLADOS: readonly MotivoSinCorreoPendiente[] = [
  'sin_correo',
  'no_es_sitio',
  'estado',
  'manual',
  'pago',
  'mesa',
  'nativo',
  'ya_pago_despues',
]

/**
 * Checkout de la sede si está publicada con un slug propio; si no, el checkout
 * del sitio (carrito sin sucursal en la clave). Un slug reservado no es sede.
 */
export function destinoRetomar(
  sede: { id: number; slug: string | null; publicada: boolean } | null,
  slugsReservados: readonly string[],
): { ruta: string; branchId: number | null } {
  const slug = (sede?.slug || '').trim().toLowerCase()
  const reservado = slugsReservados.some((s) => s.toLowerCase() === slug)
  if (sede && sede.publicada && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !reservado) {
    return { ruta: `/${slug}/checkout`, branchId: sede.id }
  }
  return { ruta: '/checkout', branchId: null }
}

function entero(valor: unknown): number | null {
  const n = Number(valor)
  return Number.isInteger(n) ? n : null
}

/** Línea que el carrito y el checkout ya entienden, a precio recalculado. Null si no se puede armar. */
export function lineaRetoma(entrada: {
  productId: number
  nombre: string
  precioUnitario: number
  cantidad: number
  sku: string | null
  modificadores: { groupId: number; groupName: string; modifierId: number; name: string; extraPrice: number }[]
  sinPrecio: { typeId: unknown; typeName: unknown; valueId: unknown; valueName: unknown }[]
  notas: string | null
  imageUrl?: string | null
  uuid?: string | null
  variantAttributes?: Record<string, string> | null
}): LineaRetoma | null {
  if (!Number.isInteger(entrada.productId) || entrada.productId <= 0) return null
  const cantidad = Number(entrada.cantidad)
  const precio = Number(entrada.precioUnitario)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null
  if (!Number.isFinite(precio) || precio < 0) return null
  const modifiers = (entrada.modificadores || []).filter((m) => {
    const groupId = entero(m.groupId)
    const modifierId = entero(m.modifierId)
    return groupId !== null && modifierId !== null && groupId > 0 && modifierId > 0
  }).map((m) => ({
    groupId: Number(m.groupId),
    groupName: typeof m.groupName === 'string' ? m.groupName : '',
    modifierId: Number(m.modifierId),
    name: typeof m.name === 'string' ? m.name : '',
    extraPrice: Number.isFinite(Number(m.extraPrice)) && Number(m.extraPrice) > 0 ? Number(m.extraPrice) : 0,
  }))
  const imagen = typeof entrada.imageUrl === 'string' && entrada.imageUrl.trim() ? entrada.imageUrl.trim() : null
  const uuid = typeof entrada.uuid === 'string' && entrada.uuid.trim() ? entrada.uuid.trim() : null
  const atributos = entrada.variantAttributes && Object.keys(entrada.variantAttributes).length > 0
    ? entrada.variantAttributes
    : null
  const legacy = (entrada.sinPrecio || []).flatMap((m) => {
    const typeId = entero(m.typeId)
    const valueId = entero(m.valueId)
    if (typeId === null || valueId === null) return []
    return [{
      typeId,
      typeName: typeof m.typeName === 'string' ? m.typeName : '',
      valueId,
      valueName: typeof m.valueName === 'string' ? m.valueName : '',
    }]
  })
  return {
    productId: entrada.productId,
    name: (entrada.nombre || '').trim() || 'Producto',
    unitPrice: precio,
    quantity: cantidad,
    sku: entrada.sku,
    ...(imagen ? { imageUrl: imagen } : {}),
    ...(uuid ? { uuid } : {}),
    ...(atributos ? { variantAttributes: atributos } : {}),
    ...(modifiers.length > 0 ? { modifiers } : {}),
    ...(legacy.length > 0 ? { legacyModifiers: legacy } : {}),
    notes: entrada.notas,
  }
}

/** Nombre del pedido → nombre y apellido del checkout. El resto de la frase queda en el apellido. */
export function datosClienteRetomar(
  nombre: string | null,
  email: string | null,
  phone: string | null,
): DatosClienteRetomar {
  const limpio = (nombre || '').replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
  const espacio = limpio.indexOf(' ')
  return {
    firstName: espacio === -1 ? limpio : limpio.slice(0, espacio),
    lastName: espacio === -1 ? '' : limpio.slice(espacio + 1).trim(),
    email: (email || '').trim(),
    phone: (phone || '').trim(),
  }
}
