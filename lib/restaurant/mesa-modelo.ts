/**
 * Carta QR en la mesa — modelo puro (sin React ni Supabase) de lo que devuelven las RPC públicas
 * de la mesa (migraciones 20261007090000…0300 del ERP) y de las cuentas que hace la pantalla.
 *
 * Lo comparten el servidor (`lib/restaurant/mesa-servidor.ts`, `/api/mesa/...`), las vistas de
 * las secciones de mesa y `scripts/verify-carta-qr.mjs`.
 *
 * Reglas:
 * - Todo lo que es dinero lo decide la base: aquí solo se muestra y se PROPONE (partes iguales,
 *   propina). El monto que se cobra lo recalcula `fn_mesa_abono_iniciar`; si el navegador vio
 *   otro, responde MONTO_CAMBIO.
 * - Lo que llega de la red se valida por forma: un campo raro se descarta, nunca rompe la vista.
 */

export type EstadoRonda = 'por_enviar' | 'por_confirmar' | 'enviada' | 'en_preparacion' | 'lista' | 'servida' | 'cancelada'

export const ESTADOS_RONDA: readonly EstadoRonda[] = [
  'por_enviar', 'por_confirmar', 'enviada', 'en_preparacion', 'lista', 'servida', 'cancelada',
]

/** Texto de la píldora de estado (láminas 04 y 06). */
export const ETIQUETA_ESTADO_RONDA: Record<EstadoRonda, string> = {
  por_enviar: 'Por enviar',
  por_confirmar: 'Por confirmar',
  enviada: 'Enviada',
  en_preparacion: 'En preparación',
  lista: 'Lista',
  servida: 'Servida',
  cancelada: 'Cancelada',
}

/** Paso del seguimiento (06): 0 enviada · 1 en preparación · 2 lista · 3 servida. */
export function pasoDeEstado(estado: EstadoRonda): number {
  switch (estado) {
    case 'en_preparacion': return 1
    case 'lista': return 2
    case 'servida': return 3
    default: return 0
  }
}

export interface LineaMesa {
  id: string
  nombre: string
  cantidad: number
  total: number
  modificadores: string[]
  nota: string | null
  comensal: string | null
  estado: EstadoRonda | null
  pagada: boolean
}

export interface RondaMesa {
  clave: string
  numero: number
  origen: 'web' | 'mesero'
  creada: string | null
  comensal: string | null
  estado: EstadoRonda
  listaAt: string | null
  items: LineaMesa[]
  subtotal: number
}

export interface SolicitudMesa {
  id: string
  kind: 'waiter' | 'bill' | 'help'
  status: 'open' | 'ack'
  createdAt: string | null
}

export interface MesaPublica {
  id: string
  nombre: string
  zona: string | null
  sedeId: number | null
  sede: string | null
}

export interface SesionPublica {
  estado: 'active' | 'bill_requested'
  abiertaDesde: string | null
  personas: number | null
  mesero: string | null
}

export interface PedidoMesa {
  mesa: MesaPublica
  /** `null` = la mesa no tiene sesión activa: el QR solo deja ver la carta. */
  sesion: SesionPublica | null
  rondas: RondaMesa[]
  total: number
  impuesto: number
  impuestoIncluido: boolean
  solicitudes: SolicitudMesa[]
}

export type EstadoAbono = 'pending' | 'paid' | 'paid_unapplied' | 'vencido'

export interface AbonoMesa {
  id: string
  comensal: string | null
  modo: ModoDivision
  monto: number
  propina: number
  estado: EstadoAbono
  creado: string | null
  pagado: string | null
}

export interface ComensalCuenta {
  comensal: string | null
  total: number
  pendiente: number
  lineas: number
}

export interface CuentaMesaDatos {
  moneda: string
  total: number
  pagado: number
  saldo: number
  tolerancia: number
  propina: number
  impuesto: number
  impuestoIncluido: boolean
  porComensal: ComensalCuenta[]
  abonos: AbonoMesa[]
  /** Pasarela con la que se puede pagar en línea; `null` = solo pagar en la mesa. */
  pasarela: string | null
}

export interface CuentaMesa extends PedidoMesa {
  cuenta: CuentaMesaDatos | null
}

export type ModoDivision = 'todo' | 'iguales' | 'comensal'

