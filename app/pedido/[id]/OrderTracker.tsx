'use client'

import { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import { Loader2, RefreshCw, MapPin, Phone, Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeliveryInfo } from '@/components/site/DeliveryInfo'
import { EstimatedTime } from '@/components/site/EstimatedTime'
import { DeliveryMap } from '@/components/site/DeliveryMap'
import { esDomicilio, esEstadoFinal, estiloEstado, etiquetaPago, etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { fechaHoraPedido, horaPedido, momentoPedido } from '@/lib/restaurant/ventanaPedido'
import { etiquetaMesa } from '@/lib/orders/nombreMesa'

interface TimelineEvent {
  key: string
  label: string
  description?: string
  timestamp: string | null
  status: 'completed' | 'current' | 'pending'
  icon: string
}

interface TrackingData {
  orgTypeId: number
  /** Zona de la sede: todas las horas se pintan en ella, no en la del navegador. */
  zona: string
  /** El enlace trae el token de seguimiento: hay dirección, conductor y entrega. */
  verificado: boolean
  order: {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string | null
    deliveryType: string
    mesa: string | null
    sede: string | null
    cancellationReason: string | null
    deliveryAddress: any
    isScheduled: boolean
    scheduledAt: string | null
    tipAmount: number | null
    subtotal: number
    taxTotal: number
    deliveryFee: number
    discountTotal: number
    total: number
    estimatedReadyAt: string | null
    estimatedDeliveryAt: string | null
    customerName: string
    customerNotes: string | null
    createdAt: string
    organizationId: number
    branchId: number | null
  }
  shipment: {
    id: string
    shipmentNumber: string
    status: string
    trackingNumber: string | null
    externalTrackingUrl: string | null
    carrier: { name: string; contact_phone: string } | null
    pickedAt: string | null
    dispatchedAt: string | null
    deliveredAt: string | null
    expectedDeliveryDate: string | null
    latitude: number | null
    longitude: number | null
  } | null
  deliveryAttempts: {
    attemptNumber: number
    attemptedAt: string
    status: string
    failureReason: string | null
    driverNotes: string | null
    latitude: number | null
    longitude: number | null
    photoUrls: string[] | null
  }[]
  timeline: TimelineEvent[]
}

interface OrderTrackerProps {
  orderIdentifier: string
  primaryColor: string
  /** Token de seguimiento del enlace (`?t=`): sin él no se muestran datos personales. */
  token?: string | null
  /** Ruta de la carta / catálogo para «Seguir pidiendo». */
  rutaSeguirPidiendo?: string
}

const POLL_INTERVAL = 15000 // 15 segundos

/**
 * El token de seguimiento no se queda en la barra de direcciones: la página carga el píxel de Meta
 * y los scripts del negocio, que leen `location.href` (el PageView manda la URL completa). Al
 * montar, el token del enlace se guarda en sessionStorage de este pedido y `?t=` se quita con
 * history.replaceState ANTES de que corran esos scripts (efecto de layout, antes de los efectos
 * de next/script y de CustomScripts). Recargar la pestaña conserva el acceso; otra pestaña o
 * dispositivo necesita el enlace del correo.
 */
const useEfectoDeLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function claveToken(pedido: string): string {
  return `seguimiento_pedido_${pedido}`
}

function leerTokenGuardado(pedido: string): string | null {
  try {
    const t = window.sessionStorage.getItem(claveToken(pedido))
    return t && /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null
  } catch {
    return null
  }
}

export function OrderTracker({ orderIdentifier, primaryColor, token: tokenDelEnlace, rutaSeguirPidiendo = '/' }: OrderTrackerProps) {
  // En el servidor, el del enlace; en el navegador, además, el guardado de esta pestaña.
  const [token] = useState<string | null>(() =>
    tokenDelEnlace ?? (typeof window !== 'undefined' ? leerTokenGuardado(orderIdentifier) : null),
  )
  useEfectoDeLayout(() => {
    if (tokenDelEnlace) {
      try {
        window.sessionStorage.setItem(claveToken(orderIdentifier), tokenDelEnlace)
      } catch {
        /* almacenamiento bloqueado: el acceso dura lo que dure la página */
      }
    }
    const url = new URL(window.location.href)
    if (url.searchParams.has('t')) {
      url.searchParams.delete('t')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [tokenDelEnlace, orderIdentifier])
  const consulta = token ? `?t=${encodeURIComponent(token)}` : ''
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/tracking${consulta}`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 404) {
          setError('Pedido no encontrado')
        } else {
          setError('Error al obtener el tracking')
        }
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [orderIdentifier, consulta])

  useEffect(() => {
    fetchTracking()
    // Polling: refrescar cada 15s si el pedido no está finalizado
    const interval = setInterval(() => {
      if (data && esEstadoFinal(data.order.status)) return
      fetchTracking()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchTracking, data?.order?.status])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <span className="text-5xl mb-4">🔍</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{error || 'Pedido no encontrado'}</h2>
        <p className="text-gray-500 text-sm mb-4">Verifica el número de pedido e intenta de nuevo.</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchTracking() }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
        </Button>
      </div>
    )
  }

  const { order, shipment, deliveryAttempts, timeline, orgTypeId, zona } = data
  const isFinal = esEstadoFinal(order.status)
  const isRetail = orgTypeId === 3
  const domicilio = esDomicilio(order.deliveryType)
  const estilo = estiloEstado(order.status)
  const pago = etiquetaPago(order.paymentStatus)

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Pedido #{order.orderNumber}
        </h1>
        <p className="text-gray-500 text-sm">
          {fechaHoraPedido(order.createdAt, zona)}
          {order.sede && <> · {order.sede}</>}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
        >
          {etiquetaTipoEntrega(order.deliveryType, orgTypeId === 1)}
          {order.mesa && <span>· {etiquetaMesa(order.mesa)}</span>}
          {order.isScheduled && order.scheduledAt && (
            <span className="text-gray-500">
              · {momentoPedido(order.scheduledAt, zona)}
            </span>
          )}
        </div>
      </div>

      {/* Estado actual destacado */}
      <div className="bg-white rounded-2xl border p-6 mb-6 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">
          {estilo.icono}
        </div>
        <h2 className="text-xl font-bold" style={{ color: primaryColor }}>
          {estilo.etiqueta}
        </h2>
        {order.cancellationReason && (
          <p className="text-gray-500 text-sm mt-1">{order.cancellationReason}</p>
        )}
        {order.paymentStatus && (
          <p className="text-xs mt-1" style={{ color: pago.color }}>{pago.etiqueta}</p>
        )}
        {order.estimatedReadyAt && !isFinal && (
          <p className="text-gray-500 text-sm mt-1 flex items-center justify-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Listo aprox. {horaPedido(order.estimatedReadyAt, zona)}
          </p>
        )}
        {!isFinal && (
          <p className="text-xs text-gray-400 mt-2">Se actualiza automáticamente</p>
        )}
      </div>

      {/* Barra de tiempo estimado (solo restaurante en preparación) */}
      {!isRetail && ['confirmed', 'preparing'].includes(order.status) && order.organizationId && (
        <EstimatedTime
          organizationId={order.organizationId}
          branchId={order.branchId || undefined}
          orderCreatedAt={order.createdAt}
          primaryColor={primaryColor}
        />
      )}

      {/* Timeline */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Seguimiento</h3>
        <div className="space-y-0">
          {timeline.map((event, i) => {
            const isLast = i === timeline.length - 1
            return (
              <div key={event.key} className="flex gap-4">
                {/* Línea y punto */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                      event.status === 'completed' ? 'text-white'
                      : event.status === 'current' ? 'border-2 bg-white'
                      : 'bg-gray-100 text-gray-400'
                    }`}
                    style={
                      event.status === 'completed' ? { backgroundColor: primaryColor }
                      : event.status === 'current' ? { borderColor: primaryColor, color: primaryColor }
                      : {}
                    }
                  >
                    {event.icon}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[24px] ${
                        event.status === 'completed' ? '' : 'bg-gray-200'
                      }`}
                      style={event.status === 'completed' ? { backgroundColor: primaryColor } : {}}
                    />
                  )}
                </div>

                {/* Contenido */}
                <div className={`pb-5 ${event.status === 'pending' ? 'opacity-40' : ''}`}>
                  <p className={`font-medium text-sm ${event.status === 'current' ? '' : 'text-gray-900'}`}
                    style={event.status === 'current' ? { color: primaryColor } : {}}
                  >
                    {event.label}
                  </p>
                  {event.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                  )}
                  {event.timestamp && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {horaPedido(event.timestamp, zona)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Shipment info */}
      {shipment && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Información de envío</h3>
          {shipment.carrier && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">🛵</div>
              <div>
                <p className="font-medium text-sm">{shipment.carrier.name}</p>
                {shipment.carrier.contact_phone && (
                  <a href={`tel:${shipment.carrier.contact_phone}`} className="text-xs flex items-center gap-1" style={{ color: primaryColor }}>
                    <Phone className="h-3 w-3" /> {shipment.carrier.contact_phone}
                  </a>
                )}
              </div>
            </div>
          )}
          {shipment.trackingNumber && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Guía: {shipment.trackingNumber}</span>
              {shipment.externalTrackingUrl && (
                <a href={shipment.externalTrackingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium" style={{ color: primaryColor }}
                >
                  Ver tracking externo <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conductor + Vehículo (domicilio, con el enlace verificado) */}
      {domicilio && data.verificado && !isFinal && (
        <div className="mb-6">
          <DeliveryInfo orderIdentifier={orderIdentifier} primaryColor={primaryColor} token={token} />
        </div>
      )}

      {/* Mapa en vivo (solo cuando está en camino) */}
      {domicilio && data.verificado && order.status === 'in_delivery' && (
        <DeliveryMap
          orderIdentifier={orderIdentifier}
          token={token}
          destinationLat={shipment?.latitude || undefined}
          destinationLng={shipment?.longitude || undefined}
          destinationAddress={
            typeof order.deliveryAddress === 'object'
              ? [order.deliveryAddress?.address, order.deliveryAddress?.city].filter(Boolean).join(', ')
              : undefined
          }
          primaryColor={primaryColor}
        />
      )}

      {/* Delivery attempts */}
      {deliveryAttempts.length > 0 && (
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Intentos de entrega</h3>
          <div className="space-y-3">
            {deliveryAttempts.map(attempt => (
              <div key={attempt.attemptNumber} className="flex gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  attempt.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {attempt.attemptNumber}
                </div>
                <div>
                  <p className="font-medium">
                    {attempt.status === 'delivered' ? 'Entregado' : 'Intento fallido'}
                  </p>
                  {attempt.failureReason && <p className="text-xs text-gray-500">{attempt.failureReason}</p>}
                  {attempt.driverNotes && <p className="text-xs text-gray-400 italic">{attempt.driverNotes}</p>}
                  <p className="text-xs text-gray-400">
                    {fechaHoraPedido(attempt.attemptedAt, zona)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dirección de entrega (solo con el enlace verificado) */}
      {domicilio && order.deliveryAddress && (
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Dirección de entrega
          </h3>
          <p className="text-sm text-gray-600">
            {typeof order.deliveryAddress === 'object'
              ? [order.deliveryAddress.address, order.deliveryAddress.city].filter(Boolean).join(', ')
              : String(order.deliveryAddress)}
          </p>
        </div>
      )}

      {/* Resumen del pedido */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Resumen</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>${Number(order.subtotal || 0).toLocaleString('es-CO')}</span>
          </div>
          {Number(order.taxTotal) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Impuestos</span>
              <span>${Number(order.taxTotal).toLocaleString('es-CO')}</span>
            </div>
          )}
          {Number(order.deliveryFee) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Envío</span>
              <span>${Number(order.deliveryFee).toLocaleString('es-CO')}</span>
            </div>
          )}
          {Number(order.tipAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Propina</span>
              <span>${Number(order.tipAmount).toLocaleString('es-CO')}</span>
            </div>
          )}
          {Number(order.discountTotal) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Descuento</span>
              <span>-${Number(order.discountTotal).toLocaleString('es-CO')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span style={{ color: primaryColor }}>${Number(order.total || 0).toLocaleString('es-CO')}</span>
          </div>
        </div>
      </div>

      {!data.verificado && (
        <p className="text-xs text-gray-500 text-center mt-4">
          Para ver la dirección y los datos del repartidor, abre el enlace de tu correo de confirmación.
        </p>
      )}

      <div className="text-center mt-6">
        <a
          href={rutaSeguirPidiendo}
          className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Seguir pidiendo
        </a>
      </div>

      {/* Botón refrescar manual */}
      {!isFinal && (
        <div className="text-center mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTracking()}
            className="text-gray-500"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualizar
          </Button>
        </div>
      )}
    </div>
  )
}
