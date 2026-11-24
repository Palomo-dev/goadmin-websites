import { getOrgContext } from '@/lib/get-org-context'
import { isValidUUID } from '@/lib/utils'
import { getTripById } from '@/lib/supabase/queries'
import { createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { colorCabeceraDe } from '@/lib/navegacion/coloresVolver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { TripDetailClient } from './TripDetailClient'
import { Metadata } from 'next'
import Link from '@/components/site/Enlace'

export const dynamic = 'force-dynamic'

async function getAvailableGateways(organizationId: number) {
  const supabase = createPublicClient()
  const { data, error } = await (supabase as any)
    .from('integration_connections')
    .select(`id, environment, status, connector_id, integration_connectors!inner (code, name)`)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('integration_connectors.code', ['wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout'])

  if (error || !data) return []
  return data.map((conn: any) => ({
    code: conn.integration_connectors.code,
    name: conn.integration_connectors.name,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Detalle de Viaje' }
  const { id } = await params
  const trip = await getTripById(id, ctx.organization.id)
  const title = trip ? `Viaje ${trip.trip_code}` : 'Viaje no encontrado'
  return { title: `${title} | ${ctx.organization.name}` }
}

export default async function ViajeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  if (!isValidUUID(id)) return <NotFoundPage />
  const sp = await searchParams
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  const [trip, gateways] = await Promise.all([
    getTripById(id, organization.id),
    getAvailableGateways(organization.id),
  ])

  if (!trip) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">🚌</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Viaje no encontrado</h1>
            <Link href="/viajes" className="text-sm hover:underline" style={{ color: primaryColor }}>Buscar viajes</Link>
          </div>
        </div>
      </OrganizationLayout>
    )
  }

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <BarraVolverMovil
        padre={{ href: '/viajes', etiqueta: 'Viajes' }}
        primaryColor={primaryColor}
        colorCabecera={colorCabeceraDe(organization.website_settings)}
      />
      <div className="container mx-auto px-4 py-8">
        {/* «Volver» (Figma 2992:74856): ← al inicio de las migas en escritorio; en el celular, la barra. */}
        <EncabezadoPagina tipo="ficha" className="mb-8" migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Viajes', href: '/viajes' }, { etiqueta: 'Viaje' }]} padre={{ href: '/viajes', etiqueta: 'Viajes' }} primaryColor={primaryColor} />

        <TripDetailClient
          trip={trip}
          gateways={gateways}
          primaryColor={primaryColor}
          organizationId={organization.id}
          originCity={sp.origin || ''}
          destinationCity={sp.destination || ''}
        />
      </div>
    </OrganizationLayout>
  )
}
