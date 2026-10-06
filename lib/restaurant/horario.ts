/**
 * Horario de las sedes y fechas en la zona horaria de la sede.
 *
 * Módulo puro (sin React ni Supabase): lo usan el servidor y el navegador.
 * Toda hora «de pared» se calcula con `Intl` en la zona IANA de la sede
 * (`branches.timezone` → `organizations.timezone`, el mismo orden que
 * `fn_timezone_for`), nunca con la hora local del navegador ni del servidor.
 *
 * Formato real de `branches.opening_hours` (verificado por MCP el 2026-10-05,
 * 80 sedes): `{ monday: { open: 'HH:MM', close: 'HH:MM', closed?: boolean }, … }`;
 * un día cerrado puede venir sólo como `{ closed: true }`.
 */

export const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type Dia = (typeof DIAS)[number]

const NOMBRE_DIA: Record<Dia, string> = {
  monday: 'lunes',
  tuesday: 'martes',
  wednesday: 'miércoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sábado',
  sunday: 'domingo',
}

export interface Tramo {
  abre: string
  cierra: string
}

/** `null` = cerrado ese día. */
export type HorarioSemana = Record<Dia, Tramo | null>

export type EstadoApertura = 'open' | 'closing_soon' | 'closed'

export interface Apertura {
  estado: EstadoApertura
  /** Texto completo del badge: el estado va en texto, no sólo en color. */
  texto: string
  /** «Hoy 12:00 – 22:00» o «Hoy cerrado · abre mañana 12:00». */
  hoy: string
}

const HORA = /^(\d{1,2}):(\d{2})(?::\d{2})?$/

