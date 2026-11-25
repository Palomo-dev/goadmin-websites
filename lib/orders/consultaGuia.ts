/**
 * Consulta por número de guía (Figma «16 Sitio web» › Consulta por número de guía, sección
 * 3240:97997; G1–G3 computador, M1–M4 celular, lámina G4; aprobado por el dueño el 2026-11-25).
 *
 * Puro y sin dependencias de servidor: lo usan la página /consultar-pedido (servidor), la pantalla
 * `SeguirPedido` (cliente) y scripts/verify-consulta-guia.mjs.
 *
 * Qué se ve SOLO con la guía (la ve cualquiera que vea la caja: va pegada por fuera):
 * - el estado en palabras y su historial con horas reales, en la zona horaria de la tienda;
 * - el destino: solo ciudad y departamento (nunca la dirección, el barrio ni las indicaciones);
 * - quién lo lleva: el NOMBRE DE PILA del domiciliario, o la transportadora con su guía y enlace;
 * - cuándo llega, los paquetes y «Pagas al recibir» SIN el monto;
 * - entregado: fecha y hora, sin quién lo recibió, sin foto ni firma.
 * Nunca: dirección, nombre ni teléfono del comprador, teléfono del domiciliario, placa, código de
 * entrega, montos ni el número interno «TRK…» (se acepta para buscar, por compatibilidad, pero no se
 * muestra). Los textos del historial salen de una lista fija en código por estado canónico; la
 * `description` interna de `transport_events` no se lee.
 */

import { MOTIVO_NOVEDAD } from './rastreoPublico'

/** Respaldo de la zona horaria (regla 6 de docs/reglas-fechas-timezone.md del ERP): solo si la sede y la organización no tienen una. */
export const ZONA_RESPALDO = 'America/Bogota'

// ─── Lo que escribe la persona ───────────────────────────────────────────────────────────────

export interface GuiaNormalizada {
  /** Mayúsculas, sin espacios ni «#»: así se guardan `shipment_number` y casi todas las guías. */
  compacta: string
  /** Mayúsculas con los espacios de la persona reducidos a uno («7012 4455 9981»), o null si no tenía. */
  conEspacios: string | null
}

/**
 * Normaliza lo que se escribió en «Número de guía». Solo letras, números, guiones y espacios: con
 * eso caben `DEL-WO-…` (hasta 27 caracteres), las guías de las transportadoras y el TRK viejo, y
 * nada más llega a la consulta.
 */
