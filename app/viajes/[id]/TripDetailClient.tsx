'use client'

import { useState, useCallback } from 'react'
import { SeatMap } from '@/components/site/transport/SeatMap'
import { TripBookingForm } from '@/components/site/transport/TripBookingForm'
import { MapPin, Clock, Bus, Calendar, Route, Info } from 'lucide-react'

interface Gateway { code: string; name: string }

interface TripDetailClientProps {
  trip: any
  gateways: Gateway[]
  primaryColor: string
  organizationId: number
  originCity: string
  destinationCity: string
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDuration(minutes: number) {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}min` : ''}` : `${m}min`
}

export function TripDetailClient({
  trip,
  gateways,
  primaryColor,
  organizationId,
  originCity,
  destinationCity,
}: TripDetailClientProps) {
  const [selectedSeats, setSelectedSeats] = useState<{ id: string; label: string }[]>([])
  const [fare, setFare] = useState(Number(trip.base_fare) || 0)

  const route = trip.transport_routes
  const vehicle = trip.vehicles
  const stops = trip.stops || []

  const handleToggleSeat = useCallback((seatId: string, seatLabel: string) => {
    setSelectedSeats(prev => {
      const exists = prev.find(s => s.id === seatId)
      if (exists) return prev.filter(s => s.id !== seatId)
      return [...prev, { id: seatId, label: seatLabel }]
    })
  }, [])

  return (
    <div className="space-y-8">
      {/* Header del viaje */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Horarios */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: primaryColor }}>{formatTime(trip.scheduled_departure)}</div>
              <div className="text-sm text-gray-500">{originCity || 'Origen'}</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-4">
              <div className="text-xs text-gray-400">{route?.estimated_duration_minutes ? formatDuration(route.estimated_duration_minutes) : ''}</div>
              <div className="w-24 border-t-2 border-dashed" style={{ borderColor: primaryColor }} />
              {route?.estimated_distance_km && (
                <div className="text-xs text-gray-400">{route.estimated_distance_km} km</div>
              )}
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-700">{formatTime(trip.scheduled_arrival)}</div>
              <div className="text-sm text-gray-500">{destinationCity || 'Destino'}</div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(trip.trip_date)}</span>
            </div>
            {route && (
              <div className="flex items-center gap-1.5">
                <Route className="h-4 w-4" />
                <span>{route.name}</span>
              </div>
            )}
            {vehicle && (
              <div className="flex items-center gap-1.5">
                <Bus className="h-4 w-4" />
                <span>{vehicle.brand} {vehicle.model} ({vehicle.vehicle_type})</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4" />
              <span>{trip.available_seats} asientos disponibles</span>
            </div>
          </div>

          {/* Precio */}
          <div className="text-right">
            <div className="text-sm text-gray-500">Desde</div>
            <div className="text-3xl font-bold" style={{ color: primaryColor }}>
              ${Number(trip.base_fare).toLocaleString('es-CO')}
            </div>
            <div className="text-xs text-gray-500">{trip.currency || 'COP'} / pasajero</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Columna izquierda: Mapa de asientos + Paradas */}
        <div className="space-y-6">
          {/* Mapa de asientos */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-4">Selecciona tus asientos</h3>
            <SeatMap
              seats={trip.seats || []}
              selectedSeats={selectedSeats.map(s => s.id)}
              onToggleSeat={handleToggleSeat}
              primaryColor={primaryColor}
            />
            {selectedSeats.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm">
                <span className="text-gray-600">Seleccionados: </span>
                <span className="font-medium">{selectedSeats.map(s => s.label).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Paradas de la ruta */}
          {stops.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-lg mb-4">Paradas de la ruta</h3>
              <div className="space-y-0">
                {stops.map((stop: any, idx: number) => {
                  const s = stop.transport_stops
                  const isFirst = idx === 0
                  const isLast = idx === stops.length - 1
                  return (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full border-2 shrink-0 ${isFirst || isLast ? '' : 'bg-white'}`}
                          style={{
                            borderColor: primaryColor,
                            backgroundColor: isFirst || isLast ? primaryColor : undefined,
                          }}
                        />
                        {!isLast && <div className="w-0.5 h-8 bg-gray-200" />}
                      </div>
                      <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                        <div className="font-medium text-sm">{s?.name || `Parada ${stop.stop_order}`}</div>
                        <div className="text-xs text-gray-500">{s?.city}{s?.department ? `, ${s.department}` : ''}</div>
                        {stop.estimated_arrival_minutes != null && !isFirst && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            +{stop.estimated_arrival_minutes} min desde el inicio
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: Formulario de compra */}
        <div>
          {selectedSeats.length > 0 ? (
            <TripBookingForm
              tripId={trip.id}
              tripCode={trip.trip_code}
              routeName={route?.name || ''}
              selectedSeats={selectedSeats}
              fare={fare}
              currency={trip.currency || 'COP'}
              organizationId={organizationId}
              primaryColor={primaryColor}
              gateways={gateways}
            />
          ) : (
            <div className="bg-white rounded-xl border p-8 text-center sticky top-4">
              <p className="text-4xl mb-3">💺</p>
              <h3 className="font-semibold text-lg mb-1">Selecciona un asiento</h3>
              <p className="text-gray-500 text-sm">
                Haz clic en un asiento disponible en el mapa para continuar con la compra
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
