'use client'

/**
 * Vista cliente de `private_events` (Figma 148:7191 / 148:7397).
 *
 * El envío reutiliza `useContactForm` (POST /api/contact → RPC
 * `web_capture_lead`): mismo rate limit, honeypot, validación y aviso honesto
 * del resultado que el formulario de contacto. Los campos propios de la
 * cotización (tipo, fecha, invitados, lugar, presupuesto) se arman en el
 * asunto y el mensaje con `composeMessage`, que es lo que el CRM muestra en
 * la ficha del lead.
 *
 * Movimiento (nota 149:8095): paquetes y formulario con fade-up, stagger
 * 80 ms. prefers-reduced-motion: sin animación.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPlainDate, parsePlainDate } from '@/lib/restaurant/secciones'
import { hoyEnZona } from '@/lib/restaurant/horario'
import {
  CONTACT_MAX_LENGTHS,
  HONEYPOT_FIELD_PROPS,
  useContactForm,
  type ContactFormValues,
} from '@/components/sections/contact/useContactForm'
import { ContactFormFeedback } from '@/components/sections/contact/ContactFormFeedback'
import { SectionHeading } from './SectionHeading'
import { useSectionMotion } from './useSectionMotion'
import m from './motion.module.css'

export interface PrivatePackage {
  name: string
  detail: string | null
  price: string | null
}

export interface PrivateEventsViewProps {
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  packages: PrivatePackage[]
  steps: string[]
  formTitle: string | null
  eventTypes: string[]
  budgetOptions: string[]
  submitText: string
  formNote: string | null
  organizationId: number
  /** Radio, fondo, borde y sombra de paquetes y formulario (CARD_FIELDS). */
  cardStyle: React.CSSProperties
  timeZone: string
  sectionKey: string
  /** Sedes elegibles (más de una → selector). Vacío: sin sede o la de la página. */
  sedes?: { id: number; nombre: string }[]
  sedeInicial?: number | null
}

const ACCENT = 'var(--accent-color, var(--primary-color))'
const FIELD =
  'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[color:var(--primary-color)]'
const LABEL = 'text-sm leading-5 text-foreground'

interface EventFields {
  eventType: string
  date: string
  guests: string
  venue: string
  budget: string
}

const UNDECIDED = 'Aún no lo sé'


function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  required,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD, 'appearance-none pr-10')}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  )
}

