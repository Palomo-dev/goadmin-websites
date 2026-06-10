import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CheckoutWizard } from '@/components/site/CheckoutWizard'
import { Metadata } from 'next'
import { getMetaPixelId, getGoogleAdsConfig } from '@/lib/supabase/queries'
import { MetaPixelInitiateCheckout } from '@/components/site/MetaPixelEvents'

export const dynamic = 'force-dynamic'

async function getWebsitePaymentMethods(organizationId: number) {
  const supabase = createAdminClient() || createPublicClient()

  // 1. Métodos de pago nativos (cash, transfer, card, etc.) habilitados para website
  const { data: orgMethods, error: orgError } = await (supabase as any)
    .from('organization_payment_methods')
    .select(`
      id, payment_method_code, is_active, show_on_website,
      website_display_order, website_display_name, website_description, website_icon,
      integration_connection_id,
      payment_methods (name, requires_reference)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('show_on_website', true)
    .order('website_display_order', { ascending: true, nullsFirst: false })

  const methods = (orgMethods || []).map((m: any) => ({
    code: m.payment_method_code,
    name: m.website_display_name || m.payment_methods?.name || m.payment_method_code,
    description: m.website_description || null,
    icon: m.website_icon || null,
    requiresReference: m.payment_methods?.requires_reference || false,
    connectionId: m.integration_connection_id || null,
    type: m.integration_connection_id ? 'gateway' as const : 'native' as const,
  }))

  // 2. Pasarelas de pago online (integration_connections activas/conectadas)
  // Solo agregar las que NO ya están en organization_payment_methods
  const existingConnectionIds = new Set(methods.filter((m: any) => m.connectionId).map((m: any) => m.connectionId))

  const { data: gateways } = await (supabase as any)
    .from('integration_connections')
    .select(`
      id, environment, status,
      integration_connectors!inner (code, name)
    `)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'connected'])
    .in('integration_connectors.code', [
      'wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout'
    ])

  const gatewayMethods = (gateways || [])
    .filter((conn: any) => !existingConnectionIds.has(conn.id))
    .map((conn: any) => ({
      code: conn.integration_connectors.code,
      name: conn.integration_connectors.name,
      description: null,
      icon: null,
      requiresReference: false,
      connectionId: conn.id,
      type: 'gateway' as const,
    }))

  return [...methods, ...gatewayMethods]
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
  const [paymentMethods, metaPixelId, googleAdsConfig] = await Promise.all([
    getWebsitePaymentMethods(organization.id),
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id)
  ])

  // Impuesto: desde organization_taxes (fuente real)
  const supabaseTax = (createAdminClient() || createPublicClient()) as any
  let defaultTax = null
  // Primero buscar impuesto predeterminado
  const { data: defaultTaxRow } = await supabaseTax
    .from('organization_taxes')
    .select('name, rate, tax_included')
    .eq('organization_id', organization.id)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()
  defaultTax = defaultTaxRow
  // Fallback: si no hay predeterminado, buscar el impuesto activo con mayor tasa (tipo IVA)
  if (!defaultTax) {
    const { data: fallbackTax } = await supabaseTax
      .from('organization_taxes')
      .select('name, rate, tax_included')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .gt('rate', 0)
      .order('rate', { ascending: false })
      .limit(1)
      .single()
    defaultTax = fallbackTax
  }

  // Shipping + delivery: desde tabla website_settings
  const supabaseWs = createAdminClient() || createPublicClient()
  const { data: wsRow } = await (supabaseWs as any)
    .from('website_settings')
    .select('available_delivery_types, shipping_flat_rate, free_shipping_threshold, enable_shipping, tax_included, shipping_flat_rate_title, shipping_flat_rate_description')
    .eq('organization_id', organization.id)
    .single()

  const checkoutSettings = {
    taxRate: defaultTax ? Number(defaultTax.rate) : 0,
    taxName: defaultTax?.name || 'IVA',
    taxIncluded: defaultTax?.tax_included ?? wsRow?.tax_included ?? false,
    shippingFlatRate: Number(wsRow?.shipping_flat_rate ?? 10000),
    freeShippingThreshold: Number(wsRow?.free_shipping_threshold ?? 100000),
    enableShipping: wsRow?.enable_shipping !== false,
    availableDeliveryTypes: wsRow?.available_delivery_types || ['pickup', 'delivery_own', 'delivery_third_party'],
    shippingTitle: wsRow?.shipping_flat_rate_title || 'Envío',
    shippingDescription: wsRow?.shipping_flat_rate_description || '',
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
        paymentMethods={paymentMethods}
        checkoutSettings={checkoutSettings}
        isRestaurant={organization.type_id === 1}
        organizationSubdomain={organization.subdomain || ''}
      />
    </OrganizationLayout>
  )
}
