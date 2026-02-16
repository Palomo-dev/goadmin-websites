import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerTickets } from '@/lib/supabase/queries'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Tickets' }
  return { title: `Mis Tickets | ${ctx.organization.name}` }
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; label: string; cls: string }> = {
    confirmed: { icon: CheckCircle, label: 'Confirmado', cls: 'bg-green-100 text-green-700' },
    pending: { icon: Clock, label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
    cancelled: { icon: XCircle, label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
    used: { icon: CheckCircle, label: 'Usado', cls: 'bg-blue-100 text-blue-700' },
    refunded: { icon: XCircle, label: 'Reembolsado', cls: 'bg-gray-100 text-gray-600' },
  }
  const c = config[status] || config.pending
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  )
}

export default async function TicketsPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization } = ctx
  const customer = await getAuthCustomer(organization.id)

  const tickets = customer?.email
    ? await getCustomerTickets(customer.email, organization.id)
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Tickets</h1>
          <p className="text-gray-500">Pasajes y tickets de viaje</p>
        </div>
        <Link
          href="/viajes"
          className="text-sm font-medium hover:underline"
          style={{ color: ctx.primaryColor }}
        >
          Comprar pasaje
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">🎫</p>
          <h3 className="font-semibold text-lg mb-1">No tienes tickets</h3>
          <p className="text-gray-500 text-sm">Compra un pasaje para ver tus tickets aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const trip = ticket.trips
            const route = trip?.transport_routes
            const tripDate = trip?.trip_date
              ? new Date(trip.trip_date).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })
              : ''
            const departureTime = trip?.scheduled_departure
              ? new Date(trip.scheduled_departure).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
              : ''

            return (
              <Link
                key={ticket.id}
                href={`/ticket/${ticket.ticket_number}`}
                className="block bg-white rounded-xl border hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium text-gray-700">{ticket.ticket_number}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {route?.name || trip?.trip_code || 'Viaje'}
                      {ticket.seat_number && <span className="ml-2 text-gray-400">Asiento {ticket.seat_number}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {tripDate} {departureTime && `• ${departureTime}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold" style={{ color: ctx.primaryColor }}>
                      ${Number(ticket.total || ticket.fare || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">{ticket.currency || 'COP'}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-300 shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
