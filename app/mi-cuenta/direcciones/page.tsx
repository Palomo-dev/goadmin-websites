import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerAddresses } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Direcciones' }
  return { title: `Mis Direcciones | ${ctx.organization.name}` }
}

export default async function DireccionesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const addresses = customer ? await getCustomerAddresses(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Direcciones</h1>
          <p className="text-gray-500">Gestiona tus direcciones de entrega</p>
        </div>
      </div>

      {addresses.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">📍</p>
          <h3 className="font-semibold text-lg mb-1">No tienes direcciones guardadas</h3>
          <p className="text-gray-500">Agrega una dirección para tus entregas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr: any) => (
            <div key={addr.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">📍</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{addr.label || 'Dirección'}</p>
                      {addr.is_default && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Principal</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{addr.address_line1}</p>
                    {addr.address_line2 && <p className="text-sm text-gray-500">{addr.address_line2}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[addr.city, addr.department].filter(Boolean).join(', ')}
                    </p>
                    {addr.recipient_name && (
                      <p className="text-xs text-gray-400">{addr.recipient_name} · {addr.recipient_phone}</p>
                    )}
                    {addr.delivery_instructions && (
                      <p className="text-xs text-gray-400 italic mt-1">{addr.delivery_instructions}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
