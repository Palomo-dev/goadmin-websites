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

/**
 * Desde el 2026-11-24 el código es de la tienda, no de Supabase: lo genera y lo guarda (solo su
 * hash) lib/cuenta/codigoTienda.ts en `web_customer_login_codes`, y lo envía la tienda con Resend y
 * su marca (lib/email/send-codigo-acceso.ts). Regla del dueño: el comprador nunca recibe correos
 * de Supabase Auth ni de la plataforma.
 */
/** Largo del código. */
export const LARGO_CODIGO = 6
/** Segundos antes de poder pedir otro código (la tabla de códigos lo hace cumplir). */
export const ESPERA_REENVIO_S = 60
/** Minutos que dura el código (lo que dice la pantalla y el correo). */
export const MINUTOS_VIGENCIA_CODIGO = 10
/** Intentos con un mismo código antes de tener que pedir otro. */
export const MAX_INTENTOS_CODIGO = 5
/** Códigos por correo y tienda en la ventana de `VENTANA_CODIGOS_MIN` (todos los propósitos). */
export const MAX_CODIGOS_VENTANA = 5
export const VENTANA_CODIGOS_MIN = 10

/** Para qué es el código: entrar, confirmar el correo al crear la cuenta o cambiar la contraseña. */
export type PropositoCodigo = 'login' | 'verify' | 'reset'

export function propositoCodigo(v: unknown): PropositoCodigo {
  return v === 'verify' || v === 'reset' ? v : 'login'
}

/** Resultado de comprobar un código escrito contra el guardado. */
export type ResultadoCodigo = 'ok' | 'vencido' | 'no_coincide' | 'intentos'

/**
 * Antes de comparar: sin código vigente (no hay, se usó o venció) → `vencido`; con los intentos
 * agotados → `intentos`; si no, `probar`.
 */
export function estadoAntesDeProbar(
  fila: { expires_at: string | null; attempts: number | null; used_at?: string | null } | null | undefined,
  ahoraMs: number,
): 'vencido' | 'intentos' | 'probar' {
  if (!fila || fila.used_at) return 'vencido'
  const vence = fila.expires_at ? Date.parse(fila.expires_at) : NaN
  if (!Number.isFinite(vence) || vence <= ahoraMs) return 'vencido'
  if ((fila.attempts ?? 0) >= MAX_INTENTOS_CODIGO) return 'intentos'
  return 'probar'
}

/**
 * ¿Se puede enviar otro código? `espera` si el último salió hace menos de `ESPERA_REENVIO_S`;
 * `limite` si ya van `MAX_CODIGOS_VENTANA` en la ventana. `creados` = fechas de los recientes.
 */
export function puedeEnviarCodigo(creados: (string | null | undefined)[], ahoraMs: number): 'ok' | 'espera' | 'limite' {
  const tiempos = creados.map((c) => (c ? Date.parse(c) : NaN)).filter((t) => Number.isFinite(t))
  const enVentana = tiempos.filter((t) => ahoraMs - t < VENTANA_CODIGOS_MIN * 60_000)
  if (enVentana.length >= MAX_CODIGOS_VENTANA) return 'limite'
  if (tiempos.some((t) => ahoraMs - t < ESPERA_REENVIO_S * 1000)) return 'espera'
  return 'ok'
}

/** Mensaje para el comprador según el resultado. Nunca dice si el correo tiene cuenta. */
export function mensajeResultadoCodigo(r: Exclude<ResultadoCodigo, 'ok'>): string {
  if (r === 'vencido') return 'El código venció o ya se usó. Pide uno nuevo.'
  if (r === 'intentos') return 'Hiciste muchos intentos con este código. Pide uno nuevo.'
  return 'El código no coincide. Revísalo o pide uno nuevo.'
}

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
 * Mensaje para el cliente según un error de verificación con forma de error de Supabase. Nunca
 * dice si el correo tiene cuenta: solo si el código venció o no coincide.
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
 * ¿El correo de la sesión está verificado? Lo está si entró con el código de la tienda (la sesión
 * se abre con el correo ya confirmado) o si confirmó el correo al registrarse. Solo así se le muestran los pedidos hechos sin cuenta con
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
  | 'pases' | 'vehiculos' | 'historial' | 'factura'

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
  // Acceso propio (decisión del dueño, 2026-11-24): la sección de factura de Mis datos. No va en
  // `menuCuenta` (no es una página aparte), solo en los grupos de Mi cuenta V2.
  factura: { clave: 'factura', texto: 'Datos de factura', href: '/mi-cuenta/perfil#factura' },
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

