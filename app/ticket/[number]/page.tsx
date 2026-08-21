import { getOrgContext } from '@/lib/get-org-context'
import { getTicketByNumber } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Clock, XCircle, MapPin, Calendar, Bus, Hash, CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  const { number } = await params
  if (!ctx) return { title: `Boleto ${number}` }
  return { title: `Boleto ${number} | ${ctx.organization.name}` }
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; label: string; bg: string; text: string }> = {
    confirmed: { icon: CheckCircle, label: 'Confirmado', bg: 'bg-green-100', text: 'text-green-700' },
    pending: { icon: Clock, label: 'Pendiente de pago', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    cancelled: { icon: XCircle, label: 'Cancelado', bg: 'bg-red-100', text: 'text-red-700' },
    refunded: { icon: XCircle, label: 'Reembolsado', bg: 'bg-gray-100', text: 'text-gray-700' },
    used: { icon: CheckCircle, label: 'Utilizado', bg: 'bg-blue-100', text: 'text-blue-700' },
  }
  const c = config[status] || config.pending
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.bg} ${c.text}`}>
      <Icon className="h-4 w-4" />
      {c.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export default async function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { number } = await params
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  const ticket = await getTicketByNumber(number)

  if (!ticket) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">🎫</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Boleto no encontrado</h1>
            <p className="text-gray-500 mb-4 text-sm">No se encontró un boleto con el número {number}</p>
            <Link href="/viajes" className="text-sm hover:underline" style={{ color: primaryColor }}>Buscar viajes</Link>
          </div>
        </div>
      </OrganizationLayout>
    )
  }

  const trip = ticket.trips as any
  const route = trip?.transport_routes
  const vehicle = trip?.vehicles
  const orgName = trip?.organizations?.name || organization.name
  const boarding = ticket.boardingStop
  const alighting = ticket.alightingStop

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/viajes" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Buscar viajes
          </Link>
        </div>

        {/* Boleto digital */}
        <div className="bg-white rounded-2xl border-2 overflow-hidden shadow-lg" style={{ borderColor: primaryColor }}>
          {/* Header */}
          <div className="p-6 text-white text-center" style={{ backgroundColor: primaryColor }}>
            <h1 className="text-2xl font-bold mb-1">Boleto Digital</h1>
            <p className="text-white/80 text-sm">{orgName}</p>
          </div>

          {/* Status */}
          <div className="px-6 pt-4 flex justify-between items-center">
            <span className="text-sm text-gray-500 font-mono">{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
          </div>

          {/* Ruta */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-center flex-1">
                <div className="text-xl font-bold text-gray-900">{boarding?.city || 'Origen'}</div>
                <div className="text-sm text-gray-500">{boarding?.name || ''}</div>
              </div>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className="text-xs text-gray-400">{route?.estimated_duration_minutes ? `${Math.floor(route.estimated_duration_minutes / 60)}h ${route.estimated_duration_minutes % 60}min` : ''}</div>
                <div className="w-16 border-t-2 border-dashed" style={{ borderColor: primaryColor }} />
                <div className="text-lg">🚌</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-xl font-bold text-gray-900">{alighting?.city || 'Destino'}</div>
                <div className="text-sm text-gray-500">{alighting?.name || ''}</div>
              </div>
            </div>
          </div>

          {/* Detalles */}
          <div className="px-6 pb-4 grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="text-sm font-medium">{formatDate(trip?.trip_date)}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Hora de salida</div>
                <div className="text-sm font-medium">{formatTime(trip?.scheduled_departure)}</div>
              </div>
            </div>
            {ticket.seat_number && (
              <div className="flex items-start gap-2">
                <Hash className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Asiento</div>
                  <div className="text-sm font-medium">{ticket.seat_number}</div>
                </div>
              </div>
            )}
            {vehicle && (
              <div className="flex items-start gap-2">
                <Bus className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Vehículo</div>
                  <div className="text-sm font-medium">{vehicle.brand} {vehicle.model}</div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Ruta</div>
                <div className="text-sm font-medium">{route?.name || trip?.trip_code}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Total pagado</div>
                <div className="text-sm font-bold" style={{ color: primaryColor }}>
                  ${Number(ticket.total || ticket.fare || 0).toLocaleString('es-CO')} {ticket.currency || 'COP'}
                </div>
              </div>
            </div>
          </div>

          {/* Pasajero */}
          <div className="mx-6 border-t pt-4 pb-4">
            <div className="text-xs text-gray-500 mb-1">Pasajero</div>
            <div className="font-semibold">{ticket.passenger_name}</div>
            {ticket.passenger_doc_type && ticket.passenger_doc_number && (
              <div className="text-sm text-gray-500">{ticket.passenger_doc_type} {ticket.passenger_doc_number}</div>
            )}
          </div>

          {/* Código check-in */}
          {ticket.checkin_code && ticket.status === 'confirmed' && (
            <div className="mx-6 border-t pt-5 pb-5 text-center">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Código de Check-in</div>
              <div
                className="text-4xl font-bold tracking-[0.3em] font-mono py-3 px-4 rounded-xl"
                style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
              >
                {ticket.checkin_code}
              </div>
              <p className="text-xs text-gray-400 mt-2">Presenta este código al abordar el vehículo</p>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 text-center border-t">
            <p className="text-xs text-gray-400">
              Boleto generado el {new Date(ticket.created_at).toLocaleDateString('es-CO')} — {orgName}
            </p>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  )
}
