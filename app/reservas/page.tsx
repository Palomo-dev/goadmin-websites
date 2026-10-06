import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { getOrganizationSpaceTypes } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ReservationWizard } from './ReservationWizard'
import { redirect } from 'next/navigation'
import { getPaginasPublicas, rutaDePaginaCon } from '@/lib/seo/paginasPublicas'
import { conPrefijo } from '@/lib/outlet/rutaSitio'

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

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Reservar' }
  return {
    title: `Reservar | ${ctx.organization.name}`,
    description: `Realiza tu reserva en ${ctx.organization.name}`
  }
}

export default async function ReservasPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  // Restaurante: /reservas (y /<sede>/reservas) es el asistente de espacios de hotel. La reserva
  // de mesa vive en la página con la sección de reserva: se lleva allí, con la sede.
  if (organization.type_id === 1 && !frozenReason) {
    const paginas = await getPaginasPublicas(organization.id, ctx.branchId ?? null)
    const destino = rutaDePaginaCon(paginas, ['reservation', 'reservation_cta'])
    if (destino && destino !== '/reservas') redirect(conPrefijo(destino, ctx.prefijoSede))
  } else {
    // Otras verticales: el asistente de siempre.
  }
  const [spaceTypes, gateways] = await Promise.all([
    getOrganizationSpaceTypes(organization.id),
    getAvailableGateways(organization.id)
  ])

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link href="/espacios" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a espacios
          </Link>
        </div>

        <ReservationWizard
          organizationId={organization.id}
          organizationName={organization.name}
          spaceTypes={spaceTypes.map((st: any) => ({
            id: st.id,
            name: st.name,
            short_name: st.short_name,
            base_rate: Number(st.base_rate),
            capacity: st.capacity,
            area_sqm: st.area_sqm,
            amenities: st.amenities
          }))}
          primaryColor={primaryColor}
          gateways={gateways}
        />
      </main>
    </OrganizationLayout>
  )
}
