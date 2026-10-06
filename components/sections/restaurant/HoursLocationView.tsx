'use client'

/**
 * Horario y sedes (Figma Locations 144:6644) — vista cliente.
 *
 * Variantes:
 *  - `hours_map`: horario de una sede (hoy resaltado) + mapa.
 *  - `cards`:     tarjeta por sede con estado en vivo y Reservar / Cómo llegar / Pedir.
 *  - `list`:      buscador + lista desplegable (pensada para 4+ sedes).
 *
 * «Abierto ahora / Cierra a las …» se calcula con el horario de la sede
 * (`branches.opening_hours`) en SU zona horaria, y se recalcula cada minuto.
 * Hasta el montaje no se pinta el estado, para que el HTML cacheado no muestre
 * un estado viejo. Festivos: no hay datos de festivos por sede (pendiente).
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, ImageIcon, MapPin, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildCardStyle, resolveImageFitClass, resolveImageRatioClass } from '@/lib/sectionStyle'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'
import {
  ahoraEnZona,
  estadoApertura,
  filasHorario,
  type Apertura,
  type Dia,
  type HorarioSemana,
} from '@/lib/restaurant/horario'

export type HoursLocationVariant = 'hours_map' | 'cards' | 'list'

export interface SedeVista {
  id: number
  nombre: string
  direccion: string | null
  telefono: string | null
  telHref: string | null
  comoLlegar: string | null
  mapaEmbed: string | null
  horario: HorarioSemana | null
  zonaHoraria: string
  foto: string | null
  lat: number | null
  lng: number | null
  /** Enlace a la reserva con la sede preseleccionada; null si no acepta reservas. */
  reservar: string | null
  pedir: string | null
}

interface HoursLocationViewProps {
  variant: HoursLocationVariant
  sedes: SedeVista[]
  /** No se pudieron leer las sedes. */
  sinDatos: boolean
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  showMap: boolean
  showPhotos: boolean
  /** `content` completo: estilo de tarjeta del editor (CARD_FIELDS). */
  cardContent: Record<string, unknown>
  sectionKey: string
}

const PRIMARY = 'var(--primary-color)'
const ACCENT = 'var(--accent-color, var(--primary-color))'

const fadeUp = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:[animation-duration:600ms] motion-safe:fill-mode-both'

// ---------------------------------------------------------------------------
// Estado en vivo
// ---------------------------------------------------------------------------

interface EstadoSede {
  apertura: Apertura | null
  hoy: Dia
}

/** Estado de cada sede, recalculado cada minuto. `null` antes del montaje. */
function useEstadosEnVivo(sedes: SedeVista[]): Map<number, EstadoSede> | null {
  const [estados, setEstados] = useState<Map<number, EstadoSede> | null>(null)
  useEffect(() => {
    const calcular = () => {
      const m = new Map<number, EstadoSede>()
      for (const s of sedes) {
        const ahora = ahoraEnZona(s.zonaHoraria)
        m.set(s.id, { apertura: estadoApertura(s.horario, ahora), hoy: ahora.dia })
      }
      setEstados(m)
    }
    calcular()
    const id = window.setInterval(calcular, 60_000)
    return () => window.clearInterval(id)
  }, [sedes])
  return estados
}

const BADGE: Record<Apertura['estado'], { fondo: string; texto: string; punto: string }> = {
  open: {
    fondo: 'bg-green-50 dark:bg-green-900/30',
    texto: 'text-green-700 dark:text-green-300',
    punto: 'bg-green-600 dark:bg-green-400',
  },
  closing_soon: {
    fondo: 'bg-amber-50 dark:bg-amber-900/30',
    texto: 'text-amber-700 dark:text-amber-300',
    punto: 'bg-amber-500',
  },
  closed: {
    fondo: 'bg-red-50 dark:bg-red-900/30',
    texto: 'text-red-700 dark:text-red-300',
    punto: 'bg-red-600 dark:bg-red-400',
  },
}

