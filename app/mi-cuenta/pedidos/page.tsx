import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerOrders } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Pedidos' }
  return {
    title: `Mis Pedidos | ${ctx.organization.name}`,
    description: `Historial de pedidos en ${ctx.organization.name}`
  }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#F59E0B' },
  confirmed: { label: 'Confirmado', color: '#3B82F6' },
  preparing: { label: 'Preparando', color: '#8B5CF6' },
  ready: { label: 'Listo', color: '#10B981' },
  shipped: { label: 'Enviado', color: '#3B82F6' },
  delivered: { label: 'Entregado', color: '#059669' },
  completed: { label: 'Completado', color: '#059669' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
}

const PAYMENT_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#F59E0B' },
  approved: { label: 'Pagado', color: '#059669' },
  declined: { label: 'Rechazado', color: '#EF4444' },
  voided: { label: 'Anulado', color: '#6B7280' },
}

export default async function PedidosPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const orders = customer ? await getCustomerOrders(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Pedidos</h1>
          <p className="text-gray-500">Historial de compras y pedidos</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📦</p>
          <h3 className="font-semibold text-lg mb-1">No tienes pedidos aún</h3>
          <p className="text-gray-500 mb-4">Cuando realices una compra, aparecerá aquí</p>
          <Link
            href="/productos"
            className="inline-block px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Explorar productos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => {
            const st = STATUS_MAP[order.status] || { label: order.status, color: '#6B7280' }
            const pay = PAYMENT_MAP[order.payment_status] || { label: order.payment_status || '-', color: '#6B7280' }
            return (
              <Link
                key={order.id}
                href={`/mi-cuenta/pedidos/${order.id}`}
                className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-md transition-shadow block"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="font-semibold text-sm">{order.order_number}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {order.delivery_type && ` · ${order.delivery_type === 'delivery' ? 'Domicilio' : 'Recoger'}`}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold text-sm">${Number(order.total || 0).toLocaleString('es-CO')}</p>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                    {st.label}
                  </span>
                  <span className="text-xs" style={{ color: pay.color }}>{pay.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
