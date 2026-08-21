'use client'

import { useState } from 'react'
import { TripSearchWidget } from '@/components/site/transport/TripSearchWidget'
import { Clock, Bus, MapPin, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Stop {
  id: string
  name: string
  city: string
  department: string
}

interface Trip {
  id: string
  trip_code: string
  trip_date: string
  scheduled_departure: string
  scheduled_arrival: string
  total_seats: number
  available_seats: number
  base_fare: number
  currency: string
  status: string
  transport_routes: {
    id: string
    name: string
    code: string
    estimated_distance_km: number
    estimated_duration_minutes: number
  } | null
  vehicles: {
    id: string
    plate: string
    vehicle_type: string
    brand: string
    model: string
    passenger_capacity: number
  } | null
}

interface TripSearchClientProps {
  stops: Stop[]
  initialTrips: Trip[]
  primaryColor: string
  initialOrigin?: string
  initialDestination?: string
  initialDate?: string
  initialPassengers?: number
  organizationId: number
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(minutes: number) {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}min` : ''}` : `${m}min`
}

export function TripSearchClient({
  stops,
  initialTrips,
  primaryColor,
  initialOrigin = '',
  initialDestination = '',
  initialDate = '',
  initialPassengers = 1,
  organizationId,
}: TripSearchClientProps) {
  const [trips, setTrips] = useState<Trip[]>(initialTrips)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(initialTrips.length > 0)
  const [searchParams, setSearchParams] = useState({
    origin: initialOrigin,
    destination: initialDestination,
    date: initialDate,
    passengers: initialPassengers,
  })

  const handleSearch = async (params: { origin: string; destination: string; date: string; passengers: number }) => {
    setLoading(true)
    setSearched(true)
    setSearchParams(params)

    try {
      const qs = new URLSearchParams({
        origin: params.origin,
        destination: params.destination,
        date: params.date,
        passengers: String(params.passengers),
      })
      const res = await fetch(`/viajes?${qs.toString()}`, { headers: { Accept: 'application/json' } })

      // Recargar la página con los parámetros de búsqueda
      window.location.href = `/viajes?${qs.toString()}`
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <TripSearchWidget
        stops={stops}
        primaryColor={primaryColor}
        defaultOrigin={searchParams.origin}
        defaultDestination={searchParams.destination}
        defaultDate={searchParams.date}
        defaultPassengers={searchParams.passengers}
        onSearch={handleSearch}
        loading={loading}
      />

      {/* Resultados */}
      {searched && !loading && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {trips.length > 0
              ? `${trips.length} viaje${trips.length > 1 ? 's' : ''} encontrado${trips.length > 1 ? 's' : ''}`
              : 'No se encontraron viajes'
            }
          </h2>

          {trips.length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-4xl mb-3">🚌</p>
              <h3 className="font-semibold text-lg mb-1">Sin viajes disponibles</h3>
              <p className="text-gray-500 text-sm">Intenta con otra fecha o destino</p>
            </div>
          )}

          <div className="space-y-3">
            {trips.map(trip => {
              const route = trip.transport_routes
              const vehicle = trip.vehicles
              return (
                <Link
                  key={trip.id}
                  href={`/viajes/${trip.id}?origin=${searchParams.origin}&destination=${searchParams.destination}&passengers=${searchParams.passengers}`}
                  className="block bg-white rounded-xl border hover:shadow-md transition-shadow p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Horarios */}
                    <div className="flex items-center gap-3 md:min-w-[200px]">
                      <div className="text-center">
                        <div className="text-xl font-bold" style={{ color: primaryColor }}>{formatTime(trip.scheduled_departure)}</div>
                        <div className="text-xs text-gray-500">{searchParams.origin}</div>
                      </div>
                      <div className="flex-1 flex items-center gap-1 text-gray-300">
                        <div className="flex-1 border-t border-dashed" />
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-700">{formatTime(trip.scheduled_arrival)}</div>
                        <div className="text-xs text-gray-500">{searchParams.destination}</div>
                      </div>
                    </div>

                    {/* Detalles */}
                    <div className="flex-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      {route && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {route.name}
                        </span>
                      )}
                      {route?.estimated_duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(route.estimated_duration_minutes)}
                        </span>
                      )}
                      {vehicle && (
                        <span className="flex items-center gap-1">
                          <Bus className="h-3.5 w-3.5" />
                          {vehicle.brand} {vehicle.model}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {trip.available_seats} disponibles
                      </span>
                    </div>

                    {/* Precio */}
                    <div className="text-right md:min-w-[120px]">
                      <div className="text-2xl font-bold" style={{ color: primaryColor }}>
                        ${Number(trip.base_fare).toLocaleString('es-CO')}
                      </div>
                      <div className="text-xs text-gray-500">{trip.currency || 'COP'} / pasajero</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {!searched && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <h3 className="font-semibold text-lg mb-1">Busca tu viaje</h3>
          <p className="text-gray-500 text-sm">Selecciona origen, destino y fecha para ver viajes disponibles</p>
        </div>
      )}
    </div>
  )
}
