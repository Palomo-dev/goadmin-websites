'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Calendar, Moon, Users } from 'lucide-react'

interface DateSelectorProps {
  checkin: string
  checkout: string
  guests: number
  maxGuests: number
  onCheckinChange: (date: string) => void
  onCheckoutChange: (date: string) => void
  onGuestsChange: (guests: number) => void
  primaryColor: string
}

export function DateSelector({
  checkin,
  checkout,
  guests,
  maxGuests,
  onCheckinChange,
  onCheckoutChange,
  onGuestsChange,
  primaryColor
}: DateSelectorProps) {
  const [nights, setNights] = useState(0)
  
  const today = new Date().toISOString().split('T')[0]
  const minCheckout = checkin || today
  
  useEffect(() => {
    if (checkin && checkout) {
      const start = new Date(checkin)
      const end = new Date(checkout)
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      setNights(diff > 0 ? diff : 0)
    } else {
      setNights(0)
    }
  }, [checkin, checkout])

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Selecciona las fechas</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 mr-2" />
            Fecha de llegada (Check-in)
          </label>
          <Input
            type="date"
            value={checkin}
            min={today}
            onChange={(e) => {
              onCheckinChange(e.target.value)
              if (checkout && e.target.value >= checkout) {
                onCheckoutChange('')
              }
            }}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 mr-2" />
            Fecha de salida (Check-out)
          </label>
          <Input
            type="date"
            value={checkout}
            min={minCheckout}
            onChange={(e) => onCheckoutChange(e.target.value)}
            disabled={!checkin}
            className="w-full"
          />
        </div>
      </div>
      
      {nights > 0 && (
        <div 
          className="flex items-center justify-center gap-2 py-3 rounded-lg"
          style={{ backgroundColor: `${primaryColor}10` }}
        >
          <Moon className="h-5 w-5" style={{ color: primaryColor }} />
          <span className="font-medium" style={{ color: primaryColor }}>
            {nights} {nights === 1 ? 'noche' : 'noches'}
          </span>
        </div>
      )}
      
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Users className="h-4 w-4 mr-2" />
          Número de huéspedes
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onGuestsChange(Math.max(1, guests - 1))}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            -
          </button>
          <span className="text-xl font-semibold w-12 text-center">{guests}</span>
          <button
            type="button"
            onClick={() => onGuestsChange(Math.min(maxGuests, guests + 1))}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            +
          </button>
          <span className="text-sm text-gray-500">
            (máximo {maxGuests} personas)
          </span>
        </div>
      </div>
    </div>
  )
}
