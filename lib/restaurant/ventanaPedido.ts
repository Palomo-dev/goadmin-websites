/**
 * Ventana de pedido de una sede: franjas para programar y validación del momento del pedido.
 *
 * Una sola regla para el checkout (`ScheduleSelector`) y para el servidor (`/api/orders`):
 * - «Lo antes posible» solo con la sede abierta (mismo `estadoApertura` que «Abierto ahora»).
 * - Una hora programada debe ser futura, caer dentro del horario de la sede y no pasar de
 *   `diasAdelante` días.
 * - Todo se calcula en la zona de la sede (`branches.timezone` → `organizations.timezone` →
 *   America/Bogota), nunca con la hora del navegador ni del servidor.
 *
 * Se apoya solo en `horario.ts` (conversión de zona única del sitio de restaurante): no escribe
 * otra conversión con `Intl`. Si la sede no tiene horario utilizable (`null`), nada se restringe y
 * el llamador conserva su comportamiento anterior.
 *
 * Puro: lo usan servidor y navegador.
 */

import {
  ahoraEnZona,
  estadoApertura,
  fechaCorta,
  horaDeMinutos,
  hoyEnZona,
  instanteEnZona,
  sumarDias,
  turnosDe,
  aMinutos,
  DIAS,
  type Dia,
  type HorarioSemana,
} from './horario'

export interface OpcionesFranjas {
  /** Minutos entre franjas. */
  pasoMin?: number
  /** Minutos mínimos desde ahora hasta la primera franja (tiempo de preparación). */
  antelacionMin?: number
  /** Días hacia adelante, contando hoy (1 = solo hoy, 2 = hoy y mañana). */
  diasAdelante?: number
}

const POR_DEFECTO: Required<OpcionesFranjas> = { pasoMin: 30, antelacionMin: 30, diasAdelante: 2 }

/** Tolerancia para una hora programada que quedó unos minutos en el pasado mientras se pagaba. */
const TOLERANCIA_PASADO_MS = 5 * 60 * 1000

function diaDeFecha(fecha: string): Dia {
  const [y, m, d] = fecha.split('-').map(Number)
  // getUTCDay: 0 = domingo. DIAS empieza en lunes.
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return DIAS[(js + 6) % 7]
}

/**
 * Franjas (instantes ISO) en las que se puede programar un pedido: dentro de los turnos de la
 * sede, en su zona, desde `ahora + antelacionMin`. Incluye el turno de ayer que sigue abierto
 * pasada la medianoche y turnos que cierran después de las 00:00.
 */
export function franjasPedido(
  horario: HorarioSemana | null,
  zona: string | null | undefined,
  ahora: Date = new Date(),
  opciones: OpcionesFranjas = {},
): string[] {
  if (!horario) return []
  const { pasoMin, antelacionMin, diasAdelante } = { ...POR_DEFECTO, ...opciones }
  const desde = ahora.getTime() + antelacionMin * 60 * 1000
  const hasta = ahora.getTime() + diasAdelante * 24 * 60 * 60 * 1000
  const hoy = hoyEnZona(zona, ahora)
  const vistos = new Set<string>()
  const franjas: { t: number; iso: string }[] = []

  // Desde ayer (turno que cruza la medianoche) hasta el último día pedido.
  for (let d = -1; d < diasAdelante; d++) {
    const fecha = sumarDias(hoy, d)
    // Turno por turno (turnosDe): con turno partido (12:00-15:00 · 19:00-23:00) no se ofrecen las
    // horas del hueco, que validarMomentoPedido (estadoApertura) rechaza. De ayer solo cuenta el
    // tramo que pasa de la medianoche; los demás ya quedaron antes de `desde`.
    for (const turno of turnosDe(horario[diaDeFecha(fecha)])) {
      const abre = aMinutos(turno.abre)
      let cierra = aMinutos(turno.cierra)
      if (cierra <= abre) cierra += 24 * 60
      for (let m = abre; m < cierra; m += pasoMin) {
        const fechaFranja = m >= 24 * 60 ? sumarDias(fecha, 1) : fecha
        const t = instanteEnZona(fechaFranja, horaDeMinutos(m % (24 * 60)), zona).getTime()
        if (t < desde || t > hasta) continue
        const iso = new Date(t).toISOString()
        if (vistos.has(iso)) continue
        vistos.add(iso)
        franjas.push({ t, iso })
      }
    }
  }
  return franjas.sort((a, b) => a.t - b.t).map((f) => f.iso)
}

export type CodigoMomento = 'SEDE_CERRADA' | 'HORA_PROGRAMADA_INVALIDA'

