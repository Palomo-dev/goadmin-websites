'use client'

import { useState } from 'react'
import { Search, Package, Loader2, ShoppingBag, Clock, CheckCircle, XCircle, Truck, CreditCard, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface OrderResult {
  id: string
  order_number: string
  status: string
  delivery_type: string
  subtotal: number
  tax_total: number
  delivery_fee: number
  discount_total: number
  total: number
  customer_name: string
  payment_status: string
  payment_method: string
  created_at: string
  items: { product_name: string; quantity: number; unit_price: number; total: number }[]
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  preparing: { label: 'En preparación', color: 'bg-purple-100 text-purple-700', icon: Package },
  ready: { label: 'Listo', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  shipped: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-600' },
  paid: { label: 'Pagado', color: 'text-green-600' },
  failed: { label: 'Fallido', color: 'text-red-600' },
  refunded: { label: 'Reembolsado', color: 'text-gray-600' },
}

export function OrderLookupClient({ primaryColor }: { primaryColor: string }) {
  const [searchType, setSearchType] = useState<'order_number' | 'email'>('order_number')
  const [query, setQuery] = useState('')
  const [orders, setOrders] = useState<OrderResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || query.trim().length < 3) {
      setError('Ingresa al menos 3 caracteres')
      return
    }

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const res = await fetch(`/api/orders/lookup?q=${encodeURIComponent(query.trim())}&type=${searchType}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al buscar')
        setOrders([])
        return
      }

      setOrders(data.orders || [])
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
          <ShoppingBag className="h-8 w-8" style={{ color: primaryColor }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Consultar Pedido</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
          Ingresa tu número de pedido o correo electrónico para ver el estado de tu compra
        </p>
      </div>

      {/* Tabs de tipo de búsqueda */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
        <button
          onClick={() => { setSearchType('order_number'); setQuery(''); setOrders([]); setSearched(false) }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            searchType === 'order_number'
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <Package className="h-4 w-4 inline mr-1.5" />
          N° de pedido
        </button>
        <button
          onClick={() => { setSearchType('email'); setQuery(''); setOrders([]); setSearched(false) }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            searchType === 'email'
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <CreditCard className="h-4 w-4 inline mr-1.5" />
          Correo electrónico
        </button>
      </div>

      {/* Formulario de búsqueda */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-4 py-3">
          <Search className="h-5 w-5 text-gray-400 shrink-0" />
          <input
            type={searchType === 'email' ? 'email' : 'text'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchType === 'order_number' ? 'Ej: ORD-001' : 'Ej: tu@email.com'}
            className="w-full outline-none text-sm bg-transparent dark:text-white"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="px-6 shrink-0 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
        </Button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Resultados */}
      {searched && !loading && orders.length === 0 && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-8 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">No se encontraron pedidos</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {searchType === 'order_number'
              ? 'Verifica el número de pedido e intenta de nuevo'
              : 'No hay pedidos asociados a ese correo electrónico'}
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {orders.length} pedido{orders.length > 1 ? 's' : ''} encontrado{orders.length > 1 ? 's' : ''}
          </p>

          {orders.map((order) => {
            const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700', icon: Clock }
            const StatusIcon = statusInfo.icon
            const paymentInfo = PAYMENT_STATUS_MAP[order.payment_status] || { label: order.payment_status, color: 'text-gray-500' }
            const isExpanded = expandedOrder === order.id

            return (
              <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
                {/* Header del pedido */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">
                        Pedido #{order.order_number}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('es-CO', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                      {order.customer_name && (
                        <p className="text-xs text-gray-500 mt-0.5">{order.customer_name}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusInfo.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Info rápida */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        ${Number(order.total).toLocaleString('es-CO')}
                      </span>
                      <span className={`text-xs font-medium ${paymentInfo.color}`}>
                        {paymentInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="text-xs font-medium flex items-center gap-1 hover:underline"
                        style={{ color: primaryColor }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {isExpanded ? 'Ocultar' : 'Ver detalle'}
                      </button>
                      <Link
                        href={`/pedido/${order.order_number}`}
                        className="text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Rastrear
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Detalle expandible */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700 p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/50">
                    {/* Productos */}
                    {order.items.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Productos</h4>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300">
                                {item.quantity}x {item.product_name}
                              </span>
                              <span className="text-gray-900 dark:text-white font-medium">
                                ${Number(item.total).toLocaleString('es-CO')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resumen */}
                    <div className="space-y-1.5 text-sm border-t dark:border-gray-700 pt-3">
                      <div className="flex justify-between text-gray-500 dark:text-gray-400">
                        <span>Subtotal</span>
                        <span>${Number(order.subtotal).toLocaleString('es-CO')}</span>
                      </div>
                      {Number(order.tax_total) > 0 && (
                        <div className="flex justify-between text-gray-500 dark:text-gray-400">
                          <span>Impuestos</span>
                          <span>${Number(order.tax_total).toLocaleString('es-CO')}</span>
                        </div>
                      )}
                      {Number(order.delivery_fee) > 0 && (
                        <div className="flex justify-between text-gray-500 dark:text-gray-400">
                          <span>Envío</span>
                          <span>${Number(order.delivery_fee).toLocaleString('es-CO')}</span>
                        </div>
                      )}
                      {Number(order.discount_total) > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Descuento</span>
                          <span>-${Number(order.discount_total).toLocaleString('es-CO')}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1.5 border-t dark:border-gray-700">
                        <span>Total</span>
                        <span style={{ color: primaryColor }}>${Number(order.total).toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ayuda */}
      {!searched && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 text-center">
          <p className="text-4xl mb-3">📦</p>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">¿Dónde encuentro mi número de pedido?</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Lo puedes encontrar en el correo de confirmación que te enviamos al realizar tu compra.
            También puedes buscar por el correo electrónico que usaste al comprar.
          </p>
        </div>
      )}
    </div>
  )
}
