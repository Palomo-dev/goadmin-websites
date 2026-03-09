import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerQuotes } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Cotizaciones' }
  return { title: `Mis Cotizaciones | ${ctx.organization.name}` }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  open: { label: 'Abierta', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  won: { label: 'Aceptada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  lost: { label: 'Rechazada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  closed: { label: 'Cerrada', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

export default async function CotizacionesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const quotes = customer ? await getCustomerQuotes(customer.id, organization.id) : []

  const open = quotes.filter((q: any) => q.status === 'open')
  const closed = quotes.filter((q: any) => q.status !== 'open')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Cotizaciones</h1>
          <p className="text-gray-500 dark:text-gray-400">Seguimiento de tus solicitudes de cotización</p>
        </div>
        <Link
          href="/cotizar"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          + Nueva cotización
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-8 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No tienes cotizaciones registradas</p>
          <Link href="/cotizar" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>
            Solicitar una cotización →
          </Link>
        </div>
      ) : (
        <>
          {/* Abiertas */}
          {open.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">En proceso ({open.length})</h2>
              <div className="space-y-3">
                {open.map((q: any) => {
                  const st = statusLabels[q.status] || statusLabels.open
                  return (
                    <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          </div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{q.name || 'Cotización'}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Solicitada: {formatDate(q.created_at)}
                            {q.expected_close_date && ` · Cierre est.: ${formatDate(q.expected_close_date)}`}
                          </p>
                        </div>
                        {q.amount > 0 && (
                          <div className="text-right">
                            <p className="text-lg font-bold" style={{ color: primaryColor }}>
                              {formatCurrency(Number(q.amount), q.currency)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Monto estimado</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Historial */}
          {closed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Historial</h2>
              <div className="space-y-2">
                {closed.map((q: any) => {
                  const st = statusLabels[q.status] || { label: q.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-3 opacity-75">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      <span className="text-sm text-gray-900 dark:text-white truncate flex-1">{q.name || 'Cotización'}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(q.created_at)}</span>
                      {q.amount > 0 && (
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(q.amount), q.currency)}</span>
                      )}
                    </div>
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
