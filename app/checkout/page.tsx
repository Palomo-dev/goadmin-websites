import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CheckoutWizard } from '@/components/site/CheckoutWizard'
import { Metadata } from 'next'
import { getMetaPixelId, getGoogleAdsConfig } from '@/lib/supabase/queries'
import { MetaPixelInitiateCheckout } from '@/components/site/MetaPixelEvents'

export const dynamic = 'force-dynamic'

async function getAvailableGateways(organizationId: number) {
  const supabase = createPublicClient()

  const { data, error } = await (supabase as any)
    .from('integration_connections')
    .select(`
      id,
      environment,
      status,
      connector_id,
      integration_connectors!inner (
        code,
        name
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('integration_connectors.code', [
      'wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout'
    ])

  if (error || !data) return []

  return data.map((conn: any) => ({
    code: conn.integration_connectors.code,
    name: conn.integration_connectors.name,
    connectionId: conn.id,
    environment: conn.environment || 'production'
  }))
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Checkout' }
  return {
    title: `Checkout | ${ctx.organization.name}`,
  }
}

export default async function CheckoutPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav } = ctx
  const [gateways, metaPixelId, googleAdsConfig] = await Promise.all([
    getAvailableGateways(organization.id),
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id)
  ])

  // Impuesto: desde organization_taxes (fuente real)
  const supabaseTax = createPublicClient()
  const { data: defaultTax } = await (supabaseTax as any)
    .from('organization_taxes')
    .select('name, rate')
    .eq('organization_id', organization.id)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  // Shipping: desde website_settings (config de UI)
  const ws = organization.website_settings as any
  const checkoutSettings = {
    taxRate: defaultTax ? Number(defaultTax.rate) : 0,
    taxName: defaultTax?.name || 'IVA',
    taxIncluded: ws?.tax_included || false,
    shippingFlatRate: Number(ws?.shipping_flat_rate ?? 10000),
    freeShippingThreshold: Number(ws?.free_shipping_threshold ?? 100000),
    enableShipping: ws?.enable_shipping !== false,
  }

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      metaPixelId={metaPixelId}
      googleAdsConfig={googleAdsConfig}
    >
      {/* Meta Pixel InitiateCheckout */}
      {metaPixelId && <MetaPixelInitiateCheckout />}
      <CheckoutWizard
        organizationId={organization.id}
        primaryColor={primaryColor}
        gateways={gateways}
        checkoutSettings={checkoutSettings}
        isRestaurant={organization.type_id === 1}
      />
    </OrganizationLayout>
  )
}
