import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerMembership } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { MembershipQR } from '@/components/site/sections/gym/MembershipQR'
import { FreezeRequestForm } from '@/components/site/sections/gym/FreezeRequestForm'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Membresía' }
  return { title: `Mi Membresía | ${ctx.organization.name}` }
}

// Estados que acepta la base (memberships_status_check) y cómo se muestran.
const ESTADOS: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Activa', bg: '#DCFCE7', color: '#166534' },
  frozen: { label: 'Congelada', bg: '#DBEAFE', color: '#1E40AF' },
  pending: { label: 'Pendiente de pago', bg: '#FEF3C7', color: '#92400E' },
  past_due: { label: 'En período de gracia', bg: '#FEF3C7', color: '#92400E' },
  expired: { label: 'Vencida', bg: '#FEE2E2', color: '#991B1B' },
  cancelled: { label: 'Cancelada', bg: '#F3F4F6', color: '#374151' },
}

function getDaysUntilExpiry(endDate: string): number {
  const end = new Date(endDate)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function MembresiaPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  // Las fechas de memberships son timestamptz: se pintan en la zona de la organización (un
  // vencimiento a las 23:59:59 de Bogotá es el día siguiente en UTC, la zona del servidor).
  const timeZone = (organization as { timezone?: string | null }).timezone || 'America/Bogota'
  const formatFecha = (valor: string) =>
    new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone })
  const customer = await getAuthCustomer(organization.id)
  const membership = customer ? await getCustomerMembership(customer.id, organization.id) : null

  const daysLeft = membership?.end_date ? getDaysUntilExpiry(membership.end_date) : null
  const showRenewalAlert = daysLeft !== null && daysLeft <= 7 && daysLeft > 0
  const enGracia = membership?.status === 'past_due'
  const isExpired = membership?.status === 'expired' || (!enGracia && membership?.status !== 'cancelled' && daysLeft !== null && daysLeft <= 0)
  const estado = membership ? (ESTADOS[membership.status] ?? { label: membership.status, bg: '#FEF3C7', color: '#92400E' }) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Membresía</h1>
        <p className="text-gray-500">Estado de tu plan activo</p>
      </div>

      {!membership ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">💪</p>
          <h3 className="font-semibold text-lg mb-1">Sin membresía activa</h3>
          <p className="text-gray-500 mb-4">Adquiere un plan para acceder al gimnasio</p>
          <Link
            href="/membresias"
            className="inline-block px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Ver planes
          </Link>
        </div>
      ) : (
        <>
          {/* Alerta de vencimiento próximo */}
          {showRenewalAlert && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm">Tu membresía vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}</p>
                <p className="text-amber-700 text-xs mt-0.5">Renueva ahora para no perder acceso al gimnasio</p>
              </div>
              <Link
                href={`/membresias?renew=${membership.membership_plan_id}`}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                Renovar
              </Link>
            </div>
          )}

          {/* En período de gracia: vencida, pero todavía entra (regla del plan) */}
          {enGracia && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">⏳</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm">Tu membresía venció y está en período de gracia</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  {membership.grace_until ? `Puedes seguir entrando hasta el ${formatFecha(membership.grace_until)}. ` : ''}Renueva para no perder el acceso.
                </p>
              </div>
              <Link
                href={`/membresias?renew=${membership.membership_plan_id}`}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                Renovar
              </Link>
            </div>
          )}

          {/* Alerta expirada */}
          {isExpired && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">❌</span>
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm">Tu membresía ha expirado</p>
                <p className="text-red-700 text-xs mt-0.5">Renueva para volver a acceder al gimnasio y reservar clases</p>
              </div>
              <Link
                href={`/membresias?renew=${membership.membership_plan_id}`}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                Renovar
              </Link>
            </div>
          )}

          {/* Card principal */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: `${primaryColor}15` }}>
                💪
              </div>
              <div>
                <p className="font-bold text-lg">{membership.plan_name || 'Membresía'}</p>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: estado?.bg, color: estado?.color }}
                >
                  {estado?.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              {membership.start_date && (
                <div>
                  <p className="text-gray-500">Inicio</p>
                  <p className="font-medium">{formatFecha(membership.start_date)}</p>
                </div>
              )}
              {membership.end_date && (
                <div>
                  <p className="text-gray-500">Vencimiento</p>
                  <p className="font-medium">{formatFecha(membership.end_date)}</p>
                </div>
              )}
              {daysLeft !== null && daysLeft > 0 && (
                <div>
                  <p className="text-gray-500">Días restantes</p>
                  <p className="font-medium">{daysLeft} día{daysLeft !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>

            {/* QR de acceso */}
            {membership.access_code && (membership.status === 'active' || membership.status === 'past_due') && (
              <MembershipQR
                accessCode={membership.access_code}
                memberName={customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}`.trim() : undefined}
                primaryColor={primaryColor}
              />
            )}

            {/* Congelamiento: solo si el plan lo permite. Hoy lo hace el staff (ver FreezeRequestForm). */}
            {membership.status === 'active' && membership.freeze_allowed && customer && (
              <div className="mt-4">
                <FreezeRequestForm organizationName={organization.name} />
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/mi-cuenta/checkins"
              className="bg-white rounded-xl border p-4 hover:bg-gray-50 transition-colors text-center"
            >
              <span className="text-2xl block mb-1">✅</span>
              <p className="text-sm font-medium">Mis Check-ins</p>
            </Link>
            <Link
              href="/mi-cuenta/clases"
              className="bg-white rounded-xl border p-4 hover:bg-gray-50 transition-colors text-center"
            >
              <span className="text-2xl block mb-1">📅</span>
              <p className="text-sm font-medium">Mis Clases</p>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
