/**
 * Horario de las sedes y fechas en la zona horaria de la sede.
 *
 * Módulo puro (sin React ni Supabase): lo usan el servidor y el navegador.
 * Toda hora «de pared» se calcula con `Intl` en la zona IANA de la sede
 * (`branches.timezone` → `organizations.timezone`, el mismo orden que
 * `fn_timezone_for`), nunca con la hora local del navegador ni del servidor.
 *
 * Es la ÚNICA conversión de zona del sitio de restaurante: `ahoraEnZona`
 * (hora de pared ahora), `hoyEnZona` (día) e `instanteEnZona` (hora de pared →
 * instante UTC). Eventos (`secciones.ts`), carta con horario (`MenuFullView`),
 * eventos privados, reservas y el estado «Abierto ahora» del hero las usan;
 * no se escribe otra con `Intl`.
 *
 * Formato real de `branches.opening_hours` (verificado por MCP el 2026-10-05,
 * 80 sedes): `{ monday: { open: 'HH:MM', close: 'HH:MM', closed?: boolean }, … }`;
 * un día cerrado puede venir sólo como `{ closed: true }`.
 *
 * Turnos partidos (aditivo, sin migración: `opening_hours` es jsonb): un día puede
 * traer además `tramos: [{ open, close }, …]`. Si existe, manda sobre `open`/`close`;
 * el ERP sigue escribiendo `open` = apertura del primer turno y `close` = cierre del
 * último para los lectores que no conocen `tramos`. Aquí el `Tramo` del día conserva
 * esa envolvente en `abre`/`cierra` (los consumidores actuales no cambian) y lleva
 * los turnos en `turnos` (solo con 2 o más). Lee siempre los turnos con `turnosDe`.
 *
 * Horario por defecto del ERP: 76 de las 80 sedes (2026-10-06) tienen el valor que
 * el formulario de Sucursales guardaba sin que nadie lo tocara (L-V 09:00-18:00,
 * sábado 10:00-15:00, domingo cerrado). `esHorarioPorDefecto` lo detecta y
 * `horarioRevisado` lo trata como «sin horario»: no se pinta «Abierto/Cerrado» con
 * un horario inventado.
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
  /** Apertura del día (del primer turno si hay varios). */
  abre: string
  /** Cierre del día (del último turno si hay varios). */
  cierra: string
  /** Turnos partidos, ordenados (solo con 2 o más). Léelos con `turnosDe`. */
  turnos?: Tramo[]
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
    const turnos = leerTurnos(v.tramos)
    if (turnos.length >= 2) {
      semana[dia] = { abre: turnos[0].abre, cierra: turnos[turnos.length - 1].cierra, turnos }
      continue
    }
    if (turnos.length === 1) {
      semana[dia] = turnos[0]
      continue
    }
    const abre = horaValida(v.open)
    const cierra = horaValida(v.close)
    semana[dia] = abre && cierra && abre !== cierra ? { abre, cierra } : null
  }
  return conDatos ? semana : null
}

/** Turnos válidos de `tramos`, ordenados por apertura y sin solapes (los que se pisan se descartan). */
function leerTurnos(valor: unknown): Tramo[] {
  if (!Array.isArray(valor)) return []
  const validos = valor
    .filter(esObjeto)
    .map((t) => ({ abre: horaValida(t.open), cierra: horaValida(t.close) }))
    .filter((t): t is Tramo => !!t.abre && !!t.cierra && t.abre !== t.cierra)
    .sort((a, b) => aMinutos(a.abre) - aMinutos(b.abre))
  const turnos: Tramo[] = []
  for (const t of validos) {
    const previo = turnos[turnos.length - 1]
    // Solo el último turno puede cruzar la medianoche; uno que empieza antes de que cierre el anterior se ignora.
    if (previo && (aMinutos(previo.cierra) <= aMinutos(previo.abre) || aMinutos(t.abre) < aMinutos(previo.cierra))) continue
    turnos.push(t)
  }
  return turnos
}

