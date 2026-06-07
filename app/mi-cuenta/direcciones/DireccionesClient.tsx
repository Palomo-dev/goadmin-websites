'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, MapPin, Star } from 'lucide-react'

interface Address {
  id: number
  label?: string
  address_line?: string
  address_line1?: string
  city?: string
  department?: string
  state?: string
  is_default?: boolean
  recipient_name?: string
  recipient_phone?: string
  delivery_instructions?: string
}

interface Props {
  addresses: Address[]
  organizationId: number
  primaryColor: string
}

export function DireccionesClient({ addresses: initialAddresses, organizationId, primaryColor }: Props) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    label: '',
    address_line: '',
    city: '',
    is_default: false
  })

  const handleSave = async () => {
    if (!form.address_line.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/customer/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          address_line: form.address_line,
          city: form.city,
          label: form.label || 'Dirección',
          is_default: form.is_default
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.address) {
          if (form.is_default) {
            setAddresses([data.address, ...addresses.map(a => ({ ...a, is_default: false }))])
          } else {
            setAddresses([...addresses, data.address])
          }
          setForm({ label: '', address_line: '', city: '', is_default: false })
          setShowForm(false)
        }
      }
    } catch {}
    setSaving(false)
  }

  const setAsDefault = async (addrId: number) => {
    try {
      const res = await fetch('/api/customer/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          address_line: addresses.find(a => a.id === addrId)?.address_line || addresses.find(a => a.id === addrId)?.address_line1,
          city: addresses.find(a => a.id === addrId)?.city,
          label: addresses.find(a => a.id === addrId)?.label || 'Principal',
          is_default: true
        })
      })
      if (res.ok) {
        setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === addrId })))
      }
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Direcciones</h1>
          <p className="text-gray-500">Gestiona tus direcciones de entrega</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: primaryColor }}
          className="text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>

      {/* Formulario para agregar */}
      {showForm && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Nueva dirección</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta</label>
              <Input
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="Ej: Casa, Oficina..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
              <Input
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Medellín"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección completa</label>
            <Input
              value={form.address_line}
              onChange={e => setForm({ ...form, address_line: e.target.value })}
              placeholder="Calle 123 #45-67, Barrio, Ciudad"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={e => setForm({ ...form, is_default: e.target.checked })}
              className="rounded"
              style={{ accentColor: primaryColor }}
            />
            Marcar como dirección principal
          </label>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving || !form.address_line.trim()} style={{ backgroundColor: primaryColor }} className="text-white">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de direcciones */}
      {addresses.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📍</p>
          <h3 className="font-semibold text-lg mb-1">No tienes direcciones guardadas</h3>
          <p className="text-gray-500">Agrega una dirección para tus entregas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: addr.is_default ? primaryColor : '#9CA3AF' }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{addr.label || 'Dirección'}</p>
                      {addr.is_default && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Principal</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{addr.address_line || addr.address_line1}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[addr.city, addr.department || addr.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                {!addr.is_default && (
                  <button
                    onClick={() => setAsDefault(addr.id)}
                    className="text-xs flex items-center gap-1 hover:underline"
                    style={{ color: primaryColor }}
                  >
                    <Star className="h-3 w-3" />
                    Hacer principal
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
