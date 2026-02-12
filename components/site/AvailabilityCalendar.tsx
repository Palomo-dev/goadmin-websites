'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CalendarDay {
  date: string
  price: number
  available: boolean
  spacesAvailable: number
  blocked: boolean
  source: string
  past: boolean
}

interface AvailabilityCalendarProps {
  organizationId: number
  spaceId?: string
  spaceTypeId?: string
  primaryColor: string
  onSelectDates?: (checkin: string, checkout: string) => void
}

export function AvailabilityCalendar({ organizationId, spaceId, spaceTypeId, primaryColor, onSelectDates }: AvailabilityCalendarProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
  const [days, setDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(false)
  const [baseRate, setBaseRate] = useState(0)
  const [selectedCheckin, setSelectedCheckin] = useState<string | null>(null)
  const [selectedCheckout, setSelectedCheckout] = useState<string | null>(null)

  const fetchCalendar = useCallback(async (month: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/reservations/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, ...(spaceId ? { spaceId } : { spaceTypeId }), month })
      })
      if (res.ok) {
        const data = await res.json()
        setDays(data.days || [])
        setBaseRate(data.baseRate || 0)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [organizationId, spaceId, spaceTypeId])

  useEffect(() => {
    fetchCalendar(currentMonth)
  }, [currentMonth, fetchCalendar])

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    const now = new Date()
    if (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth())) return
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleDayClick = (day: CalendarDay) => {
    if (!day.available || day.past) return

    if (!selectedCheckin || (selectedCheckin && selectedCheckout)) {
      // Primer click o reset
      setSelectedCheckin(day.date)
      setSelectedCheckout(null)
    } else {
      // Segundo click
      if (day.date <= selectedCheckin) {
        setSelectedCheckin(day.date)
        setSelectedCheckout(null)
      } else {
        setSelectedCheckout(day.date)
        onSelectDates?.(selectedCheckin, day.date)
      }
    }
  }

  const isInRange = (dateStr: string) => {
    if (!selectedCheckin || !selectedCheckout) return false
    return dateStr > selectedCheckin && dateStr < selectedCheckout
  }

  const isCheckin = (dateStr: string) => dateStr === selectedCheckin
  const isCheckout = (dateStr: string) => dateStr === selectedCheckout

  // Renderizar el mes actual del calendario
  const [year, month] = currentMonth.split('-').map(Number)
  const monthName = new Date(year, month - 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  // Filtrar days que pertenezcan a este mes
  const monthPrefix = currentMonth
  const monthDays = days.filter(d => d.date.startsWith(monthPrefix))
  const dayMap = new Map(monthDays.map(d => [d.date, d]))

  const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-gray-900 capitalize">{monthName}</h3>
        <Button variant="ghost" size="sm" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Encabezado días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-xs font-medium text-gray-400 py-1">{w}</div>
            ))}
          </div>

          {/* Grilla de días */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espacios vacíos antes del primer día */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Días del mes */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dateStr = `${currentMonth}-${String(dayNum).padStart(2, '0')}`
              const day = dayMap.get(dateStr)
              const available = day?.available ?? false
              const past = day?.past ?? true
              const blocked = day?.blocked ?? false
              const price = day?.price ?? baseRate
              const hasSpecialRate = day?.source === 'rate'
              const inRange = isInRange(dateStr)
              const checkinDay = isCheckin(dateStr)
              const checkoutDay = isCheckout(dateStr)

              let bgClass = ''
              let textClass = 'text-gray-400'
              let priceColor = 'text-gray-300'
              let cursor = 'cursor-default'

              if (past) {
                bgClass = 'bg-gray-50'
                textClass = 'text-gray-300'
              } else if (blocked) {
                bgClass = 'bg-red-50'
                textClass = 'text-red-300 line-through'
                priceColor = 'text-red-200'
              } else if (checkinDay || checkoutDay) {
                bgClass = ''
                textClass = 'text-white'
                priceColor = 'text-white/80'
              } else if (inRange) {
                bgClass = ''
                textClass = 'text-gray-900'
                priceColor = 'text-gray-500'
              } else if (available) {
                bgClass = 'hover:bg-gray-50'
                textClass = 'text-gray-900'
                priceColor = hasSpecialRate ? 'text-orange-500' : 'text-gray-500'
                cursor = 'cursor-pointer'
              }

              return (
                <button
                  key={dateStr}
                  disabled={!available || past}
                  onClick={() => day && handleDayClick(day)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${bgClass} ${cursor} ${
                    checkinDay || checkoutDay ? 'ring-2' : ''
                  }`}
                  style={{
                    ...(checkinDay || checkoutDay ? { backgroundColor: primaryColor, ringColor: primaryColor } : {}),
                    ...(inRange ? { backgroundColor: `${primaryColor}15` } : {}),
                  }}
                >
                  <span className={`font-medium leading-none ${textClass}`}>{dayNum}</span>
                  {!past && !blocked && available && (
                    <span className={`text-[9px] leading-none mt-0.5 ${priceColor}`}>
                      ${(price / 1000).toFixed(0)}k
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400 justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 border" /> Pasado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `${primaryColor}30` }} /> Disponible
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" /> Bloqueado
            </span>
            <span className="flex items-center gap-1 text-orange-500 font-medium">* Tarifa especial</span>
          </div>

          {/* Selección */}
          {selectedCheckin && (
            <div className="mt-3 text-center text-xs text-gray-500">
              {selectedCheckout ? (
                <span>
                  <strong style={{ color: primaryColor }}>{selectedCheckin}</strong> → <strong style={{ color: primaryColor }}>{selectedCheckout}</strong>
                </span>
              ) : (
                <span>Selecciona la fecha de check-out</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
