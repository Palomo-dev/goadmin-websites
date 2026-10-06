/**
 * Utilidades compartidas por las secciones nuevas de restaurante (Figma
 * «Secciones nuevas» 167:5358): normalizar el contenido libre del editor y
 * fechas de eventos en la zona de la organización.
 *
 * El horario de las sedes («Abierto ahora») NO vive aquí: es de
 * lib/restaurant/horario.ts (secciones `hours_location` / `reservation`).
 *
 * Módulo puro: sin componentes ni consultas. Lo usan tanto los componentes de
 * sección (que el manifiesto lee desde un route handler) como sus vistas de
 * cliente.
 */

import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Contenido del editor (JSON libre) → valores tipados
// ---------------------------------------------------------------------------

export type Content = Record<string, unknown>

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Texto con valor por defecto solo si la clave NO existe (vacío = ocultar). */
export function strOr(content: Content, key: string, fallback: string | null): string | null {
  return key in content ? str(content[key]) : fallback
}

export function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Lista de objetos de un repeater; descarta lo que no sea objeto. */
export function items(value: unknown): Content[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is Content => !!v && typeof v === 'object' && !Array.isArray(v))
}

/** Líneas no vacías de un textarea («una por línea») o de un array de strings. */
export function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => str(v)).filter((v): v is string => v !== null)
  const s = str(value)
  if (!s) return []
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Enlaces http(s), mailto/tel/wa.me o rutas del propio sitio. Lo demás se descarta. */
export function safeHref(value: unknown): string | null {
  const url = str(value)
  if (!url) return null
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url) ? url : null
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

// ---------------------------------------------------------------------------
// Zona horaria
// ---------------------------------------------------------------------------

export const FALLBACK_TZ = 'America/Bogota'

function safeTz(timeZone: string | null | undefined): string {
  if (!timeZone) return FALLBACK_TZ
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return FALLBACK_TZ
  }
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number // 0 = domingo
}

/** Fecha y hora de pared de `instant` en la zona indicada. */
export function wallClockIn(instant: Date, timeZone: string | null | undefined): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: Math.max(0, weekdays.indexOf(get('weekday'))),
  }
}

/**
 * Instante UTC de una hora de pared («2026-10-24 19:30») en la zona dada.
 * Dos pasadas: corrige el desfase y el posible cambio de horario.
 */
export function zonedToInstant(date: PlainDate, time: string | null, timeZone: string | null | undefined): Date {
  const [h, m] = parseHm(time) ?? [0, 0]
  const asUtc = Date.UTC(date.year, date.month - 1, date.day, h, m)
  let guess = asUtc
  for (let i = 0; i < 2; i++) {
    const wc = wallClockIn(new Date(guess), timeZone)
    const wcUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute)
    guess += asUtc - wcUtc
  }
  return new Date(guess)
}

// ---------------------------------------------------------------------------
// Fechas planas (columna `date` o campo de fecha del editor: sin zona)
// ---------------------------------------------------------------------------

export interface PlainDate {
  year: number
  month: number
  day: number
}

/** "YYYY-MM-DD" (o "YYYY-MM-DDTHH:MM", del que solo se toma el día escrito). */
export function parsePlainDate(value: unknown): PlainDate | null {
  const s = str(value)
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  const check = new Date(Date.UTC(d.year, d.month - 1, d.day))
  if (check.getUTCMonth() !== d.month - 1 || check.getUTCDate() !== d.day) return null
  return d
}

const HM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function parseHm(value: unknown): [number, number] | null {
  const s = str(value)
  if (!s) return null
  const m = HM_RE.exec(s)
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** Formatea una fecha plana sin convertir zona (es una fecha de calendario). */
export function formatPlainDate(d: PlainDate, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-CO', { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(d.year, d.month - 1, d.day, 12)),
  )
}

// ---------------------------------------------------------------------------
// Eventos (contenido de la sección: no hay tabla de eventos en la base)
// ---------------------------------------------------------------------------

export type EventStatus = 'available' | 'new' | 'few_left' | 'sold_out'
export const EVENT_STATUSES: readonly EventStatus[] = ['available', 'new', 'few_left', 'sold_out']

