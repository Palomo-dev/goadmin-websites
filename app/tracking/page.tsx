import { getOrgContext } from '@/lib/get-org-context'
import { getShipmentByTracking } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import { Package, CheckCircle, Truck, Clock, MapPin, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Rastrear Envío' }
  return { title: `Rastrear Envío | ${ctx.organization.name}` }
}

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

export default async function TrackingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav } = ctx
  const params = await searchParams
  const trackingNumber = params.q || ''

  const shipment = trackingNumber ? await getShipmentByTracking(trackingNumber) : null

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-2">Rastrear Envío</h1>
        <p className="text-gray-500 text-center mb-8">Ingresa tu número de guía para ver el estado de tu envío</p>

        {/* Formulario de búsqueda */}
        <form method="GET" className="flex gap-2 mb-8">
          <div className="flex-1 flex items-center gap-2 bg-white border rounded-lg px-4 py-3">
            <Package className="h-5 w-5 text-gray-400 shrink-0" />
            <input
              type="text"
              name="q"
              defaultValue={trackingNumber}
              placeholder="Número de guía (ej: TRK-ABC123)"
              className="w-full outline-none text-sm"
              required
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-lg text-white font-medium text-sm shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            Rastrear
          </button>
        </form>

        {/* Resultado */}
        {trackingNumber && !shipment && (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-4xl mb-3">📦</p>
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

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Origen</div>
                  <div className="font-medium">{shipment.sender_city}{shipment.sender_department ? `, ${shipment.sender_department}` : ''}</div>
                </div>
                <div>
                  <div className="text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Destino</div>
                  <div className="font-medium">{shipment.receiver_city}{shipment.receiver_department ? `, ${shipment.receiver_department}` : ''}</div>
                </div>
                {shipment.expected_delivery_date && (
                  <div>
                    <div className="text-gray-500">Entrega estimada</div>
                    <div className="font-medium">{new Date(shipment.expected_delivery_date).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  </div>
                )}
                {shipment.total_packages && (
                  <div>
                    <div className="text-gray-500">Paquetes</div>
                    <div className="font-medium">{shipment.total_packages} ({shipment.total_weight_kg} kg)</div>
                  </div>
                )}
              </div>

              {/* Proof of delivery */}
              {shipment.proof_of_delivery && (
                <div className="mt-4 bg-green-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-green-700 mb-1">Entregado a: {shipment.proof_of_delivery.receiver_name}</div>
                  {shipment.proof_of_delivery.relationship && (
                    <div className="text-green-600 text-xs">Parentesco: {shipment.proof_of_delivery.relationship}</div>
                  )}
                  {shipment.proof_of_delivery.confirmed_at && (
                    <div className="text-green-600 text-xs">
                      {new Date(shipment.proof_of_delivery.confirmed_at).toLocaleString('es-CO')}
                    </div>
                  )}
                </div>
              )}
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

        {!trackingNumber && (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-4xl mb-3">📦</p>
            <h3 className="font-semibold text-lg mb-1">Ingresa tu número de guía</h3>
            <p className="text-gray-500 text-sm">Escribe el número de tracking que recibiste al hacer tu envío</p>
          </div>
        )}
      </div>
    </OrganizationLayout>
  )
}