function horaValida(valor: unknown): string | null {
  const m = HORA.exec(String(valor ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** `null` si la sede no tiene horario utilizable (sin datos o JSON inválido). */
export function parseHorario(json: unknown): HorarioSemana | null {
  if (!esObjeto(json)) return null
  let conDatos = false
  const semana = {} as HorarioSemana
  for (const dia of DIAS) {
    const v = json[dia]
    if (!esObjeto(v)) {
      semana[dia] = null
      continue
    }
    conDatos = true
    if (v.closed === true) {
      semana[dia] = null
      continue
    }
    const abre = horaValida(v.open)
    const cierra = horaValida(v.close)
    semana[dia] = abre && cierra && abre !== cierra ? { abre, cierra } : null
  }
  return conDatos ? semana : null
}

// ---------------------------------------------------------------------------
// Hora de pared en una zona
// ---------------------------------------------------------------------------

export interface AhoraEnZona {
  dia: Dia
  minutos: number
  /** YYYY-MM-DD en la zona. */
  fecha: string
}

const formateadores = new Map<string, Intl.DateTimeFormat>()

function partesEnZona(zona: string, instante: Date) {
  let f = formateadores.get(zona)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: zona,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    } catch {
      // Zona inválida guardada en la base: mismo criterio que fn_timezone_for.
      f = partesFallback()
    }
    formateadores.set(zona, f)
  }
  const partes = f.formatToParts(instante)
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  return {
    weekday: v('weekday').toLowerCase(),
    fecha: `${v('year')}-${v('month')}-${v('day')}`,
    hora: Number(v('hour')) % 24,
    minuto: Number(v('minute')),
  }
}

function partesFallback() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

export function ahoraEnZona(zona: string, instante: Date = new Date()): AhoraEnZona {
  const p = partesEnZona(zona, instante)
  const dia = (DIAS as readonly string[]).includes(p.weekday) ? (p.weekday as Dia) : 'monday'
  return { dia, minutos: p.hora * 60 + p.minuto, fecha: p.fecha }
}

/** Fecha de hoy (YYYY-MM-DD) en la zona. */
export function hoyEnZona(zona: string, instante: Date = new Date()): string {
  return partesEnZona(zona, instante).fecha
}

// ---------------------------------------------------------------------------
// Estado «Abierto ahora»
// ---------------------------------------------------------------------------

function diaRelativo(base: Dia, offset: number): Dia {
  return DIAS[(DIAS.indexOf(base) + offset + 7) % 7]
}

/** Cierre después de medianoche (18:00 – 02:00). */
function cruzaMedianoche(t: Tramo): boolean {
  return aMinutos(t.cierra) <= aMinutos(t.abre)
}

export function rango(t: Tramo): string {
  return `${t.abre} – ${t.cierra}`
}

/**
 * Estado de la sede en este instante. `closing_soon` cuando faltan
 * `avisoMinutos` o menos para cerrar. `null` si la sede no tiene horario.
 */
export function estadoApertura(
  horario: HorarioSemana | null,
  ahora: AhoraEnZona,
  avisoMinutos = 60,
): Apertura | null {
  if (!horario) return null
  const hoy = horario[ahora.dia]
  const ayer = horario[diaRelativo(ahora.dia, -1)]

  let minutosParaCerrar: number | null = null
  let cierra: string | null = null

  // Turno de ayer que sigue abierto pasada la medianoche.
  if (ayer && cruzaMedianoche(ayer) && ahora.minutos < aMinutos(ayer.cierra)) {
    minutosParaCerrar = aMinutos(ayer.cierra) - ahora.minutos
    cierra = ayer.cierra
  } else if (hoy) {
    const abre = aMinutos(hoy.abre)
    const fin = cruzaMedianoche(hoy) ? aMinutos(hoy.cierra) + 24 * 60 : aMinutos(hoy.cierra)
    if (ahora.minutos >= abre && ahora.minutos < fin) {
      minutosParaCerrar = fin - ahora.minutos
      cierra = hoy.cierra
    }
  }

  const textoHoy = hoy ? `Hoy ${rango(hoy)}` : null

  if (minutosParaCerrar !== null && cierra) {
    const pronto = minutosParaCerrar <= avisoMinutos
    return {
      estado: pronto ? 'closing_soon' : 'open',
      texto: pronto ? `Cierra pronto · a las ${cierra}` : `Abierto ahora · Cierra a las ${cierra}`,
      hoy: textoHoy ?? `Abierto hasta las ${cierra}`,
    }
  }

  // Cerrada: próxima apertura (hoy más tarde, o los próximos 7 días).
  let proxima: string | null = null
  if (hoy && ahora.minutos < aMinutos(hoy.abre)) {
    proxima = `hoy a las ${hoy.abre}`
  } else {
    for (let i = 1; i <= 7; i++) {
      const t = horario[diaRelativo(ahora.dia, i)]
      if (t) {
        proxima = `${i === 1 ? 'mañana' : `el ${NOMBRE_DIA[diaRelativo(ahora.dia, i)]}`} a las ${t.abre}`
        break
      }
    }
  }
  if (!proxima) return { estado: 'closed', texto: 'Cerrado', hoy: 'Hoy cerrado' }
  return {
    estado: 'closed',
    texto: `Cerrado · Abre ${proxima}`,
    hoy: textoHoy ?? `Hoy cerrado · abre ${proxima.replace(' a las', '')}`,
  }
}

// ---------------------------------------------------------------------------
// Tabla de horario agrupada («Martes a jueves 12:00 – 22:00»)
// ---------------------------------------------------------------------------

export interface FilaHorario {
  etiqueta: string
  horas: string | null
  esHoy: boolean
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function filasHorario(horario: HorarioSemana, hoy: Dia | null): FilaHorario[] {
  const filas: FilaHorario[] = []
  let i = 0
  while (i < DIAS.length) {
    const t = horario[DIAS[i]]
    const clave = t ? rango(t) : null
    let j = i
    while (j + 1 < DIAS.length) {
      const sig = horario[DIAS[j + 1]]
      if ((sig ? rango(sig) : null) !== clave) break
      j++
    }
    const desde = NOMBRE_DIA[DIAS[i]]
    const hasta = NOMBRE_DIA[DIAS[j]]
    const etiqueta = i === j ? capitalizar(desde) : j === i + 1 ? `${capitalizar(desde)} y ${hasta}` : `${capitalizar(desde)} a ${hasta}`
    const esHoy = hoy !== null && DIAS.indexOf(hoy) >= i && DIAS.indexOf(hoy) <= j
    filas.push({ etiqueta, horas: clave, esHoy })
    i = j + 1
  }
  return filas
}

// ---------------------------------------------------------------------------
// Fechas de calendario (valores `date`, sin zona)
// ---------------------------------------------------------------------------

function partesFecha(fecha: string): [number, number, number] {
  const [y, m, d] = fecha.split('-').map(Number)
  return [y, m, d]
}

/** Suma días a una fecha YYYY-MM-DD sin pasar por la zona del navegador. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = partesFecha(fecha)
  const t = new Date(Date.UTC(y, m - 1, d + dias))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

const fmtCorta = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const fmtLarga = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

function comoUtc(fecha: string): Date {
  const [y, m, d] = partesFecha(fecha)
  return new Date(Date.UTC(y, m - 1, d))
}

/** «Sáb 17 oct» */
export function fechaCorta(fecha: string): string {
  return capitalizar(fmtCorta.format(comoUtc(fecha)).replace(/\./g, '').replace(/,/g, '').replace(/ de /g, ' '))
}

/** «Sábado 17 de octubre» */
export function fechaLarga(fecha: string): string {
  return capitalizar(fmtLarga.format(comoUtc(fecha)).replace(/,/g, ''))
}

/**
 * Instante UTC de una hora de pared en una zona (para «Añadir al calendario»).
 * Dos pasadas bastan para zonas con cambio de horario.
 */
export function instanteEnZona(fecha: string, hora: string, zona: string): Date {
  const [y, m, d] = partesFecha(fecha)
  const [h, min] = hora.split(':').map(Number)
  const objetivo = Date.UTC(y, m - 1, d, h, min)
  let t = objetivo
  for (let i = 0; i < 2; i++) {
    const p = partesEnZona(zona, new Date(t))
    const [py, pm, pd] = partesFecha(p.fecha)
    const pared = Date.UTC(py, pm - 1, pd, p.hora, p.minuto)
    t += objetivo - pared
  }
  return new Date(t)
}
