'use client'

/**
 * Reserva de mesa (Figma TableReservation 141:5796) — vista cliente.
 *
 * Variantes:
 *  - `stepper`:     personas → día → hora disponible → datos (ReservationStep).
 *  - `form_image`:  formulario completo con imagen del salón.
 *  - `band`:        banda con botón; abre el formulario en línea (o va a `cta_url`).
 *  - `hero_widget`: hero con widget personas/día/hora; los datos se piden después.
 *  - `external`:    botón a un proveedor externo configurado (sin iframe).
 *
 * Todas usan el mismo flujo: `useReservaMesa` → `/api/restaurant-reservations`
 * (disponibilidad y creación con las RPC del ERP). «Hoy» y los días ofrecidos
 * se calculan en la zona de la sede, no del navegador.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, Check, ExternalLink, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { useReservaMesa, type FranjaDisponible, type ReservaCreada } from '@/lib/restaurant/useReservaMesa'
import { fechaCorta, fechaLarga, hoyEnZona, instanteEnZona, sumarDias } from '@/lib/restaurant/horario'
import { AJUSTES_RESERVA_POR_DEFECTO, type AjustesReserva, limitesPersonas } from '@/lib/restaurant/sedes-modelo'

export type ReservationVariant = 'stepper' | 'form_image' | 'band' | 'hero_widget' | 'external'

export interface SedeReserva {
  id: number
  nombre: string
  direccion: string | null
  /** Teléfono de la sede: «Contáctanos» de los grupos grandes. */
  telefono?: string | null
  zonaHoraria: string
  ajustes: AjustesReserva | null
}

export interface ReservationViewProps {
  variant: ReservationVariant
  organizationId: number
  organizationName: string
  /** Sedes que aceptan reservas (ya filtradas). */
  sedes: SedeReserva[]
  /** Reserva sin sede (mesas sin sede o sin datos de sedes). */
  sinSede: { zonaHoraria: string; ajustes: AjustesReserva | null } | null
  /** Por qué no se puede reservar; sólo se muestra en la vista previa del editor. */
  motivoSinReservas: string | null
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  ctaText: string | null
  ctaUrl: string | null
  imageUrl: string | null
  externalUrl: string | null
  externalButtonText: string | null
  minGuests: number | null
  maxGuests: number | null
  maxDays: number | null
  requireEmail: boolean
  showNotes: boolean
  policyText: string | null
  successMessage: string | null
  pendingMessage: string | null
  anchorId: string
  sectionKey: string
}

const PRIMARY = 'var(--primary-color)'
const ACCENT = 'var(--accent-color, var(--primary-color))'
const DURACION_TURNO_MIN = 90

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] dark:[color-scheme:dark] disabled:opacity-60'

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium leading-6 text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-color)] disabled:cursor-not-allowed disabled:opacity-50'

const outlineButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border bg-transparent px-4 py-2 text-base font-medium leading-6 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] disabled:opacity-50'

const fadeUp = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:[animation-duration:600ms]'

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase leading-4 tracking-[0.12em]" style={{ color: ACCENT }}>
      {children}
    </p>
  )
}

function AvisoEditor({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-500/60 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Reserva de mesa · solo visible en el editor</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}

function Campo({ id, label, children, ayuda }: { id: string; label: string; children: ReactNode; ayuda?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
      <label htmlFor={id} className="text-sm leading-5">
        {label}
      </label>
      {children}
      {ayuda && <p className="text-sm leading-5 text-muted-foreground">{ayuda}</p>}
    </div>
  )
}

function agruparFranjas(franjas: FranjaDisponible[]): { etiqueta: string; franjas: FranjaDisponible[] }[] {
  const grupos: { etiqueta: string; franjas: FranjaDisponible[] }[] = []
  for (const f of franjas) {
    const h = Number(f.time.slice(0, 2))
    const etiqueta = h < 11 ? 'Desayuno' : h < 17 ? 'Almuerzo' : 'Cena'
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.etiqueta === etiqueta) ultimo.franjas.push(f)
    else grupos.push({ etiqueta, franjas: [f] })
  }
  return grupos
}

function personasTexto(n: number) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

// ---------------------------------------------------------------------------
// Estado del flujo (común a todas las variantes)
// ---------------------------------------------------------------------------

