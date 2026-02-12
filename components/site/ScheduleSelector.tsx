'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Clock, Zap } from 'lucide-react'

interface ScheduleSelectorProps {
  isScheduled: boolean
  scheduledAt: string | null
  onScheduledChange: (isScheduled: boolean) => void
  onTimeChange: (scheduledAt: string | null) => void
  primaryColor: string
}

export function ScheduleSelector({
  isScheduled, scheduledAt, onScheduledChange, onTimeChange, primaryColor
}: ScheduleSelectorProps) {

  // Generar opciones de tiempo (cada 30min desde ahora + 30min hasta +8h)
  const getTimeSlots = (): string[] => {
    const slots: string[] = []
    const now = new Date()
    const start = new Date(now)
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30 + 30, 0, 0)

    for (let i = 0; i < 16; i++) {
      const slot = new Date(start.getTime() + i * 30 * 60 * 1000)
      // No pasar de las 23:00
      if (slot.getHours() >= 23) break
      slots.push(slot.toISOString())
    }
    return slots
  }

  const timeSlots = getTimeSlots()

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Hoy'
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana'
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">¿Para cuándo?</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { onScheduledChange(false); onTimeChange(null) }}
          className={`p-3 rounded-xl border-2 text-left transition-all ${
            !isScheduled ? 'border-current shadow-sm' : 'border-gray-200 hover:border-gray-300'
          }`}
          style={!isScheduled ? { borderColor: primaryColor } : {}}
        >
          <Zap className="h-5 w-5 mb-1" style={{ color: !isScheduled ? primaryColor : '#9CA3AF' }} />
          <p className="font-semibold text-sm" style={!isScheduled ? { color: primaryColor } : { color: '#374151' }}>
            Lo antes posible
          </p>
          <p className="text-xs text-gray-500">Preparamos tu pedido ahora</p>
        </button>
        <button
          type="button"
          onClick={() => onScheduledChange(true)}
          className={`p-3 rounded-xl border-2 text-left transition-all ${
            isScheduled ? 'border-current shadow-sm' : 'border-gray-200 hover:border-gray-300'
          }`}
          style={isScheduled ? { borderColor: primaryColor } : {}}
        >
          <Clock className="h-5 w-5 mb-1" style={{ color: isScheduled ? primaryColor : '#9CA3AF' }} />
          <p className="font-semibold text-sm" style={isScheduled ? { color: primaryColor } : { color: '#374151' }}>
            Programar
          </p>
          <p className="text-xs text-gray-500">Elige fecha y hora</p>
        </button>
      </div>

      {isScheduled && (
        <div className="mt-3">
          {timeSlots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {timeSlots.map(slot => {
                const isSelected = scheduledAt === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onTimeChange(slot)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                  >
                    <span className="block text-[10px] text-gray-400 font-normal">
                      {!isSelected && formatDate(slot)}
                    </span>
                    {formatTime(slot)}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay horarios disponibles para hoy. Intenta mañana.</p>
          )}
        </div>
      )}
    </div>
  )
}
