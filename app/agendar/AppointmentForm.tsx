'use client'

import { useState } from 'react'
import { trackMetaSchedule } from '@/components/site/MetaPixelEvents'
// Mismo señuelo que los formularios de contacto y cotización: un solo patrón.
import { HONEYPOT_FIELD_PROPS } from '@/components/sections/contact/useContactForm'

interface ServiceOption {
  id: string
  name: string
}

interface AppointmentFormProps {
  organizationId: number
  services: ServiceOption[]
  primaryColor: string
  preselectedServiceId?: string
}

export function AppointmentForm({ organizationId, services, primaryColor, preselectedServiceId }: AppointmentFormProps) {
  const [form, setForm] = useState({
    serviceId: preselectedServiceId || '',
    website: '', // señuelo: si un bot lo rellena, el servidor descarta el envío
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Combinar fecha + hora
    const startAt = form.date && form.time ? `${form.date}T${form.time}:00` : ''
    if (!startAt) {
      setError('Selecciona fecha y hora')
      setLoading(false)
      return
    }

    // Calcular endAt = startAt + 1 hora por defecto
    const start = new Date(startAt)
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    try {
      const res = await fetch('/api/services/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          serviceId: form.serviceId || undefined,
          website: form.website,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          notes: form.notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al enviar solicitud')
      } else {
        setSuccess(true)
        trackMetaSchedule()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Solicitud Enviada!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Te hemos enviado un correo de confirmación. Nuestro equipo revisará tu solicitud y te contactará pronto.
        </p>
        <a href="/servicios" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: primaryColor }}>
          ← Volver a servicios
        </a>
      </div>
    )
  }

  // Generar horarios disponibles (8:00 - 18:00 cada 30 min)
  const timeSlots: string[] = []
  for (let h = 8; h <= 17; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`)
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`)
  }
  timeSlots.push('18:00')

  // Fecha mínima = mañana
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input {...HONEYPOT_FIELD_PROPS} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Servicio */}
      {services.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servicio</label>
          <select
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
            style={{ '--tw-ring-color': primaryColor } as any}
          >
            <option value="">Seleccionar servicio (opcional)</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nombre / Apellido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
          <input
            type="text"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
            placeholder="Tu nombre"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido *</label>
          <input
            type="text"
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
            placeholder="Tu apellido"
          />
        </div>
      </div>

      {/* Email / Teléfono */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
            placeholder="+57 300 123 4567"
          />
        </div>
      </div>

      {/* Fecha / Hora */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha deseada *</label>
          <input
            type="date"
            required
            min={minDate}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora deseada *</label>
          <select
            required
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
          >
            <option value="">Seleccionar hora</option>
            {timeSlots.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas adicionales</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none resize-none"
          placeholder="Describe brevemente el motivo de tu cita..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-6 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? 'Enviando...' : '📅 Solicitar Cita'}
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Tu solicitud será revisada por nuestro equipo. Recibirás confirmación por email.
      </p>
    </form>
  )
}
