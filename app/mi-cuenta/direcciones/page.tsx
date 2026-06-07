import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getCustomerAddresses } from '@/lib/queries/customer-portal'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import { DireccionesClient } from './DireccionesClient'

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
    <DireccionesClient
      addresses={addresses}
      organizationId={organization.id}
      primaryColor={primaryColor}
    />
  )
}
