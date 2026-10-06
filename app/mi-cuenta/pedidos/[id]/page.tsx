import { getOrgContext } from '@/lib/get-org-context'
import { isValidUUID } from '@/lib/utils'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerOrderDetail } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ReorderButton } from '@/components/site/ReorderButton'
import { DeliveryInfo } from '@/components/site/DeliveryInfo'
import { ESTADOS_SIN_ENTREGA, esDomicilio, esEstadoFinal, estiloEstado, etiquetaEntregaFinal, etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { fechaHoraPedido, momentoPedido } from '@/lib/restaurant/ventanaPedido'
import { rutaSeguimiento, tokenSeguimiento } from '@/lib/orders/tokenSeguimiento'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Detalle de Pedido' }
  return {
    title: `Detalle de Pedido | ${ctx.organization.name}`,
  }
}

/**
 * Mini línea de tiempo con los estados reales (lib/orders/estados-pedido.ts): «En camino» solo en
 * domicilio (`delivery_own`/`delivery_third_party`, nunca 'delivery') y un paso terminal para
 * cancelado, rechazado, reembolsado o expirado.
 */
function buildSimpleTimeline(order: any, esRestaurante: boolean) {
  const orden = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered']
  const paso = orden.indexOf(order.status)
  const alcanzo = (e: string) => paso >= orden.indexOf(e)
  const steps = [
    { key: 'received', label: 'Recibido', ts: order.created_at, icon: '📋' },
    { key: 'confirmed', label: 'Confirmado', ts: order.confirmed_at || (alcanzo('confirmed') ? order.created_at : null), icon: '✅' },
    { key: 'preparing', label: 'Preparando', ts: alcanzo('preparing') ? (order.confirmed_at || order.created_at) : null, icon: '👨‍🍳' },
    { key: 'ready', label: 'Listo', ts: order.ready_at || (alcanzo('ready') ? order.updated_at : null), icon: '🔔' },
  ]
  if (esDomicilio(order.delivery_type)) {
    steps.push({ key: 'in_delivery', label: 'En camino', ts: order.shipment?.dispatched_at || (alcanzo('in_delivery') ? order.updated_at : null), icon: '🛵' })
  }
  steps.push({ key: 'delivered', label: etiquetaEntregaFinal(order.delivery_type, esRestaurante, order.internal_notes), ts: order.delivered_at || (alcanzo('delivered') ? order.updated_at : null), icon: '🎉' })
  if (ESTADOS_SIN_ENTREGA.has(order.status)) {
    const estilo = estiloEstado(order.status)
    steps.push({ key: order.status, label: estilo.etiqueta, ts: order.cancelled_at || order.updated_at, icon: estilo.icono })
  }

  let reachedCurrent = false
  return steps.map(s => {
    if (s.ts && !reachedCurrent) return { ...s, status: 'completed' as const }
    if (!reachedCurrent && !s.ts) { reachedCurrent = true; return { ...s, status: 'current' as const } }
    return { ...s, status: 'pending' as const }
  })
}

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  if (!isValidUUID(id)) return <NotFoundPage />
  const { organization, primaryColor, branchId } = ctx
  const customer = await getAuthCustomer(organization.id)

  if (!customer) {
    return <NotFoundPage />
  }

  const order = await getCustomerOrderDetail(id, customer.id)

  if (!order) {
    return (
      <div className="space-y-6">
        <Link href="/mi-cuenta/pedidos" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a pedidos
        </Link>
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📦</p>
          <h3 className="font-semibold text-lg mb-1">Pedido no encontrado</h3>
        </div>
      </div>
    )
  }

  const estilo = estiloEstado(order.status)
  const st = { label: estilo.etiqueta, color: estilo.color, icon: estilo.icono }
  const esRestaurante = organization.type_id === 1
  const zona = (organization as any).timezone as string | null
  const timeline = buildSimpleTimeline(order, esRestaurante)
  const isFinal = esEstadoFinal(order.status)
  // Cliente con sesión y dueño del pedido (getCustomerOrderDetail filtra por su customer_id): el
  // enlace lleva el token de seguimiento.
  const token = tokenSeguimiento(organization.id, order.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/mi-cuenta/pedidos" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a pedidos
          </Link>
          <h1 className="text-2xl font-bold">Pedido {order.order_number}</h1>
          <p className="text-gray-500 text-sm">
            {fechaHoraPedido(order.created_at, zona)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFinal && order.items && order.items.length > 0 && (
            <ReorderButton
              items={(order.items || []).map((item: any) => ({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                modifiers: item.modifiers,
                notes: item.notes,
              }))}
              primaryColor={primaryColor}
              size="sm"
              branchId={branchId}
            />
          )}
          {!isFinal && (
            <a
              href={rutaSeguimiento(organization.id, order)}
              className="text-sm font-medium px-4 py-2 rounded-lg"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              Ver tracking en vivo →
            </a>
          )}
        </div>
      </div>

      {/* Estado + Tipo de pedido */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: `${st.color}15` }}>
            {st.icon}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg">
              <span style={{ color: st.color }}>{st.label}</span>
            </p>
            {order.delivery_type && (
              <p className="text-gray-500 text-sm">{etiquetaTipoEntrega(order.delivery_type, esRestaurante, order.internal_notes)}</p>
            )}
          </div>
          {order.is_scheduled && order.scheduled_at && (
            <div className="text-right text-sm">
              <p className="text-gray-400">Programado</p>
              <p className="font-medium" style={{ color: primaryColor }}>
                {momentoPedido(order.scheduled_at, zona)}
              </p>
            </div>
          )}
        </div>

        {/* Timeline mini */}
        <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
          {timeline.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center min-w-[56px]">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    step.status === 'completed' ? 'text-white'
                    : step.status === 'current' ? 'border-2 bg-white'
                    : 'bg-gray-100 text-gray-400'
                  }`}
                  style={
                    step.status === 'completed' ? { backgroundColor: primaryColor }
                    : step.status === 'current' ? { borderColor: primaryColor, color: primaryColor }
                    : {}
                  }
                >
                  {step.icon}
                </div>
                <span className={`text-[10px] mt-1 text-center leading-tight ${step.status === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
              {i < timeline.length - 1 && (
                <div
                  className={`h-0.5 w-8 mx-1 ${step.status === 'completed' ? '' : 'bg-gray-200'}`}
                  style={step.status === 'completed' ? { backgroundColor: primaryColor } : {}}
                />
              )}
            </div>
          ))}
        </div>

        {/* Items */}
        <h3 className="font-semibold mb-3">Productos</h3>
        <div className="space-y-3 mb-6">
          {(order.items || []).map((item: any) => (
            <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.product_name}</p>
                {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                  <p className="text-xs text-gray-400">
                    {item.modifiers.map((m: any) => m.valueName || m.value || m).join(', ')}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {Number(item.quantity)} × ${Number(item.unit_price || 0).toLocaleString('es-CO')}
                  {item.notes && <span className="italic"> · 📝 {item.notes}</span>}
                </p>
              </div>
              <p className="font-semibold text-sm ml-2">${Number(item.total || 0).toLocaleString('es-CO')}</p>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>${Number(order.subtotal || 0).toLocaleString('es-CO')}</span>
          </div>
          {Number(order.tax_total || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Impuestos</span>
              <span>${Number(order.tax_total).toLocaleString('es-CO')}</span>
            </div>
          )}
          {Number(order.delivery_fee || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío</span>
              <span>${Number(order.delivery_fee).toLocaleString('es-CO')}</span>
            </div>
          )}
          {Number(order.tip_amount || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Propina</span>
              <span>${Number(order.tip_amount).toLocaleString('es-CO')}</span>
            </div>
          )}
          {Number(order.discount_total || 0) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento</span>
              <span>-${Number(order.discount_total).toLocaleString('es-CO')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span style={{ color: primaryColor }}>${Number(order.total || 0).toLocaleString('es-CO')}</span>
          </div>
        </div>
      </div>

      {/* Shipment info */}
      {order.shipment && (
        <div className="bg-white rounded-xl border p-6 space-y-3">
          <h3 className="font-semibold">Información de envío</h3>
          {order.shipment.transport_carriers && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">🛵</div>
              <div>
                <p className="font-medium text-sm">{order.shipment.transport_carriers.name}</p>
                {order.shipment.transport_carriers.contact_phone && (
                  <a href={`tel:${order.shipment.transport_carriers.contact_phone}`} className="text-xs" style={{ color: primaryColor }}>
                    📞 {order.shipment.transport_carriers.contact_phone}
                  </a>
                )}
              </div>
            </div>
          )}
          {order.shipment.tracking_number && (
            <p className="text-sm text-gray-500">Guía: <span className="font-medium">{order.shipment.tracking_number}</span></p>
          )}
          {order.shipment.external_tracking_url && (
            <a href={order.shipment.external_tracking_url} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium" style={{ color: primaryColor }}
            >
              Ver tracking externo →
            </a>
          )}
        </div>
      )}

      {/* Conductor + Vehículo + POD */}
      {esDomicilio(order.delivery_type) && (
        <DeliveryInfo orderIdentifier={order.order_number} primaryColor={primaryColor} token={token} />
      )}

      {/* Delivery attempts */}
      {order.deliveryAttempts && order.deliveryAttempts.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-3">Intentos de entrega</h3>
          <div className="space-y-3">
            {order.deliveryAttempts.map((a: any) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  a.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {a.attempt_number}
                </div>
                <div>
                  <p className="font-medium">{a.status === 'delivered' ? 'Entregado' : 'Fallido'}</p>
                  {a.failure_reason_text && <p className="text-xs text-gray-500">{a.failure_reason_text}</p>}
                  <p className="text-xs text-gray-400">
                    {fechaHoraPedido(a.attempted_at, zona)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info adicional */}
      {(order.customer_notes || order.delivery_address) && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          {order.customer_notes && (
            <div>
              <h3 className="font-semibold text-sm mb-1">Notas</h3>
              <p className="text-gray-600 text-sm">{order.customer_notes}</p>
            </div>
          )}
          {order.delivery_address && (
            <div>
              <h3 className="font-semibold text-sm mb-1">Dirección de entrega</h3>
              <p className="text-gray-600 text-sm">
                {typeof order.delivery_address === 'object'
                  ? [order.delivery_address.address, order.delivery_address.address_line1, order.delivery_address.city].filter(Boolean).join(', ')
                  : String(order.delivery_address)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
