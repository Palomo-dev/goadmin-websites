'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useReservaMesa } from '@/lib/restaurant/useReservaMesa'

interface ReservationCtaFormProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    show_form?: boolean
    // F8.3 — Campos de personalización
    form_fields?: Array<{ name: string; label: string }>
    require_phone?: boolean
    require_email?: boolean
    min_guests?: number
    max_guests?: number
    time_slot_interval?: '30' | '60' | '90'
    success_message?: string
    /** Texto cuando la reserva queda pendiente de confirmación del equipo. */
    pending_message?: string
    error_message?: string
    show_available_times?: boolean
    bg_color?: string
    text_color?: string
  }
  primaryColor?: string
  organization?: any
  /** Datos de la página; `branchId` es la sede (outlet) resuelta en el servidor. */
  data?: Record<string, any>
}

export function ReservationCtaForm({ content, primaryColor, organization, data: datosPagina }: ReservationCtaFormProps) {
  // ── Configuración con defaults (compatibilidad hacia atrás) ──
  const minGuests = content.min_guests || 1
  const maxGuests = content.max_guests || 8
  const slotInterval = content.time_slot_interval || '30'
  const requirePhone = content.require_phone !== false // default true
  const requireEmail = content.require_email === true   // default false
  const showAvailableTimes = content.show_available_times === true
  const successMessage = content.success_message || '¡Reserva confirmada! Te esperamos.'
  const errorMessage = content.error_message || 'No se pudo completar la reserva. Inténtalo de nuevo.'

  // Campos visibles del formulario (default: name, phone, date, time, guests)
  const formFields = content.form_fields && content.form_fields.length > 0
    ? content.form_fields.map(f => f.name)
    : ['name', 'phone', 'date', 'time', 'guests']

  // ── Estado del formulario ──
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    time: '',
    guests: minGuests,
  })

  // Disponibilidad, envío y honeypot: compartidos con la sección `reservation`.
  const {
    honeypot,
    setHoneypot,
    status,
    errorMsg,
    suggestedTimes,
    availableSlots,
    availabilityLoading,
    reservationResult,
    fallar,
    checkAvailability,
    submit,
    reiniciar,
  } = useReservaMesa({
    organizationId: organization?.id,
    branchId: datosPagina?.branchId ?? null,
    slotInterval,
    errorMessage,
  })

  // ── Fecha mínima (hoy) para bloquear fechas pasadas ──
  const todayStr = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const inputClass =
    'w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:[color-scheme:dark] focus:ring-2 focus:outline-none'

  const handleFieldChange = (field: string, value: string | number) => {
    const newFormData = { ...formData, [field]: value }
    setFormData(newFormData)

    // Recargar disponibilidad si cambia fecha, hora o personas
    if (field === 'date' || field === 'time' || field === 'guests') {
      if (newFormData.date) {
        checkAvailability(newFormData.date, newFormData.time, newFormData.guests)
      }
    }
  }

  // ── Enviar reserva ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization?.id) {
      fallar('No se pudo identificar el restaurante.')
      return
    }

    // Validaciones de campos requeridos
    if (!formData.name.trim()) {
      fallar('Por favor ingresa tu nombre.')
      return
    }
    if (requirePhone && !formData.phone.trim()) {
      fallar('El teléfono es obligatorio.')
      return
    }
    if (requireEmail && !formData.email.trim()) {
      fallar('El email es obligatorio.')
      return
    }
    if (!formData.date || !formData.time) {
      fallar('Selecciona fecha y hora.')
      return
    }
    if (!formData.phone.trim() && !formData.email.trim()) {
      fallar('Se requiere al menos un teléfono o email de contacto.')
      return
    }

    await submit({
      date: formData.date,
      time: formData.time,
      guests: formData.guests,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
    })
  }

  // ── Pantalla de éxito ──
  if (status === 'success' && reservationResult) {
    // Si la sede exige confirmación, la reserva nace `pending`: no se anuncia
    // como confirmada (mismo criterio que ReservationView y el correo).
    const pendiente = reservationResult.status === 'pending'
    return (
      <div className="text-center" style={content.bg_color ? { backgroundColor: content.bg_color } : undefined}>
        <div className="max-w-2xl mx-auto py-8">
          <div className="mb-6 text-5xl">{pendiente ? '⏳' : '✅'}</div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: content.text_color || undefined }}>
            {pendiente ? 'Solicitud recibida' : content.title || '¡Reserva Confirmada!'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {pendiente
              ? content.pending_message || 'El equipo revisará tu solicitud y te avisará cuando la confirme.'
              : successMessage}
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-left max-w-md mx-auto">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Código:</span>
                <span className="font-mono font-bold">{reservationResult.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Fecha:</span>
                <span className="font-medium">{reservationResult.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Hora:</span>
                <span className="font-medium">{reservationResult.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Personas:</span>
                <span className="font-medium">{reservationResult.partySize}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reiniciar()
              setFormData({ name: '', phone: '', email: '', date: '', time: '', guests: minGuests })
            }}
            className="mt-6 text-sm underline hover:opacity-70"
            style={{ color: primaryColor }}
          >
            Hacer otra reserva
          </button>
        </div>
      </div>
    )
  }

  // ── Render del formulario (mantiene aspecto visual original) ──
  return (
    <div className="text-center" style={content.bg_color ? { backgroundColor: content.bg_color } : undefined}>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: content.text_color || undefined }}>
          {content.title}
        </h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 mb-8">{content.subtitle}</p>
      )}

      {content.show_form !== false ? (
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          {/* Campos de contacto (name, phone, email) */}
          {(formFields.includes('name') || formFields.includes('phone') || formFields.includes('email')) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {formFields.includes('name') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre {requirePhone && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    required
                    className={inputClass}
                    style={{ '--tw-ring-color': primaryColor } as any}
                    placeholder="Tu nombre"
                  />
                </div>
              )}
              {formFields.includes('phone') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Teléfono {requirePhone && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    required={requirePhone}
                    className={inputClass}
                    style={{ '--tw-ring-color': primaryColor } as any}
                    placeholder="300 123 4567"
                  />
                </div>
              )}
              {formFields.includes('email') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email {requireEmail && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    required={requireEmail}
                    className={inputClass}
                    style={{ '--tw-ring-color': primaryColor } as any}
                    placeholder="tu@email.com"
                  />
                </div>
              )}
            </div>
          )}

          {/* Campos de reserva (date, time, guests) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {formFields.includes('date') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formData.date}
                  min={todayStr}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  required
                  className={inputClass}
                  style={{ '--tw-ring-color': primaryColor } as any}
                />
              </div>
            )}
            {formFields.includes('time') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora
                  {availabilityLoading && <span className="ml-1 text-xs text-gray-400">…</span>}
                </label>
                {showAvailableTimes && availableSlots.length > 0 ? (
                  <select
                    value={formData.time}
                    onChange={(e) => handleFieldChange('time', e.target.value)}
                    required
                    className={inputClass}
                    style={{ '--tw-ring-color': primaryColor } as any}
                  >
                    <option value="">Selecciona una hora</option>
                    {availableSlots.map((slot) => (
                      <option key={slot.time} value={slot.time} disabled={!slot.available}>
                        {slot.time}{!slot.available ? ' (sin cupo)' : slot.remaining <= 2 ? ` — quedan ${slot.remaining}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleFieldChange('time', e.target.value)}
                    required
                    className={inputClass}
                    style={{ '--tw-ring-color': primaryColor } as any}
                  />
                )}
              </div>
            )}
            {formFields.includes('guests') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personas</label>
                <select
                  value={formData.guests}
                  onChange={(e) => handleFieldChange('guests', parseInt(e.target.value, 10))}
                  className={inputClass}
                  style={{ '--tw-ring-color': primaryColor } as any}
                >
                  {Array.from({ length: maxGuests - minGuests + 1 }, (_, i) => i + minGuests).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mensaje de no disponibilidad con horarios alternativos */}
          {status === 'no_availability' && suggestedTimes.length > 0 && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-left">
              <p className="text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
                {errorMsg || 'No hay disponibilidad para esa hora.'}
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-sm mb-2">Horarios alternativos disponibles:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleFieldChange('time', t)}
                    className="px-3 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mensaje de error */}
          {status === 'error' && errorMsg && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* Honeypot anti-bot — oculto visualmente, accesible a screen readers como campo vacío */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
            <label htmlFor="website-url">No rellenar</label>
            <input
              type="text"
              id="website-url"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Botón de envío */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={status === 'submitting' || availabilityLoading}
              className="w-full px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              {status === 'submitting' ? 'Reservando…' : (content.cta_text || 'Reservar Mesa')}
            </button>
          </div>
        </form>
      ) : (
        <Link
          href={content.cta_url || '/reservas'}
          className="inline-block px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {content.cta_text || 'Reservar Mesa'}
        </Link>
      )}
    </div>
  )
}