// ─── Lectura defensiva ──────────────────────────────────────────────────────────────────────

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
function txt(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}
function num(v: unknown, porDefecto = 0): number {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : porDefecto
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function estadoRonda(v: unknown): EstadoRonda {
  return typeof v === 'string' && (ESTADOS_RONDA as readonly string[]).includes(v) ? (v as EstadoRonda) : 'enviada'
}

function parseLinea(v: unknown, estadoRondaPadre: EstadoRonda): LineaMesa | null {
  const o = obj(v)
  if (!o) return null
  return {
    id: String(o.id ?? ''),
    nombre: txt(o.nombre) ?? 'Producto',
    cantidad: num(o.cantidad, 1),
    total: num(o.total),
    modificadores: arr(o.modificadores).filter((m): m is string => typeof m === 'string' && m.trim() !== ''),
    nota: txt(o.nota),
    comensal: txt(o.comensal),
    estado: o.estado === null || o.estado === undefined ? estadoRondaPadre : estadoRonda(o.estado),
    pagada: o.pagada === true,
  }
}

export function parsePedidoMesa(v: unknown): PedidoMesa | null {
  const o = obj(v)
  const m = obj(o?.mesa)
  if (!o || !m || typeof m.id !== 'string') return null
  const s = obj(o.sesion)
  const rondas: RondaMesa[] = []
  for (const r of arr(o.rondas)) {
    const ro = obj(r)
    if (!ro) continue
    const estado = estadoRonda(ro.estado)
    rondas.push({
      clave: String(ro.clave ?? ''),
      numero: num(ro.numero, rondas.length + 1),
      origen: ro.origen === 'web' ? 'web' : 'mesero',
      creada: txt(ro.creada),
      comensal: txt(ro.comensal),
      estado,
      listaAt: txt(ro.lista_at),
      items: arr(ro.items).map((l) => parseLinea(l, estado)).filter((l): l is LineaMesa => l !== null),
      subtotal: num(ro.subtotal),
    })
  }
  return {
    mesa: {
      id: m.id,
      nombre: txt(m.nombre) ?? 'Tu mesa',
      zona: txt(m.zona),
      sedeId: m.sede_id === null || m.sede_id === undefined ? null : num(m.sede_id),
      sede: txt(m.sede),
    },
    sesion: s
      ? {
          estado: s.estado === 'bill_requested' ? 'bill_requested' : 'active',
          abiertaDesde: txt(s.abierta_desde),
          personas: s.personas === null || s.personas === undefined ? null : num(s.personas),
          mesero: txt(s.mesero),
        }
      : null,
    rondas,
    total: num(o.total),
    impuesto: num(o.impuesto),
    impuestoIncluido: o.impuesto_incluido === true,
    solicitudes: arr(o.solicitudes)
      .map((x) => obj(x))
      .filter((x): x is Record<string, unknown> => x !== null && typeof x.id === 'string')
      .map((x) => ({
        id: x.id as string,
        kind: x.kind === 'bill' ? 'bill' : x.kind === 'help' ? 'help' : 'waiter',
        status: x.status === 'ack' ? 'ack' : 'open',
        createdAt: txt(x.created_at),
      })),
  }
}

export function parseCuentaMesa(v: unknown): CuentaMesa | null {
  const pedido = parsePedidoMesa(v)
  if (!pedido) return null
  const c = obj(obj(v)?.cuenta)
  if (!c) return { ...pedido, cuenta: null }
  const modo = (x: unknown): ModoDivision => (x === 'iguales' || x === 'comensal' ? x : 'todo')
  const estadoAbono = (x: unknown): EstadoAbono =>
    x === 'paid' || x === 'paid_unapplied' || x === 'vencido' ? x : 'pending'
  return {
    ...pedido,
    cuenta: {
      moneda: txt(c.moneda) ?? 'COP',
      total: num(c.total),
      pagado: num(c.pagado),
      saldo: num(c.saldo),
      tolerancia: num(c.tolerancia, 1),
      propina: num(c.propina),
      impuesto: num(c.impuesto),
      impuestoIncluido: c.impuesto_incluido === true,
      porComensal: arr(c.por_comensal)
        .map((x) => obj(x))
        .filter((x): x is Record<string, unknown> => x !== null)
        .map((x) => ({ comensal: txt(x.comensal), total: num(x.total), pendiente: num(x.pendiente), lineas: num(x.lineas) })),
      abonos: arr(c.abonos)
        .map((x) => obj(x))
        .filter((x): x is Record<string, unknown> => x !== null && typeof x.id === 'string')
        .map((x) => ({
          id: x.id as string,
          comensal: txt(x.comensal),
          modo: modo(x.modo),
          monto: num(x.monto),
          propina: num(x.propina),
          estado: estadoAbono(x.estado),
          creado: txt(x.creado),
          pagado: txt(x.pagado),
        })),
      pasarela: txt(c.pasarela),
    },
  }
}

// ─── Cuentas de la pantalla ─────────────────────────────────────────────────────────────────

/** Comensal mostrado: «Yo» para el propio, el nombre, o «Mesa» si la línea no tiene nombre. */
export function nombreComensal(comensal: string | null): string {
  return comensal && comensal.trim() ? comensal.trim() : 'Mesa'
}

/** Rondas agrupadas por comensal (pestaña «Por persona»). */
export function lineasPorComensal(rondas: RondaMesa[]): { comensal: string; lineas: LineaMesa[]; total: number }[] {
  const mapa = new Map<string, LineaMesa[]>()
  for (const r of rondas) {
    for (const l of r.items) {
      const k = nombreComensal(l.comensal ?? r.comensal)
      const lista = mapa.get(k) ?? []
      lista.push(l)
      mapa.set(k, lista)
    }
  }
  return Array.from(mapa.entries()).map(([comensal, lineas]) => ({
    comensal,
    lineas,
    total: lineas.reduce((s, l) => s + l.total, 0),
  }))
}

/**
 * Parte de una división en partes iguales, como la calcula la base (`fn_mesa_abono_iniciar`):
 * total / partes redondeado hacia arriba a la unidad de la moneda, con tope en el saldo.
 */
export function parteIgual(total: number, partes: number, saldo: number, tolerancia = 1): number {
  if (!(partes >= 2) || !(total > 0)) return Math.max(0, saldo)
  const unidad = tolerancia > 0 ? tolerancia : 1
  const parte = Math.ceil(total / partes / unidad - 1e-9) * unidad
  return Math.max(0, Math.min(saldo, Math.round(parte * 100) / 100))
}

/** Propina sobre la parte: % redondeado a la unidad de la moneda. */
export function propinaPorcentaje(base: number, porcentaje: number, tolerancia = 1): number {
  if (!(base > 0) || !(porcentaje > 0)) return 0
  const unidad = tolerancia > 0 ? tolerancia : 1
  return Math.round((base * porcentaje) / 100 / unidad) * unidad
}

/**
 * Línea «Incluye impuesto al consumo (8 %): $X» del pedido de la mesa. El impuesto es el de la
 * venta (`sales.tax_total`, sumado línea a línea por el POS) y solo cubre lo que ya está en la
 * cuenta (`total`). La ronda que el comensal aún no envía no tiene impuesto calculado: no se le
 * imputa la tasa de las demás (puede llevar productos con otra tarifa o exentos), así que si hay
 * ronda local la línea aclara que el impuesto es de lo enviado.
 */
export function impuestoDelPedido(
  total: number,
  impuesto: number,
  incluido: boolean,
  totalLocal = 0,
): { tasa: number; valor: number; soloEnviado: boolean } | null {
  if (!incluido || !(impuesto > 0) || !(total > impuesto)) return null
  return { tasa: Math.round((impuesto / (total - impuesto)) * 100), valor: impuesto, soloEnviado: totalLocal > 0 }
}

/** Monto de la parte según la forma de dividir (propuesta; la base decide). */
export function montoDeParte(
  cuenta: Pick<CuentaMesaDatos, 'total' | 'saldo' | 'tolerancia' | 'porComensal' | 'propina'>,
  modo: ModoDivision,
  partes: number,
  comensal: string | null,
): number {
  if (modo === 'todo') return Math.max(0, cuenta.saldo)
  if (modo === 'iguales') return parteIgual(cuenta.total, partes, cuenta.saldo, cuenta.tolerancia)
  const fila = cuenta.porComensal.find((c) => (c.comensal ?? null) === (comensal ?? null))
  return Math.max(0, Math.min(cuenta.saldo, fila?.pendiente ?? 0))
}

/** «Ana ya pagó · tú estás pagando · faltan 2 partes» (lámina 09). */
export function progresoPartes(abonos: AbonoMesa[], partes: number): { pagadas: number; enCurso: number; faltan: number } {
  const pagadas = abonos.filter((a) => a.modo === 'iguales' && (a.estado === 'paid' || a.estado === 'paid_unapplied')).length
  const enCurso = abonos.filter((a) => a.modo === 'iguales' && a.estado === 'pending').length
  return { pagadas, enCurso, faltan: Math.max(0, partes - pagadas - enCurso) }
}

// ─── Comensal y ronda local («por enviar») ──────────────────────────────────────────────────

/** Nombre del comensal saneado como lo guarda la base (≤ 40, sin controles). */
export function sanearComensal(v: unknown): string | null {
  if (typeof v !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  return t === '' ? null : t
}

/** Clave del navegador para el nombre del comensal y la ronda por enviar de esta mesa. */
export function claveComensal(mesaId: string): string {
  return `carta_qr_comensal_${mesaId}`
}
export function claveRondasEnviadas(mesaId: string): string {
  return `carta_qr_rondas_${mesaId}`
}

/** Códigos de respuesta de `/api/mesa/...` con su texto para el comensal. */
export const MENSAJES_MESA: Record<string, string> = {
  SIN_SESION: 'Tu mesa aún no está abierta. Pide al equipo que la abra para pedir desde aquí.',
  SIN_PASARELA: 'Este restaurante aún no recibe pagos en línea. Puedes pagar en la mesa.',
  CUENTA_PAGADA: 'La cuenta de la mesa ya está pagada.',
  CUENTA_VACIA: 'La cuenta de la mesa aún está vacía.',
  NADA_QUE_PAGAR: 'No hay nada pendiente para esa parte.',
  PAGO_EN_CURSO: 'Alguien de la mesa está pagando en este momento. Espera un minuto e inténtalo de nuevo.',
  MONTO_CAMBIO: 'La cuenta cambió mientras la mirabas. Revisa el nuevo valor.',
  PROPINA_INVALIDA: 'La propina no puede ser mayor que tu parte.',
  DEMASIADOS: 'Ya avisamos al equipo. Espera un momento antes de volver a intentarlo.',
  NO_DISPONIBLE: 'Esta función aún no está disponible en este restaurante.',
  MESA_INVALIDA: 'No encontramos tu mesa. Escanea de nuevo el código QR.',
  ERROR: 'No pudimos completar la acción. Revisa la señal e inténtalo de nuevo.',
}
