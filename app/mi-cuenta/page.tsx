import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerDashboardCounts, getCustomerRecentActivity, getCustomerServiceDashboard } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mi Cuenta' }
  return {
    title: `Mi Cuenta | ${ctx.organization.name}`,
    description: `Tu cuenta en ${ctx.organization.name}`
  }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#F59E0B' },
  confirmed: { label: 'Confirmado', color: '#3B82F6' },
  preparing: { label: 'Preparando', color: '#8B5CF6' },
  ready: { label: 'Listo', color: '#10B981' },
  delivered: { label: 'Entregado', color: '#059669' },
  completed: { label: 'Completado', color: '#059669' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
  active: { label: 'Activa', color: '#10B981' },
  checked_in: { label: 'Check-in', color: '#3B82F6' },
  checked_out: { label: 'Check-out', color: '#6B7280' },
  no_show: { label: 'No show', color: '#EF4444' },
}

export default async function MiCuentaDashboard() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor } = ctx
  const typeId = organization.type_id ?? 0
  const customer = await getAuthCustomer(organization.id)

  // Conteos y actividad real (si hay cliente autenticado)
  const counts = customer
    ? await getCustomerDashboardCounts(customer.id, organization.id)
    : { orders: 0, reservations: 0, addresses: 0, coupons: 0, memberships: 0, checkins: 0, tickets: 0, passes: 0, vehicles: 0, sessions: 0 }

  const serviceDash = (customer && typeId === 4)
    ? await getCustomerServiceDashboard(customer.id, organization.id)
    : { upcomingAppointments: 0, pendingInvoices: 0, pendingBalance: 0, totalPaid: 0, openQuotes: 0 }

  const activity = customer
    ? await getCustomerRecentActivity(customer.id, organization.id)
    : []

  const greeting = customer?.first_name ? `Hola, ${customer.first_name}` : 'Bienvenido'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}</h1>
        <p className="text-gray-500 dark:text-gray-400">Tu panel en {organization.name}</p>
      </div>

      {!customer && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-400">
          <Link href="/auth" className="font-medium underline" style={{ color: primaryColor }}>Inicia sesión</Link> para ver tu información personalizada.
        </div>
      )}

      {/* Resumen rápido según tipo de negocio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {typeId === 3 && ( // retail
          <>
            <DashCard icon="📦" label="Pedidos" value={String(counts.orders)} href="/mi-cuenta/pedidos" color={primaryColor} />
            <DashCard icon="📍" label="Direcciones" value={String(counts.addresses)} href="/mi-cuenta/direcciones" color={primaryColor} />
            <DashCard icon="🎟️" label="Cupones" value={String(counts.coupons)} href="/mi-cuenta/cupones" color={primaryColor} />
          </>
        )}
        {typeId === 1 && ( // restaurant
          <>
            <DashCard icon="📦" label="Pedidos" value={String(counts.orders)} href="/mi-cuenta/pedidos" color={primaryColor} />
            <DashCard icon="📅" label="Reservas" value={String(counts.reservations)} href="/mi-cuenta/reservas" color={primaryColor} />
            <DashCard icon="🎟️" label="Cupones" value={String(counts.coupons)} href="/mi-cuenta/cupones" color={primaryColor} />
          </>
        )}
        {typeId === 2 && ( // hotel
          <>
            <DashCard icon="📅" label="Reservas" value={String(counts.reservations)} href="/mi-cuenta/reservas" color={primaryColor} />
          </>
        )}
        {typeId === 5 && ( // gym
          <>
            <DashCard icon="💪" label="Membresía" value={counts.memberships > 0 ? 'Activa' : 'Inactiva'} href="/mi-cuenta/membresia" color={primaryColor} />
            <DashCard icon="📅" label="Clases" value={String(counts.checkins)} href="/mi-cuenta/clases" color={primaryColor} />
            <DashCard icon="✅" label="Check-ins" value={String(counts.checkins)} href="/mi-cuenta/checkins" color={primaryColor} />
          </>
        )}
        {typeId === 6 && ( // transport
          <>
            <DashCard icon="🎫" label="Tickets" value={String(counts.tickets)} href="/mi-cuenta/tickets" color={primaryColor} />
          </>
        )}
        {typeId === 7 && ( // parking
          <>
            <DashCard icon="🎫" label="Pases" value={String(counts.passes)} href="/mi-cuenta/pases" color={primaryColor} />
            <DashCard icon="🚗" label="Vehículos" value={String(counts.vehicles)} href="/mi-cuenta/vehiculos" color={primaryColor} />
            <DashCard icon="📋" label="Sesiones" value={String(counts.sessions)} href="/mi-cuenta/historial" color={primaryColor} />
          </>
        )}
        {typeId === 4 && ( // services
          <>
            <DashCard icon="📅" label="Próximas citas" value={String(serviceDash.upcomingAppointments)} href="/mi-cuenta/citas" color={primaryColor} />
            <DashCard icon="📄" label="Facturas pendientes" value={String(serviceDash.pendingInvoices)} href="/mi-cuenta/facturas" color={primaryColor} />
            <DashCard icon="📋" label="Cotizaciones abiertas" value={String(serviceDash.openQuotes)} href="/mi-cuenta/cotizaciones" color={primaryColor} />
          </>
        )}
      </div>

      {/* Actividad reciente */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Actividad Reciente</h2>
        {activity.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-3xl mb-2">📋</p>
            <p>No hay actividad reciente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activity.map((item: any) => {
              const st = STATUS_LABELS[item.status] || { label: item.status, color: '#6B7280' }
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.type === 'order' ? `/mi-cuenta/pedidos/${item.id}` : `/mi-cuenta/reservas`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.type === 'order' ? '📦' : '📅'}</span>
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                      {st.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(item.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DashCard({ icon, label, value, href, color }: {
  icon: string; label: string; value: string; href: string; color: string
}) {
  return (
    <a href={href} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{label}</p>
    </a>
  )
}
