import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerParkingSessions } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Historial' }
  return { title: `Historial de Sesiones | ${ctx.organization.name}` }
}

export default async function HistorialPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization } = ctx
  const customer = await getAuthCustomer(organization.id)
  const sessions = customer ? await getCustomerParkingSessions(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial de Sesiones</h1>
        <p className="text-gray-500">Registro de entradas y salidas del parqueadero</p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📋</p>
          <h3 className="font-semibold text-lg mb-1">Sin sesiones registradas</h3>
          <p className="text-gray-500">Tu historial de estacionamiento aparecerá aquí</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {sessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">🅿️</span>
                <div>
                  <p className="font-medium text-sm">
                    {s.entry_at
                      ? new Date(s.entry_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'Sin fecha'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.entry_at && new Date(s.entry_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    {s.exit_at && ` → ${new Date(s.exit_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
                    {s.vehicle_plate && ` · ${s.vehicle_plate}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {s.amount != null && (
                  <p className="font-bold text-sm">${Number(s.amount).toLocaleString('es-CO')}</p>
                )}
                {s.duration_min != null && <p className="text-xs text-gray-400">{s.duration_min} min</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