function OpenStatusBadge({ apertura }: { apertura: Apertura }) {
  const c = BADGE[apertura.estado]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1', c.fondo)}>
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', c.punto, apertura.estado !== 'closed' && 'motion-safe:animate-pulse')} />
      <span className={cn('text-xs font-medium leading-4', c.texto)}>{apertura.texto}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Encabezado({ eyebrow, title, subtitle, tituloDefecto }: { eyebrow: string | null; title: string | null; subtitle: string | null; tituloDefecto: string }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <p className="text-xs font-medium uppercase leading-4 tracking-[0.12em]" style={{ color: ACCENT }}>
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-bold leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>
        {title || tituloDefecto}
      </h2>
      {subtitle && <p className="max-w-3xl text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

const botonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-2'

function Acciones({ sede, abierta, compacto }: { sede: SedeVista; abierta: boolean | null; compacto: boolean }) {
  const tam = compacto ? 'flex-1 px-3 py-1.5 text-sm' : 'px-4 py-2 text-base'
  const items: ReactNode[] = []
  if (sede.reservar) {
    items.push(
      <Link key="reservar" href={sede.reservar} className={cn(botonBase, tam, 'text-white hover:opacity-90')} style={{ backgroundColor: PRIMARY }}>
        Reservar<span className="sr-only"> en {sede.nombre}</span>
      </Link>,
    )
  }
  if (sede.comoLlegar) {
    items.push(
      <a
        key="llegar"
        href={sede.comoLlegar}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(botonBase, tam, !sede.reservar ? 'text-white hover:opacity-90' : 'border hover:bg-muted')}
        style={!sede.reservar ? { backgroundColor: PRIMARY } : { borderColor: ACCENT, color: ACCENT }}
      >
        Cómo llegar<span className="sr-only"> a {sede.nombre} (se abre en una pestaña nueva)</span>
      </a>,
    )
  }
  if (sede.telHref) {
    items.push(
      <a key="llamar" href={sede.telHref} className={cn(botonBase, tam, compacto ? 'hover:underline' : 'border hover:bg-muted')} style={{ borderColor: ACCENT, color: ACCENT }}>
        Llamar<span className="sr-only"> a {sede.nombre}</span>
      </a>,
    )
  }
  if (sede.pedir) {
    const cerrada = abierta === false
    items.push(
      cerrada ? (
        <span key="pedir" className={cn(botonBase, tam, 'cursor-not-allowed opacity-50')} style={{ color: ACCENT }} aria-disabled="true" title="La sede está cerrada ahora">
          Pedir<span className="sr-only"> (cerrado ahora)</span>
        </span>
      ) : (
        <Link key="pedir" href={sede.pedir} className={cn(botonBase, tam, 'hover:underline')} style={{ color: ACCENT }}>
          Pedir<span className="sr-only"> en {sede.nombre}</span>
        </Link>
      ),
    )
  }
  if (items.length === 0) return null
  return <div className={cn('flex flex-wrap gap-2', compacto ? 'w-full' : 'gap-3')}>{items}</div>
}

function TablaHorario({ horario, hoy }: { horario: HorarioSemana; hoy: Dia | null }) {
  return (
    <dl className="w-full">
      {filasHorario(horario, hoy).map((f) => (
        <div
          key={f.etiqueta}
          className={cn('flex justify-between gap-4 border-b border-border py-3', f.esHoy && 'rounded-xl bg-muted px-3 font-medium')}
        >
          <dt>
            {f.etiqueta}
            {f.esHoy && ' (hoy)'}
          </dt>
          <dd className={f.horas ? '' : 'text-muted-foreground'}>{f.horas ?? 'Cerrado'}</dd>
        </div>
      ))}
    </dl>
  )
}

function Contacto({ sede }: { sede: SedeVista }) {
  return (
    <>
      {sede.direccion && (
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span>{sede.direccion}</span>
        </p>
      )}
      {sede.telefono && (
        <p className="flex items-center gap-2">
          <Phone className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {sede.telHref ? (
            <a href={sede.telHref} className="hover:underline">
              {sede.telefono}
            </a>
          ) : (
            <span>{sede.telefono}</span>
          )}
        </p>
      )}
    </>
  )
}

function AvisoEditor({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-500/60 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Horario y sedes · solo visible en el editor</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

export function HoursLocationView(props: HoursLocationViewProps) {
  const { variant, sedes } = props
  const isPreview = useIsPreviewMode()
  const estados = useEstadosEnVivo(sedes)
  const [sedeActiva, setSedeActiva] = useState<number | null>(sedes[0]?.id ?? null)
  const [busqueda, setBusqueda] = useState('')
  const [origen, setOrigen] = useState<{ lat: number; lng: number } | null>(null)
  const [ubicando, setUbicando] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState('')
  const [expandida, setExpandida] = useState<number | null>(null)

  const card = useMemo(() => {
    const c = props.cardContent
    const { className, style } = buildCardStyle({ ...c, card_padding: null })
    const pad = c.card_padding
    const padding: CSSProperties =
      typeof pad === 'number' ? { padding: `${pad}px` } : typeof pad === 'string' && pad ? { padding: { none: '0px', sm: '8px', md: '16px', lg: '24px', xl: '32px' }[pad] ?? pad } : {}
    return {
      className: cn(
        className,
        typeof c.card_radius !== 'number' && 'rounded-xl',
        typeof c.card_border_width !== 'number' && 'border border-border',
        !c.card_bg && 'bg-card text-card-foreground',
      ),
      style,
      padding,
      ratio: typeof c.image_ratio === 'string' ? resolveImageRatioClass(c.image_ratio) : 'h-[200px]',
      fit: resolveImageFitClass(typeof c.image_fit === 'string' ? c.image_fit : 'cover'),
    }
  }, [props.cardContent])

  if (sedes.length === 0) {
    if (!isPreview) return null
    return (
      <AvisoEditor>
        {props.sinDatos
          ? 'No se pudieron leer las sedes de la organización.'
          : 'No hay sedes activas para mostrar. Créalas (dirección, teléfono y horario) en el ERP › Organización › Sedes, o revisa las sedes elegidas en la sección.'}
      </AvisoEditor>
    )
  }

  const sinHorario = sedes.filter((s) => !s.horario).map((s) => s.nombre)
  const avisoHorario =
    isPreview && sinHorario.length > 0 ? (
      <AvisoEditor>Sin horario de atención: {sinHorario.join(', ')}. Configúralo en el ERP › Sedes para mostrar «Abierto ahora».</AvisoEditor>
    ) : null

  // ── Horario + mapa (una sede) ──
  if (variant === 'hours_map') {
    const sede = sedes.find((s) => s.id === sedeActiva) ?? sedes[0]
    const estado = estados?.get(sede.id) ?? null
    const conMapa = props.showMap && !!sede.mapaEmbed
    return (
      <div className="flex flex-col gap-8">
        <Encabezado eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} tituloDefecto="Horario y ubicación" />
        {avisoHorario}
        {sedes.length > 1 && (
          <div role="tablist" aria-label="Sedes" className="flex flex-wrap gap-2">
            {sedes.map((s) => (
              <button
                key={s.id}
                role="tab"
                type="button"
                aria-selected={s.id === sede.id}
                onClick={() => setSedeActiva(s.id)}
                className={cn('rounded-lg px-4 py-2 text-sm', s.id === sede.id ? 'text-white' : 'border border-border hover:bg-muted')}
                style={s.id === sede.id ? { backgroundColor: PRIMARY } : undefined}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}
        <div className={cn('grid items-start gap-8 md:gap-12', conMapa && 'md:grid-cols-[minmax(0,480px)_1fr]')}>
          <div className={cn('flex flex-col items-start gap-4', fadeUp)}>
            {estado?.apertura && <OpenStatusBadge apertura={estado.apertura} />}
            <h3 className="text-2xl font-bold leading-8" style={{ fontFamily: 'var(--font-heading)' }}>
              {sede.nombre}
            </h3>
            {sede.horario && <TablaHorario horario={sede.horario} hoy={estado?.hoy ?? null} />}
            <Contacto sede={sede} />
            <Acciones sede={sede} abierta={estado?.apertura ? estado.apertura.estado !== 'closed' : null} compacto={false} />
          </div>
          {conMapa && (
            <iframe
              key={sede.id}
              src={sede.mapaEmbed ?? undefined}
              title={`Mapa de ${sede.nombre}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[320px] w-full rounded-xl border-0 bg-muted md:h-[480px]"
            />
          )}
        </div>
      </div>
    )
  }

  // ── Tarjetas ──
  if (variant === 'cards') {
    return (
      <div className="flex flex-col gap-8">
        <Encabezado eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} tituloDefecto="Nuestras sedes" />
        {avisoHorario}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sedes.map((sede, i) => {
            const estado = estados?.get(sede.id) ?? null
            return (
              <li
                key={sede.id}
                className={cn(card.className, fadeUp)}
                style={{ ...card.style, animationDelay: `${i * 80}ms` }}
              >
                {props.showPhotos && (sede.foto || isPreview) && (
                  <div className={cn('relative flex w-full items-center justify-center overflow-hidden bg-muted', card.ratio)}>
                    {sede.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sede.foto} alt="" loading="lazy" className={cn('absolute inset-0 h-full w-full', card.fit)} />
                    ) : (
                      <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="h-7 w-7" aria-hidden="true" />
                        Portada de la sede (ERP › Sedes)
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-1 flex-col items-start gap-3 p-5" style={card.padding}>
                  {estado?.apertura && <OpenStatusBadge apertura={estado.apertura} />}
                  <h3 className="text-2xl font-bold leading-8" style={{ fontFamily: 'var(--font-heading)' }}>
                    {sede.nombre}
                  </h3>
                  {sede.direccion && <p className="text-sm leading-5 text-muted-foreground">{sede.direccion}</p>}
                  {estado?.apertura && <p className="text-sm leading-5">{estado.apertura.hoy}</p>}
                  <div className="mt-auto w-full pt-1">
                    <Acciones sede={sede} abierta={estado?.apertura ? estado.apertura.estado !== 'closed' : null} compacto />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // ── Lista con buscador ──
  const conCoordenadas = sedes.some((s) => s.lat !== null && s.lng !== null)
  const q = normalizar(busqueda.trim())
  const filtradas = sedes
    .filter((s) => !q || normalizar(`${s.nombre} ${s.direccion ?? ''}`).includes(q))
    .map((s) => ({ s, km: origen && s.lat !== null && s.lng !== null ? distanciaKm(origen, { lat: s.lat, lng: s.lng }) : null }))
    .sort((a, b) => (a.km === null ? 1 : b.km === null ? -1 : a.km - b.km))
  const buscadorId = `buscar-sede-${props.sectionKey}`

  const usarUbicacion = () => {
    if (!navigator.geolocation) {
      setErrorUbicacion('Tu navegador no permite compartir la ubicación.')
      return
    }
    setUbicando(true)
    setErrorUbicacion('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigen({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setUbicando(false)
      },
      () => {
        setErrorUbicacion('No pudimos obtener tu ubicación.')
        setUbicando(false)
      },
      { timeout: 10_000, maximumAge: 300_000 },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Encabezado eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} tituloDefecto="Encuentra tu sede" />
      {avisoHorario}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={buscadorId} className="text-sm leading-5">
            Buscar
          </label>
          <input
            id={buscadorId}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Barrio o ciudad"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]"
          />
        </div>
        {conCoordenadas && (
          <button
            type="button"
            onClick={usarUbicacion}
            disabled={ubicando}
            className={cn(botonBase, 'border px-4 py-2 hover:bg-muted disabled:opacity-50')}
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            {ubicando ? 'Ubicando…' : 'Usar mi ubicación'}
          </button>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {filtradas.length} {filtradas.length === 1 ? 'sede' : 'sedes'}
        {origen ? ', ordenadas por cercanía' : ''}
      </p>
      {errorUbicacion && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errorUbicacion}</p>}
      {filtradas.length === 0 ? (
        <p className="text-muted-foreground">No encontramos sedes con «{busqueda}».</p>
      ) : (
        <ul className="flex flex-col">
          {filtradas.map(({ s: sede, km }, i) => {
            const estado = estados?.get(sede.id) ?? null
            const abierta = expandida === sede.id
            const panelId = `sede-${props.sectionKey}-${sede.id}`
            const linea = [sede.direccion, estado?.apertura?.hoy, km !== null ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km` : null]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={sede.id} className={cn('border-b border-border', fadeUp)} style={{ animationDelay: `${Math.min(i, 12) * 80}ms` }}>
                <button
                  type="button"
                  aria-expanded={abierta}
                  aria-controls={panelId}
                  onClick={() => setExpandida(abierta ? null : sede.id)}
                  className="flex w-full items-center gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xl font-bold leading-7" style={{ fontFamily: 'var(--font-heading)' }}>
                        {sede.nombre}
                      </span>
                      {estado?.apertura && <OpenStatusBadge apertura={estado.apertura} />}
                    </span>
                    {linea && <span className="text-sm leading-5 text-muted-foreground">{linea}</span>}
                  </span>
                  <ChevronRight
                    className={cn('h-5 w-5 shrink-0 transition-transform motion-reduce:transition-none', abierta && 'rotate-90')}
                    aria-hidden="true"
                  />
                </button>
                {abierta && (
                  <div id={panelId} className="flex flex-col gap-4 pb-6 md:flex-row md:gap-12">
                    {sede.horario && (
                      <div className="w-full md:max-w-[420px]">
                        <TablaHorario horario={sede.horario} hoy={estado?.hoy ?? null} />
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-3">
                      <Contacto sede={sede} />
                      <Acciones sede={sede} abierta={estado?.apertura ? estado.apertura.estado !== 'closed' : null} compacto={false} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