function useFlujoReserva(props: ReservationViewProps) {
  const { sedes, sinSede, organizationId } = props
  const [sedeId, setSedeId] = useState<number | null>(sedes[0]?.id ?? null)

  // `?sede=<id>` (desde «Reservar» de la sección de sedes) preselecciona la sede.
  useEffect(() => {
    try {
      const pedida = Number(new URLSearchParams(window.location.search).get('sede'))
      if (sedes.some((s) => s.id === pedida)) setSedeId(pedida)
    } catch {
      /* noop */
    }
  }, [sedes])

  const sede = sedes.find((s) => s.id === sedeId) ?? sedes[0] ?? null
  const ajustes = sede ? sede.ajustes : sinSede?.ajustes ?? null
  const zona = sede?.zonaHoraria ?? sinSede?.zonaHoraria ?? 'America/Bogota'

  // La sección solo puede RESTRINGIR lo que fija la sede; sin ajustes, los
  // valores de la base (AJUSTES_RESERVA_POR_DEFECTO), no unos propios del sitio.
  const base = ajustes ?? AJUSTES_RESERVA_POR_DEFECTO
  const { min: minPersonas, max: maxPersonas } = limitesPersonas(ajustes, props.minGuests, props.maxGuests)
  const diasMax = Math.max(0, Math.min(base.maxDiasAnticipacion, props.maxDays ?? base.maxDiasAnticipacion))
  const grupoGrande = ajustes?.grupoGrande ?? null

  // «Hoy» en la zona de la sede. Se calcula en el cliente para no congelarlo en caché.
  const [hoy, setHoy] = useState<string | null>(null)
  useEffect(() => setHoy(hoyEnZona(zona)), [zona])
  const fechas = useMemo(() => (hoy ? Array.from({ length: diasMax + 1 }, (_, i) => sumarDias(hoy, i)) : []), [hoy, diasMax])

  const [personas, setPersonas] = useState(Math.min(Math.max(2, minPersonas), maxPersonas))
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [zonaMesa, setZonaMesa] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const [acepta, setAcepta] = useState(false)

  useEffect(() => {
    if (personas < minPersonas) setPersonas(minPersonas)
    else if (personas > maxPersonas) setPersonas(maxPersonas)
  }, [personas, minPersonas, maxPersonas])

  useEffect(() => {
    if (hoy && (!fecha || fecha < hoy || !fechas.includes(fecha))) setFecha(hoy)
  }, [hoy, fecha, fechas])

  useEffect(() => {
    if (zonaMesa && !(ajustes?.zonas ?? []).includes(zonaMesa)) setZonaMesa(null)
  }, [ajustes, zonaMesa])

  const reserva = useReservaMesa({
    organizationId,
    branchId: sede?.id ?? null,
    slotInterval: String(base.intervaloMinutos),
    errorMessage: 'No se pudo completar la reserva. Inténtalo de nuevo.',
    origen: 'ReservationView',
    limpiarFranjas: true,
  })
  const { checkAvailability } = reserva

  useEffect(() => {
    if (!fecha) return
    setHora('')
    void checkAvailability(fecha, '', personas, zonaMesa)
  }, [fecha, personas, zonaMesa, sede?.id, checkAvailability])

  const requiereTelefono = ajustes?.requiereTelefono ?? true
  const requiereEmail = props.requireEmail || ajustes?.requiereEmail === true
  const politica = ajustes?.politica ?? props.policyText

  /** Valida y envía. Devuelve false si falta algo (el mensaje queda en `reserva.errorMsg`). */
  /** Más personas que el umbral de la sede: no se reserva en línea, se contacta. */
  const esGrupoGrande = grupoGrande !== null && personas > grupoGrande

  const enviar = useCallback(async () => {
    if (esGrupoGrande) return reserva.fallar(`Para grupos de más de ${grupoGrande} personas, escríbenos y organizamos tu mesa.`)
    if (!fecha || !hora) return reserva.fallar('Selecciona día y hora.')
    if (!nombre.trim()) return reserva.fallar('Por favor ingresa tu nombre.')
    if (requiereTelefono && !telefono.trim()) return reserva.fallar('El celular es obligatorio.')
    if (requiereEmail && !email.trim()) return reserva.fallar('El correo es obligatorio.')
    if (!telefono.trim() && !email.trim()) return reserva.fallar('Se requiere al menos un celular o correo de contacto.')
    if (politica && !acepta) return reserva.fallar('Debes aceptar la política de reservas.')
    await reserva.submit({
      date: fecha,
      time: hora,
      guests: personas,
      name: nombre.trim(),
      phone: telefono.trim(),
      email: email.trim(),
      notes: notas.trim() || undefined,
      zone: zonaMesa,
    })
  }, [esGrupoGrande, grupoGrande, fecha, hora, nombre, telefono, email, notas, acepta, personas, zonaMesa, requiereTelefono, requiereEmail, politica, reserva])

  const reiniciar = () => {
    reserva.reiniciar()
    setHora('')
    setNotas('')
    setAcepta(false)
    if (fecha) void checkAvailability(fecha, '', personas, zonaMesa)
  }

  return {
    sedes,
    sede,
    setSedeId,
    ajustes,
    zona,
    hoy,
    fechas,
    minPersonas,
    maxPersonas,
    personas,
    setPersonas,
    fecha,
    setFecha,
    hora,
    setHora,
    zonaMesa,
    setZonaMesa,
    nombre,
    setNombre,
    telefono,
    setTelefono,
    email,
    setEmail,
    notas,
    setNotas,
    acepta,
    setAcepta,
    requiereTelefono,
    requiereEmail,
    politica,
    grupoGrande,
    esGrupoGrande,
    reserva,
    enviar,
    reiniciar,
  }
}

