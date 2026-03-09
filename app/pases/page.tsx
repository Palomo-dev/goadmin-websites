import { getOrgContext } from '@/lib/get-org-context'
import { getParkingPassTypes, getParkingRates, getParkingZones, getParkingAvailability } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { PasesClient } from './PasesClient'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Pases de Estacionamiento' }
  return {
    title: `Pases de Estacionamiento | ${ctx.organization.name}`,
    description: `Compra tu pase de estacionamiento en ${ctx.organization.name}. Planes flexibles con los mejores beneficios.`,
  }
}

export default async function PasesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  const [passTypes, rates, zones, availability] = await Promise.all([
    getParkingPassTypes(organization.id),
    getParkingRates(organization.id),
    getParkingZones(organization.id),
    getParkingAvailability(organization.id),
  ])

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
    >
      <PasesClient
        organizationName={organization.name}
        primaryColor={primaryColor}
        passTypes={passTypes}
        rates={rates}
        zones={availability.length > 0 ? availability : zones}
      />
    </OrganizationLayout>
  )
}