/** Turnos del día: los partidos, o el único tramo. Cerrado → []. */
export function turnosDe(tramo: Tramo | null | undefined): Tramo[] {
  if (!tramo) return []
  return tramo.turnos && tramo.turnos.length > 0 ? tramo.turnos : [{ abre: tramo.abre, cierra: tramo.cierra }]
}

// ---------------------------------------------------------------------------
// Horario por defecto del ERP y formato de website_settings.business_hours
// ---------------------------------------------------------------------------

const DEFECTO_ERP: Record<Dia, [string, string] | null> = {
  monday: ['09:00', '18:00'],
  tuesday: ['09:00', '18:00'],
  wednesday: ['09:00', '18:00'],
  thursday: ['09:00', '18:00'],
  friday: ['09:00', '18:00'],
  saturday: ['10:00', '15:00'],
  sunday: null,
}

function esSemana(v: unknown): v is HorarioSemana {
  return esObjeto(v) && DIAS.every((d) => v[d] === null || (esObjeto(v[d]) && typeof (v[d] as Record<string, unknown>).abre === 'string'))
}

/**
 * true si el horario es el que el formulario de Sucursales del ERP guardaba por
 * defecto (L-V 09:00-18:00, sábado 10:00-15:00, domingo cerrado). Compara de forma
 * canónica (ignora `closed:false` y las horas de un día cerrado). Acepta el JSON de
 * `branches.opening_hours` o un `HorarioSemana` ya leído.
 */
export function esHorarioPorDefecto(horario: unknown): boolean {
  const semana = esSemana(horario) ? horario : parseHorario(horario)
  if (!semana) return false
  return DIAS.every((dia) => {
    const t = semana[dia]
    const def = DEFECTO_ERP[dia]
    if (!def) return t === null
    return !!t && !t.turnos && t.abre === def[0] && t.cierra === def[1]
  })
}

/** El horario, o `null` si es el por defecto del ERP (sin revisar): nada se calcula con él. */
export function horarioRevisado(horario: HorarioSemana | null): HorarioSemana | null {
  return horario && !esHorarioPorDefecto(horario) ? horario : null
}

/**
 * Horario con el que se CALCULA algo (estado «Abierto/Cerrado», banner de la carta, franjas,
 * validación del pedido) a partir de `branches.opening_hours`: `null` si no hay horario
 * utilizable o si es el por defecto del ERP (sin revisar). Con `null`, cada consumidor conserva
 * su comportamiento sin horario: no se pinta cerrado y no se rechaza ningún pedido por hora.
 *
 * Única regla para la carta (`MenuFull`), el checkout, `/api/orders`, el pie y el selector.
 * Para PINTAR la tabla de horario (con aviso de «sin revisar» en el editor) se usa `parseHorario`.
 */
export function horarioDeSede(json: unknown): HorarioSemana | null {
  return horarioRevisado(parseHorario(json))
}

const DIA_ES: Record<string, Dia> = {
  lunes: 'monday',
  martes: 'tuesday',
  miercoles: 'wednesday',
  jueves: 'thursday',
  viernes: 'friday',
  sabado: 'saturday',
  domingo: 'sunday',
}

/**
 * `website_settings.business_hours` se guarda con los días en español y sin tildes
 * (`lunes`, `miercoles`, `sabado`…). Devuelve el mismo objeto con las claves en
 * inglés (las de `parseHorario`); las claves ya en inglés se conservan.
 */
export function normalizarDias(json: unknown): unknown {
  if (!esObjeto(json)) return json
  const salida: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(json)) {
    const limpia = clave.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const dia = (DIAS as readonly string[]).includes(limpia) ? (limpia as Dia) : DIA_ES[limpia]
    if (dia && !(dia in salida)) salida[dia] = valor
  }
  return salida
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

/** Zona por defecto (regla 6 de docs/reglas-fechas-timezone.md del ERP: solo como respaldo). */
export const ZONA_POR_DEFECTO = 'America/Bogota'

const formateadores = new Map<string, Intl.DateTimeFormat>()