type Flujo = ReturnType<typeof useFlujoReserva>

// ---------------------------------------------------------------------------
// Bloques de formulario
// ---------------------------------------------------------------------------

function SelectorSede({ flujo, id }: { flujo: Flujo; id: string }) {
  if (flujo.sedes.length < 2) return null
  return (
    <Campo id={id} label="Sede">
      <select
        id={id}
        className={inputClass}
        value={flujo.sede?.id ?? ''}
        onChange={(e) => flujo.setSedeId(Number(e.target.value))}
      >
        {flujo.sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </Campo>
  )
}

function SelectPersonas({ flujo, id }: { flujo: Flujo; id: string }) {
  return (
    <Campo id={id} label="Personas">
      <select id={id} className={inputClass} value={flujo.personas} onChange={(e) => flujo.setPersonas(Number(e.target.value))}>
        {Array.from({ length: flujo.maxPersonas - flujo.minPersonas + 1 }, (_, i) => i + flujo.minPersonas).map((n) => (
          <option key={n} value={n}>
            {personasTexto(n)}
          </option>
        ))}
      </select>
    </Campo>
  )
}

function SelectDia({ flujo, id }: { flujo: Flujo; id: string }) {
  return (
    <Campo id={id} label="Día">
      <select id={id} className={inputClass} value={flujo.fecha} onChange={(e) => flujo.setFecha(e.target.value)} disabled={flujo.fechas.length === 0}>
        {flujo.fechas.map((f, i) => (
          <option key={f} value={f}>
            {i === 0 ? `Hoy · ${fechaCorta(f)}` : i === 1 ? `Mañana · ${fechaCorta(f)}` : fechaCorta(f)}
          </option>
        ))}
      </select>
    </Campo>
  )
}

function SelectHora({ flujo, id }: { flujo: Flujo; id: string }) {
  const { reserva } = flujo
  const disponibles = reserva.availableSlots.filter((s) => s.available)
  const sinHoras = reserva.availabilityLoaded && !reserva.availabilityLoading && disponibles.length === 0
  return (
    <Campo id={id} label={reserva.availabilityLoading ? 'Hora (buscando…)' : 'Hora'}>
      <select
        id={id}
        className={inputClass}
        value={flujo.hora}
        onChange={(e) => flujo.setHora(e.target.value)}
        disabled={reserva.availabilityLoading || disponibles.length === 0}
        aria-describedby={sinHoras ? `${id}-sin` : undefined}
      >
        <option value="">{sinHoras ? 'Sin horas' : 'Elige'}</option>
        {reserva.availableSlots.map((s) => (
          <option key={s.time} value={s.time} disabled={!s.available}>
            {s.time}
            {!s.available ? ' (sin mesas)' : ''}
          </option>
        ))}
      </select>
      {sinHoras && (
        <span id={`${id}-sin`} className="sr-only">
          No quedan mesas ese día para {personasTexto(flujo.personas)}.
        </span>
      )}
    </Campo>
  )
}

function CamposContacto({ flujo, base, mostrarNotas }: { flujo: Flujo; base: string; mostrarNotas: boolean }) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Campo id={`${base}-nombre`} label="Nombre completo">
          <input
            id={`${base}-nombre`}
            className={inputClass}
            autoComplete="name"
            required
            value={flujo.nombre}
            onChange={(e) => flujo.setNombre(e.target.value)}
          />
        </Campo>
        <Campo id={`${base}-tel`} label={flujo.requiereTelefono ? 'Celular' : 'Celular (opcional)'}>
          <input
            id={`${base}-tel`}
            type="tel"
            inputMode="tel"
            className={inputClass}
            autoComplete="tel"
            required={flujo.requiereTelefono}
            value={flujo.telefono}
            onChange={(e) => flujo.setTelefono(e.target.value)}
          />
        </Campo>
      </div>
      <Campo id={`${base}-email`} label={flujo.requiereEmail ? 'Correo' : 'Correo (opcional)'} ayuda="Te enviamos la confirmación a este correo.">
        <input
          id={`${base}-email`}
          type="email"
          className={inputClass}
          autoComplete="email"
          required={flujo.requiereEmail}
          value={flujo.email}
          onChange={(e) => flujo.setEmail(e.target.value)}
        />
      </Campo>
      {mostrarNotas && (
        <Campo id={`${base}-notas`} label="Notas (opcional)">
          <input id={`${base}-notas`} className={inputClass} maxLength={300} value={flujo.notas} onChange={(e) => flujo.setNotas(e.target.value)} />
        </Campo>
      )}
      {flujo.politica && (
        <div className="flex items-start gap-2 text-left text-sm leading-5">
          <input
            id={`${base}-politica`}
            type="checkbox"
            className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-border accent-[var(--primary-color)]"
            checked={flujo.acepta}
            onChange={(e) => flujo.setAcepta(e.target.checked)}
          />
          <label htmlFor={`${base}-politica`}>
            Acepto la política de reservas y datos.
            <span className="mt-1 block text-muted-foreground">{flujo.politica}</span>
          </label>
        </div>
      )}
      <Honeypot flujo={flujo} base={base} />
    </>
  )
}