export type MomentoPedido =
  | { ok: true; /** ISO normalizado, o null si es «lo antes posible». */ programadoPara: string | null }
  | {
      ok: false
      code: CodigoMomento
      motivo: 'cerrada' | 'invalida' | 'pasado' | 'fuera_de_horario' | 'demasiado_lejos'
      /** «Cerrado · Abre mañana a las 11:30», para que el checkout ofrezca programar. */
      proximaApertura: string | null
      mensaje: string
    }

/**
 * Valida el momento del pedido. `programadoPara` null = «lo antes posible».
 * Sin horario (`null`) siempre es válido: el llamador conserva el comportamiento anterior.
 */
export function validarMomentoPedido(
  horario: HorarioSemana | null,
  zona: string | null | undefined,
  programadoPara: string | null,
  ahora: Date = new Date(),
  opciones: OpcionesFranjas = {},
): MomentoPedido {
  if (!horario) {
    if (programadoPara === null) return { ok: true, programadoPara: null }
    const t = new Date(programadoPara)
    return Number.isNaN(t.getTime())
      ? { ok: false, code: 'HORA_PROGRAMADA_INVALIDA', motivo: 'invalida', proximaApertura: null, mensaje: 'La hora programada no es válida.' }
      : { ok: true, programadoPara: t.toISOString() }
  }

  const estadoAhora = estadoApertura(horario, ahoraEnZona(zona, ahora))
  const proxima = estadoAhora && estadoAhora.estado === 'closed' ? estadoAhora.texto : null

  if (programadoPara === null) {
    if (estadoAhora && estadoAhora.estado === 'closed') {
      return {
        ok: false,
        code: 'SEDE_CERRADA',
        motivo: 'cerrada',
        proximaApertura: proxima,
        mensaje: `La sede está cerrada ahora${proxima ? ` (${proxima.replace(/^Cerrado · /, '').toLowerCase()})` : ''}. Programa tu pedido para cuando abra.`,
      }
    }
    return { ok: true, programadoPara: null }
  }

  const t = new Date(programadoPara)
  if (Number.isNaN(t.getTime())) {
    return { ok: false, code: 'HORA_PROGRAMADA_INVALIDA', motivo: 'invalida', proximaApertura: proxima, mensaje: 'La hora programada no es válida.' }
  }
  if (t.getTime() < ahora.getTime() - TOLERANCIA_PASADO_MS) {
    return { ok: false, code: 'HORA_PROGRAMADA_INVALIDA', motivo: 'pasado', proximaApertura: proxima, mensaje: 'La hora programada ya pasó. Elige otra hora.' }
  }
  const { diasAdelante } = { ...POR_DEFECTO, ...opciones }
  if (t.getTime() > ahora.getTime() + diasAdelante * 24 * 60 * 60 * 1000) {
    return { ok: false, code: 'HORA_PROGRAMADA_INVALIDA', motivo: 'demasiado_lejos', proximaApertura: proxima, mensaje: 'Solo puedes programar pedidos para hoy o mañana.' }
  }
  const estadoEnHora = estadoApertura(horario, ahoraEnZona(zona, t))
  if (estadoEnHora && estadoEnHora.estado === 'closed') {
    return {
      ok: false,
      code: 'HORA_PROGRAMADA_INVALIDA',
      motivo: 'fuera_de_horario',
      proximaApertura: proxima,
      mensaje: 'La sede está cerrada a esa hora. Elige una hora dentro del horario.',
    }
  }
  return { ok: true, programadoPara: t.toISOString() }
}

// ---------------------------------------------------------------------------
// Presentación en la zona de la sede (sin otra conversión con Intl)
// ---------------------------------------------------------------------------

/** «7:30 p. m.» de un instante, en la zona de la sede. */
export function horaPedido(iso: string | Date, zona: string | null | undefined): string {
  const t = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(t.getTime())) return ''
  const { minutos } = ahoraEnZona(zona, t)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** «Hoy», «Mañana» o «Sáb 17 oct» de un instante, en la zona de la sede. */
export function diaPedido(iso: string | Date, zona: string | null | undefined, ahora: Date = new Date()): string {
  const t = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(t.getTime())) return ''
  const fecha = hoyEnZona(zona, t)
  const hoy = hoyEnZona(zona, ahora)
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, 1)) return 'Mañana'
  return fechaCorta(fecha)
}

/** «Hoy · 7:30 p. m.» */
export function momentoPedido(iso: string | Date, zona: string | null | undefined, ahora: Date = new Date()): string {
  return `${diaPedido(iso, zona, ahora)} · ${horaPedido(iso, zona)}`
}

/** «17 oct · 7:30 p. m.» con el día del calendario de la sede (para fechas pasadas). */
export function fechaHoraPedido(iso: string | Date, zona: string | null | undefined): string {
  const t = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(t.getTime())) return ''
  return `${fechaCorta(hoyEnZona(zona, t))} · ${horaPedido(t, zona)}`
}
