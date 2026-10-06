'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { User, Mail, Phone, FileText, CreditCard } from 'lucide-react'
import { TelefonoPais } from '@/components/site/TelefonoPais'

interface GuestData {
  firstName: string
  lastName: string
  email: string
  phone: string
  identificationType: string
  identificationNumber: string
  notes: string
}

interface GuestInfoProps {
  guestData: GuestData
  onChange: (data: GuestData) => void
  primaryColor: string
}

export function GuestInfo({ guestData, onChange, primaryColor }: GuestInfoProps) {
  const updateField = (field: keyof GuestData, value: string) => {
    onChange({ ...guestData, [field]: value })
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Información del huésped</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <User className="h-4 w-4 mr-2" />
            Nombre
          </label>
          <Input
            value={guestData.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            placeholder="Juan"
            required
          />
        </div>
        
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <User className="h-4 w-4 mr-2" />
            Apellido
          </label>
          <Input
            value={guestData.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            placeholder="Pérez"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Mail className="h-4 w-4 mr-2" />
          Correo electrónico
        </label>
        <Input
          type="email"
          value={guestData.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="juan@ejemplo.com"
          required
        />
      </div>
      
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Phone className="h-4 w-4 mr-2" />
          Teléfono
        </label>
        <TelefonoPais
          value={guestData.phone}
          onChange={(v) => updateField('phone', v)}
          required
          className="rounded-md border border-input bg-background text-sm [&_input]:h-9"
          aria-label="Teléfono"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <CreditCard className="h-4 w-4 mr-2" />
            Tipo de documento
          </label>
          <select
            value={guestData.identificationType}
            onChange={(e) => updateField('identificationType', e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{ focusRingColor: primaryColor } as React.CSSProperties}
          >
            <option value="">Seleccionar...</option>
            <option value="CC">Cédula de Ciudadanía</option>
            <option value="CE">Cédula de Extranjería</option>
            <option value="PA">Pasaporte</option>
            <option value="NIT">NIT</option>
          </select>
        </div>
        
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4 mr-2" />
            Número de documento
          </label>
          <Input
            value={guestData.identificationNumber}
            onChange={(e) => updateField('identificationNumber', e.target.value)}
            placeholder="1234567890"
          />
        </div>
      </div>
      
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <FileText className="h-4 w-4 mr-2" />
          Notas o solicitudes especiales (opcional)
        </label>
        <Textarea
          value={guestData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Ej: Llegada tardía, cama extra, preferencias..."
          rows={3}
        />
      </div>
    </div>
  )
}
