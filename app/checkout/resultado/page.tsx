import { getOrgContext } from '@/lib/get-org-context'
import { rutaSitio } from '@/lib/outlet/rutaSitio'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { getGoogleAdsConfig, getMetaPixelId } from '@/lib/supabase/queries'
import GoogleAdsConversion from '@/components/site/GoogleAdsConversion'
import { MetaPixelPurchase } from '@/components/site/MetaPixelEvents'
import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'
import { enviarCorreoPedidoPagado } from '@/lib/orders/correoPedidoPagado'
import { etiquetaPago } from '@/lib/orders/estados-pedido'

/** «j***@dominio.com»: la página se abre con solo el número de pedido. */
function correoEnmascarado(correo: string): string {
  const [usuario, dominio] = correo.split('@')
  if (!dominio) return '***'
  return `${usuario.slice(0, 1)}***@${dominio}`
}

export const dynamic = 'force-dynamic'

async function getOrderByRef(organizationId: number, orderNumber: string, transactionId?: string) {
  const supabase = createAdminClient() || createPublicClient()

  // Solo pedidos de la organización del host: con el número de otro sitio, «no encontrado».
  const { data, error } = await (supabase as any)
    .from('web_orders')
    .select('id, order_number, total, payment_status, status, payment_method, customer_email, customer_name, organization_id, created_at')
    .eq('organization_id', organizationId)
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (error || !data) return null

  // Fallback: si la orden sigue pendiente y fue pagada con Wompi, verificar directamente con la API
  if (data.payment_status === 'pending' && ['wompi', 'wompi_co', 'card'].includes(data.payment_method)) {
    try {
      const updated = await checkWompiTransactionStatus(supabase, data, transactionId)
      if (updated) return updated
    } catch (err) {
      console.error('[Resultado] Error checking Wompi status:', err)
    }
  }

  return data
}

/**
 * Verifica el estado de la transacción en Wompi API por referencia y actualiza la orden si fue pagada
 */
async function checkWompiTransactionStatus(supabase: any, order: any, transactionId?: string) {
  // Obtener conexión de Wompi para esta org
  const { data: conn } = await supabase
    .from('integration_connections')
    .select('id, environment')
    .eq('organization_id', order.organization_id)
    .eq('connector_id', '39950173-5f7c-48a9-a242-c6fdf5a07aee')
    .in('status', ['active', 'connected'])
    .limit(1)
    .single()

  if (!conn) return null

  const baseApi = conn.environment === 'sandbox'
    ? 'https://sandbox.wompi.co/v1'
    : 'https://production.wompi.co/v1'

  let tx: any = null

  // Opción 1: Usar el transactionId directo (más confiable, endpoint público)
  if (transactionId) {
    const res = await fetch(`${baseApi}/transactions/${transactionId}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const json = await res.json()
      tx = json.data
    }
  }

  // Opción 2: Buscar por referencia (fallback)
  if (!tx) {
    const res = await fetch(`${baseApi}/transactions?reference=${order.order_number}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const json = await res.json()
      tx = json.data?.[0]
    }
  }

  if (!tx) return null

  const statusMap: Record<string, string> = {
    APPROVED: 'paid', DECLINED: 'failed', VOIDED: 'refunded', ERROR: 'failed', PENDING: 'pending',
  }
  const newStatus = statusMap[tx.status] || 'pending'

  if (newStatus === 'pending') return null // Sin cambio

  // Actualizar la orden, solo si sigue pendiente: si el webhook ya la pasó a pagada, no se repite
  // nada (ni el aviso al ERP ni el correo).
  const { data: actualizadas } = await supabase.from('web_orders').update({
    payment_status: newStatus,
    payment_reference: String(tx.id),
    updated_at: new Date().toISOString(),
    ...(newStatus === 'paid' && { status: 'confirmed', confirmed_at: new Date().toISOString() }),
    ...(newStatus === 'failed' && { status: 'cancelled', cancelled_at: new Date().toISOString() }),
  }).eq('id', order.id).eq('payment_status', 'pending').select('id')

  // Notificar al ERP para crear venta, factura, cuenta por cobrar, stock y envío, y mandar al
  // cliente «Pago confirmado» (el mismo correo que envía el webhook en la transición pending → paid).
  if (newStatus === 'paid' && Array.isArray(actualizadas) && actualizadas.length > 0) {
    notifyErpAutoConfirm(order.id).catch(err =>
      console.error('[Resultado] ERP auto-confirm error:', err)
    )
    enviarCorreoPedidoPagado(order.id).catch(err =>
      console.error('[Resultado] Correo de pago confirmado:', err)
    )
  } else {
    // Ya no estaba pendiente (lo actualizó el webhook) o no quedó pagada: sin avisos repetidos.
  }

  return { ...order, payment_status: newStatus, status: newStatus === 'paid' ? 'confirmed' : order.status }
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Resultado del pago' }
  return {
    title: `Resultado del pago | ${ctx.organization.name}`,
  }
}

