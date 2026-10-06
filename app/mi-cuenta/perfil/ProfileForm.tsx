'use client'

import { useState } from 'react'
import type { AuthCustomer } from '@/lib/get-auth-customer'
import { TelefonoPais } from '@/components/site/TelefonoPais'

interface ProfileFormProps {
  customer: AuthCustomer
  primaryColor: string
  organizationId: number
}

export function ProfileForm({ customer, primaryColor, organizationId }: ProfileFormProps) {
  const [form, setForm] = useState({
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    phone: customer.phone || '',
    doc_type: customer.doc_type || customer.identification_type || '',
    doc_number: customer.doc_number || customer.identification_number || '',
    address: customer.address || '',
    city: customer.city || '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          organization_id: organizationId,
          ...form,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Perfil actualizado correctamente' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text" name="first_name" value={form.first_name} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
              placeholder="Juan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
            <input
              type="text" name="last_name" value={form.last_name} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
              placeholder="Pérez"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email" value={customer.email || ''} disabled
            className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <TelefonoPais
            name="phone"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            className="rounded-lg border"
            aria-label="Teléfono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
            <select
              name="doc_type" value={form.doc_type} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
            >
              <option value="">Seleccionar</option>
              <option value="cc">Cédula de Ciudadanía</option>
              <option value="ce">Cédula de Extranjería</option>
              <option value="passport">Pasaporte</option>
              <option value="nit">NIT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de documento</label>
            <input
              type="text" name="doc_number" value={form.doc_number} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
              placeholder="1234567890"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text" name="address" value={form.address} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
              placeholder="Calle 123 #45-67"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input
              type="text" name="city" value={form.city} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
              placeholder="Bogotá"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
