'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface DeliveryMapProps {
  orderIdentifier: string
  /** Token de seguimiento (`?t=`): sin él la API no devuelve la posición del repartidor. */
  token?: string | null
  destinationLat?: number
  destinationLng?: number
  destinationAddress?: string
  primaryColor?: string
  pollingInterval?: number
  height?: string
}

interface DriverPosition {
  latitude: number
  longitude: number
  eventTime: string
  locationText?: string
}

declare global {
  interface Window {
    google: any
    initDeliveryMap: () => void
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export function DeliveryMap({
  orderIdentifier,
  token,
  destinationLat,
  destinationLng,
  destinationAddress,
  primaryColor = '#3B82F6',
  pollingInterval = 15000,
  height = '300px',
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const [driverPos, setDriverPos] = useState<DriverPosition | null>(null)
  const [eta, setEta] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Cargar Google Maps SDK
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return
    if (window.google?.maps) {
      setMapLoaded(true)
      return
    }

    window.initDeliveryMap = () => setMapLoaded(true)

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initDeliveryMap`
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      window.initDeliveryMap = undefined as any
    }
  }, [])

  // Polling posición del conductor
  const fetchDriverPosition = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/delivery${token ? `?t=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.lastEvent?.latitude && data.lastEvent?.longitude) {
        setDriverPos({
          latitude: data.lastEvent.latitude,
          longitude: data.lastEvent.longitude,
          eventTime: data.lastEvent.eventTime,
          locationText: data.lastEvent.locationText,
        })
      }
    } catch { /* silent */ }
  }, [orderIdentifier, token])

  useEffect(() => {
    fetchDriverPosition()
    const interval = setInterval(fetchDriverPosition, pollingInterval)
    return () => clearInterval(interval)
  }, [fetchDriverPosition, pollingInterval])

  // Inicializar mapa
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google?.maps) return

    const defaultCenter = driverPos
      ? { lat: driverPos.latitude, lng: driverPos.longitude }
      : destinationLat && destinationLng
        ? { lat: destinationLat, lng: destinationLng }
        : { lat: 4.711, lng: -74.0721 } // Bogotá default

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
        ],
      })
    }
  }, [mapLoaded, driverPos, destinationLat, destinationLng])

  // Actualizar marcadores
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return
    const map = mapInstanceRef.current

    // Marcador del conductor
    if (driverPos) {
      const pos = { lat: driverPos.latitude, lng: driverPos.longitude }

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setPosition(pos)
      } else {
        driverMarkerRef.current = new window.google.maps.Marker({
          position: pos,
          map,
          title: 'Conductor',
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: primaryColor,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            rotation: 0,
          },
          zIndex: 10,
        })
      }

      // Centrar en conductor
      map.panTo(pos)
    }

    // Marcador del destino
    if (destinationLat && destinationLng && !destMarkerRef.current) {
      destMarkerRef.current = new window.google.maps.Marker({
        position: { lat: destinationLat, lng: destinationLng },
        map,
        title: destinationAddress || 'Destino',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      })
    }

    // Ajustar bounds para mostrar ambos marcadores
    if (driverPos && destinationLat && destinationLng) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend({ lat: driverPos.latitude, lng: driverPos.longitude })
      bounds.extend({ lat: destinationLat, lng: destinationLng })
      map.fitBounds(bounds, { padding: 60 })
    }
  }, [driverPos, destinationLat, destinationLng, destinationAddress, primaryColor])

  // Calcular ETA con Directions API
  useEffect(() => {
    if (!mapLoaded || !driverPos || !destinationLat || !destinationLng || !window.google?.maps) return

    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin: { lat: driverPos.latitude, lng: driverPos.longitude },
        destination: { lat: destinationLat, lng: destinationLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === 'OK' && result.routes[0]?.legs[0]) {
          setEta(result.routes[0].legs[0].duration.text)
        }
      }
    )
  }, [mapLoaded, driverPos, destinationLat, destinationLng])

  if (!GOOGLE_MAPS_API_KEY) return null
  if (!driverPos && !destinationLat) return null

  return (
    <div className="bg-white rounded-2xl border overflow-hidden mb-6">
      {/* Header con ETA */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b bg-gray-50">
        <span className="text-sm font-medium text-gray-700">📍 Seguimiento en vivo</span>
        {eta && (
          <span className="text-sm font-bold" style={{ color: primaryColor }}>
            ETA: {eta}
          </span>
        )}
      </div>
      {/* Mapa */}
      <div ref={mapRef} style={{ width: '100%', height }} />
      {/* Info última posición */}
      {driverPos?.locationText && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t">
          📍 {driverPos.locationText} · Hace {getTimeAgo(driverPos.eventTime)}
        </div>
      )}
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h`
}
