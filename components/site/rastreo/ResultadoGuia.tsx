import { Package, CheckCircle, Truck, Clock, MapPin, AlertCircle } from 'lucide-react'

/**
 * Resultado del rastreo por guía de transportadora (lo que mostraba /tracking, que ahora redirige a
 * /rastrear?guia=…). Solo pinta: la búsqueda la hace la página con
 * `getShipmentByTracking(guia, organizationId)` — siempre con la organización del host.
 */

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'delivered': return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'in_transit': return <Truck className="h-5 w-5 text-blue-500" />
    case 'out_for_delivery': return <Truck className="h-5 w-5 text-orange-500" />
    case 'failed': return <AlertCircle className="h-5 w-5 text-red-500" />
    default: return <Clock className="h-5 w-5 text-gray-400" />
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    picked_up: 'Recogido',
    in_transit: 'En tránsito',
    in_warehouse: 'En bodega',
    out_for_delivery: 'En reparto',
    delivered: 'Entregado',
    failed: 'Fallido',
    returned: 'Devuelto',
  }
  return map[status] || status
}

export function ResultadoGuia({ trackingNumber, shipment, primaryColor }: { trackingNumber: string; shipment: any; primaryColor: string }) {
  return (
    <>
      {/* Resultado */}
      {trackingNumber && !shipment && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Package aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h3 className="font-semibold text-lg mb-1">Envío no encontrado</h3>
          <p className="text-gray-500 text-sm">No se encontró un envío con la guía <strong>{trackingNumber}</strong></p>
        </div>
      )}

      {shipment && (
        <div className="space-y-6">
          {/* Header del envío */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-gray-500">Guía</div>
                <div className="font-bold text-lg font-mono">{shipment.tracking_number}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon status={shipment.status} />
                <span className="font-semibold">{statusLabel(shipment.status)}</span>
              </div>
            </div>

            {/* No se muestra "Origen": los datos del remitente no viven en `shipments`.
                Las columnas sender_city/sender_department que se pintaban aquí no existen. */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Destino</div>
                <div className="font-medium">{shipment.delivery_city}{shipment.delivery_department ? `, ${shipment.delivery_department}` : ''}</div>
              </div>
              {shipment.expected_delivery_date && (
                <div>
                  <div className="text-gray-500">Entrega estimada</div>
                  <div className="font-medium">{new Date(shipment.expected_delivery_date).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                </div>
              )}
              {shipment.package_count && (
                <div>
                  <div className="text-gray-500">Paquetes</div>
                  <div className="font-medium">
                    {shipment.package_count}{shipment.weight_kg ? ` (${shipment.weight_kg} kg)` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Entrega: solo la fecha. Quién recibió no se muestra por guía (cualquiera puede
                escribir una guía); está en el enlace seguro que llega al correo del cliente. */}
            {shipment.proof_of_delivery && (
              <div className="mt-4 bg-green-50 rounded-lg p-3 text-sm">
                <div className="font-medium text-green-700">Entregado</div>
                {shipment.proof_of_delivery.delivered_at && (
                  <div className="text-green-600 text-xs">
                    {new Date(shipment.proof_of_delivery.delivered_at).toLocaleString('es-CO')}
                  </div>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-500">
              ¿Es tu pedido? Abre el enlace del correo de confirmación para ver la dirección, el domiciliario y quién lo recibió.
            </p>
          </div>

          {/* Timeline */}
          {shipment.events && shipment.events.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-lg mb-4">Historial de eventos</h3>
              <div className="space-y-0">
                {shipment.events.map((event: any, idx: number) => {
                  const isFirst = idx === 0
                  const isLast = idx === shipment.events.length - 1
                  return (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full border-2 shrink-0 ${isFirst ? '' : 'bg-white'}`}
                          style={{
                            borderColor: isFirst ? primaryColor : '#d1d5db',
                            backgroundColor: isFirst ? primaryColor : undefined,
                          }}
                        />
                        {!isLast && <div className="w-0.5 flex-1 min-h-[24px] bg-gray-200" />}
                      </div>
                      <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                        <div className={`text-sm font-medium ${isFirst ? 'text-gray-900' : 'text-gray-600'}`}>
                          {event.description || event.event_type}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(event.event_time).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                          {event.location_text ? ` — ${event.location_text}` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </>
  )
}
