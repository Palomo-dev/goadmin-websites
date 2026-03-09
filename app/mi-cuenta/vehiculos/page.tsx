import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerVehicles } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Vehículos' }
  return { title: `Mis Vehículos | ${ctx.organization.name}` }
}

export default async function VehiculosPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const vehicles = customer ? await getCustomerVehicles(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Vehículos</h1>
          <p className="text-gray-500">Vehículos registrados</p>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">🚗</p>
          <h3 className="font-semibold text-lg mb-1">No tienes vehículos registrados</h3>
          <p className="text-gray-500">Registra tu vehículo para usar tu pase</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v: any) => (
            <div key={v.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚗</span>
                <div>
                  <p className="font-semibold text-sm">
                    {v.plate || 'Sin placa'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[v.brand, v.model, v.color].filter(Boolean).join(' · ') || 'Sin detalles'}
                  </p>
                  {v.vehicle_type && <p className="text-xs text-gray-400">{v.vehicle_type}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