export function normalizarGuia(v: unknown): GuiaNormalizada | null {
  if (typeof v !== 'string') return null
  const limpia = v.trim().replace(/^#/, '').toUpperCase().replace(/\s+/g, ' ')
  if (!/^[A-Z0-9][A-Z0-9 -]{3,79}$/.test(limpia)) return null
  const compacta = limpia.replace(/ /g, '')
  if (compacta.length < 4 || compacta.length > 60) return null
  return { compacta, conEspacios: limpia.includes(' ') ? limpia : null }
}

/**
 * ¿Tiene forma de número de pedido (WO-…, EG-… sin «DEL-»)? Los números de pedido son dos letras,
 * guion y el resto; la guía de la tienda es «DEL-» + el número de pedido.
 */
export function pareceNumeroPedido(v: unknown): string | null {
  const g = normalizarGuia(v)
  if (!g) return null
  return /^[A-Z]{2}-[A-Z0-9][A-Z0-9-]{2,}$/.test(g.compacta) ? g.compacta : null
}

/** ¿Es el número interno «TRK…» que la tienda generaba antes? Nunca se muestra. */
export function esTrkInterno(v: unknown): boolean {
  return typeof v === 'string' && /^TRK/i.test(v.trim())
}

// ─── Lo que llega de la base (columnas verificadas el 2026-11-25) ────────────────────────────

export interface FilaEnvioGuia {
  shipment_number: string | null
  tracking_number: string | null
  status: string | null
  fulfillment_mode: string | null
  delivery_city: string | null
  delivery_department: string | null
  package_count: number | null
  weight_kg: number | string | null
  cod_status: string | null
  external_tracking_url: string | null
  expected_delivery_date: string | null
  picked_at: string | null
  dispatched_at: string | null
  delivered_at: string | null
  assigned_at: string | null
  created_at: string | null
  source_type: string | null
}

export interface EventoEnvioGuia {
  canonical_status: string | null
  event_type: string | null
  event_time: string | null
  location_text: string | null
  reason_code: string | null
}

export interface PedidoEnvioGuia {
  created_at: string | null
  confirmed_at: string | null
  estimated_delivery_at: string | null
  payment_status: string | null
}

export interface DatosGuia {
  envio: FilaEnvioGuia
  eventos: EventoEnvioGuia[]
  pedido: PedidoEnvioGuia | null
  /** `driver_credentials.full_name`: aquí solo se usa el nombre de pila. */
  domiciliarioNombreCompleto: string | null
  transportadora: { nombre: string | null; plantillaUrl: string | null } | null
  /** Zona IANA de la sede del envío → la de la organización → ZONA_RESPALDO. */
  zona: string
  /** Con qué columna se encontró: el número de la tienda o `tracking_number`. */
  encontradoPor: 'numero' | 'guia'
}

// ─── Lo que ve el comprador ──────────────────────────────────────────────────────────────────

export type EstadoGuia = 'preparando' | 'en_camino' | 'novedad' | 'entregado' | 'devuelto' | 'cancelado'

export interface PasoGuia {
  titulo: string
  detalle: string | null
  estado: 'hecho' | 'actual' | 'pendiente'
}

export interface EventoGuiaVista {
  texto: string
  detalle: string
}

export type QuienLoLleva =
  | { tipo: 'domiciliario'; nombre: string }
  | { tipo: 'transportadora'; nombre: string; guia: string | null; enlace: string | null }
  | { tipo: 'tienda' }

export interface VistaGuia {
  /** `shipment_number` (DEL-…): lo único que se muestra como «Guía» de la tienda. */
  numeroGuia: string
  subtitulo: string
  estado: EstadoGuia
  chip: string
  titulo: string
  aviso: { tono: 'info' | 'exito' | 'alerta' | 'neutro'; titulo: string; detalle: string } | null
  /** Vacío si el envío se canceló o volvió a la tienda. */
  pasos: PasoGuia[]
  resumen: string
  quien: QuienLoLleva
  estimado: { titulo: string; detalle: string } | null
  destino: string | null
  paquetes: string | null
  pago: 'al_recibir' | 'pagado' | null
  historial: EventoGuiaVista[]
  ultimoMovimiento: string | null
  /** Número del pedido web (la guía sin «DEL-») para «Ver mi pedido completo»; null si no es web. */
  numeroPedido: string | null
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

const MODOS_TRANSPORTADORA = new Set(['national_carrier', 'last_mile', 'marketplace'])
const EN_CAMINO = new Set(['picked', 'dispatched', 'in_transit', 'out_for_delivery'])
const NOVEDAD = new Set(['failed_attempt', 'failed'])
const CANONICOS = new Set([
  'created', 'ready_for_pickup', 'assigned', 'picked', 'in_transit', 'out_for_delivery',
  'failed_attempt', 'delivered', 'exception', 'returned', 'cancelled',
])

/** Estado del envío → lo que ve el comprador. */
export function estadoGuia(status: string | null): EstadoGuia {
  if (status === 'delivered') return 'entregado'
  if (status === 'returned') return 'devuelto'
  if (status === 'cancelled') return 'cancelado'
  if (status && NOVEDAD.has(status)) return 'novedad'
  if (status && EN_CAMINO.has(status)) return 'en_camino'
  return 'preparando'
}

export const CHIP_GUIA: Record<EstadoGuia, string> = {
  preparando: 'Preparando',
  en_camino: 'En camino',
  novedad: 'No se pudo entregar',
  entregado: 'Entregado',
  devuelto: 'Devuelto',
  cancelado: 'Cancelado',
}

/** Solo el nombre de pila: «Carlos Andrés Pérez» → «Carlos». */
export function nombreDePila(v: unknown): string | null {
  const t = texto(v)
  if (!t) return null
  const primero = t.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '')
  if (!primero) return null
  const corto = primero.slice(0, 20)
  return corto.charAt(0).toLocaleUpperCase('es-CO') + corto.slice(1).toLocaleLowerCase('es-CO')
}

/** Solo http(s): la URL viene de la base, pero nunca se pinta un `javascript:` ni un enlace roto. */
export function enlaceSeguro(v: unknown): string | null {
  const t = texto(v)
  if (!t) return null
  try {
    const u = new URL(t)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Enlace de la transportadora: el del envío, o la plantilla de la transportadora con la guía. */
export function enlaceTransportadora(externo: unknown, plantilla: unknown, guia: string | null): string | null {
  const directo = enlaceSeguro(externo)
  if (directo) return directo
  const p = texto(plantilla)
  if (!p || !guia) return null
  if (!/\{(tracking_number|tracking|guia)\}/.test(p)) return null
  return enlaceSeguro(p.replace(/\{(tracking_number|tracking|guia)\}/g, encodeURIComponent(guia)))
}

// ─── Fechas en la zona de la tienda ──────────────────────────────────────────────────────────

const formateadores = new Map<string, Intl.DateTimeFormat>()
function formateador(clave: string, zona: string, opciones: Intl.DateTimeFormatOptions, idioma = 'es-CO'): Intl.DateTimeFormat {
  const k = `${clave}|${zona}`
  let f = formateadores.get(k)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: zona })
    } catch {
      // Zona inválida guardada en la base: la de respaldo.
      f = new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: ZONA_RESPALDO })
    }
    formateadores.set(k, f)
  }
  return f
}

