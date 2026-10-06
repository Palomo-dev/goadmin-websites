'use client'

import { useState, useEffect } from 'react'

interface DeliveryData {
  hasDelivery: boolean
  shipment?: {
    id: string
    status: string
    trackingNumber: string
    expectedDeliveryDate?: string
    pickedAt?: string
    deliveredAt?: string
    dispatchedAt?: string
    deliveryLatitude?: number
    deliveryLongitude?: number
  }
  driver?: {
    id: string
    name: string
    phone?: string
    avatarUrl?: string
    licenseCategory?: string
  }
  vehicle?: {
    id: string
    plateNumber: string
    vehicleType: string
    brand?: string
    model?: string
    color?: string
    year?: number
  }
  lastEvent?: {
    eventType: string
    eventTime: string
    latitude: number
    longitude: number
    locationText?: string
    description?: string
  }
  proofOfDelivery?: {
    deliveredAt: string
    recipientName: string
    recipientRelationship?: string
    signatureUrl?: string
    photoUrls?: string[]
    rating?: number
    feedback?: string
    notes?: string
  }
}

const VEHICLE_ICONS: Record<string, string> = {
  motorcycle: '🏍️',
  car: '🚗',
  van: '🚐',
  truck: '🚛',
  bicycle: '🚲',
  minibus: '🚌',
  bus: '🚌',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Preparando envío', color: '#F59E0B' },
  assigned: { label: 'Conductor asignado', color: '#3B82F6' },
  picked_up: { label: 'Recogido', color: '#8B5CF6' },
  in_transit: { label: 'En tránsito', color: '#8B5CF6' },
  out_for_delivery: { label: 'En camino a ti', color: '#3B82F6' },
  delivered: { label: 'Entregado', color: '#059669' },
  returned: { label: 'Devuelto', color: '#EF4444' },
  cancelled: { label: 'Cancelado', color: '#6B7280' },
}

interface DeliveryInfoProps {
  orderIdentifier: string
  /** Token de seguimiento (`?t=`): sin él la API solo devuelve el estado del envío. */
  token?: string | null
  primaryColor?: string
  pollingInterval?: number
}

export function DeliveryInfo({ orderIdentifier, token, primaryColor = '#3B82F6', pollingInterval = 15000 }: DeliveryInfoProps) {
  const [data, setData] = useState<DeliveryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchDelivery() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/delivery${token ? `?t=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' })
        if (res.ok && active) {
          const json = await res.json()
          setData(json)
        }
      } catch {
        // silencioso
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchDelivery()

    // Polling solo si el pedido está en delivery activo
    const interval = setInterval(() => {
      if (data?.shipment?.status && !['delivered', 'returned', 'cancelled'].includes(data.shipment.status)) {
        fetchDelivery()
      }
    }, pollingInterval)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [orderIdentifier, token, pollingInterval, data?.shipment?.status])

  if (loading || !data?.hasDelivery) return null

  const { shipment, driver, vehicle, lastEvent, proofOfDelivery } = data
  if (!shipment) return null

  const st = STATUS_LABELS[shipment.status] || { label: shipment.status, color: '#6B7280' }
  const vehicleIcon = vehicle ? (VEHICLE_ICONS[vehicle.vehicleType] || '🚗') : '🛵'
  const isActive = ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(shipment.status)

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header con estado */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: `${st.color}10` }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: `${st.color}20`, color: st.color }}>
          {shipment.status === 'delivered' ? '✅' : '🛵'}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: st.color }}>{st.label}</p>
          {lastEvent?.locationText && isActive && (
            <p className="text-xs text-gray-500">📍 {lastEvent.locationText}</p>
          )}
        </div>
        {isActive && lastEvent?.eventTime && (
          <span className="text-[10px] text-gray-400">
            Hace {getTimeAgo(lastEvent.eventTime)}
          </span>
        )}
      </div>

      {/* Conductor + Vehículo */}
      {driver && (
        <div className="px-4 py-3 border-t flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
            {driver.avatarUrl ? (
              <img src={driver.avatarUrl} alt={driver.name} className="w-full h-full object-cover" />
            ) : (
              '👤'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{driver.name}</p>
            {vehicle && (
              <p className="text-xs text-gray-500">
                {vehicleIcon} {vehicle.brand && `${vehicle.brand} `}{vehicle.model && `${vehicle.model} `}
                {vehicle.color && <span className="capitalize">· {vehicle.color} </span>}
                · <span className="font-medium">{vehicle.plateNumber}</span>
              </p>
            )}
          </div>
          {driver.phone && isActive && (
            <a
              href={`tel:${driver.phone}`}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              title="Llamar conductor"
            >
              📞
            </a>
          )}
        </div>
      )}

      {/* Prueba de entrega */}
      {proofOfDelivery && (
        <div className="px-4 py-3 border-t bg-green-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">✅</span>
            <p className="text-sm font-medium text-green-800">Entregado</p>
          </div>
          <p className="text-xs text-green-700">
            Recibió: <strong>{proofOfDelivery.recipientName}</strong>
            {proofOfDelivery.recipientRelationship && ` (${proofOfDelivery.recipientRelationship})`}
          </p>
          {proofOfDelivery.deliveredAt && (
            <p className="text-xs text-green-600 mt-0.5">
              {new Date(proofOfDelivery.deliveredAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {proofOfDelivery.photoUrls && proofOfDelivery.photoUrls.length > 0 && (
            <div className="flex gap-2 mt-2">
              {proofOfDelivery.photoUrls.slice(0, 3).map((url, i) => (
                <img key={i} src={url} alt={`Evidencia ${i + 1}`} className="w-12 h-12 rounded object-cover border" />
              ))}
            </div>
          )}
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
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