// ─── Mi cuenta V2 y menú del avatar (Figma «16 Sitio web» 3044:78726, aprobado 2026-11-24) ─────

/** Nombre completo de la ficha `customers` de la organización; `null` si no tiene. */
export function nombreDeFicha(ficha: { first_name?: string | null; last_name?: string | null } | null | undefined): string | null {
  const n = [ficha?.first_name, ficha?.last_name].map((x) => (x || '').trim()).filter(Boolean).join(' ')
  return n || null
}

export interface IdentidadCuenta {
  /** Nombre de la ficha de la organización (no de la sesión); null si no tiene. */
  nombre: string | null
  /** Lo que se pinta como título: el nombre o, sin nombre, el correo. */
  titulo: string
  /** Iniciales del avatar; sin nombre, la inicial del correo. */
  iniciales: string
  correo: string | null
}

/**
 * Quién es (cabecera de Mi cuenta y menú del avatar). Quien entra solo con el código deja la ficha
 * sin nombre: entonces el título es el correo, el avatar lleva su inicial y aparece «Agrega tu nombre».
 */
export function identidadCuenta(ficha: { first_name?: string | null; last_name?: string | null } | null | undefined, correo: string | null | undefined): IdentidadCuenta {
  const nombre = nombreDeFicha(ficha)
  const c = (correo || '').trim() || null
  return { nombre, titulo: nombre ?? c ?? 'Mi cuenta', iniciales: iniciales(nombre, c), correo: c }
}

/** «Cliente desde marzo de 2026» (fecha de la ficha, en la zona de la tienda). */
export function textoClienteDesde(creadoEn: string | null | undefined, zona?: string | null): string | null {
  const t = creadoEn ? Date.parse(creadoEn) : NaN
  if (!Number.isFinite(t)) return null
  try {
    const f = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: zona || 'America/Bogota' }).format(new Date(t))
    return `Cliente desde ${f}`
  } catch {
    return null
  }
}

/** «12 nov» (día y mes corto, sin punto), en la zona de la tienda. */
export function fechaCortaCuenta(v: string | null | undefined, zona?: string | null): string | null {
  const t = v ? Date.parse(v) : NaN
  if (!Number.isFinite(t)) return null
  try {
    const partes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: zona || 'America/Bogota' }).formatToParts(new Date(t))
    const dia = partes.find((p) => p.type === 'day')?.value
    const mes = partes.find((p) => p.type === 'month')?.value.replace(/\./g, '').trim()
    return dia && mes ? `${dia} ${mes}` : null
  } catch {
    return null
  }
}

// «Completa tu cuenta 1 de 3»: calculado, sin columnas.

export type ClavePasoCuenta = 'correo' | 'nombre' | 'factura'

export interface PasoCuenta {
  clave: ClavePasoCuenta
  texto: string
  hecho: boolean
  /** A dónde lleva la fila (el correo confirmado no lleva a ningún lado). */
  href: string | null
}

/** Los tres pasos de una cuenta completa: correo confirmado, nombre y celular, datos de factura. */
export function pasosCuenta(e: {
  verificado: boolean
  ficha: {
    first_name?: string | null
    phone?: string | null
    customer_type?: string | null
    identification_type?: string | null
    identification_number?: string | null
    company_name?: string | null
  } | null | undefined
}): PasoCuenta[] {
  const tieneNombre = !!(e.ficha?.first_name || '').trim()
  const tieneCelular = digitosTelefono(e.ficha?.phone).length >= 7
  return [
    { clave: 'correo', texto: 'Correo confirmado', hecho: e.verificado, href: null },
    { clave: 'nombre', texto: 'Tu nombre y celular', hecho: tieneNombre && tieneCelular, href: '/mi-cuenta/perfil' },
    { clave: 'factura', texto: 'Datos para la factura', hecho: facturaCompleta(e.ficha), href: '/mi-cuenta/perfil#factura' },
  ]
}

/**
 * Qué aviso lleva Inicio: la lista «Completa tu cuenta» (pantalla 2) si falta el correo o el
 * nombre; solo la tarjeta «Faltan tus datos de factura» (pantalla 1) si es lo único que falta;
 * nada con la cuenta completa.
 */
