import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerInvoices } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Facturas' }
  return { title: `Mis Facturas | ${ctx.organization.name}` }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  partial: { label: 'Pago parcial', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  overdue: { label: 'Vencida', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  paid: { label: 'Pagada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
  void: { label: 'Anulada', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

export default async function FacturasPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const invoices = customer ? await getCustomerInvoices(customer.id, organization.id) : []

  const pending = invoices.filter((inv: any) => ['sent', 'partial', 'overdue'].includes(inv.status))
  const others = invoices.filter((inv: any) => !['sent', 'partial', 'overdue'].includes(inv.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Facturas</h1>
        <p className="text-gray-500 dark:text-gray-400">Consulta y paga tus facturas pendientes</p>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-8 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500 dark:text-gray-400">No tienes facturas registradas</p>
        </div>
      ) : (
        <>
          {/* Pendientes */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Pendientes de pago ({pending.length})</h2>
              <div className="space-y-3">
                {pending.map((inv: any) => {
                  const st = statusLabels[inv.status] || statusLabels.sent
                  const balance = Number(inv.balance || 0)
                  return (
                    <Link key={inv.id} href={`/mi-cuenta/facturas/${inv.id}`} className="block bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                            <span className="text-sm font-mono text-gray-500 dark:text-gray-400">#{inv.number || '—'}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Emitida: {formatDate(inv.issue_date)} · Vence: {formatDate(inv.due_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold" style={{ color: primaryColor }}>{formatCurrency(balance, inv.currency)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total: {formatCurrency(Number(inv.total || 0), inv.currency)}</p>
                        </div>
                        <div className="text-sm font-medium flex items-center gap-1" style={{ color: primaryColor }}>
                          Pagar →
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Otras facturas */}
          {others.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Historial</h2>
              <div className="space-y-2">
                {others.map((inv: any) => {
                  const st = statusLabels[inv.status] || { label: inv.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <Link key={inv.id} href={`/mi-cuenta/facturas/${inv.id}`} className="block bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 hover:shadow-sm transition-shadow opacity-75">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        <span className="text-sm font-mono text-gray-500 dark:text-gray-400">#{inv.number || '—'}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(inv.issue_date)}</span>
                        <span className="ml-auto text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(inv.total || 0), inv.currency)}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
