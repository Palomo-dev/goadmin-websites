'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Calendar, Users, ArrowRightLeft } from 'lucide-react'

interface Stop {
  id: string
  name: string
  city: string
  department: string
}

interface TripSearchWidgetProps {
  stops: Stop[]
  primaryColor: string
  defaultOrigin?: string
  defaultDestination?: string
  defaultDate?: string
  defaultPassengers?: number
  onSearch: (params: { origin: string; destination: string; date: string; passengers: number }) => void
  loading?: boolean
}

function StopAutocomplete({
  stops,
  value,
  onChange,
  placeholder,
  icon,
}: {
  stops: Stop[]
  value: string
  onChange: (val: string) => void
  placeholder: string
  icon: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const cities = Array.from(new Set(stops.map(s => s.city))).sort()
  const filtered = cities.filter(c =>
    c.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2.5">
        {icon}
        <input
          type="text"
          className="w-full outline-none text-sm bg-transparent"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(city => (
            <button
              key={city}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              onClick={() => { onChange(city); setQuery(city); setOpen(false) }}
            >
              <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span>{city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TripSearchWidget({
  stops,
  primaryColor,
  defaultOrigin = '',
  defaultDestination = '',
  defaultDate = '',
  defaultPassengers = 1,
  onSearch,
  loading = false,
}: TripSearchWidgetProps) {
  const [origin, setOrigin] = useState(defaultOrigin)
  const [destination, setDestination] = useState(defaultDestination)
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0])
  const [passengers, setPassengers] = useState(defaultPassengers)

  const swap = () => {
    const tmp = origin
    setOrigin(destination)
    setDestination(tmp)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!origin || !destination || !date) return
    onSearch({ origin, destination, date, passengers })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border p-4 md:p-6">
      <div className="flex flex-col md:flex-row gap-3 items-end">
        {/* Origen */}
        <StopAutocomplete
          stops={stops}
          value={origin}
          onChange={setOrigin}
          placeholder="Ciudad de origen"
          icon={<MapPin className="h-4 w-4 text-green-600 shrink-0" />}
        />

        {/* Swap */}
        <button
          type="button"
          onClick={swap}
          className="hidden md:flex items-center justify-center w-9 h-9 rounded-full border hover:bg-gray-50 shrink-0"
          title="Intercambiar"
        >
          <ArrowRightLeft className="h-4 w-4 text-gray-500" />
        </button>

        {/* Destino */}
        <StopAutocomplete
          stops={stops}
          value={destination}
          onChange={setDestination}
          placeholder="Ciudad de destino"
          icon={<MapPin className="h-4 w-4 text-red-500 shrink-0" />}
        />

        {/* Fecha */}
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2.5 min-w-[160px]">
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="date"
            className="w-full outline-none text-sm bg-transparent"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Pasajeros */}
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2.5 w-[120px]">
          <Users className="h-4 w-4 text-gray-400 shrink-0" />
          <select
            className="w-full outline-none text-sm bg-transparent"
            value={passengers}
            onChange={e => setPassengers(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'pasajero' : 'pasajeros'}</option>
            ))}
          </select>
        </div>

        {/* Buscar */}
        <button
          type="submit"
          disabled={loading || !origin || !destination}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium text-sm disabled:opacity-50 shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <Search className="h-4 w-4" />
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
    </form>
  )
}
