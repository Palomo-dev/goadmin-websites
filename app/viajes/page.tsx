import { getOrgContext } from '@/lib/get-org-context'
import { getTransportStops, searchTrips } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { TripSearchClient } from './TripSearchClient'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Viajes' }
  return {
    title: `Buscar Viajes | ${ctx.organization.name}`,
    description: `Busca y compra pasajes en ${ctx.organization.name}`
  }
}

export default async function ViajesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx
  const params = await searchParams
  const origin = params.origin || ''
  const destination = params.destination || ''
  const date = params.date || ''
  const passengers = Number(params.passengers) || 1

  const [stops, initialTrips] = await Promise.all([
    getTransportStops(organization.id),
    origin && destination && date
      ? searchTrips(organization.id, origin, destination, date, passengers)
      : Promise.resolve([]),
  ])

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Buscar Viajes</h1>
        <TripSearchClient
          stops={stops}
          initialTrips={initialTrips}
          primaryColor={primaryColor}
          initialOrigin={origin}
          initialDestination={destination}
          initialDate={date}
          initialPassengers={passengers}
          organizationId={organization.id}
        />
      </div>
    </OrganizationLayout>
  )
}
