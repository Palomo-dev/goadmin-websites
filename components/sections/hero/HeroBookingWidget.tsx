'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Calendar, Users, Search, Moon, ChevronDown, Minus, Plus } from 'lucide-react'

interface HeroBookingWidgetProps {
  primaryColor: string
}

export function HeroBookingWidget({ primaryColor }: HeroBookingWidgetProps) {
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [guestOpen, setGuestOpen] = useState(false)
  const [error, setError] = useState('')
  const guestRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const minCheckout = useMemo(() => {
    if (!checkin) return today
    const d = new Date(checkin + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }, [checkin, today])

  const nights = useMemo(() => {
    if (!checkin || !checkout) return 0
    const diff = Math.round(
      (new Date(checkout + 'T12:00:00').getTime() - new Date(checkin + 'T12:00:00').getTime()) /
      (1000 * 60 * 60 * 24)
    )
    return diff > 0 ? diff : 0
  }, [checkin, checkout])

  const handleCheckinChange = useCallback((value: string) => {
    setCheckin(value)
    setError('')
    if (value) {
      const ci = new Date(value + 'T12:00:00')
      if (!checkout || new Date(checkout + 'T12:00:00') <= ci) {
        const next = new Date(ci)
        next.setDate(next.getDate() + 1)
        setCheckout(next.toISOString().split('T')[0])
      }
    }
  }, [checkout])

  const totalGuests = adults + children

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guestRef.current && !guestRef.current.contains(e.target as Node)) {
        setGuestOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = () => {
    if (!checkin) { setError('Selecciona la fecha de llegada'); return }
    if (!checkout) { setError('Selecciona la fecha de salida'); return }
    if (nights <= 0) { setError('La fecha de salida debe ser posterior a la de llegada'); return }
    setError('')
    const params = new URLSearchParams({
      checkin,
      checkout,
      adults: String(adults),
      children: String(children),
      guests: String(totalGuests),
    })
    window.location.href = `/espacios?${params.toString()}`
  }

  const fmtDate = (d: string) => {
    if (!d) return ''
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="text-left">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 dark:border-gray-700/50 p-4 sm:p-5 md:p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_minmax(160px,1fr)_auto] gap-3">

          {/* Check-in */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              <Calendar className="w-3.5 h-3.5 dark:text-gray-400" />
              Llegada
            </label>
            <input
              type="date"
              value={checkin}
              min={today}
              onChange={(e) => handleCheckinChange(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] text-sm font-medium focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            {checkin && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmtDate(checkin)}</p>}
          </div>

          {/* Check-out */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              <Calendar className="w-3.5 h-3.5 dark:text-gray-400" />
              Salida
            </label>
            <input
              type="date"
              value={checkout}
              min={minCheckout}
              onChange={(e) => { setCheckout(e.target.value); setError('') }}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] text-sm font-medium focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            {checkout && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmtDate(checkout)}</p>}
          </div>

          {/* Huéspedes */}
          <div className="relative" ref={guestRef}>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5" />
              Huéspedes
            </label>
            <button
              type="button"
              onClick={() => setGuestOpen(!guestOpen)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <span>{adults} Ad.{children > 0 ? ` · ${children} Niñ.` : ''}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${guestOpen ? 'rotate-180' : ''}`} />
            </button>

            {guestOpen && (
              <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-4 z-50 w-[260px]">
                {/* Adultos */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Adultos</p>
                    <p className="text-xs text-gray-400">13+ años</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} disabled={adults <= 1}
                      className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold dark:text-white">{adults}</span>
                    <button type="button" onClick={() => setAdults(Math.min(10, adults + 1))} disabled={adults >= 10}
                      className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <hr className="border-gray-100 dark:border-gray-700" />

                {/* Niños */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Niños</p>
                    <p className="text-xs text-gray-400">0–12 años</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} disabled={children <= 0}
                      className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold dark:text-white">{children}</span>
                    <button type="button" onClick={() => setChildren(Math.min(6, children + 1))} disabled={children >= 6}
                      className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button type="button" onClick={() => setGuestOpen(false)}
                  className="w-full mt-2 text-center text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: primaryColor }}>
                  Listo
                </button>
              </div>
            )}
          </div>

          {/* Buscar */}
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              onClick={handleSearch}
              className="w-full h-11 px-6 rounded-xl text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap"
              style={{ backgroundColor: primaryColor }}
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </div>

        {/* Info noches + error */}
        <div className="mt-3 flex items-center justify-between min-h-[20px]">
          {nights > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Moon className="w-3.5 h-3.5" />
              <span className="font-semibold" style={{ color: primaryColor }}>{nights}</span>
              {nights === 1 ? 'noche' : 'noches'}
              {' · '}{totalGuests} {totalGuests === 1 ? 'huésped' : 'huéspedes'}
            </p>
          )}
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        </div>
      </div>
    </div>
  )
}
