import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { PaseCheckoutClient } from './PaseCheckoutClient'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getPassType(passTypeId: string, organizationId: number) {
  const supabase = createPublicClient()
  const { data, error } = await (supabase as any)
    .from('parking_pass_types')
    .select('id, name, description, duration_days, price, max_entries_per_day, includes_car_wash, includes_valet, allowed_vehicle_types, is_active')
    .eq('id', passTypeId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data
}

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
  if (!ctx) return { title: 'Comprar Pase' }
  const { id } = await params
  const passType = await getPassType(id, ctx.organization.id)
  const title = passType ? `${passType.name}` : 'Pase no encontrado'
  return {
    title: `${title} | ${ctx.organization.name}`,
    description: passType?.description || `Compra tu pase de estacionamiento en ${ctx.organization.name}`,
  }
}

export default async function PaseCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  const [passType, gateways] = await Promise.all([
    getPassType(id, organization.id),
    getAvailableGateways(organization.id),
  ])

  if (!passType) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl mb-4">🅿️</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Plan no encontrado</h1>
            <p className="text-gray-500 mb-4">Este plan no está disponible o no existe.</p>
            <Link href="/pases" className="text-sm hover:underline" style={{ color: primaryColor }}>
              Ver planes disponibles
            </Link>
          </div>
        </div>
      </OrganizationLayout>
    )
  }

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/pases" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a planes
          </Link>
        </div>

        <PaseCheckoutClient
          passType={passType}
          gateways={gateways}
          primaryColor={primaryColor}
          organizationId={organization.id}
          organizationName={organization.name}
        />
      </div>
    </OrganizationLayout>
  )
}
