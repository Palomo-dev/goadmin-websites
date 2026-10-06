'use client'

/**
 * Vista cliente de `events` (Figma 147:7029 / 147:7087 y móviles).
 *
 * Movimiento (notas 149:7752 y 149:7880):
 *  - list: filas con fade-up y stagger 60 ms; la fecha grande se revela
 *    desde una máscara.
 *  - detail: zoom lento de la imagen al entrar (1.05 → 1) y fade-up del texto.
 *  - prefers-reduced-motion: sin animación.
 *
 * Fechas: el editor guarda fecha y hora de pared de la organización. Se
 * formatean como fecha de calendario (sin convertir zona) y la comparación
 * con «ahora» usa el instante calculado con la zona de la organización.
 */

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Check, ChevronDown, Clock, MapPin, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Price } from '@/components/site/CurrencyProvider'
import { buildIcs, formatPlainDate, upcomingEvents, type SiteEvent } from '@/lib/restaurant/secciones'
import { SiteImage } from './SiteImage'
import { SectionHeading } from './SectionHeading'
import { EditorHint } from './EditorHint'
import { CtaLink } from './RestaurantHeroView'
import { useSectionMotion } from './useSectionMotion'
import m from './motion.module.css'

export type EventsVariant = 'list' | 'detail'

export interface EventsViewProps {
  variant: EventsVariant
  events: SiteEvent[]
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  detailUrl: string | null
  listUrl: string | null
  reserveUrl: string | null
  reserveText: string
  emptyText: string | null
  organizationName: string
  /** Radio de la imagen (CARD_FIELDS del editor). */
  mediaStyle: React.CSSProperties
  sectionKey: string
}

const ACCENT = 'var(--accent-color, var(--primary-color))'