export function avisoCompletarCuenta(pasos: readonly PasoCuenta[]): 'lista' | 'factura' | null {
  const faltan = pasos.filter((p) => !p.hecho).map((p) => p.clave)
  if (faltan.length === 0) return null
  if (faltan.length === 1 && faltan[0] === 'factura') return 'factura'
  return 'lista'
}

// Grupos del menú (Compras · Mi información · Ayuda).

export interface GrupoMenuCuenta {
  clave: 'actividad' | 'informacion'
  titulo: string
  items: ItemMenuCuenta[]
}

const TITULO_ACTIVIDAD: Record<number, string> = { 1: 'Compras', 2: 'Reservas', 3: 'Compras', 4: 'Servicios', 5: 'Gimnasio', 6: 'Viajes', 7: 'Parqueadero' }
const CLAVES_INFORMACION: readonly ClaveMenuCuenta[] = ['datos', 'direcciones', 'factura']

/**
 * Los accesos de Mi cuenta en grupos: lo del negocio (Compras: Mis pedidos, Favoritos, Cupones,
 * Facturas; o reservas, citas, membresía, pases… según el tipo) y Mi información (Mis datos,
 * Direcciones si el negocio las usa, y Datos de factura como acceso propio). Ayuda (WhatsApp y
 * políticas) la arma la página con lo que la tienda tenga. Nada se pierde respecto a `menuCuenta`.
 */
export function gruposMenuCuenta(tipoNegocio: number | null | undefined): GrupoMenuCuenta[] {
  const items = menuCuenta(tipoNegocio).filter((i) => i.clave !== 'inicio')
  // Tiendas: el orden del Figma (Mis pedidos, Favoritos, Cupones, Facturas).
  const orden: ClaveMenuCuenta[] = ['pedidos', 'reservas', 'favoritos', 'cupones', 'facturas']
  const posicion = (c: ClaveMenuCuenta) => {
    const i = orden.indexOf(c)
    return i < 0 ? 99 : i
  }
  const actividad = items.filter((i) => !CLAVES_INFORMACION.includes(i.clave))
  if (vendeConPedidos(tipoNegocio)) actividad.sort((a, b) => posicion(a.clave) - posicion(b.clave))
  const informacion = CLAVES_INFORMACION.filter((c) => c === 'factura' || items.some((i) => i.clave === c)).map((c) => M[c])
  const grupos: GrupoMenuCuenta[] = []
  if (actividad.length > 0) grupos.push({ clave: 'actividad', titulo: TITULO_ACTIVIDAD[tipoNegocio ?? 0] ?? 'Tu actividad', items: actividad })
  grupos.push({ clave: 'informacion', titulo: 'Mi información', items: informacion })
  return grupos
}

/** ¿El negocio vende con pedidos web? (tiendas y restaurantes: «Seguir un pedido», pedido en curso). */
export function vendeConPedidos(tipoNegocio: number | null | undefined): boolean {
  return tipoNegocio === 1 || tipoNegocio === 3
}

/**
 * Accesos del menú del avatar (pantallas 5 y 6): en tiendas, Mis pedidos, Favoritos, Mis datos,
 * Direcciones, Cupones y Facturas; en las demás verticales, sus secciones y Mis datos.
 */
export function itemsMenuAvatar(tipoNegocio: number | null | undefined): ItemMenuCuenta[] {
  const items = menuCuenta(tipoNegocio).filter((i) => i.clave !== 'inicio')
  if (vendeConPedidos(tipoNegocio)) {
    const orden: ClaveMenuCuenta[] = ['pedidos', 'favoritos', 'datos', 'direcciones', 'cupones', 'facturas']
    return orden.map((c) => items.find((i) => i.clave === c)).filter((i): i is ItemMenuCuenta => !!i)
  }
  return items
}

/** Cifras de la cuenta (todas calculadas, sin columnas nuevas). */
export interface CifrasCuenta {
  pedidos: number
  enCurso: number
  ultimoPedidoEn: string | null
  favoritos: number
  cupones: number
  cuponVenceEnDias: number | null
  direcciones: number
  /** Nombre de la dirección principal («Casa»). */
  principal: string | null
  /** Facturas válidas de las ventas de sus pedidos. */
  facturas: number
  /** Cifras de las demás verticales (reservas, citas, pases…), si las hay. */
  otras?: Partial<Record<ClaveMenuCuenta, number>>
}

