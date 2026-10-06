import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerOrders } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { estiloEstado, etiquetaPago, etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { fechaHoraPedido } from '@/lib/restaurant/ventanaPedido'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Pedidos' }
  return {
    title: `Mis Pedidos | ${ctx.organization.name}`,
    description: `Historial de pedidos en ${ctx.organization.name}`
  }
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
            href={organization.type_id === 1 ? '/menu' : '/productos'}
            className="inline-block px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Explorar productos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => {
            const estilo = estiloEstado(order.status)
            const st = { label: estilo.etiqueta, color: estilo.color }
            const pagoEtiqueta = etiquetaPago(order.payment_status)
            const pay = { label: pagoEtiqueta.etiqueta, color: pagoEtiqueta.color }
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
                      {fechaHoraPedido(order.created_at, (organization as any).timezone)}
                      {order.delivery_type && ` · ${etiquetaTipoEntrega(order.delivery_type, organization.type_id === 1)}`}
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