function Honeypot({ flujo, base }: { flujo: Flujo; base: string }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
      <label htmlFor={`${base}-website`}>No rellenar</label>
      <input
        type="text"
        id={`${base}-website`}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={flujo.reserva.honeypot}
        onChange={(e) => flujo.reserva.setHoneypot(e.target.value)}
      />
    </div>
  )
}

function enlaceWhatsApp(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (digitos.length < 7) return null
  return `https://wa.me/${digitos.length === 10 ? `57${digitos}` : digitos}`
}

/** «Contáctanos» de los grupos grandes (más personas que `large_party_threshold` de la sede). */
function AvisoGrupoGrande({ flujo }: { flujo: Flujo }) {
  if (!flujo.esGrupoGrande) return null
  const telefono = flujo.sede?.telefono ?? null
  const whatsapp = enlaceWhatsApp(telefono)
  return (
    <div className="rounded-lg border border-border bg-muted p-4 text-left text-sm">
      <p className="font-medium">Para grupos de más de {flujo.grupoGrande} personas, contáctanos.</p>
      <p className="mt-1 text-muted-foreground">Organizamos tu mesa y te confirmamos por teléfono o WhatsApp.</p>
      {(whatsapp || telefono) && (
        <div className="mt-2 flex flex-wrap gap-3">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4" style={{ color: ACCENT }}>
              Escribir por WhatsApp
            </a>
          )}
          {telefono && (
            <a href={`tel:${telefono.replace(/[^\d+]/g, '')}`} className="font-medium underline underline-offset-4" style={{ color: ACCENT }}>
              Llamar
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function Mensajes({ flujo }: { flujo: Flujo }) {
  const { reserva } = flujo
  return (
    <div aria-live="polite">
      <AvisoGrupoGrande flujo={flujo} />
      {reserva.status === 'no_availability' && reserva.suggestedTimes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">{reserva.errorMsg || 'No hay disponibilidad para esa hora.'}</p>
          <p className="mb-2 text-amber-700 dark:text-amber-300">Horas con mesa:</p>
          <div className="flex flex-wrap gap-2">
            {reserva.suggestedTimes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  flujo.setHora(t)
                  reserva.setStatus('idle')
                }}
                className="rounded-md bg-amber-100 px-3 py-1 font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {(reserva.status === 'error' || (reserva.status === 'no_availability' && reserva.suggestedTimes.length === 0)) && reserva.errorMsg && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {reserva.errorMsg}
        </p>
      )}
    </div>
  )
}

/** Formulario completo (form_image, band): sede, personas/día/hora y datos. */
function FormularioCompleto({ flujo, base, ctaText, showNotes }: { flujo: Flujo; base: string; ctaText: string; showNotes: boolean }) {
  const enviando = flujo.reserva.status === 'submitting'
  return (
    <form
      noValidate
      className="relative flex w-full flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void flujo.enviar()
      }}
    >
      <SelectorSede flujo={flujo} id={`${base}-sede`} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectPersonas flujo={flujo} id={`${base}-personas`} />
        <SelectDia flujo={flujo} id={`${base}-dia`} />
        <SelectHora flujo={flujo} id={`${base}-hora`} />
      </div>
      <CamposContacto flujo={flujo} base={base} mostrarNotas={showNotes} />
      <Mensajes flujo={flujo} />
      <button type="submit" disabled={enviando} className={cn(primaryButtonClass, 'w-full')} style={{ backgroundColor: PRIMARY }}>
        {enviando ? 'Enviando…' : ctaText}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Confirmación
// ---------------------------------------------------------------------------

function enlacesCalendario(r: ReservaCreada, zona: string, titulo: string, lugar: string | null) {
  const inicio = instanteEnZona(r.date, r.time.slice(0, 5), zona)
  const fin = new Date(inicio.getTime() + DURACION_TURNO_MIN * 60_000)
  const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const detalles = `Reserva ${r.code} · ${personasTexto(r.partySize)}`
  const google = new URL('https://calendar.google.com/calendar/render')
  google.searchParams.set('action', 'TEMPLATE')
  google.searchParams.set('text', titulo)
  google.searchParams.set('dates', `${utc(inicio)}/${utc(fin)}`)
  google.searchParams.set('details', detalles)
  if (lugar) google.searchParams.set('location', lugar)
  const escapar = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GO Admin//Reservas//ES',
    'BEGIN:VEVENT',
    `UID:${r.id}@goadmin`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(inicio)}`,
    `DTEND:${utc(fin)}`,
    `SUMMARY:${escapar(titulo)}`,
    `DESCRIPTION:${escapar(detalles)}`,
    ...(lugar ? [`LOCATION:${escapar(lugar)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return { google: google.toString(), ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` }
}

function Confirmacion({ flujo, props }: { flujo: Flujo; props: ReservationViewProps }) {
  const r = flujo.reserva.reservationResult
  const tituloRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => tituloRef.current?.focus(), [])
  if (!r) return null
  const pendiente = r.status === 'pending'
  const lugar = [flujo.sede?.nombre, flujo.sede?.direccion].filter(Boolean).join(' · ') || null
  const cal = enlacesCalendario(r, flujo.zona, `Reserva en ${props.organizationName}`, lugar)
  const filas: [string, string][] = [
    ['Código', r.code],
    ...(flujo.sede ? ([['Sede', flujo.sede.nombre]] as [string, string][]) : []),
    ['Día', fechaLarga(r.date)],
    ['Hora', r.time.slice(0, 5)],
    ['Personas', String(r.partySize)],
  ]
  return (
    <div className={cn('mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center', fadeUp)} aria-live="polite">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: pendiente ? 'rgb(217 119 6)' : PRIMARY }}
        aria-hidden="true"
      >
        {pendiente ? <CalendarDays className="h-6 w-6" /> : <Check className="h-6 w-6" />}
      </span>
      <span
        className={cn(
          'rounded-full px-3 py-1 text-xs font-medium',
          pendiente
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
            : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200',
        )}
      >
        {pendiente ? 'Pendiente de confirmación' : 'Confirmada'}
      </span>
      <h3 ref={tituloRef} tabIndex={-1} className="text-2xl font-bold leading-8 outline-none" style={{ fontFamily: 'var(--font-heading)' }}>
        {pendiente ? 'Solicitud recibida' : '¡Reserva confirmada!'}
      </h3>
      <p className="text-muted-foreground">
        {pendiente
          ? props.pendingMessage || 'El equipo revisará tu solicitud y te avisará cuando la confirme.'
          : props.successMessage || 'Te esperamos. Si dejaste tu correo, te enviamos la confirmación.'}
      </p>
      <dl className="w-full space-y-2 rounded-lg bg-muted p-5 text-left text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={k === 'Código' ? 'font-mono font-bold' : 'font-medium'}>{v}</dd>
          </div>
        ))}
      </dl>
      {r.manageUrl && (
        <Link href={r.manageUrl} className="text-sm font-medium underline underline-offset-4" style={{ color: ACCENT }}>
          Consultar o cancelar tu reserva
        </Link>
      )}
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <a href={cal.google} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline" style={{ color: ACCENT }}>
          Añadir a Google Calendar
        </a>
        <a href={cal.ics} download={`reserva-${r.code}.ics`} className="underline-offset-4 hover:underline" style={{ color: ACCENT }}>
          Descargar .ics (Outlook, Apple)
        </a>
      </div>
      <button type="button" onClick={flujo.reiniciar} className="text-sm underline underline-offset-4 hover:opacity-70">
        Hacer otra reserva
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Variante stepper
// ---------------------------------------------------------------------------

const PASOS = ['Personas', 'Día', 'Hora', 'Datos'] as const

function BotonOpcion({
  seleccionado,
  deshabilitado,
  onClick,
  children,
  className,
  style,
}: {
  seleccionado: boolean
  deshabilitado?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      disabled={deshabilitado}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2.5 text-base font-medium leading-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]',
        seleccionado
          ? 'text-white'
          : deshabilitado
            ? 'cursor-not-allowed bg-muted text-muted-foreground line-through'
            : 'border border-border hover:bg-muted',
        className,
      )}
      style={{ ...(seleccionado ? { backgroundColor: PRIMARY } : {}), ...style }}
    >
      {children}
    </button>
  )
}

function Stepper({ flujo, props, base }: { flujo: Flujo; props: ReservationViewProps; base: string }) {
  const [paso, setPaso] = useState(0)
  const [cambiandoSede, setCambiandoSede] = useState(false)
  const tituloPaso = useRef<HTMLHeadingElement>(null)
  const montado = useRef(false)

  useEffect(() => {
    if (montado.current) tituloPaso.current?.focus()
    montado.current = true
  }, [paso])

  const { reserva } = flujo
  const puedeSeguir = paso === 0 ? true : paso === 1 ? !!flujo.fecha : paso === 2 ? !!flujo.hora : true
  const resumen = flujo.fecha ? `${fechaLarga(flujo.fecha)} · ${personasTexto(flujo.personas)}` : personasTexto(flujo.personas)

  const titulos = ['¿Cuántas personas?', 'Elige el día', 'Elige la hora', 'Tus datos']

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 text-center">
      {flujo.sede && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <p className="font-medium">{flujo.sede.nombre}</p>
          {flujo.sedes.length > 1 && (
            <button
              type="button"
              className="text-sm underline-offset-4 hover:underline"
              style={{ color: ACCENT }}
              aria-expanded={cambiandoSede}
              aria-controls={`${base}-cambiar-sede`}
              onClick={() => setCambiandoSede((v) => !v)}
            >
              · cambiar
            </button>
          )}
        </div>
      )}
      {cambiandoSede && (
        <div id={`${base}-cambiar-sede`} className="w-full">
          <SelectorSede flujo={flujo} id={`${base}-sede`} />
        </div>
      )}

      <ol className="flex items-center gap-2" aria-label="Pasos de la reserva">
        {PASOS.map((nombre, i) => {
          const hecho = i <= paso
          return (
            <li key={nombre} className="flex items-center gap-2" aria-current={i === paso ? 'step' : undefined}>
              {i > 0 && <span aria-hidden="true" className="h-0.5 w-6 sm:w-12" style={{ backgroundColor: i <= paso ? PRIMARY : 'hsl(var(--border))' }} />}
              <span className="flex flex-col items-center gap-1 sm:flex-col">
                <span
                  className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium', hecho ? 'text-white' : 'bg-muted text-muted-foreground')}
                  style={hecho ? { backgroundColor: PRIMARY } : undefined}
                >
                  {i + 1}
                </span>
                <span className={cn('text-xs font-medium', i === paso ? '' : 'hidden text-muted-foreground sm:block')}>
                  {nombre}
                  {i < paso && <span className="sr-only"> (completado)</span>}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <form
        noValidate
        className={cn('relative flex w-full flex-col gap-5 rounded-xl border border-border bg-card p-6 text-left text-card-foreground shadow-sm', fadeUp)}
        onSubmit={(e) => {
          e.preventDefault()
          if (paso < 3) {
            if (puedeSeguir) setPaso(paso + 1)
          } else void flujo.enviar()
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase leading-4" style={{ color: ACCENT }}>
            Paso {paso + 1} de 4
          </p>
          <h3 ref={tituloPaso} tabIndex={-1} className="text-2xl font-bold leading-8 outline-none" style={{ fontFamily: 'var(--font-heading)' }}>
            {titulos[paso]}
          </h3>
          {paso >= 2 && <p className="text-sm leading-5 text-muted-foreground">{resumen}</p>}
        </div>

        {paso === 0 && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Personas</legend>
            {Array.from({ length: flujo.maxPersonas - flujo.minPersonas + 1 }, (_, i) => i + flujo.minPersonas).map((n) => (
              <BotonOpcion key={n} seleccionado={flujo.personas === n} onClick={() => flujo.setPersonas(n)} className="min-w-[3rem]">
                <span aria-label={personasTexto(n)}>{n}</span>
              </BotonOpcion>
            ))}
          </fieldset>
        )}

        {paso === 1 && (
          <fieldset className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
            <legend className="sr-only">Día</legend>
            {flujo.fechas.map((f, i) => (
              <BotonOpcion key={f} seleccionado={flujo.fecha === f} onClick={() => flujo.setFecha(f)}>
                {i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : fechaCorta(f)}
              </BotonOpcion>
            ))}
          </fieldset>
        )}

        {paso === 2 && (
          <>
            {reserva.availabilityLoading && <p className="text-sm text-muted-foreground">Buscando horas con mesa…</p>}
            {!reserva.availabilityLoading && reserva.availabilityLoaded && reserva.availableSlots.every((s) => !s.available) && (
              <p className="text-sm text-muted-foreground">No quedan mesas ese día para {personasTexto(flujo.personas)}. Prueba otro día.</p>
            )}
            {!reserva.availabilityLoading &&
              agruparFranjas(reserva.availableSlots).map((g) => (
                <fieldset key={g.etiqueta} className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm leading-5 text-muted-foreground">{g.etiqueta}</legend>
                  <div className="flex flex-wrap gap-2">
                    {g.franjas.map((s, i) => (
                      <BotonOpcion
                        key={s.time}
                        seleccionado={flujo.hora === s.time}
                        deshabilitado={!s.available}
                        onClick={() => flujo.setHora(s.time)}
                        className="motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both"
                        style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
                      >
                        {s.time}
                        {!s.available && <span className="sr-only"> (sin mesas)</span>}
                      </BotonOpcion>
                    ))}
                  </div>
                </fieldset>
              ))}
            {(flujo.ajustes?.zonas.length ?? 0) > 0 && (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="mb-2 text-sm leading-5 text-muted-foreground">Zona (opcional)</legend>
                {flujo.ajustes?.zonas.map((z) => (
                  <button
                    key={z}
                    type="button"
                    aria-pressed={flujo.zonaMesa === z}
                    onClick={() => flujo.setZonaMesa(flujo.zonaMesa === z ? null : z)}
                    className={cn('rounded-lg border px-3 py-1.5 text-sm', flujo.zonaMesa === z ? 'border-[var(--primary-color)] bg-muted' : 'border-border')}
                  >
                    {z}
                  </button>
                ))}
              </fieldset>
            )}
            {reserva.availableSlots.some((s) => !s.available) && (
              <p className="text-xs font-medium text-muted-foreground">Horas tachadas: sin mesas para {flujo.personas}.</p>
            )}
          </>
        )}

        {paso === 3 && <CamposContacto flujo={flujo} base={base} mostrarNotas={props.showNotes} />}

        <Mensajes flujo={flujo} />

        <div className="flex gap-3">
          {paso > 0 && (
            <button type="button" className={cn(outlineButtonClass, 'flex-1')} style={{ borderColor: ACCENT, color: ACCENT }} onClick={() => setPaso(paso - 1)}>
              Atrás
            </button>
          )}
          <button
            type="submit"
            disabled={!puedeSeguir || reserva.status === 'submitting'}
            className={cn(primaryButtonClass, 'flex-1 px-4 py-2')}
            style={{ backgroundColor: PRIMARY }}
          >
            {paso < 3 ? 'Continuar' : reserva.status === 'submitting' ? 'Enviando…' : props.ctaText || 'Confirmar reserva'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vista principal
// ---------------------------------------------------------------------------

export function ReservationView(props: ReservationViewProps) {
  const { variant } = props
  const isPreview = useIsPreviewMode()
  const base = `${useId().replace(/:/g, '')}-${props.sectionKey}`
  const flujo = useFlujoReserva(props)
  const [abierto, setAbierto] = useState(false)
  const [widgetDatos, setWidgetDatos] = useState(false)

  const encabezado = (centrado: boolean, tituloDefecto: string, enHero = false) => (
    <div className={cn('flex flex-col gap-2', centrado ? 'items-center text-center' : 'items-start text-left')}>
      {props.eyebrow && !enHero && <Eyebrow>{props.eyebrow}</Eyebrow>}
      <h2
        className={cn('font-bold', enHero ? 'text-4xl leading-tight text-white md:text-6xl' : 'text-3xl leading-tight md:text-4xl')}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {props.title || tituloDefecto}
      </h2>
      {props.subtitle && <p className={cn('max-w-2xl', enHero ? 'text-lg text-white/90' : 'text-muted-foreground')}>{props.subtitle}</p>}
    </div>
  )

  // ── Externa: sólo un enlace configurado ──
  if (variant === 'external') {
    if (!props.externalUrl) {
      return isPreview ? <AvisoEditor>Configura el enlace del proveedor de reservas (debe empezar por https://).</AvisoEditor> : null
    }
    return (
      <div id={props.anchorId} className={cn('grid scroll-mt-[var(--header-h,80px)] items-center gap-12', props.imageUrl && 'md:grid-cols-2', fadeUp)}>
        <div className="flex flex-col items-start gap-4">
          {encabezado(false, 'Reserva tu mesa')}
          <a
            href={props.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryButtonClass}
            style={{ backgroundColor: PRIMARY }}
          >
            {props.externalButtonText || 'Reservar en el sitio del proveedor'}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">
            <ExternalLink className="h-3.5 w-3.5" />
            Se abre en una pestaña nueva
          </p>
        </div>
        {props.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.imageUrl} alt="" className="h-[360px] w-full rounded-xl object-cover" loading="lazy" />
        )}
      </div>
    )
  }

  const reservable = flujo.sedes.length > 0 || props.sinSede !== null
  if (!reservable) {
    return isPreview ? <AvisoEditor>{props.motivoSinReservas || 'No hay sedes que acepten reservas.'}</AvisoEditor> : null
  }

  const exito = flujo.reserva.status === 'success' && flujo.reserva.reservationResult
  const ctaText = props.ctaText || 'Solicitar reserva'

  // ── Stepper ──
  if (variant === 'stepper') {
    return (
      <div id={props.anchorId} className="flex scroll-mt-[var(--header-h,80px)] flex-col items-center gap-6">
        {exito ? (
          <Confirmacion flujo={flujo} props={props} />
        ) : (
          <>
            <h2 className="text-center text-3xl font-bold leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>
              {props.title || 'Reserva tu mesa'}
            </h2>
            {props.subtitle && <p className="-mt-2 text-center text-muted-foreground">{props.subtitle}</p>}
            <Stepper flujo={flujo} props={props} base={base} />
          </>
        )}
      </div>
    )
  }

  // ── Imagen + formulario ──
  if (variant === 'form_image') {
    const conImagen = !!props.imageUrl || isPreview
    return (
      <div id={props.anchorId} className={cn('grid scroll-mt-[var(--header-h,80px)] overflow-hidden rounded-xl', conImagen && 'md:grid-cols-2')}>
        {conImagen && (
          <div className="relative flex min-h-[240px] items-center justify-center bg-muted md:min-h-[560px]">
            {props.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-7 w-7" aria-hidden="true" />
                Añade la imagen del salón en el editor
              </span>
            )}
          </div>
        )}
        <div className={cn('flex flex-col gap-4 py-8 md:p-16', !conImagen && 'mx-auto w-full max-w-2xl', fadeUp)}>
          {exito ? (
            <Confirmacion flujo={flujo} props={props} />
          ) : (
            <>
              {encabezado(false, 'Guardamos tu mesa')}
              <FormularioCompleto flujo={flujo} base={base} ctaText={ctaText} showNotes={props.showNotes} />
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Banda ──
  if (variant === 'band') {
    const boton = props.ctaUrl ? (
      <Link href={props.ctaUrl} className={cn(primaryButtonClass, 'shrink-0')} style={{ backgroundColor: PRIMARY }}>
        {props.ctaText || 'Reservar mesa'}
      </Link>
    ) : (
      <button
        type="button"
        className={cn(primaryButtonClass, 'shrink-0')}
        style={{ backgroundColor: PRIMARY }}
        aria-expanded={abierto}
        aria-controls={`${base}-panel`}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? 'Cerrar' : props.ctaText || 'Reservar mesa'}
      </button>
    )
    return (
      <div id={props.anchorId} className="flex scroll-mt-[var(--header-h,80px)] flex-col gap-6">
        <div className="flex flex-col items-start gap-6 rounded-xl bg-muted px-6 py-8 sm:flex-row sm:items-center md:px-12 md:py-12">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: PRIMARY }} aria-hidden="true">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-2xl font-bold leading-8" style={{ fontFamily: 'var(--font-heading)' }}>
              {props.title || '¿Mesa para esta noche?'}
            </h2>
            {props.subtitle && <p className="text-muted-foreground">{props.subtitle}</p>}
          </div>
          {boton}
        </div>
        {abierto && !props.ctaUrl && (
          <div id={`${base}-panel`} className={cn('mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-card-foreground', fadeUp)}>
            {exito ? <Confirmacion flujo={flujo} props={props} /> : <FormularioCompleto flujo={flujo} base={base} ctaText={ctaText} showNotes={props.showNotes} />}
          </div>
        )}
      </div>
    )
  }

  // ── Hero con widget ──
  const enviando = flujo.reserva.status === 'submitting'
  return (
    <div
      id={props.anchorId}
      className="relative flex min-h-[560px] scroll-mt-[var(--header-h,80px)] flex-col justify-end gap-6 overflow-hidden rounded-xl p-6 md:min-h-[640px] md:p-20"
      style={{ backgroundColor: 'var(--secondary-color, #1f2937)' }}
    >
      {props.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      {!props.imageUrl && isPreview && (
        <p className="absolute left-1/2 top-8 -translate-x-1/2 text-sm text-white/80">Añade la imagen de fondo en el editor</p>
      )}
      <div className="relative flex flex-col gap-6">
        {encabezado(false, 'Reserva tu mesa', true)}
        <div className={cn('w-full max-w-[960px] rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg', fadeUp)}>
          {exito ? (
            <Confirmacion flujo={flujo} props={props} />
          ) : (
            <form
              noValidate
              className="relative flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!widgetDatos) {
                  if (!flujo.hora) {
                    flujo.reserva.fallar('Elige una hora con mesa disponible.')
                    return
                  }
                  flujo.reserva.setStatus('idle')
                  setWidgetDatos(true)
                } else void flujo.enviar()
              }}
            >
              {flujo.sedes.length > 1 && <SelectorSede flujo={flujo} id={`${base}-sede`} />}
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <SelectPersonas flujo={flujo} id={`${base}-personas`} />
                <SelectDia flujo={flujo} id={`${base}-dia`} />
                <SelectHora flujo={flujo} id={`${base}-hora`} />
                {!widgetDatos && (
                  <button type="submit" className={cn(primaryButtonClass, 'shrink-0')} style={{ backgroundColor: PRIMARY }}>
                    {props.ctaText || 'Buscar mesa'}
                  </button>
                )}
              </div>
              {widgetDatos && (
                <div className={cn('flex flex-col gap-4', fadeUp)}>
                  <CamposContacto flujo={flujo} base={base} mostrarNotas={props.showNotes} />
                  <button type="submit" disabled={enviando} className={primaryButtonClass} style={{ backgroundColor: PRIMARY }}>
                    {enviando ? 'Enviando…' : 'Confirmar reserva'}
                  </button>
                </div>
              )}
              <Mensajes flujo={flujo} />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