export interface DatosFilaCuenta {
  nombre: string | null
  telefono: string | null
  facturaCompleta: boolean
  zona?: string | null
}

export interface DetalleAcceso {
  /** Línea pequeña debajo del nombre: una cifra que dice algo o, en cero, una invitación. */
  detalle: string
  /** Número a la derecha (null en cero: en vez de «0», la invitación). */
  cifra: string | null
  /** Insignia «Faltan datos». */
  aviso: string | null
}

const DETALLE_VERTICAL: Partial<Record<ClaveMenuCuenta, string>> = {
  reservas: 'Tus reservas y su estado',
  citas: 'Tus citas próximas y pasadas',
  cotizaciones: 'Las que te enviamos',
  membresia: 'Tu plan y su vigencia',
  clases: 'Reserva y revisa tus clases',
  checkins: 'Tus visitas registradas',
  tickets: 'Tus tiquetes',
  pases: 'Tus pases',
  vehiculos: 'Los que registraste',
  historial: 'Tus sesiones anteriores',
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

function positivo(v: number | null | undefined): number {
  return typeof v === 'number' && v > 0 ? v : 0
}

/** Fila de Mi cuenta (celular y menú lateral): «1 en curso · el último, 12 nov», «Faltan datos»… */
export function detalleAcceso(clave: ClaveMenuCuenta, c: Partial<CifrasCuenta> | null | undefined, d: DatosFilaCuenta): DetalleAcceso {
  const cifra = (v: number) => (v > 0 ? String(v) : null)
  if (clave === 'pedidos') {
    const total = positivo(c?.pedidos)
    if (!total) return { detalle: 'Aquí verás tus compras', cifra: null, aviso: null }
    const partes: string[] = []
    const enCurso = positivo(c?.enCurso)
    if (enCurso) partes.push(`${enCurso} en curso`)
    const ultimo = fechaCortaCuenta(c?.ultimoPedidoEn, d.zona)
    if (ultimo) partes.push(`el último, ${ultimo}`)
    return { detalle: partes.join(' · ') || plural(total, 'pedido', 'pedidos'), cifra: cifra(total), aviso: null }
  }
  if (clave === 'favoritos') {
    const total = positivo(c?.favoritos)
    return total
      ? { detalle: 'Lo que guardaste para después', cifra: cifra(total), aviso: null }
      : { detalle: 'Toca el corazón para guardar productos', cifra: null, aviso: null }
  }
  if (clave === 'cupones') {
    const total = positivo(c?.cupones)
    if (!total) return { detalle: 'Sin cupones por ahora', cifra: null, aviso: null }
    const vence = typeof c?.cuponVenceEnDias === 'number' ? c.cuponVenceEnDias : null
    const texto = vence === null ? plural(total, 'disponible', 'disponibles') : vence === 0 ? '1 vence hoy' : `1 vence en ${plural(vence, 'día', 'días')}`
    return { detalle: texto, cifra: cifra(total), aviso: null }
  }
  if (clave === 'facturas') {
    const total = positivo(c?.facturas)
    return total
      ? { detalle: 'De tus compras entregadas', cifra: cifra(total), aviso: null }
      : { detalle: 'Aparecen cuando compras', cifra: null, aviso: null }
  }
  if (clave === 'datos') {
    if (!d.nombre) return { detalle: 'Agrega tu nombre y celular', cifra: null, aviso: null }
    const partes = [d.nombre, d.telefono].map((x) => (x || '').trim()).filter(Boolean)
    return { detalle: partes.join(' · '), cifra: null, aviso: null }
  }
  if (clave === 'direcciones') {
    const total = positivo(c?.direcciones)
    if (!total) return { detalle: 'Agrega una para pagar más rápido', cifra: null, aviso: null }
    return { detalle: c?.principal ? `${c.principal} es la principal` : plural(total, 'guardada', 'guardadas'), cifra: cifra(total), aviso: null }
  }
  if (clave === 'factura') return { detalle: 'Para tu factura electrónica', cifra: null, aviso: d.facturaCompleta ? null : 'Faltan datos' }
  return { detalle: DETALLE_VERTICAL[clave] ?? '', cifra: cifra(positivo(c?.otras?.[clave])), aviso: null }
}

/** Línea corta de los mosaicos de la hoja del celular (pantalla 6): «12 · 1 en curso», «6 productos»… */
export function detalleMosaico(clave: ClaveMenuCuenta, c: Partial<CifrasCuenta> | null | undefined, d: Pick<DatosFilaCuenta, 'facturaCompleta'>): { texto: string; aviso: boolean } {
  if (clave === 'pedidos') {
    const total = positivo(c?.pedidos)
    const enCurso = positivo(c?.enCurso)
    return { texto: !total ? 'Aún no hay' : enCurso ? `${total} · ${enCurso} en curso` : String(total), aviso: false }
  }
  if (clave === 'favoritos') return { texto: positivo(c?.favoritos) ? textoProductos(positivo(c?.favoritos)) : 'Guarda lo que te gusta', aviso: false }
  if (clave === 'datos') return d.facturaCompleta ? { texto: 'Nombre y celular', aviso: false } : { texto: 'Faltan datos', aviso: true }
  if (clave === 'direcciones') return { texto: positivo(c?.direcciones) ? plural(positivo(c?.direcciones), 'guardada', 'guardadas') : 'Agrega una', aviso: false }
  if (clave === 'cupones') return { texto: positivo(c?.cupones) ? plural(positivo(c?.cupones), 'disponible', 'disponibles') : 'Sin cupones', aviso: false }
  if (clave === 'facturas') return { texto: positivo(c?.facturas) ? String(positivo(c?.facturas)) : 'Aún no hay', aviso: false }
  const v = positivo(c?.otras?.[clave])
  return { texto: v ? String(v) : DETALLE_VERTICAL[clave] ?? '', aviso: false }
}

/** Páginas legales en orden de preferencia para «Políticas de la tienda» (envíos y devoluciones primero). */
const PREFERENCIA_POLITICAS = ['envios', 'politica-de-envios', 'politica-envios', 'cambios-y-devoluciones', 'devoluciones', 'terminos', 'terminos-y-condiciones']
const ES_LEGAL = /^(terminos|privacidad|tratamiento-de-datos|envios|cambios-y-devoluciones|devoluciones|cookies|politica-)/

export interface PaginaNavCuenta {
  slug?: string | null
  page_type?: string | null
  is_external?: boolean | null
  children?: PaginaNavCuenta[] | null
}

/**
 * Enlace a las políticas de la tienda (Ayuda): la primera página legal del pie. Sin páginas
 * legales, null y la fila no se pinta.
 */
export function enlacePoliticas(paginas: readonly PaginaNavCuenta[] | null | undefined): string | null {
  const todas: PaginaNavCuenta[] = []
  const recorrer = (lista: readonly PaginaNavCuenta[] | null | undefined) => {
    for (const p of lista ?? []) {
      todas.push(p)
      recorrer(p.children)
    }
  }
  recorrer(paginas)
  const slugDe = (p: PaginaNavCuenta) => (p.slug || '').replace(/^\/+/, '').trim()
  const legales = todas.filter((p) => {
    const slug = slugDe(p)
    return !p.is_external && !!slug && !slug.includes('://') && (p.page_type === 'legal' || p.page_type === 'policy' || ES_LEGAL.test(slug))
  })
  if (legales.length === 0) return null
  const posicion = (p: PaginaNavCuenta) => {
    const i = PREFERENCIA_POLITICAS.indexOf(slugDe(p))
    return i < 0 ? 99 : i
  }
  legales.sort((a, b) => posicion(a) - posicion(b))
  return `/${slugDe(legales[0])}`
}

export interface FilaMenuCuenta extends DetalleAcceso {
  clave: ClaveMenuCuenta
  texto: string
  href: string
}

export interface GrupoFilasCuenta {
  clave: GrupoMenuCuenta['clave']
  titulo: string
  filas: FilaMenuCuenta[]
}

/** Grupos con su detalle, cifra y aviso, listos para pintar (Inicio, celular y menú lateral). */
export function filasMenuCuenta(tipoNegocio: number | null | undefined, c: Partial<CifrasCuenta> | null | undefined, d: DatosFilaCuenta): GrupoFilasCuenta[] {
  return gruposMenuCuenta(tipoNegocio).map((g) => ({
    clave: g.clave,
    titulo: g.titulo,
    filas: g.items.map((it) => ({ clave: it.clave, texto: it.texto, href: it.href, ...detalleAcceso(it.clave, c, d) })),
  }))
}