function instante(v: unknown): Date | null {
  const t = texto(v)
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Día calendario (YYYY-MM-DD) de un instante en la zona. */
export function diaEnZona(d: Date, zona: string): string {
  return formateador('dia', zona, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA').format(d)
}

function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** «9:48 p. m.» en la zona. */
export function horaEnZona(d: Date, zona: string): string {
  return formateador('hora', zona, { hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(/\s+/g, ' ')
}

/** «24 nov» de un día calendario (sin convertir zona: ya es un día). */
function diaCorto(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  return formateador('diaCorto', 'UTC', { day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d))).replace('.', '')
}

/** «miércoles 26 de noviembre» de un día calendario. */
function diaLargo(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  return formateador('diaLargo', 'UTC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d))).replace(',', '')
}

/** «Hoy 9:48 p. m.», «Ayer 9:48 p. m.» o «24 nov, 9:48 p. m.», en la zona de la tienda. */
export function cuandoEnZona(v: unknown, zona: string, ahora: Date): string | null {
  const d = instante(v)
  if (!d) return null
  const dia = diaEnZona(d, zona)
  const hoy = diaEnZona(ahora, zona)
  const hora = horaEnZona(d, zona)
  if (dia === hoy) return `Hoy ${hora}`
  if (dia === sumarDias(hoy, -1)) return `Ayer ${hora}`
  return `${diaCorto(dia)}, ${hora}`
}

/** «hoy a las 11:02 p. m.» / «el 24 nov a las 11:02 p. m.». */
function cuandoFrase(d: Date, zona: string, ahora: Date): string {
  const dia = diaEnZona(d, zona)
  const hoy = diaEnZona(ahora, zona)
  const hora = horaEnZona(d, zona)
  if (dia === hoy) return `hoy a las ${hora}`
  if (dia === sumarDias(hoy, -1)) return `ayer a las ${hora}`
  return `el ${diaCorto(dia)} a las ${hora}`
}

/**
 * Cuándo llega: la hora estimada del pedido (domicilio propio, timestamptz) o el día estimado
 * (transportadora, `date`: se compara como día calendario, sin convertir zona). Solo hacia
 * adelante: una estimación ya vencida no se muestra.
 */
export function estimadoGuia(
  horaEstimada: unknown,
  diaEstimado: unknown,
  zona: string,
  ahora: Date,
): { titulo: string; corto: string } | null {
  const hoy = diaEnZona(ahora, zona)
  const d = instante(horaEstimada)
  if (d && d.getTime() > ahora.getTime()) {
    const dia = diaEnZona(d, zona)
    const hora = horaEnZona(d, zona)
    if (dia === hoy) return { titulo: `Llega hoy hacia las ${hora}`, corto: `Hoy hacia ${hora}` }
    if (dia === sumarDias(hoy, 1)) return { titulo: `Llega mañana hacia las ${hora}`, corto: `Mañana hacia ${hora}` }
    return { titulo: `Llega el ${diaLargo(dia)} hacia las ${hora}`, corto: `${diaCorto(dia)}, ${hora}` }
  }
  const t = texto(diaEstimado)
  const dia = t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null
  if (dia && dia >= hoy) {
    if (dia === hoy) return { titulo: 'Llega hoy', corto: 'Llega hoy' }
    if (dia === sumarDias(hoy, 1)) return { titulo: `Llega mañana, ${diaLargo(dia)}`, corto: `Llega mañana, ${diaCorto(dia)}` }
    return { titulo: `Llega el ${diaLargo(dia)}`, corto: `Llega el ${diaCorto(dia)}` }
  }
  return null
}

// ─── Historial: lista fija estado canónico → texto del comprador ─────────────────────────────

/**
 * Texto del comprador por estado canónico (los mismos de Logística en el ERP). `quien` es el
 * nombre de pila del domiciliario o el de la transportadora; null si no se sabe.
 */
export function textoEvento(estado: string, propio: boolean, quien: string | null): string {
  switch (estado) {
    case 'created': return 'Estamos preparando tu pedido'
    case 'ready_for_pickup': return 'Tu pedido está listo y empacado'
    case 'assigned':
      if (propio) return quien ? `Tu pedido ya tiene domiciliario: ${quien}` : 'Tu pedido ya tiene domiciliario'
      return quien ? `Tu pedido se asignó a ${quien}` : 'Tu pedido se asignó a la transportadora'
    case 'picked':
      if (propio) return quien ? `${quien} recogió tu pedido` : 'El domiciliario recogió tu pedido'
      return quien ? `Entregado a ${quien}` : 'Entregado a la transportadora'
    case 'in_transit': return propio ? 'Tu pedido va en camino' : 'En tránsito'
    case 'out_for_delivery':
      if (propio) return quien ? `${quien} va en camino a tu dirección` : 'Tu pedido va en camino a tu dirección'
      return 'Salió a entregarse en tu dirección'
    case 'failed_attempt': return 'No pudimos entregar tu pedido'
    case 'delivered': return 'Entregado'
    case 'exception': return 'Hay una novedad con tu envío'
    case 'returned': return 'Tu pedido volvió a la tienda'
    case 'cancelled': return 'El envío se canceló'
    default: return 'Tu envío se actualizó'
  }
}

function estadoDeEvento(e: EventoEnvioGuia): string | null {
  const c = texto(e.canonical_status)
  if (c && CANONICOS.has(c)) return c
  const t = texto(e.event_type)
  return t && CANONICOS.has(t) ? t : null
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

// ─── La vista ────────────────────────────────────────────────────────────────────────────────

/** Arma lo que ve el comprador. Todo lo que no está en `VistaGuia` no sale del servidor. */
export function vistaGuiaPublica(datos: DatosGuia, ahora: Date = new Date()): VistaGuia {
  const { envio, pedido, zona } = datos
  const estado = estadoGuia(envio.status)
  const propio = !MODOS_TRANSPORTADORA.has(envio.fulfillment_mode ?? '')
  const numeroGuia = texto(envio.shipment_number) ?? 'Sin número'
  const domiciliario = propio ? nombreDePila(datos.domiciliarioNombreCompleto) : null
  const carrierNombre = !propio ? texto(datos.transportadora?.nombre) ?? 'la transportadora' : null
  const carrierNombreTitulo = carrierNombre ? carrierNombre.charAt(0).toLocaleUpperCase('es-CO') + carrierNombre.slice(1) : null
  // La guía de la transportadora vive en `tracking_number`; el TRK interno nunca se muestra.
  const guiaTransportadora = !propio && !esTrkInterno(envio.tracking_number) ? texto(envio.tracking_number) : null
  const quienTexto = propio ? domiciliario : carrierNombreTitulo

  const cuando = (v: unknown) => cuandoEnZona(v, zona, ahora)
  const ciudad = texto(envio.delivery_city)
  const depto = texto(envio.delivery_department)
  const destino = ciudad && depto && ciudad.toLowerCase() !== depto.toLowerCase() ? `${ciudad}, ${depto}` : ciudad ?? depto
  const nPaquetes = typeof envio.package_count === 'number' && envio.package_count > 0 ? envio.package_count : null
  const peso = Number(envio.weight_kg)
  const paquetes = nPaquetes
    ? `${plural(nPaquetes, 'paquete', 'paquetes')}${!propio && Number.isFinite(peso) && peso > 0 ? ` · ${peso.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg` : ''}`
    : null

  // Eventos válidos, del más viejo al más nuevo.
  const eventos = datos.eventos
    .map((e) => ({ e, estado: estadoDeEvento(e), t: instante(e.event_time) }))
    .filter((x): x is { e: EventoEnvioGuia; estado: string; t: Date } => !!x.estado && !!x.t)
    .sort((a, b) => a.t.getTime() - b.t.getTime())
  const primero = (estados: string[]) => eventos.find((x) => estados.includes(x.estado))?.t ?? null
  const ultimo = (estados: string[]) => [...eventos].reverse().find((x) => estados.includes(x.estado)) ?? null

  const final = estado === 'entregado' || estado === 'cancelado' || estado === 'devuelto'
  const est = final ? null : estimadoGuia(pedido?.estimated_delivery_at, envio.expected_delivery_date, zona, ahora)
  const estimado = est
    ? { titulo: est.titulo, detalle: propio ? 'Hora estimada' : 'Fecha estimada de la transportadora' }
    : null

  // Pasos: Recibido, Preparando, En camino, Entregado.
  const tRecibido = instante(pedido?.created_at) ?? instante(envio.created_at)
  const tPreparando = instante(pedido?.confirmed_at) ?? primero(['created']) ?? instante(envio.created_at)
  const tEnCamino = primero(['picked', 'in_transit', 'out_for_delivery']) ?? instante(envio.dispatched_at) ?? instante(envio.picked_at)
  const tEntregado = instante(envio.delivered_at) ?? primero(['delivered'])
  const horaSola = (d: Date | null) => (d ? cuando(d.toISOString()) : null)
  let pasos: PasoGuia[] = []
  if (estado !== 'cancelado' && estado !== 'devuelto') {
    const conQuien = quienTexto ? `Con ${quienTexto}` : null
    const detalleEnCamino = estado === 'novedad'
      ? 'No se pudo entregar'
      : [conQuien, horaSola(tEnCamino)].filter(Boolean).join(' · ') || null
    const actual = estado === 'preparando' ? 1 : estado === 'entregado' ? 4 : 2
    const nombres = ['Recibido', 'Preparando', 'En camino', 'Entregado']
    const detalles = [
      horaSola(tRecibido),
      horaSola(tPreparando),
      actual >= 2 ? detalleEnCamino : null,
      estado === 'entregado' ? horaSola(tEntregado) : est?.corto ?? null,
    ]
    pasos = nombres.map((titulo, i): PasoGuia => ({
      titulo,
      detalle: i <= actual || i === 3 ? detalles[i] : null,
      estado: i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente',
    }))
  }

  // Historial con textos del comprador, el más reciente primero.
  const filas: { t: Date; texto: string; extra: string | null }[] = []
  const tCreado = instante(pedido?.created_at)
  if (tCreado) filas.push({ t: tCreado, texto: 'Recibimos tu pedido', extra: null })
  const tConfirmado = instante(pedido?.confirmed_at)
  if (tConfirmado) filas.push({ t: tConfirmado, texto: 'Pedido confirmado', extra: null })
  for (const x of eventos) {
    let extra: string | null = null
    if (x.estado === 'ready_for_pickup' && nPaquetes) extra = plural(nPaquetes, 'paquete', 'paquetes')
    else if (x.estado === 'delivered') extra = ciudad
    // La ubicación solo de la transportadora (centros y ciudades). En domicilio propio nunca: podría
    // ser la dirección del comprador.
    else if (!propio) extra = texto(x.e.location_text)?.slice(0, 60) ?? null
    let textoFila = textoEvento(x.estado, propio, quienTexto)
    if (x.estado === 'failed_attempt') {
      const motivo = MOTIVO_NOVEDAD[texto(x.e.reason_code) ?? '']
      if (motivo) textoFila = `${textoFila}: ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}`
    }
    filas.push({ t: x.t, texto: textoFila, extra })
  }
  if (filas.length === 0) {
    const t = instante(envio.created_at)
    if (t) filas.push({ t, texto: 'Recibimos tu pedido', extra: null })
  }
  filas.sort((a, b) => b.t.getTime() - a.t.getTime())
  const vistos = new Set<string>()
  const historial: EventoGuiaVista[] = []
  for (const f of filas) {
    const clave = `${f.texto}|${Math.floor(f.t.getTime() / 60000)}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    historial.push({ texto: f.texto, detalle: [cuando(f.t.toISOString()), f.extra].filter(Boolean).join(' · ') })
    if (historial.length >= 30) break
  }

  // Encabezado.
  const titulo =
    estado === 'preparando' ? 'Estamos preparando tu pedido'
    : estado === 'en_camino' ? (propio ? 'Tu envío va en camino' : `Tu envío va con ${carrierNombre}`)
    : estado === 'novedad' ? 'No pudimos entregar tu pedido'
    : estado === 'entregado' ? 'Tu pedido fue entregado'
    : estado === 'devuelto' ? 'Tu pedido volvió a la tienda'
    : 'Este envío se canceló'

  let aviso: VistaGuia['aviso'] = null
  if (estado === 'preparando') {
    aviso = {
      tono: 'info',
      titulo: est?.titulo ?? 'Estamos alistando tu pedido',
      detalle: 'Aquí verás cada paso con su hora apenas pase.',
    }
  } else if (estado === 'en_camino') {
    aviso = {
      tono: 'info',
      titulo: est?.titulo ?? (propio ? 'Tu pedido va en camino' : `${carrierNombreTitulo} tiene tu pedido`),
      detalle: propio
        ? domiciliario ? `${domiciliario}, el domiciliario de la tienda, ya va para allá.` : 'El domiciliario de la tienda ya va para allá.'
        : `${carrierNombreTitulo} lo entrega en tu dirección.`,
    }
  } else if (estado === 'novedad') {
    const motivo = MOTIVO_NOVEDAD[texto(ultimo(['failed_attempt'])?.e.reason_code) ?? '']
    aviso = {
      tono: 'alerta',
      titulo: 'No pudimos entregar tu pedido',
      detalle: `${motivo ? `${motivo}. ` : ''}Escríbenos para acordar una nueva entrega.`,
    }
  } else if (estado === 'entregado') {
    aviso = {
      tono: 'exito',
      titulo: tEntregado ? `Entregado ${cuandoFrase(tEntregado, zona, ahora)}` : 'Entregado',
      detalle: propio && domiciliario
        ? `Lo entregó ${domiciliario}, el domiciliario de la tienda. Quién lo recibió se ve con el enlace de tu correo.`
        : 'Quién lo recibió se ve con el enlace de tu correo.',
    }
  } else if (estado === 'devuelto') {
    aviso = { tono: 'neutro', titulo: 'Tu pedido volvió a la tienda', detalle: 'Escríbenos para saber qué sigue.' }
  } else {
    aviso = { tono: 'neutro', titulo: 'Este envío se canceló', detalle: 'Si tienes dudas, escríbenos.' }
  }

  const quien: QuienLoLleva = propio
    ? domiciliario ? { tipo: 'domiciliario', nombre: domiciliario } : { tipo: 'tienda' }
    : {
        tipo: 'transportadora',
        nombre: carrierNombreTitulo ?? 'La transportadora',
        guia: guiaTransportadora,
        enlace: enlaceTransportadora(envio.external_tracking_url, datos.transportadora?.plantillaUrl, guiaTransportadora),
      }

  // Contraentrega pendiente → «Pagas al recibir», sin el monto (no se lee de la base).
  const pago: VistaGuia['pago'] = final
    ? null
    : envio.cod_status === 'pending' ? 'al_recibir'
    : pedido?.payment_status === 'paid' ? 'pagado'
    : null

  const resumen = [
    destino ? `Destino: ${destino}` : null,
    nPaquetes ? plural(nPaquetes, 'paquete', 'paquetes') : null,
    propio ? 'Domicilio de la tienda' : 'Transportadora',
  ].filter(Boolean).join(' · ')

  const masReciente = filas[0]?.t ?? null
  const ultimoMovimiento = masReciente ? `Último movimiento: ${cuando(masReciente.toISOString())?.replace(/^Hoy/, 'hoy').replace(/^Ayer/, 'ayer')}` : null

  // El que buscó por el TRK viejo ve el número de la tienda, nunca el TRK.
  const subtitulo = datos.encontradoPor === 'guia' && guiaTransportadora
    ? `Buscaste la guía de la transportadora ${guiaTransportadora}.`
    : `Buscaste la guía ${numeroGuia}.`

  const numeroPedido = envio.source_type === 'web_order' && /^DEL-/.test(numeroGuia) ? numeroGuia.slice(4) : null

  return {
    numeroGuia,
    subtitulo,
    estado,
    chip: CHIP_GUIA[estado],
    titulo,
    aviso,
    pasos,
    resumen,
    quien,
    estimado,
    destino,
    paquetes,
    pago,
    historial,
    ultimoMovimiento,
    numeroPedido,
  }
}

/** Resultado de la búsqueda que la página le pasa a la pantalla (serializable, sin datos personales). */
export type ConsultaGuia =
  | { tipo: 'encontrada'; vista: VistaGuia }
  | { tipo: 'no_encontrada' }
  | { tipo: 'parece_pedido'; numero: string }
  | { tipo: 'muchas' }
  | { tipo: 'error' }
