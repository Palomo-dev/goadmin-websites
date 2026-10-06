'use client'

import { useState } from 'react'
import { trackMetaLead } from '@/components/site/MetaPixelEvents'
// Mismo señuelo que usan los formularios de contacto: un solo patrón, no dos.
import { HONEYPOT_FIELD_PROPS } from '@/components/sections/contact/useContactForm'
import { TelefonoPais } from '@/components/site/TelefonoPais'

interface ServiceOption {
  id: string
  name: string
}

interface QuoteFormProps {
  organizationId: number
  services: ServiceOption[]
  primaryColor: string
  preselectedServiceId?: string
}

export function QuoteForm({ organizationId, services, primaryColor, preselectedServiceId }: QuoteFormProps) {
  const [form, setForm] = useState({
    serviceId: preselectedServiceId || '',
    website: '', // señuelo: si un bot lo rellena, el servidor descarta el envío
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    description: '',
    budget: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/services/quotes', {
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
          companyName: form.companyName || undefined,
          description: form.description,
          budget: form.budget ? Number(form.budget) : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al enviar solicitud')
      } else {
        setSuccess(true)
        trackMetaLead(form.budget ? Number(form.budget) : 0)
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Cotización Solicitada!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Hemos recibido tu solicitud de cotización. Nuestro equipo la revisará y te enviaremos una propuesta a tu correo.
        </p>
        <a href="/servicios" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: primaryColor }}>
          ← Volver a servicios
        </a>
      </div>
    )
  }

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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servicio de interés</label>
          <select
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
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
          <TelefonoPais
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white [&_input]:py-3"
            aria-label="Teléfono"
          />
        </div>
      </div>

      {/* Empresa */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa / Organización</label>
        <input
          type="text"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
          placeholder="Nombre de tu empresa (opcional)"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Describe tu necesidad *</label>
        <textarea
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none resize-none"
          placeholder="Describe el proyecto, servicio que necesitas, alcance, plazos esperados..."
        />
      </div>

      {/* Presupuesto estimado */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Presupuesto estimado (opcional)</label>
        <input
          type="number"
          min="0"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none"
          placeholder="$0"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-6 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? 'Enviando...' : '📋 Solicitar Cotización'}
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Recibirás una propuesta personalizada en tu correo electrónico.
      </p>
    </form>
  )
}