function partesEnZona(zonaPedida: string | null | undefined, instante: Date) {
  const zona = zonaPedida || ZONA_POR_DEFECTO
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
    timeZone: ZONA_POR_DEFECTO,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

export function ahoraEnZona(zona: string | null | undefined, instante: Date = new Date()): AhoraEnZona {
  const p = partesEnZona(zona, instante)
  const dia = (DIAS as readonly string[]).includes(p.weekday) ? (p.weekday as Dia) : 'monday'
  return { dia, minutos: p.hora * 60 + p.minuto, fecha: p.fecha }
}

/** Fecha de hoy (YYYY-MM-DD) en la zona. */
export function hoyEnZona(zona: string | null | undefined, instante: Date = new Date()): string {
  return partesEnZona(zona, instante).fecha
}

/**
 * «HH:MM» de un instante (Date, ISO o epoch) en la zona de la sede. Para pintar la hora
 * de un pedido o de una franja sin pasar por la zona del navegador. `null` si no es fecha.
 */
export function horaEnZona(instante: Date | string | number, zona: string | null | undefined): string | null {
  const t = instante instanceof Date ? instante : new Date(instante)
  if (Number.isNaN(t.getTime())) return null
  const p = partesEnZona(zona, t)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
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

/** «12:00 – 22:00», o con turnos partidos «12:00 – 15:00 · 19:00 – 23:00». */
export function rango(t: Tramo): string {
  return turnosDe(t).map((x) => `${x.abre} – ${x.cierra}`).join(' · ')
}

/**
 * Estado de la sede en este instante. `closing_soon` cuando faltan
 * `avisoMinutos` o menos para cerrar. `null` si la sede no tiene horario.
 * Con turnos partidos, entre dos turnos está cerrada («Cerrado · Abre hoy a las 19:00»).
 */
export function estadoApertura(
  horario: HorarioSemana | null,
  ahora: AhoraEnZona,
  avisoMinutos = 60,
): Apertura | null {
  if (!horario) return null
  const hoy = horario[ahora.dia]
  const turnosHoy = turnosDe(hoy)
  const turnosAyer = turnosDe(horario[diaRelativo(ahora.dia, -1)])

  let minutosParaCerrar: number | null = null
  let cierra: string | null = null

  // Turno de ayer que sigue abierto pasada la medianoche (solo el último puede cruzarla).
  const ultimoAyer = turnosAyer[turnosAyer.length - 1]
  if (ultimoAyer && cruzaMedianoche(ultimoAyer) && ahora.minutos < aMinutos(ultimoAyer.cierra)) {
    minutosParaCerrar = aMinutos(ultimoAyer.cierra) - ahora.minutos
    cierra = ultimoAyer.cierra
  } else {
    for (const turno of turnosHoy) {
      const abre = aMinutos(turno.abre)
      const fin = cruzaMedianoche(turno) ? aMinutos(turno.cierra) + 24 * 60 : aMinutos(turno.cierra)
      if (ahora.minutos >= abre && ahora.minutos < fin) {
        minutosParaCerrar = fin - ahora.minutos
        cierra = turno.cierra
        break
      }
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

  // Cerrada: próxima apertura (un turno de hoy más tarde, o los próximos 7 días).
  let proxima: string | null = null
  const siguienteHoy = turnosHoy.find((t) => ahora.minutos < aMinutos(t.abre))
  if (siguienteHoy) {
    proxima = `hoy a las ${siguienteHoy.abre}`
  } else {
    for (let i = 1; i <= 7; i++) {
      const t = horario[diaRelativo(ahora.dia, i)]
      if (t) {
        proxima = `${i === 1 ? 'mañana' : `el ${NOMBRE_DIA[diaRelativo(ahora.dia, i)]}`} a las ${turnosDe(t)[0].abre}`
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

/** «HH:MM» de unos minutos del día (0 – 1439). */
export function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/**
 * Instante UTC de una hora de pared («2026-10-24», «19:30») en una zona
 * (eventos, «Añadir al calendario»). Dos pasadas bastan para zonas con cambio
 * de horario.
 */
export function instanteEnZona(fecha: string, hora: string, zona: string | null | undefined): Date {
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
