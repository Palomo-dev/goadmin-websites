/**
 * Cuenta del cliente en la tienda — reglas puras (Figma «16 Sitio web», sección 2975:71910
 * «Cuenta del cliente…», aprobada por el dueño el 2026-11-24).
 *
 * Lo usan el servidor (rutas de /api/auth/codigo, /api/cuenta/buscar-pedido, páginas de
 * /mi-cuenta) y el navegador (acceso con código, Mis pedidos), y scripts/verify-cuenta-cliente.mjs.
 * Sin efectos: nada de base de datos ni de cookies aquí.
 */

import { encabezadoPedido, pasosPedido, vistaPedido, type Paso, type TonoInsignia, type VistaPedido } from '@/lib/orders/consultaPedido'
import { ESTADOS_SIN_ENTREGA, esEstadoFinal } from '@/lib/orders/estados-pedido'

// ─── Código de 6 dígitos al correo ────────────────────────────────────────────────────────────

/** Largo del código que manda Supabase (`{{ .Token }}` de la plantilla). */
export const LARGO_CODIGO = 6
/** Segundos antes de poder pedir otro código (Supabase tampoco deja antes: `auth.rate_limits.otp.period`). */
export const ESPERA_REENVIO_S = 60
/** Minutos que dura el código (lo que dice la pantalla; se configura en Supabase › Email OTP Expiration). */
export const MINUTOS_VIGENCIA_CODIGO = 10

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Correo en minúsculas y sin espacios; `null` si no parece un correo. */
export function normalizarCorreo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const c = v.trim().toLowerCase()
  if (!c || c.length > 254 || !PATRON_CORREO.test(c)) return null
  return c
}

/** El código escrito, solo con sus dígitos; `null` si no son exactamente seis. */
export function codigoValido(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = String(v).replace(/\s+/g, '')
  return /^\d+$/.test(d) && d.length === LARGO_CODIGO ? d : null
}

/** Segundos que faltan para poder reenviar (0 = ya se puede). */
export function segundosParaReenviar(enviadoEnMs: number | null, ahoraMs: number, espera = ESPERA_REENVIO_S): number {
  if (enviadoEnMs === null || !Number.isFinite(enviadoEnMs)) return 0
  return Math.max(0, Math.ceil((enviadoEnMs + espera * 1000 - ahoraMs) / 1000))
}

