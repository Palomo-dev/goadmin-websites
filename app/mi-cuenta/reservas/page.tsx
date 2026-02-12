import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerReservations } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Reservas' }
  return { title: `Mis Reservas | ${ctx.organization.name}` }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  tentative: { label: 'Pendiente', color: '#F59E0B' },
  pending: { label: 'Pendiente', color: '#F59E0B' },
  confirmed: { label: 'Confirmada', color: '#3B82F6' },
  active: { label: 'Activa', color: '#10B981' },
  checked_in: { label: 'Check-in', color: '#8B5CF6' },
  checked_out: { label: 'Check-out', color: '#6B7280' },
  completed: { label: 'Completada', color: '#059669' },
  cancelled: { label: 'Cancelada', color: '#EF4444' },
  no_show: { label: 'No asistió', color: '#EF4444' },
}

export default async function ReservasPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const reservations = customer ? await getCustomerReservations(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Reservas</h1>
          <p className="text-gray-500">Historial y reservas activas</p>
        </div>
        <Link
          href="/reservas"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          Nueva reserva
        </Link>
      </div>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📅</p>
          <h3 className="font-semibold text-lg mb-1">No tienes reservas</h3>
          <p className="text-gray-500 mb-4">Cuando realices una reserva, aparecerá aquí</p>
          <Link
            href="/espacios"
            className="inline-block px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Explorar espacios
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r: any) => {
            const st = STATUS_MAP[r.status] || { label: r.status, color: '#6B7280' }
            const spaceTypeName = r.space_types?.name || r.resource_type || ''
            const nights = r.checkin && r.checkout
              ? Math.ceil((new Date(r.checkout).getTime() - new Date(r.checkin).getTime()) / (1000 * 60 * 60 * 24))
              : 0
            return (
              <Link
                key={r.id}
                href={`/reserva/${r.id}`}
                className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-md transition-shadow block"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏨</span>
                  <div>
                    <p className="font-semibold text-sm">
                      {spaceTypeName && <span>{spaceTypeName} · </span>}
                      {r.checkin && r.checkout
                        ? `${new Date(r.checkin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} → ${new Date(r.checkout).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
                        : new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nights > 0 ? `${nights} noche(s)` : ''}
                      {r.occupant_count ? ` · ${r.occupant_count} huésped(es)` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                    {st.label}
                  </span>
                  {r.total_estimated && (
                    <p className="text-sm font-bold">${Number(r.total_estimated).toLocaleString('es-CO')}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
