import { headers } from 'next/headers'
import {
  getOrganizationByHost,
  getWebsiteHeaderNav,
  getWebsiteFooterNav
} from '@/lib/supabase/queries'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'

export async function getOrgContext() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain

  if (!identifier) return null

  const organization = await getOrganizationByHost(identifier)
  if (!organization) return null

  const primaryColor = organization.website_settings?.primary_color || organization.primary_color || '#3B82F6'
  const templateId = organization.website_settings?.template_id || 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(organization.type_id)

  const [headerNav, footerNav] = await Promise.all([
    getWebsiteHeaderNav(organization.id),
    getWebsiteFooterNav(organization.id)
  ])

  return { organization, primaryColor, template, headerNav, footerNav }
}
