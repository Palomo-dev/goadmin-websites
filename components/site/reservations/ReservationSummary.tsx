'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Users, Moon, MapPin, Receipt } from 'lucide-react'

interface SpaceType {
  id: string
  name: string
  base_rate: number
  capacity: number
}

interface GuestData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface ReservationSummaryProps {
  spaceType: SpaceType
  checkin: string
  checkout: string
  guests: number
  guestData: GuestData
  primaryColor: string
}

export function ReservationSummary({
  spaceType,
  checkin,
  checkout,
  guests,
  guestData,
  primaryColor
}: ReservationSummaryProps) {
  const checkinDate = new Date(checkin)
  const checkoutDate = new Date(checkout)
  const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))
  
  const subtotal = Number(spaceType.base_rate) * nights
  const taxes = subtotal * 0.19 // IVA 19%
  const total = subtotal + taxes

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Resumen de tu reserva</h3>
      
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Espacio seleccionado */}
          <div className="flex items-start gap-3 pb-4 border-b">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{spaceType.name}</p>
              <p className="text-sm text-gray-500">Capacidad: {spaceType.capacity} personas</p>
            </div>
          </div>
          
          {/* Fechas */}
          <div className="flex items-start gap-3 pb-4 border-b">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Check-in</p>
                  <p className="font-medium text-gray-900">{formatDate(checkin)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-out</p>
                  <p className="font-medium text-gray-900">{formatDate(checkout)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Noches y huéspedes */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{nights} {nights === 1 ? 'noche' : 'noches'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{guests} {guests === 1 ? 'huésped' : 'huéspedes'}</span>
            </div>
          </div>
          
          {/* Datos del huésped */}
          <div className="pb-4 border-b">
            <p className="text-sm text-gray-500 mb-1">Huésped principal</p>
            <p className="font-medium text-gray-900">{guestData.firstName} {guestData.lastName}</p>
            <p className="text-sm text-gray-600">{guestData.email}</p>
            <p className="text-sm text-gray-600">{guestData.phone}</p>
          </div>
          
          {/* Desglose de precios */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Desglose</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                ${Number(spaceType.base_rate).toLocaleString()} x {nights} noches
              </span>
              <span className="text-gray-900">${subtotal.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">IVA (19%)</span>
              <span className="text-gray-900">${taxes.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between pt-3 border-t mt-3">
              <span className="font-semibold text-gray-900">Total</span>
              <span 
                className="text-xl font-bold"
                style={{ color: primaryColor }}
              >
                ${total.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="text-xs text-gray-500 text-center">
        Al confirmar, aceptas nuestros términos y condiciones de reserva.
      </p>
    </div>
  )
}
