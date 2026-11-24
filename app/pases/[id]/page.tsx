import { getOrgContext } from '@/lib/get-org-context'
import { isValidUUID } from '@/lib/utils'
import { createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { colorCabeceraDe } from '@/lib/navegacion/coloresVolver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { PaseCheckoutClient } from './PaseCheckoutClient'
import { Metadata } from 'next'
import Link from '@/components/site/Enlace'

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
  if (!isValidUUID(id)) return <NotFoundPage />
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
      <BarraVolverMovil
        padre={{ href: '/pases', etiqueta: 'Planes' }}
        etiquetaActual={String(passType.name ?? 'Plan')}
        primaryColor={primaryColor}
        colorCabecera={colorCabeceraDe(organization.website_settings)}
      />
      <div className="container mx-auto px-4 py-8">
        {/* «Volver» (Figma 2992:74856): ← al inicio de las migas en escritorio; en el celular, la barra. */}
        <EncabezadoPagina tipo="ficha" className="mb-8" migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Planes', href: '/pases' }, { etiqueta: String(passType.name ?? 'Plan') }]} padre={{ href: '/pases', etiqueta: 'Planes' }} primaryColor={primaryColor} />

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