/** «Ahora», refrescado cada minuto: un evento que termina desaparece solo. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function StatusBadge({ event }: { event: SiteEvent }) {
  if (event.status === 'available') return null
  const label = event.status === 'few_left' ? 'Últimos cupos' : event.status === 'new' ? 'Nuevo' : 'Agotado'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium leading-4',
        event.status === 'few_left' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        event.status === 'sold_out' && 'bg-muted text-muted-foreground',
        event.status === 'new' && 'text-white',
      )}
      style={event.status === 'new' ? { backgroundColor: 'var(--primary-color)' } : undefined}
    >
      {label}
    </span>
  )
}

function timeRange(e: SiteEvent): string | null {
  if (e.startTime && e.endTime) return `${e.startTime} – ${e.endTime}`
  return e.startTime
}

function PriceText({ event }: { event: SiteEvent }) {
  if (event.price === null) return null
  return (
    <>
      <Price value={event.price} />
      {` ${event.priceNote ?? 'por persona'}`}
    </>
  )
}

function eventHref(base: string, slug: string): string {
  const [path, hash] = base.split('#')
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}evento=${encodeURIComponent(slug)}${hash ? `#${hash}` : ''}`
}

function downloadIcs(event: SiteEvent, organizationName: string) {
  const ics = buildIcs(event, organizationName, window.location.href)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.slug}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function EventsView(props: EventsViewProps) {
  const now = useNow()
  const upcoming = upcomingEvents(props.events, now)

  if (upcoming.length === 0) {
    const hint = (
      <EditorHint title={props.events.length === 0 ? 'Sección de eventos vacía' : 'Todos los eventos ya pasaron'}>
        {props.events.length === 0
          ? 'Agrega eventos en «Eventos» con fecha y hora locales. Los que ya terminaron se ocultan solos.'
          : 'Los eventos pasados se ocultan automáticamente. Agrega nuevas fechas en «Eventos».'}
      </EditorHint>
    )
    if (!props.emptyText) return hint
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
        <p className="text-base leading-6 text-muted-foreground">{props.emptyText}</p>
        {hint}
      </div>
    )
  }

  return props.variant === 'detail' ? (
    <EventDetail {...props} upcoming={upcoming} />
  ) : (
    <EventList {...props} upcoming={upcoming} />
  )
}

type WithUpcoming = EventsViewProps & { upcoming: SiteEvent[] }

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

function EventList(props: WithUpcoming) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  const [open, setOpen] = useState<string | null>(null)
  const baseId = useId()

  return (
    <div ref={ref} {...motionProps} className="flex flex-col gap-8" style={{ '--stagger': '60ms' } as React.CSSProperties}>
      <SectionHeading eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
      <ul className="flex flex-col">
        {props.upcoming.map((event, i) => {
          const day = formatPlainDate(event.date, { day: '2-digit' })
          const month = formatPlainDate(event.date, { month: 'short' }).replace('.', '').toUpperCase()
          const fullDate = formatPlainDate(event.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          const meta = [event.startTime, event.location].filter(Boolean).join(' · ')
          const soldOut = event.status === 'sold_out'
          const reserveUrl = event.ctaUrl ?? props.reserveUrl
          const panelId = `${baseId}-${i}`
          const expanded = open === event.key

          return (
            <li
              key={event.key}
              className={cn('border-b border-border py-6', m.fadeUp)}
              style={{ '--i': i } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4 md:flex-nowrap md:gap-10">
                <p className="flex w-16 shrink-0 flex-col items-center md:w-[120px]">
                  <span className="sr-only">{fullDate}</span>
                  <span className={m.mask} aria-hidden="true">
                    <span
                      className={cn(m.maskInner, 'text-4xl font-bold leading-10 text-foreground [font-family:var(--font-heading)] md:text-6xl md:leading-[60px]')}
                      style={{ '--i': i } as React.CSSProperties}
                    >
                      {day}
                    </span>
                  </span>
                  <span className="text-xs font-medium leading-4 tracking-[0.12em]" style={{ color: ACCENT }} aria-hidden="true">
                    {month}
                  </span>
                </p>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h3 className="text-xl font-bold leading-7 text-foreground [font-family:var(--font-heading)] md:text-2xl md:leading-8">
                    {event.title}
                  </h3>
                  <p className="text-sm leading-5 text-muted-foreground">
                    {meta}
                    {event.price !== null && (
                      <>
                        {meta ? ' · ' : ''}
                        <PriceText event={event} />
                      </>
                    )}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end">
                  <StatusBadge event={event} />
                  {soldOut ? (
                    reserveUrl ? (
                      <Link href={reserveUrl} className="px-4 py-2 text-base font-medium leading-6 hover:underline" style={{ color: ACCENT }}>
                        Lista de espera
                      </Link>
                    ) : null
                  ) : props.detailUrl ? (
                    <Link
                      href={eventHref(props.detailUrl, event.slug)}
                      className="rounded-lg border px-4 py-2 text-base font-medium leading-6 transition-colors hover:bg-muted"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      Ver detalle
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setOpen(expanded ? null : event.key)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-base font-medium leading-6 transition-colors hover:bg-muted"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      Ver detalle
                      <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {!props.detailUrl && !soldOut && (
                <div id={panelId} hidden={!expanded} className="pt-6 md:pl-[160px]">
                  <EventInfo event={event} {...props} compact />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// detail
// ---------------------------------------------------------------------------

function EventDetail(props: WithUpcoming) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  // ?evento=<slug> elige el evento; sin él, el próximo. Se lee tras montar
  // para no exigir un Suspense alrededor de useSearchParams.
  const [slug, setSlug] = useState<string | null>(null)
  useEffect(() => {
    setSlug(new URLSearchParams(window.location.search).get('evento'))
  }, [])
  const event = (slug ? props.upcoming.find((e) => e.slug === slug) : null) ?? props.upcoming[0]
  const requestedPast = slug !== null && !props.upcoming.some((e) => e.slug === slug)

  return (
    <div ref={ref} {...motionProps} className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex gap-1.5 text-sm leading-5">
        {props.listUrl ? (
          <Link href={props.listUrl} className="text-muted-foreground hover:text-foreground">
            {props.title || 'Eventos'}
          </Link>
        ) : (
          <span className="text-muted-foreground">{props.title || 'Eventos'}</span>
        )}
        <span aria-hidden="true" className="text-muted-foreground/70">/</span>
        <span className="text-foreground" aria-current="page">{event.title}</span>
      </nav>
      {requestedPast && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm leading-5 text-muted-foreground" role="status">
          Ese evento ya pasó. Te mostramos el próximo.
        </p>
      )}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,680fr)_minmax(0,536fr)] md:gap-16">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted md:aspect-auto md:h-[520px]" style={props.mediaStyle}>
          <div className={cn('absolute inset-0', m.settle)}>
            <SiteImage src={event.imageUrl} alt={event.imageAlt ?? event.title} sizes="(min-width: 768px) 55vw, 100vw" />
          </div>
        </div>
        <div className={cn('flex flex-col gap-4', m.fadeUp)}>
          <StatusBadge event={event} />
          <h2 className="text-3xl font-bold leading-9 text-foreground [font-family:var(--font-heading)] md:text-5xl md:leading-[48px]">
            {event.title}
          </h2>
          <EventInfo event={event} {...props} />
        </div>
      </div>
    </div>
  )
}

function EventInfo({
  event,
  reserveUrl,
  reserveText,
  organizationName,
  compact = false,
}: WithUpcoming & { event: SiteEvent; compact?: boolean }) {
  const fullDate = formatPlainDate(event.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const range = timeRange(event)
  const cta = event.ctaUrl ?? reserveUrl
  const soldOut = event.status === 'sold_out'
  const row = 'flex items-center gap-2 text-base leading-6 text-foreground'
  const icon = 'h-[18px] w-[18px] shrink-0 text-muted-foreground'

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <ul className="flex flex-col gap-3">
          <li className={row}>
            <CalendarDays className={icon} aria-hidden="true" />
            <span className="first-letter:uppercase">{fullDate}</span>
          </li>
          {range && (
            <li className={row}>
              <Clock className={icon} aria-hidden="true" />
              {range}
            </li>
          )}
          {event.location && (
            <li className={row}>
              <MapPin className={icon} aria-hidden="true" />
              {event.location}
            </li>
          )}
          {(event.price !== null || event.capacity !== null) && (
            <li className={row}>
              <Ticket className={icon} aria-hidden="true" />
              <span>
                <PriceText event={event} />
                {event.price !== null && event.capacity !== null ? ' · ' : ''}
                {event.capacity !== null ? `cupo para ${event.capacity}` : ''}
              </span>
            </li>
          )}
        </ul>
      )}
      {compact && range && <p className="text-sm leading-5 text-muted-foreground">{range}</p>}
      {event.description && <p className="whitespace-pre-line text-base leading-6 text-muted-foreground">{event.description}</p>}
      {event.includes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium leading-6 text-foreground">Incluye</p>
          <ul className="flex flex-col gap-2">
            {event.includes.map((line, i) => (
              <li key={i} className="flex items-center gap-2 text-sm leading-5 text-foreground">
                <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {cta && !soldOut && (
          <div className="flex-1 [&>a]:w-full">
            <CtaLink cta={{ text: reserveText, url: cta }} kind="primary" />
          </div>
        )}
        <button
          type="button"
          onClick={() => downloadIcs(event, organizationName)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-6 py-3 text-base font-medium leading-6 transition-colors hover:bg-muted"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          Añadir al calendario
        </button>
      </div>
    </div>
  )
}
