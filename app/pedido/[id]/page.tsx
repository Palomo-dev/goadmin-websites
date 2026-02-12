import { headers } from 'next/headers'
import { Metadata } from 'next'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { getWebsiteHeaderNav, getWebsiteFooterNav, getMetaPixelId } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { OrderTracker } from './OrderTracker'

export const dynamic = 'force-dynamic'

async function getOrg() {
  const h = await headers()
  const identifier = h.get('x-custom-domain') || h.get('x-subdomain')
  if (!identifier) return null
  return getOrganizationByHost(identifier)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const org = await getOrg()
  const { id } = await params
  return {
    title: org ? `Pedido ${id} | ${org.name}` : `Pedido ${id}`,
  }
}

export default async function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg()
  if (!org) return <NotFoundPage />

  const { id } = await params
  const primaryColor = org.website_settings?.primary_color || org.primary_color || '#8B6914'
  const templateId = org.website_settings?.template_id || 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(org.type_id)

  const [headerNav, footerNav, metaPixelId] = await Promise.all([
    getWebsiteHeaderNav(org.id),
    getWebsiteFooterNav(org.id),
    getMetaPixelId(org.id),
  ])

  return (
    <OrganizationLayout
      organization={org}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      metaPixelId={metaPixelId}
    >
      <OrderTracker orderIdentifier={id} primaryColor={primaryColor} />
    </OrganizationLayout>
  )
}