export interface SiteEvent {
  key: string
  slug: string
  title: string
  date: PlainDate
  startTime: string | null
  endTime: string | null
  location: string | null
  price: number | null
  priceNote: string | null
  capacity: number | null
  status: EventStatus
  imageUrl: string | null
  imageAlt: string | null
  description: string | null
  includes: string[]
  ctaUrl: string | null
  /** Fin del evento (o fin del día si no tiene hora de fin) como instante UTC. */
  endsAt: number
  startsAt: number
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Normaliza el repeater `events`. Descarta los que no tienen título o fecha válida. */
export function parseEvents(raw: unknown, timeZone: string | null | undefined): SiteEvent[] {
  const out: SiteEvent[] = []
  const used = new Set<string>()
  items(raw).forEach((e, i) => {
    const title = str(e.title)
    const date = parsePlainDate(e.date)
    if (!title || !date) return
    const startTime = parseHm(e.start_time) ? str(e.start_time) : null
    const endTime = parseHm(e.end_time) ? str(e.end_time) : null
    const startsAt = zonedToInstant(date, startTime, timeZone).getTime()
    // Sin hora de fin: el evento sigue visible hasta que termina su día.
    let endsAt = endTime
      ? zonedToInstant(date, endTime, timeZone).getTime()
      : zonedToInstant(date, '23:59', timeZone).getTime() + 59_999
    // Fin antes del inicio = cruza medianoche.
    if (endTime && endsAt <= startsAt) endsAt += 24 * 60 * 60 * 1000
    let slug = str(e.slug) ? slugify(String(e.slug)) : slugify(title)
    if (!slug) slug = `evento-${i + 1}`
    while (used.has(slug)) slug = `${slug}-${i + 1}`
    used.add(slug)
    out.push({
      key: `${slug}-${i}`,
      slug,
      title,
      date,
      startTime,
      endTime,
      location: str(e.location),
      price: num(e.price),
      priceNote: str(e.price_note),
      capacity: num(e.capacity),
      status: oneOf(e.status, EVENT_STATUSES, 'available'),
      imageUrl: str(e.image_url),
      imageAlt: str(e.image_alt),
      description: str(e.description),
      includes: lines(e.includes),
      ctaUrl: safeHref(e.cta_url),
      endsAt,
      startsAt,
    })
  })
  return out.sort((a, b) => a.startsAt - b.startsAt)
}

export function upcomingEvents(events: SiteEvent[], now: number): SiteEvent[] {
  return events.filter((e) => e.endsAt > now)
}

/** Archivo .ics (RFC 5545) de un evento, con horas en UTC. */
export function buildIcs(event: SiteEvent, organizationName: string, url: string | null): string {
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)
  const end = event.endTime ? event.endsAt : event.startsAt + 2 * 60 * 60 * 1000
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GO Admin//Sitio web//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.slug}-${event.startsAt}@goadmin.io`,
    `DTSTAMP:${fmt(Date.now())}`,
    `DTSTART:${fmt(event.startsAt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(event.title)}`,
    event.description ? `DESCRIPTION:${esc(event.description)}` : null,
    event.location ? `LOCATION:${esc(event.location)}` : `LOCATION:${esc(organizationName)}`,
    url ? `URL:${url}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)
  return lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

/** URLs que next/image puede optimizar (remotePatterns de next.config.js). */
export function isOptimizableImage(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Apariencia de tarjetas (CARD_FIELDS del editor)
// ---------------------------------------------------------------------------

const CARD_SHADOWS: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
}

/**
 * Subconjunto de CARD_FIELDS que tiene sentido en tarjetas y fotos de estas
 * secciones: radio, fondo, borde y sombra. Estilo en línea para que gane a
 * las clases del diseño solo cuando el editor fijó un valor. (`buildCardStyle`
 * de lib/sectionStyle añade además layout y alineación, que aquí romperían
 * el diseño.)
 */
export interface CardVisual {
  /** Tarjetas con fondo propio (paquetes, formulario, accesos del hero). */
  card: CSSProperties
  /** Fotos (platos, equipo, galería): solo el radio. */
  media: CSSProperties
}

export function cardVisual(content: Content): CardVisual {
  const card: CSSProperties = {}
  const media: CSSProperties = {}
  const radius = num(content.card_radius)
  if (radius !== null && radius >= 0) {
    card.borderRadius = `${radius}px`
    media.borderRadius = `${radius}px`
  }
  const bg = str(content.card_bg)
  if (bg) card.backgroundColor = bg
  const borderWidth = num(content.card_border_width)
  if (borderWidth !== null && borderWidth > 0) {
    card.borderWidth = `${borderWidth}px`
    card.borderStyle = 'solid'
    const color = str(content.card_border_color)
    if (color) card.borderColor = color
  }
  const shadow = str(content.card_shadow)
  if (shadow && CARD_SHADOWS[shadow]) card.boxShadow = CARD_SHADOWS[shadow]
  return { card, media }
}
