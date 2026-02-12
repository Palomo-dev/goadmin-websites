import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerClassReservations } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Clases' }
  return { title: `Mis Clases | ${ctx.organization.name}` }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  booked: { label: 'Reservada', color: 'bg-blue-100 text-blue-800' },
  checked_in: { label: 'Asistió', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_show: { label: 'No asistió', color: 'bg-gray-100 text-gray-600' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default async function ClasesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const reservations = customer ? await getCustomerClassReservations(customer.id, organization.id) : []

  const now = new Date()
  const upcoming = reservations.filter((r: any) => r.status === 'booked' && new Date(r.gym_classes?.start_at) > now)
  const past = reservations.filter((r: any) => r.status !== 'booked' || new Date(r.gym_classes?.start_at) <= now)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Clases</h1>
          <p className="text-gray-500">Reservaciones de clases grupales</p>
        </div>
        <Link
          href="/clases"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          Ver horario
        </Link>
      </div>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📅</p>
          <h3 className="font-semibold text-lg mb-1">No tienes clases reservadas</h3>
          <p className="text-gray-500 mb-4">Explora el horario y reserva tu primera clase</p>
          <Link
            href="/clases"
            className="inline-block px-6 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            Ver clases disponibles
          </Link>
        </div>
      ) : (
        <>
          {/* Próximas */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Próximas clases</h2>
              <div className="bg-white rounded-xl border divide-y">
                {upcoming.map((res: any) => {
                  const cls = res.gym_classes
                  const instructor = cls?.profiles
                  const instructorName = instructor ? `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() : ''
                  const st = statusLabels[res.status] || statusLabels.booked

                  return (
                    <div key={res.id} className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: primaryColor }}>
                          {cls ? formatDate(cls.start_at).split(' ').slice(1).join(' ') : '—'}
                        </div>
                        <div>
                          <p className="font-medium">{cls?.title || 'Clase'}</p>
                          <p className="text-xs text-gray-500">
                            {cls ? `${formatTime(cls.start_at)} - ${formatTime(cls.end_at)}` : ''}
                            {instructorName && ` · ${instructorName}`}
                            {cls?.room && ` · ${cls.room}`}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${st.color}`}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Historial */}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Historial</h2>
              <div className="bg-white rounded-xl border divide-y">
                {past.map((res: any) => {
                  const cls = res.gym_classes
                  const st = statusLabels[res.status] || { label: res.status, color: 'bg-gray-100 text-gray-600' }

                  return (
                    <div key={res.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{res.status === 'checked_in' ? '✅' : res.status === 'cancelled' ? '❌' : '⏱️'}</span>
                        <div>
                          <p className="font-medium text-sm">{cls?.title || 'Clase'}</p>
                          <p className="text-xs text-gray-500">
                            {cls ? formatDate(cls.start_at) : ''}{cls ? ` · ${formatTime(cls.start_at)}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${st.color}`}>{st.label}</span>
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
