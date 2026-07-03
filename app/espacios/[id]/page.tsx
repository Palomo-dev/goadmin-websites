import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { getSpaceById } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { SpaceGallery } from '@/components/site/spaces/SpaceGallery'
import { SpaceInfo } from '@/components/site/spaces/SpaceInfo'
import { SpaceServices } from '@/components/site/spaces/SpaceServices'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SpaceBookingForm } from './SpaceBookingForm'
import { AvailabilityCalendar } from '@/components/site/AvailabilityCalendar'

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
  if (!ctx) return { title: 'Espacio' }
  const { id } = await params
  const space = await getSpaceById(id, ctx.organization.id)
  const title = space ? `${space.label} — ${space.space_types?.name || 'Espacio'}` : 'Espacio'
  return { title: `${title} | ${ctx.organization.name}` }
}

export default async function EspacioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  const [space, gateways] = await Promise.all([
    getSpaceById(id, organization.id),
    getAvailableGateways(organization.id),
  ])

  if (!space) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">🏠</p>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Espacio no encontrado</h1>
            <Link href="/espacios" className="text-sm hover:underline" style={{ color: primaryColor }}>Ver todos los espacios</Link>
          </div>
        </div>
      </OrganizationLayout>
    )
  }

  const st = space.space_types as any

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/espacios" className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a espacios
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Columna izquierda: Galería + Info + Servicios */}
          <div>
            <SpaceGallery
              images={space.images}
              label={space.label}
              primaryColor={primaryColor}
            />

            <SpaceInfo
              label={space.label}
              floorZone={space.floor_zone}
              description={space.description}
              spaceType={st}
              primaryColor={primaryColor}
            />

            <SpaceServices
              services={space.services}
              amenities={st?.amenities}
              primaryColor={primaryColor}
            />
          </div>

          {/* Columna derecha: Calendario + Formulario de reserva */}
          <div>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Disponibilidad y precios</h3>
              <AvailabilityCalendar
                organizationId={organization.id}
                spaceId={space.id}
                primaryColor={primaryColor}
              />
            </div>

            <SpaceBookingForm
              organizationId={organization.id}
              spaceId={space.id}
              spaceTypeName={st?.short_name || st?.name || space.label}
              capacity={st?.capacity || 2}
              baseRate={Number(st?.base_rate || 0)}
              primaryColor={primaryColor}
              gateways={gateways}
            />
          </div>
        </div>
      </div>
    </OrganizationLayout>
  )
}