export function PrivateEventsView(props: PrivateEventsViewProps) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`

  const venueOptions = useMemo(
    () => [UNDECIDED, ...props.packages.map((p) => p.name)],
    [props.packages],
  )
  const budgetOptions = useMemo(
    () => (props.budgetOptions.length > 0 ? [UNDECIDED, ...props.budgetOptions] : []),
    [props.budgetOptions],
  )
  const [minDate] = useState(() => hoyEnZona(props.timeZone))
  const [fields, setFields] = useState<EventFields>({
    eventType: props.eventTypes[0] ?? '',
    date: '',
    guests: '',
    venue: UNDECIDED,
    budget: UNDECIDED,
  })
  const [sedeId, setSedeId] = useState<number | null>(props.sedeInicial ?? null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const setEvent = (key: keyof EventFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
    setFieldError(null)
  }

  const composeMessage = useCallback(
    (values: ContactFormValues) => {
      const date = parsePlainDate(fields.date)
      const dateText = date ? formatPlainDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null
      const guests = Number(fields.guests)
      const detail = [
        `Tipo de evento: ${fields.eventType || 'Sin indicar'}`,
        `Fecha: ${dateText ?? 'Sin definir'}`,
        `Invitados: ${Number.isFinite(guests) && guests > 0 ? guests : 'Sin definir'}`,
        `Lugar: ${fields.venue}`,
        budgetOptions.length > 0 ? `Presupuesto por persona: ${fields.budget}` : null,
        values.phone.trim() ? `Celular: ${values.phone.trim()}` : null,
      ].filter(Boolean)
      const extra = values.message.trim()
      const subject = ['Evento privado', fields.eventType, dateText, guests > 0 ? `${guests} invitados` : null]
        .filter(Boolean)
        .join(' · ')
        .slice(0, CONTACT_MAX_LENGTHS.subject)
      return {
        subject,
        message: (extra ? `${detail.join('\n')}\n\n${extra}` : detail.join('\n')).slice(0, CONTACT_MAX_LENGTHS.message),
      }
    },
    [fields, budgetOptions.length],
  )

  // Datos estructurados para la ficha del lead (migración D6): sede y detalles
  // del evento. El texto de `composeMessage` se sigue enviando igual.
  const extraPayload = useCallback(() => {
    const guests = Number(fields.guests)
    const details: Record<string, unknown> = {
      event_type: fields.eventType || undefined,
      event_date: fields.date || undefined,
      guests: Number.isInteger(guests) && guests > 0 ? guests : undefined,
      venue: fields.venue && fields.venue !== UNDECIDED ? fields.venue : undefined,
    }
    const presupuesto = Number(String(fields.budget).replace(/[^\d]/g, ''))
    if (fields.budget !== UNDECIDED && /^\$?\s*[\d.,]+$/.test(fields.budget.trim()) && presupuesto > 0) {
      details.budget_per_person = presupuesto
    }
    return { branchId: sedeId, details }
  }, [fields, sedeId])

  const form = useContactForm({
    organizationId: props.organizationId,
    sourceForm: 'private_events',
    requireMessage: false,
    composeMessage,
    extraPayload,
  })

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const guests = Number(fields.guests)
    if (!fields.date) return setFieldError('Elige la fecha del evento.')
    if (fields.date < minDate) return setFieldError('La fecha del evento no puede ser anterior a hoy.')
    if (!Number.isInteger(guests) || guests < 1) return setFieldError('Indica cuántos invitados esperas.')
    void form.submit()
  }

  // Tras un envío correcto, los campos propios también se limpian.
  const [lastStatus, setLastStatus] = useState(form.status)
  if (form.status !== lastStatus) {
    setLastStatus(form.status)
    if (form.status === 'success') {
      setFields((prev) => ({ ...prev, date: '', guests: '', venue: UNDECIDED, budget: UNDECIDED }))
    }
  }

  return (
    <div
      ref={ref}
      {...motionProps}
      className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-20"
    >
      <div className="flex flex-col gap-5">
        <SectionHeading eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
        {props.packages.length > 0 && (
          <ul className="flex flex-col gap-4">
            {props.packages.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className={cn('flex items-center gap-4 rounded-xl border border-border bg-background p-4', m.fadeUp)}
                style={{ ...props.cardStyle, '--i': i } as React.CSSProperties}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
                  <Users className="h-5 w-5" style={{ color: ACCENT }} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-base font-medium leading-6 text-foreground">{p.name}</p>
                  {p.detail && <p className="text-sm leading-5 text-muted-foreground">{p.detail}</p>}
                </div>
                {p.price && (
                  <p className="shrink-0 text-right text-sm leading-5" style={{ color: ACCENT }}>
                    {p.price}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {props.steps.length > 0 && (
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {props.steps.map((s, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-2xl font-bold leading-8 [font-family:var(--font-heading)]" style={{ color: ACCENT }}>
                  {i + 1}
                </span>
                <span className="text-sm leading-5 text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby={props.formTitle ? id('titulo') : undefined}
        aria-label={props.formTitle ? undefined : 'Solicitud de evento privado'}
        className={cn('relative flex flex-col gap-4 rounded-xl border border-border bg-background p-6 shadow-md md:p-8', m.fadeUp)}
        style={{ ...props.cardStyle, '--i': props.packages.length } as React.CSSProperties}
      >
        {props.formTitle && (
          <h3 id={id('titulo')} className="text-2xl font-bold leading-8 text-foreground [font-family:var(--font-heading)]">
            {props.formTitle}
          </h3>
        )}
        <input {...HONEYPOT_FIELD_PROPS} value={form.values.website} onChange={(e) => form.setField('website', e.target.value)} />

        {(props.sedes?.length ?? 0) > 1 && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={id('sede')} className={LABEL}>
              Sede
            </label>
            <div className="relative">
              <select
                id={id('sede')}
                value={sedeId ?? ''}
                onChange={(e) => setSedeId(Number(e.target.value) || null)}
                className={cn(FIELD, 'appearance-none pr-10')}
              >
                {props.sedes!.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
          <SelectField id={id('tipo')} label="Tipo de evento" value={fields.eventType} options={props.eventTypes} onChange={(v) => setEvent('eventType', v)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={id('fecha')} className={LABEL}>
              Fecha del evento
            </label>
            <input id={id('fecha')} type="date" required min={minDate} value={fields.date} onChange={(e) => setEvent('date', e.target.value)} className={FIELD} />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={id('invitados')} className={LABEL}>
              Invitados
            </label>
            <input
              id={id('invitados')}
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              required
              placeholder="40"
              value={fields.guests}
              onChange={(e) => setEvent('guests', e.target.value)}
              className={FIELD}
            />
          </div>
          <SelectField id={id('lugar')} label="Lugar" value={fields.venue} options={venueOptions} onChange={(v) => setEvent('venue', v)} />
        </div>

        {budgetOptions.length > 0 && (
          <SelectField id={id('presupuesto')} label="Presupuesto por persona" value={fields.budget} options={budgetOptions} onChange={(v) => setEvent('budget', v)} />
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={id('nombre')} className={LABEL}>
              Nombre
            </label>
            <input id={id('nombre')} type="text" autoComplete="name" required maxLength={CONTACT_MAX_LENGTHS.name} value={form.values.name} onChange={(e) => form.setField('name', e.target.value)} className={FIELD} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={id('celular')} className={LABEL}>
              Celular
            </label>
            <input id={id('celular')} type="tel" autoComplete="tel" maxLength={CONTACT_MAX_LENGTHS.phone} value={form.values.phone} onChange={(e) => form.setField('phone', e.target.value)} className={FIELD} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={id('correo')} className={LABEL}>
            Correo
          </label>
          <input id={id('correo')} type="email" autoComplete="email" required maxLength={CONTACT_MAX_LENGTHS.email} value={form.values.email} onChange={(e) => form.setField('email', e.target.value)} className={FIELD} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={id('mensaje')} className={LABEL}>
            Cuéntanos más <span className="text-muted-foreground">(opcional)</span>
          </label>
          <textarea id={id('mensaje')} rows={3} maxLength={2000} value={form.values.message} onChange={(e) => form.setField('message', e.target.value)} className={cn(FIELD, 'resize-y')} />
        </div>

        {fieldError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {fieldError}
          </p>
        )}
        <ContactFormFeedback status={form.status} errorMessage={form.errorMessage} successMessage={form.successMessage} />

        <button
          type="submit"
          disabled={form.isSubmitting}
          className="w-full rounded-lg px-6 py-3 text-base font-medium leading-6 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          {form.isSubmitting ? 'Enviando…' : props.submitText}
        </button>
        {props.formNote && <p className="text-xs font-medium leading-4 text-muted-foreground">{props.formNote}</p>}
      </form>
    </div>
  )
}
