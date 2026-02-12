import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerParkingPasses } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Pases' }
  return { title: `Mis Pases | ${ctx.organization.name}` }
}

export default async function PasesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const passes = customer ? await getCustomerParkingPasses(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Pases</h1>
        <p className="text-gray-500">Abonos y pases de estacionamiento</p>
      </div>

      {passes.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">🎫</p>
          <h3 className="font-semibold text-lg mb-1">No tienes pases activos</h3>
          <p className="text-gray-500 mb-4">Adquiere un pase mensual para estacionar</p>
          <Link
            href="/tarifas"
            className="inline-block px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Ver tarifas
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {passes.map((pass: any) => {
            const isActive = pass.status === 'active'
            return (
              <div key={pass.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎫</span>
                    <div>
                      <p className="font-semibold text-sm">{pass.plan_name || 'Pase de estacionamiento'}</p>
                      <p className="text-xs text-gray-500">
                        {pass.start_date && new Date(pass.start_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        {pass.end_date && ` → ${new Date(pass.end_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? '#DCFCE7' : '#FEF3C7',
                      color: isActive ? '#166534' : '#92400E',
                    }}
                  >
                    {isActive ? 'Activo' : pass.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
