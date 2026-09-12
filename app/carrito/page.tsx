import { getOrgContext } from '@/lib/get-org-context'
import { getMetaPixelId, getGoogleAdsConfig, getOrganizationProducts, getDefaultTax } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CartPageClient } from './CartPageClient'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Carrito' }
  return {
    title: `Carrito de Compras | ${ctx.organization.name}`,
  }
}

export default async function CarritoPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, branchId } = ctx
  const [metaPixelId, googleAdsConfig] = await Promise.all([
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id)
  ])

  // Impuesto default para mostrar estimado (cacheado 300s)
  const defaultTax = await getDefaultTax(organization.id)

  // Shipping config
  const ws = organization.website_settings as any
  const cartSettings = {
    taxRate: defaultTax ? Number(defaultTax.rate) : 0,
    taxName: defaultTax?.name || 'IVA',
    taxIncluded: ws?.tax_included || false,
    shippingFlatRate: Number(ws?.shipping_flat_rate ?? 10000),
    freeShippingThreshold: Number(ws?.free_shipping_threshold ?? 100000),
    enableShipping: ws?.enable_shipping !== false,
  }

  // Productos sugeridos (últimos 8 para "Te puede interesar")
  const suggestedProducts = await getOrganizationProducts(organization.id, 8, branchId)

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      metaPixelId={metaPixelId}
      googleAdsConfig={googleAdsConfig}
      frozenReason={frozenReason}
      branchId={branchId}
    >
      <CartPageClient
        primaryColor={primaryColor}
        organizationSubdomain={organization.subdomain || ''}
        organizationId={organization.id}
        cartSettings={cartSettings}
        suggestedProducts={suggestedProducts}
        branchId={branchId}
      />
    </OrganizationLayout>
  )
}
