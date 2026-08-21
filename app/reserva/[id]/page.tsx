import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { Bed, CalendarDays, CheckCircle2, Clock, XCircle, ArrowLeft, Users, CreditCard } from 'lucide-react'
import { CancelReservationButton } from './CancelReservationButton'

export const dynamic = 'force-dynamic'

async function getReservation(reservationId: string) {
  const supabase = createPublicClient()

  const { data: reservation, error } = await (supabase as any)
    .from('reservations')
    .select(`
      id, organization_id, status, checkin, checkout, occupant_count,
      total_estimated, notes, channel, metadata, created_at, updated_at,
      space_type_id, space_id,
      space_types ( name, short_name ),
      customers ( first_name, last_name, email, phone )
    `)
    .eq('id', reservationId)
    .single()

  if (error || !reservation) return null
  return reservation
}

async function getReservationFolio(reservationId: string) {
  const supabase = createPublicClient()

  const { data: folio } = await (supabase as any)
    .from('folios')
    .select(`
      id, status, total, balance,
      folio_items ( id, description, amount, item_type, quantity )
    `)
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return folio || null
}

async function getReservationPayments(reservationId: string) {
  const supabase = createPublicClient()

  const { data: payments } = await (supabase as any)
    .from('payments')
    .select('id, method, amount, currency, status, created_at')
    .eq('source', 'reservation')
    .eq('source_id', reservationId)
    .order('created_at', { ascending: false })

  return payments || []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!ctx) return { title: `Reserva ${id.substring(0, 8).toUpperCase()}` }
  return {
    title: `Reserva ${id.substring(0, 8).toUpperCase()} | ${ctx.organization.name}`,
  }
}

const RESERVATION_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  tentative: { label: 'Pendiente de pago', color: 'text-yellow-600', icon: <Clock className="h-5 w-5" /> },
  confirmed: { label: 'Confirmada', color: 'text-green-600', icon: <CheckCircle2 className="h-5 w-5" /> },
  checked_in: { label: 'Check-in realizado', color: 'text-blue-600', icon: <Bed className="h-5 w-5" /> },
  checked_out: { label: 'Check-out completado', color: 'text-gray-600', icon: <CheckCircle2 className="h-5 w-5" /> },
  no_show: { label: 'No se presentó', color: 'text-orange-600', icon: <XCircle className="h-5 w-5" /> },
  cancelled: { label: 'Cancelada', color: 'text-red-600', icon: <XCircle className="h-5 w-5" /> },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Fallido', color: 'bg-red-100 text-red-800' },
  refunded: { label: 'Reembolsado', color: 'bg-blue-100 text-blue-800' },
}

export default async function ReservationTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  const reservation = await getReservation(id)

  if (!reservation) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
        <div className="container mx-auto px-4 py-20 text-center">
          <Bed className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reserva no encontrada</h1>
          <p className="text-gray-500 mb-8">
            No pudimos encontrar la reserva <strong>{id.substring(0, 8).toUpperCase()}</strong>.
          </p>
          <Link href="/" className="inline-block px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: primaryColor }}>
            Volver al inicio
          </Link>
        </div>
      </OrganizationLayout>
    )
  }

  const [folio, payments] = await Promise.all([
    getReservationFolio(id),
    getReservationPayments(id),
  ])

  const status = RESERVATION_STATUS[reservation.status] || RESERVATION_STATUS.tentative
  const spaceTypeName = reservation.space_types?.name || reservation.space_types?.short_name || 'Habitación'
  const customer = reservation.customers
  const customerName = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : null
  const folioItems = folio?.folio_items || []

  const checkinDate = new Date(reservation.checkin + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const checkoutDate = new Date(reservation.checkout + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const createdDate = new Date(reservation.created_at).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const nights = Math.ceil(
    (new Date(reservation.checkout).getTime() - new Date(reservation.checkin).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al inicio
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Reserva {id.substring(0, 8).toUpperCase()}
            </h1>
            <p className="text-sm text-gray-500">{createdDate}</p>
          </div>

          {/* Estado */}
          <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={status.color}>{status.icon}</span>
                <div>
                  <p className="text-sm text-gray-500">Estado de la reserva</p>
                  <p className={`font-semibold ${status.color}`}>{status.label}</p>
                </div>
              </div>
              {payments.length > 0 && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  (PAYMENT_STATUS[payments[0].status] || PAYMENT_STATUS.pending).color
                }`}>
                  {(PAYMENT_STATUS[payments[0].status] || PAYMENT_STATUS.pending).label}
                </span>
              )}
            </div>
          </div>

          {/* Detalle de estancia */}
          <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Detalle de estancia</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Bed className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="font-medium">{spaceTypeName}</span>
                  <span className="text-gray-500 ml-2">• {nights} noche(s)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                <div>
                  <p><span className="text-gray-500">Check-in:</span> {checkinDate}</p>
                  <p><span className="text-gray-500">Check-out:</span> {checkoutDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-gray-400" />
                <span>{reservation.occupant_count} huésped(es)</span>
              </div>
            </div>
          </div>

          {/* Desglose financiero (folio) */}
          {folio && (
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Desglose</h2>
              <div className="space-y-2">
                {folioItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.description}
                      {item.quantity > 1 && ` x${item.quantity}`}
                    </span>
                    <span>${Number(item.amount).toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
              <div className="border-t mt-4 pt-4 space-y-1">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span style={{ color: primaryColor }}>${Number(folio.total || reservation.total_estimated).toLocaleString('es-CO')}</span>
                </div>
                {folio.balance > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Saldo pendiente</span>
                    <span>${Number(folio.balance).toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagos */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Pagos
              </h2>
              <div className="space-y-3">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium capitalize">{p.method || 'Pago'}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('es-CO', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${Number(p.amount).toLocaleString('es-CO')} {p.currency}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        (PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending).color
                      }`}>
                        {(PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending).label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Datos del huésped */}
          {(customerName || customer?.email) && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Información del huésped</h2>
              <div className="space-y-2 text-sm">
                {customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nombre</span>
                    <span>{customerName}</span>
                  </div>
                )}
                {customer?.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer?.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Teléfono</span>
                    <span>{customer.phone}</span>
                  </div>
                )}
                {reservation.notes && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Notas</span>
                    <span className="text-right max-w-[60%]">{reservation.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botón de cancelación (solo si es cancelable) */}
          {['tentative', 'confirmed'].includes(reservation.status) && new Date(reservation.checkin) >= new Date() && (
            <div className="mt-6">
              <CancelReservationButton reservationId={id} primaryColor={primaryColor} />
            </div>
          )}
        </div>
      </div>
    </OrganizationLayout>
  )
}
