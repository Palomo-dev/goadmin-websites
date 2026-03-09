import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerAppointments } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { CancelAppointmentButton } from './CancelAppointmentButton'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Citas' }
  return { title: `Mis Citas | ${ctx.organization.name}` }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  no_show: { label: 'No asistió', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default async function CitasPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const appointments = customer ? await getCustomerAppointments(customer.id, organization.id) : []

  const now = new Date()
  const upcoming = appointments.filter((a: any) => ['pending', 'confirmed'].includes(a.status) && new Date(a.start_at) > now)
  const past = appointments.filter((a: any) => !(['pending', 'confirmed'].includes(a.status) && new Date(a.start_at) > now))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Citas</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestiona tus citas de servicio</p>
        </div>
        <Link
          href="/agendar"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          + Nueva cita
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-8 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No tienes citas registradas</p>
          <Link href="/agendar" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>
            Agendar tu primera cita →
          </Link>
        </div>
      ) : (
        <>
          {/* Próximas */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Próximas citas ({upcoming.length})</h2>
              <div className="space-y-3">
                {upcoming.map((apt: any) => {
                  const st = statusLabels[apt.status] || statusLabels.pending
                  return (
                    <div key={apt.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          {apt.title && <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{apt.title}</span>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          📅 {formatDate(apt.start_at)} · 🕐 {formatTime(apt.start_at)}
                          {apt.end_at && ` — ${formatTime(apt.end_at)}`}
                        </p>
                        {apt.metadata?.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">📝 {apt.metadata.notes}</p>
                        )}
                      </div>
                      {['pending', 'confirmed'].includes(apt.status) && (
                        <CancelAppointmentButton appointmentId={apt.id} primaryColor={primaryColor} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Historial */}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Historial</h2>
              <div className="space-y-2">
                {past.map((apt: any) => {
                  const st = statusLabels[apt.status] || { label: apt.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={apt.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-3 opacity-75">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(apt.start_at)} · {formatTime(apt.start_at)}
                      </span>
                      {apt.title && <span className="text-sm text-gray-500 dark:text-gray-400 truncate">— {apt.title}</span>}
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