/** «0:45». */
export function textoCuentaRegresiva(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Mensaje para el cliente según el error de Supabase al verificar. Nunca dice si el correo tiene
 * cuenta: solo si el código venció o no coincide.
 */
export function mensajeErrorCodigo(error: { message?: string | null; code?: string | null; status?: number | null } | null | undefined): string {
  const texto = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  if (error?.status === 429 || texto.includes('rate limit') || texto.includes('over_email_send_rate_limit')) {
    return 'Hiciste muchos intentos. Espera un momento y vuelve a intentar.'
  }
  if (texto.includes('expired')) return 'El código venció. Pide uno nuevo.'
  return 'El código no coincide. Revísalo o pide uno nuevo.'
}

/**
 * ¿El correo de la sesión está verificado? Lo está si entró con el código (verifyOtp lo confirma)
 * o si confirmó el correo al registrarse. Solo así se le muestran los pedidos hechos sin cuenta con
 * ese correo.
 */
export function correoVerificado(user: { email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined): boolean {
  if (!user?.email) return false
  return !!(user.email_confirmed_at || user.confirmed_at)
}

/** Qué hacer con la ficha de cliente de la organización al entrar con un correo verificado. */
export type DecisionVinculo = 'crear' | 'vincular' | 'ya_vinculada' | 'reasignar'

/**
 * - Sin ficha con ese correo en la organización: se crea (la cuenta se abre con el correo).
 * - Ficha sin usuario (compró sin cuenta): se vincula, y sus pedidos aparecen en Mis pedidos.
 * - Ficha de otro usuario: se reasigna. Solo se llama con el correo verificado: quien entró con el
 *   código es el dueño del correo (Supabase no deja dos usuarios con el mismo correo; esto pasa
 *   cuando alguien cambió el correo de su usuario).
 */
export function decisionVinculo(ficha: { user_id: string | null } | null | undefined, userId: string): DecisionVinculo {
  if (!ficha) return 'crear'
  if (!ficha.user_id) return 'vincular'
  return ficha.user_id === userId ? 'ya_vinculada' : 'reasignar'
}

// ─── Seguir un pedido sin cuenta (/rastrear) ──────────────────────────────────────────────────

/** Número de pedido tal como se guarda (`WO-358-MWUO4KWG-LAXG`); `null` si no tiene forma de uno. */
export function normalizarNumeroPedido(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const n = v.trim().replace(/^#/, '').toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{2,59}$/.test(n) ? n : null
}

/** Solo los dígitos de un teléfono. */
export function digitosTelefono(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D+/g, '') : ''
}

/** Lo que escribió la persona: un correo, un teléfono (7 a 15 dígitos) o nada que sirva. */
export function tipoContacto(v: unknown): 'correo' | 'telefono' | null {
  if (typeof v !== 'string' || !v.trim()) return null
  if (v.includes('@')) return normalizarCorreo(v) ? 'correo' : null
  const d = digitosTelefono(v)
  return d.length >= 7 && d.length <= 15 ? 'telefono' : null
}

/**
 * ¿El correo o el teléfono escrito es el de la compra? Correo sin distinguir mayúsculas; teléfono
 * por sus últimos 10 dígitos (con o sin indicativo: «+57 300 555 1234» = «3005551234»), y nunca
 * con menos de 7 dígitos.
 */
export function contactoCoincide(pedido: { customer_email?: string | null; customer_phone?: string | null }, contacto: unknown): boolean {
  const tipo = tipoContacto(contacto)
  if (tipo === 'correo') {
    const c = normalizarCorreo(contacto)
    const delPedido = normalizarCorreo(pedido.customer_email)
    return !!c && !!delPedido && c === delPedido
  }
  if (tipo === 'telefono') {
    const a = digitosTelefono(contacto).slice(-10)
    const b = digitosTelefono(pedido.customer_phone).slice(-10)
    return a.length >= 7 && a === b
  }
  return false
}

/** Respuesta de la búsqueda sin cuenta: la misma si el pedido no existe o si el contacto no coincide. */
export const NO_ENCONTRADO_SIN_CUENTA =
  'No encontramos un pedido con esos datos. Revisa el número y el correo o teléfono con el que compraste.'

// ─── Mis pedidos ──────────────────────────────────────────────────────────────────────────────

export type GrupoPedido = 'en_curso' | 'anteriores' | 'cancelados'

export const GRUPOS_PEDIDO: readonly { clave: GrupoPedido; texto: string }[] = [
  { clave: 'en_curso', texto: 'En curso' },
  { clave: 'anteriores', texto: 'Anteriores' },
  { clave: 'cancelados', texto: 'Cancelados' },
]

/** Pestaña del pedido: cancelado/rechazado/reembolsado/vencido → Cancelados; entregado → Anteriores. */
export function grupoPedido(status: string | null | undefined): GrupoPedido {
  if (status && ESTADOS_SIN_ENTREGA.has(status)) return 'cancelados'
  if (esEstadoFinal(status)) return 'anteriores'
  return 'en_curso'
}

export function leerGrupo(v: unknown): GrupoPedido {
  return v === 'anteriores' || v === 'cancelados' ? v : 'en_curso'
}

export type AccionPedido = 'seguir' | 'pagar' | 'ver' | 'recomprar' | 'factura' | 'calificar'

export interface EntradaAcciones {
  status: string
  paymentStatus: string | null
  /** El método del pedido es una pasarela (`fn_web_order_metodo_nativo` = false). */
  esPasarela: boolean
  /** Hay factura válida de la venta del pedido. */
  tieneFactura: boolean
  /** Se pudo firmar el enlace de «Volver a comprar» (`rutaRetomar`). */
  puedeRecomprar: boolean
}

/**
 * Botones de cada pedido según su estado (Figma E 2976:72285), en el orden en que se pintan:
 * - falta el pago por pasarela: «Pagar $X» y «Ver pedido»;
 * - en curso: «Seguir pedido»;
 * - entregado: «Volver a comprar», «Factura» (si hay) y «Calificar»;
 * - cancelado, vencido: «Ver pedido».
 * La misma regla de la consulta del pedido (`vistaPedido`), para que la lista y el detalle digan lo mismo.
 */
export function accionesPedido(e: EntradaAcciones): AccionPedido[] {
  const vista = vistaPedido({ status: e.status, paymentStatus: e.paymentStatus, esPasarela: e.esPasarela })
  if (vista === 'pagar' || vista === 'pago_fallido') return ['pagar', 'ver']
  if (vista === 'entregado') {
    const a: AccionPedido[] = []
    if (e.puedeRecomprar) a.push('recomprar')
    if (e.tieneFactura) a.push('factura')
    a.push('calificar')
    return a
  }
  if (vista === 'cancelado' || vista === 'vencido') return ['ver']
  return ['seguir']
}

/** Avance del pedido en curso (Mi cuenta › Inicio): insignia, título y la barra de 4 pasos. */
export interface AvancePedido {
  vista: VistaPedido
  insignia: string
  tono: TonoInsignia
  titulo: string
  pasos: Paso[]
}

export function avancePedido(p: {
  status: string
  paymentStatus: string | null
  esPasarela: boolean
  deliveryType: string | null
  esRestaurante: boolean
  nombre: string | null
  notasInternas?: string | null
}): AvancePedido {
  const vista = vistaPedido({ status: p.status, paymentStatus: p.paymentStatus, esPasarela: p.esPasarela })
  const enc = encabezadoPedido(vista, {
    nombre: p.nombre,
    pagado: p.paymentStatus === 'paid',
    deliveryType: p.deliveryType,
    esRestaurante: p.esRestaurante,
    notasInternas: p.notasInternas,
    status: p.status,
  })
  return { vista, insignia: enc.insignia, tono: enc.tono, titulo: enc.titulo, pasos: pasosPedido(vista, p.deliveryType, p.esRestaurante, p.notasInternas) }
}

/** Pedido en curso que se muestra arriba en Inicio: el más reciente que no ha terminado. */
export function pedidoEnCurso<T extends { status: string; createdAt: string }>(pedidos: readonly T[]): T | null {
  let elegido: T | null = null
  for (const p of pedidos) {
    if (grupoPedido(p.status) !== 'en_curso') continue
    if (!elegido || Date.parse(p.createdAt) > Date.parse(elegido.createdAt)) elegido = p
  }
  return elegido
}

/** Buscar en Mis pedidos por número o por producto (sin distinguir mayúsculas ni tildes). */
export function coincideBusqueda(p: { order_number: string; productos: readonly string[] }, q: string | null | undefined): boolean {
  const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const buscado = limpio(q ?? '')
  if (!buscado) return true
  return limpio(p.order_number).includes(buscado) || p.productos.some((n) => limpio(n).includes(buscado))
}

/** «1 producto», «4 productos». */
export function textoProductos(n: number): string {
  return `${n} ${n === 1 ? 'producto' : 'productos'}`
}

// ─── Mis datos ────────────────────────────────────────────────────────────────────────────────

export type TipoPersona = 'person' | 'company'

/**
 * ¿Están los datos para la factura electrónica? Persona: tipo y número de documento. Empresa:
 * además la razón social. Sin ellos, Inicio muestra «Completa tus datos para la factura».
 */
export function facturaCompleta(c: {
  customer_type?: string | null
  identification_type?: string | null
  identification_number?: string | null
  company_name?: string | null
} | null | undefined): boolean {
  if (!c) return false
  const tieneDoc = !!(c.identification_type || '').trim() && !!(c.identification_number || '').trim()
  if (!tieneDoc) return false
  return c.customer_type === 'company' ? !!(c.company_name || '').trim() : true
}

/** Número de documento sin puntos ni espacios (los de la DIAN son alfanuméricos en pasaporte). */
export function limpiarDocumento(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = String(v).replace(/[\s.]/g, '').toUpperCase()
  return /^[A-Z0-9-]{3,20}$/.test(d) ? d : null
}

/**
 * Preferencias de avisos (Mis datos › Avisos y privacidad) guardadas en `customers.preferences`
 * (no hay columnas propias). Los avisos de pedidos están activos salvo que la persona los apague.
 */
export interface AvisosCuenta {
  whatsapp: boolean
  correo: boolean
}

export function leerAvisos(preferencias: unknown): AvisosCuenta {
  const p = preferencias && typeof preferencias === 'object' ? (preferencias as Record<string, unknown>) : {}
  const a = p.avisos_pedido && typeof p.avisos_pedido === 'object' ? (p.avisos_pedido as Record<string, unknown>) : {}
  return { whatsapp: a.whatsapp !== false, correo: a.correo !== false }
}

/** Fecha en que autorizó el tratamiento de datos (al entrar con el código por primera vez), o null. */
export function fechaAutorizacionDatos(preferencias: unknown): string | null {
  const p = preferencias && typeof preferencias === 'object' ? (preferencias as Record<string, unknown>) : {}
  const a = p.autorizacion_datos && typeof p.autorizacion_datos === 'object' ? (p.autorizacion_datos as Record<string, unknown>) : null
  return a && typeof a.en === 'string' && Number.isFinite(Date.parse(a.en)) ? a.en : null
}

/** Cumpleaños («14 de mayo»): mes y día, sin año. `null` si no es una fecha posible. */
export function leerCumpleanos(v: unknown): { mes: number; dia: number } | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(v.trim())
  if (!m) return null
  const mes = Number(m[1])
  const dia = Number(m[2])
  const dias = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (mes < 1 || mes > 12 || dia < 1 || dia > dias[mes - 1]) return null
  return { mes, dia }
}

/** Contraseña nueva (registro y Mis datos): igual a la confirmación y de 6 caracteres o más. */
export function errorContrasena(datos: { password: string; confirmPassword: string }): string | null {
  if (datos.password !== datos.confirmPassword) return 'Las contraseñas no coinciden'
  if (datos.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
  return null
}

// ─── Direcciones: cobertura del domicilio ─────────────────────────────────────────────────────

/** Lo que se necesita de la cotización pública (`CotizacionPublica` de /api/shipping/quote). */
export interface CoberturaCotizada {
  precio: number | null
  envio_gratis: boolean
  en_zona: boolean
  zona: { es_tarifa_general: boolean } | null
  pedido_minimo: number
}

export type Cobertura = { tipo: 'ok' | 'fuera' | 'sin_zonas'; texto: string }

const pesosCo = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`

/**
 * Aviso de cobertura de una dirección con el MISMO cálculo del checkout (la cotización la hace
 * `logistica_cotizar_envio` en el servidor; aquí solo se dice en palabras). `llegada` es
 * `llegadaZona(...)` de lib/shipping/domicilioZonas.ts. Sin zonas configuradas, el envío se
 * calcula al pagar (tarifa plana o de transportadora), como siempre.
 */
export function textoCobertura(usaZonas: boolean, c: CoberturaCotizada | null, llegada: string | null): Cobertura {
  if (!usaZonas || !c) return { tipo: 'sin_zonas', texto: 'El costo del envío se calcula al pagar.' }
  if (c.precio === null) return { tipo: 'fuera', texto: 'No tenemos domicilio para esta dirección. Puedes recoger en la tienda o usar otra dirección.' }
  const fuera = !c.en_zona || !!c.zona?.es_tarifa_general
  const costo = c.envio_gratis || c.precio === 0 ? 'envío gratis' : pesosCo(c.precio)
  const partes = [fuera ? `Fuera de zona · tarifa general ${costo}` : `Domicilio de la tienda · ${costo}`]
  if (llegada) partes.push(llegada.charAt(0).toLowerCase() + llegada.slice(1))
  if (c.pedido_minimo > 0) partes.push(`pedido mínimo ${pesosCo(c.pedido_minimo)}`)
  return { tipo: 'ok', texto: partes.join(' · ') }
}

// ─── Menú de Mi cuenta ────────────────────────────────────────────────────────────────────────

export type ClaveMenuCuenta =
  | 'inicio' | 'pedidos' | 'direcciones' | 'favoritos' | 'cupones' | 'facturas' | 'datos'
  | 'reservas' | 'citas' | 'cotizaciones' | 'membresia' | 'clases' | 'checkins' | 'tickets'
  | 'pases' | 'vehiculos' | 'historial'

export interface ItemMenuCuenta {
  clave: ClaveMenuCuenta
  texto: string
  href: string
}

const M: Record<ClaveMenuCuenta, ItemMenuCuenta> = {
  inicio: { clave: 'inicio', texto: 'Inicio', href: '/mi-cuenta' },
  pedidos: { clave: 'pedidos', texto: 'Mis pedidos', href: '/mi-cuenta/pedidos' },
  direcciones: { clave: 'direcciones', texto: 'Direcciones', href: '/mi-cuenta/direcciones' },
  favoritos: { clave: 'favoritos', texto: 'Favoritos', href: '/favoritos' },
  cupones: { clave: 'cupones', texto: 'Cupones', href: '/mi-cuenta/cupones' },
  facturas: { clave: 'facturas', texto: 'Facturas', href: '/mi-cuenta/facturas' },
  datos: { clave: 'datos', texto: 'Mis datos', href: '/mi-cuenta/perfil' },
  reservas: { clave: 'reservas', texto: 'Mis reservas', href: '/mi-cuenta/reservas' },
  citas: { clave: 'citas', texto: 'Mis citas', href: '/mi-cuenta/citas' },
  cotizaciones: { clave: 'cotizaciones', texto: 'Cotizaciones', href: '/mi-cuenta/cotizaciones' },
  membresia: { clave: 'membresia', texto: 'Membresía', href: '/mi-cuenta/membresia' },
  clases: { clave: 'clases', texto: 'Mis clases', href: '/mi-cuenta/clases' },
  checkins: { clave: 'checkins', texto: 'Check-ins', href: '/mi-cuenta/checkins' },
  tickets: { clave: 'tickets', texto: 'Mis tickets', href: '/mi-cuenta/tickets' },
  pases: { clave: 'pases', texto: 'Mis pases', href: '/mi-cuenta/pases' },
  vehiculos: { clave: 'vehiculos', texto: 'Vehículos', href: '/mi-cuenta/vehiculos' },
  historial: { clave: 'historial', texto: 'Historial', href: '/mi-cuenta/historial' },
}

/**
 * Menú por tipo de negocio (el mismo reparto de antes, sin emojis). Tiendas y restaurantes: el
 * orden del Figma (Inicio, Mis pedidos, Direcciones, Favoritos, Cupones, Facturas, Mis datos).
 * Las demás verticales conservan sus páginas (reservas, citas, membresía, pases…).
 */
export function menuCuenta(tipoNegocio: number | null | undefined): ItemMenuCuenta[] {
  const porTipo: Record<number, ClaveMenuCuenta[]> = {
    1: ['pedidos', 'reservas', 'direcciones', 'favoritos', 'cupones', 'facturas'],
    2: ['reservas', 'facturas'],
    3: ['pedidos', 'direcciones', 'favoritos', 'cupones', 'facturas'],
    4: ['citas', 'facturas', 'cotizaciones'],
    5: ['membresia', 'clases', 'checkins'],
    6: ['tickets'],
    7: ['pases', 'vehiculos', 'historial'],
  }
  const claves: ClaveMenuCuenta[] = ['inicio', ...(porTipo[tipoNegocio ?? 0] ?? []), 'datos']
  return claves.map((c) => M[c])
}

/** Ítem activo del menú para la ruta actual (el más largo que coincide). */
export function itemActivo(items: readonly ItemMenuCuenta[], ruta: string | null | undefined): ClaveMenuCuenta | null {
  const r = (ruta || '').replace(/\/+$/, '') || '/'
  let mejor: ItemMenuCuenta | null = null
  for (const it of items) {
    const ok = it.href === '/mi-cuenta' ? r === '/mi-cuenta' : r === it.href || r.startsWith(`${it.href}/`)
    if (ok && (!mejor || it.href.length > mejor.href.length)) mejor = it
  }
  return mejor?.clave ?? null
}

/** «AG» de «Ana Gómez»; con solo el correo, su primera letra. */
export function iniciales(nombre: string | null | undefined, correo?: string | null): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return ((correo || '?').trim()[0] || '?').toUpperCase()
}

// ─── Google (opcional por tienda) ─────────────────────────────────────────────────────────────

/**
 * «Continuar con Google» solo si la tienda lo activó: `header_cuenta.google === true` en el
 * documento del sitio. El editor del ERP todavía no tiene el interruptor: hoy está apagado en
 * todas las tiendas. Además del ajuste, el proveedor Google debe estar activo en Supabase y el
 * dominio de la tienda en «Redirect URLs».
 */
export function googleEnAcceso(ajustes: unknown): boolean {
  const a = ajustes && typeof ajustes === 'object' ? (ajustes as Record<string, unknown>) : {}
  const c = a.header_cuenta && typeof a.header_cuenta === 'object' ? (a.header_cuenta as Record<string, unknown>) : null
  return c?.google === true
}

/** Destino seguro después de entrar: solo rutas internas del sitio (nunca otra página). */
export function destinoInterno(v: unknown, porDefecto = '/mi-cuenta'): string {
  if (typeof v !== 'string') return porDefecto
  const r = v.trim()
  if (!r.startsWith('/') || r.startsWith('//') || r.startsWith('/\\') || r.includes('://')) return porDefecto
  return r.slice(0, 300)
}
