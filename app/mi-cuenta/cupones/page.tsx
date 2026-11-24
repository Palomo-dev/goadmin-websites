import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerCoupons } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { PestanasCuenta } from '@/components/site/cuenta/PestanasCuenta'
import { EstadoVacioCuenta } from '@/components/site/cuenta/EstadoVacioCuenta'
import { Ticket } from 'lucide-react'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Cupones' }
  return { title: `Mis Cupones | ${ctx.organization.name}` }
}

export default async function CuponesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)
  const coupons = customer ? await getCustomerCoupons(customer.id, organization.id) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Cupones</h1>
        <p className="text-gray-500">Cupones disponibles y utilizados</p>
      </div>
      <PestanasCuenta />

      {coupons.length === 0 ? (
        <EstadoVacioCuenta
          icono={Ticket}
          titulo="No tienes cupones por ahora"
          texto="Cuando la tienda te regale uno, aparecerá aquí con su fecha de vencimiento."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coupons.map((c: any) => {
            const isExpired = c.end_date && new Date(c.end_date) < new Date()
            const discountLabel = c.discount_type === 'percentage'
              ? `${c.discount_value}% OFF`
              : `$${Number(c.discount_value || 0).toLocaleString('es-CO')} OFF`

            return (
              <div
                key={c.id}
                className={`rounded-xl border-2 border-dashed p-5 relative ${isExpired ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                style={{ borderColor: isExpired ? '#D1D5DB' : primaryColor }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl font-black" style={{ color: isExpired ? '#9CA3AF' : primaryColor }}>
                    {discountLabel}
                  </span>
                  {isExpired && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Expirado</span>
                  )}
                </div>
                <p className="font-semibold text-sm">{c.name || c.code}</p>
                <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">{c.code}</p>
                <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                  {c.min_purchase_amount && (
                    <p>Compra mín: ${Number(c.min_purchase_amount).toLocaleString('es-CO')}</p>
                  )}
                  {c.end_date && (
                    <p>Válido hasta: {new Date(c.end_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