const STATUS_CONFIG: Record<string, {
  icon: React.ReactNode
  title: string
  description: string
  color: string
  bgColor: string
}> = {
  paid: {
    icon: <CheckCircle2 className="h-12 w-12" />,
    title: '¡Pago exitoso!',
    description: 'Tu pago ha sido confirmado. Recibirás un correo con los detalles de tu pedido.',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  pending: {
    icon: <Clock className="h-12 w-12" />,
    title: 'Pago pendiente',
    description: 'Tu pago está siendo procesado. Te notificaremos cuando sea confirmado.',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  failed: {
    icon: <XCircle className="h-12 w-12" />,
    title: 'Pago no completado',
    description: 'No pudimos procesar tu pago. Puedes intentarlo de nuevo o elegir otro método de pago.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  refunded: {
    icon: <AlertTriangle className="h-12 w-12" />,
    title: 'Pago reembolsado',
    description: 'El pago de esta orden ha sido reembolsado.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
}

export default async function CheckoutResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; id?: string; status?: string; env?: string }>
}) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx
  const [googleAdsConfig, metaPixelId] = await Promise.all([
    getGoogleAdsConfig(organization.id),
    getMetaPixelId(organization.id)
  ])
  const params = await searchParams
  const orderRef = params.ref
  const transactionId = params.id

  if (!orderRef) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
        <div className="container mx-auto px-4 py-20 text-center">
          <AlertTriangle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sin referencia de orden</h1>
          <p className="text-gray-500 mb-8">No se proporcionó una referencia de pedido válida.</p>
          <Link
            href={rutaSitio('/', ctx.outlet, ctx.sedePorPrefijo)}
            className="inline-block px-6 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            Volver al inicio
          </Link>
        </div>
      </OrganizationLayout>
    )
  }

  const order = await getOrderByRef(organization.id, orderRef, transactionId)

  // Líneas del pedido para `contents`/`content_ids` del Purchase (SKU =
  // retailer_id del catálogo de Meta; si no hay SKU, el id del producto).
  const purchaseContents: { id: string; quantity: number }[] = []
  if (order && order.organization_id === organization.id) {
    const supabaseItems = createAdminClient() || createPublicClient()
    const { data: orderItems } = await (supabaseItems as any)
      .from('web_order_items')
      .select('product_id, product_sku, quantity')
      .eq('web_order_id', order.id)
    for (const it of orderItems || []) {
      purchaseContents.push({ id: it.product_sku || String(it.product_id), quantity: Number(it.quantity) || 1 })
    }
  }

  if (!order) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
        <div className="container mx-auto px-4 py-20 text-center">
          <AlertTriangle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Orden no encontrada</h1>
          <p className="text-gray-500 mb-8">No pudimos encontrar la orden <strong>{orderRef}</strong>.</p>
          <Link
            href={rutaSitio('/', ctx.outlet, ctx.sedePorPrefijo)}
            className="inline-block px-6 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            Volver al inicio
          </Link>
        </div>
      </OrganizationLayout>
    )
  }

  const paymentStatus = order.payment_status || 'pending'
  const config = STATUS_CONFIG[paymentStatus] || STATUS_CONFIG.pending

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} frozenReason={frozenReason}>
      {/* Google Ads Conversion — solo si pago exitoso */}
      {paymentStatus === 'paid' && googleAdsConfig && (
        <GoogleAdsConversion
          transactionId={order.order_number}
          value={Number(order.total)}
          currency="COP"
        />
      )}
      {/* Meta Pixel Purchase — solo si pago exitoso */}
      {paymentStatus === 'paid' && (
        <MetaPixelPurchase
          orderNumber={order.order_number}
          value={Number(order.total)}
          currency="COP"
          contents={purchaseContents}
          numItems={purchaseContents.reduce((s, c) => s + c.quantity, 0) || undefined}
        />
      )}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto text-center">
          {/* Icono de estado */}
          <div className={`w-24 h-24 rounded-full ${config.bgColor} flex items-center justify-center mx-auto mb-6`}>
            <span className={config.color}>{config.icon}</span>
          </div>

          {/* Título y descripción */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{config.title}</h1>
          <p className="text-gray-600 mb-6">{config.description}</p>

          {/* Detalles de la orden */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 mb-3">Detalles del pedido</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Número de orden</span>
                <span className="font-medium text-gray-900">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-bold" style={{ color: primaryColor }}>
                  ${Number(order.total).toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado del pago</span>
                <span className={`font-medium ${config.color}`}>
                  {etiquetaPago(paymentStatus).etiqueta}
                </span>
              </div>
              {order.customer_email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-gray-900">{correoEnmascarado(order.customer_email)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {paymentStatus === 'failed' && (
              <Link
                href={rutaSitio('/checkout', ctx.outlet, ctx.sedePorPrefijo)}
                className="inline-block px-6 py-3 rounded-lg text-white font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                Intentar de nuevo
              </Link>
            )}
            {paymentStatus !== 'failed' && (
              // Sin token: esta página se abre con solo el número de pedido. El enlace con los
              // datos de entrega llega en el correo.
              <Link
                href={`/pedido/${encodeURIComponent(order.order_number)}`}
                className="inline-block px-6 py-3 rounded-lg text-white font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                Seguir mi pedido
              </Link>
            )}
            <Link
              href={rutaSitio(organization.type_id === 1 ? '/menu' : '/productos', ctx.outlet, ctx.sedePorPrefijo)}
              className="inline-block px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              {organization.type_id === 1 ? 'Seguir pidiendo' : 'Seguir comprando'}
            </Link>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  )
}
