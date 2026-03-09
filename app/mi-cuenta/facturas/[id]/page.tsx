import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerInvoiceDetail } from '@/lib/queries/customer-portal'
import { createPublicClient } from '@/lib/supabase/server'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { InvoicePayButton } from './InvoicePayButton'

export const dynamic = 'force-dynamic'

async function getAvailableGateways(organizationId: number) {
  const supabase = createPublicClient()
  const { data } = await (supabase as any)
    .from('integration_connections')
    .select(`id, environment, status, connector_id, integration_connectors!inner (code, name)`)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('integration_connectors.code', ['wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout'])

  if (!data) return []
  return data.map((conn: any) => ({
    code: conn.integration_connectors.code,
    name: conn.integration_connectors.name,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Factura' }
  return { title: `Factura | ${ctx.organization.name}` }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

export default async function FacturaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const { id } = await params
  const customer = await getAuthCustomer(organization.id)

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Inicia sesión para ver tus facturas</p>
        <Link href="/auth/login" className="text-sm font-medium mt-2 inline-block" style={{ color: primaryColor }}>
          Iniciar sesión →
        </Link>
      </div>
    )
  }

  const invoice = await getCustomerInvoiceDetail(id, customer.id)
  if (!invoice) return <NotFoundPage />

  const balance = Number(invoice.balance || 0)
  const total = Number(invoice.total || 0)
  const isPendingPayment = balance > 0 && !['paid', 'cancelled', 'void'].includes(invoice.status)

  const gateways = isPendingPayment ? await getAvailableGateways(organization.id) : []

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-800' },
    partial: { label: 'Pago parcial', color: 'bg-yellow-100 text-yellow-800' },
    overdue: { label: 'Vencida', color: 'bg-red-100 text-red-700' },
    paid: { label: 'Pagada', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500' },
    void: { label: 'Anulada', color: 'bg-gray-100 text-gray-500' },
  }
  const st = statusMap[invoice.status] || { label: invoice.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <Link href="/mi-cuenta/facturas" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Volver a facturas
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Factura #{invoice.number || '—'}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Emitida: {formatDate(invoice.issue_date)} · Vence: {formatDate(invoice.due_date)}
            </p>
          </div>
          {isPendingPayment && (
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo pendiente</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>{formatCurrency(balance, invoice.currency)}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Concepto</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Cant.</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Precio</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item: any, idx: number) => (
                <tr key={item.id || idx} className="border-b dark:border-gray-700 last:border-0">
                  <td className="py-3 px-2 text-gray-900 dark:text-white">
                    {item.description || item.name || 'Item'}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">{item.quantity || 1}</td>
                  <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">
                    {formatCurrency(Number(item.unit_price || item.price || 0), invoice.currency)}
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(Number(item.total || item.amount || 0), invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="border-t dark:border-gray-700 mt-4 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
            <span className="text-gray-900 dark:text-white">{formatCurrency(Number(invoice.subtotal || 0), invoice.currency)}</span>
          </div>
          {Number(invoice.tax_total || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Impuestos</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(Number(invoice.tax_total), invoice.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span className="text-gray-900 dark:text-white">Total</span>
            <span className="text-gray-900 dark:text-white">{formatCurrency(total, invoice.currency)}</span>
          </div>
          {balance > 0 && balance < total && (
            <div className="flex justify-between text-base font-bold">
              <span style={{ color: primaryColor }}>Saldo pendiente</span>
              <span style={{ color: primaryColor }}>{formatCurrency(balance, invoice.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Botón pagar */}
      {isPendingPayment && gateways.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pagar factura</h2>
          <InvoicePayButton
            invoiceId={invoice.id}
            gateways={gateways}
            primaryColor={primaryColor}
          />
        </div>
      )}
    </div>
  )
}
